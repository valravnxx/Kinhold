// Objetos en el suelo (GDD, apartado 7: «lo que se suelta fuera de un contenedor desaparece pasado un tiempo (por
// ejemplo, 1 hora real), salvo dentro de tus tierras. Los troncos y las piedras se quedan como pila»). Lógica pura
// (sin three.js ni navegador): el servidor podrá usarla tal cual.
//
// Cada objeto del suelo es una cosa del inventario (tipo, n y, si es un contenedor, lo que lleve dentro) en un punto
// del mundo, con quién lo soltó y cuándo desaparece. Se cuenta por tiempo transcurrido: se guarda la hora a la que
// desaparece (milisegundos), no un contador que corra solo mientras se juega.
//
// Decisiones provisionales (el GDD no las fija; anotadas en el registro de decisiones y en el diario):
//  - El tiempo es 1 hora real, el ejemplo del GDD.
//  - «Dentro de tus tierras» se mira al soltarlo, en el sitio donde cae, con las tierras del que lo suelta: allí no
//    desaparece nunca. Cualquiera puede cogerlo (el GDD no dice que el suelo de tus tierras esté protegido).
//  - «Troncos y piedras» son los troncos (delgado, largo y corto), la leña, la piedra y el bloque de piedra en bruto:
//    no desaparecen nunca, estén donde estén, y lo que se suelta a menos de 1 m de una pila de lo mismo se suma a ella
//    (la pila no tiene tope).
//  - Lo soltado cae a los pies del que lo suelta. Se coge a 2 m como mucho, como lo que se recoge.
//  - Al coger de una pila sin decir cuánto, se coge lo que quepa (al menos 1); si no cabe ni uno, no se coge nada.
//  - Un contenedor se suelta y se coge con lo que lleve dentro.
import { CATALOGO, pila } from './inventario.js';

export const HORA = 3600 * 1000;
export const DURA_SUELO = HORA;          // lo que tarda en desaparecer lo soltado fuera de tus tierras
export const RADIO_PILA = 1;             // m: lo que cae a menos de esto de una pila de lo mismo, se suma a ella
export const ALCANCE_COGER = 2;          // m
export const DE_PILA = ['tronco_delgado', 'tronco_largo', 'tronco_corto', 'lena', 'piedra', 'bloque_piedra'];
export const esDePila = tipo => DE_PILA.includes(tipo);

const copiar = c => c && JSON.parse(JSON.stringify(c));
const redondo = v => Math.round(v * 100) / 100;

export const VERSION_SUELO = 1;
export class Suelo {
  constructor(cat = CATALOGO) { this.cat = cat; this.objetos = []; this.siguiente = 1; }

  // Lo que hay ahora (sin lo que ya ha desaparecido).
  visibles(ahora) { return this.objetos.filter(o => o.desaparece === null || ahora < o.desaparece); }
  // Quita lo que ya ha desaparecido. Devuelve cuántos quitó.
  limpiar(ahora) { const n = this.objetos.length; this.objetos = this.visibles(ahora); return n - this.objetos.length; }
  porId(id, ahora) { return this.visibles(ahora).find(o => o.id === id) || null; }
  // Los objetos a menos de dist m de (x, z), del más cercano al más lejano.
  cercanos(x, z, ahora, dist = ALCANCE_COGER) {
    return this.visibles(ahora).filter(o => Math.hypot(o.x - x, o.z - z) <= dist)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }

  // Deja una cosa en el suelo en (x, z). enTierras: si ese sitio es de las tierras del autor. Devuelve el objeto.
  dejar(c, x, z, ahora, autor, enTierras) {
    if (esDePila(c.tipo)) {
      const p = this.visibles(ahora).filter(o => o.cosa.tipo === c.tipo && Math.hypot(o.x - x, o.z - z) <= RADIO_PILA)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (p) { p.cosa.n += c.n; return p; }
    }
    const o = { id: 's' + this.siguiente++, cosa: copiar(c), x: redondo(x), z: redondo(z), autor, soltado: ahora,
      desaparece: esDePila(c.tipo) || enTierras ? null : ahora + DURA_SUELO };
    this.objetos.push(o);
    return o;
  }

  // Soltar al suelo lo que hay en la ruta del inventario inv (todo o n unidades), a los pies (x, z).
  soltar(inv, ruta, n, x, z, ahora, autor, enTierras) {
    const r = inv.sacar(ruta, n);
    if (!r.ok) return r;
    const o = this.dejar(r.cosa, x, z, ahora, autor, enTierras);
    return { ok: true, objeto: o.id, cosa: copiar(r.cosa), desaparece: o.desaparece };
  }

  // Lo que cabe de un tipo en todo el inventario (manos y huecos).
  cabe(inv, tipo) {
    const p = pila(tipo, this.cat);
    const rutas = inv.rutasGuardar();
    let t = 0;
    for (const r of rutas) {
      const b = inv.buscar(r);
      if (b.motivo || inv.noCabe(b, { tipo, n: 1 })) continue;
      if (b.cosa && b.cosa.tipo !== tipo) continue;
      t += Math.max(0, p - (b.cosa ? b.cosa.n : 0));
    }
    return t;
  }

  // Coger del suelo el objeto id estando en (x, z): a la ruta a, si se da, o donde quepa. n: cuánto (de una pila).
  coger(inv, id, x, z, ahora, a, n) {
    const o = this.porId(id, ahora);
    if (!o) return { ok: false, motivo: 'Ahí no hay nada que coger.' };
    if (Math.hypot(o.x - x, o.z - z) > ALCANCE_COGER) return { ok: false, motivo: 'Está demasiado lejos.' };
    const c = o.cosa, d = this.cat[c.tipo];
    if (!d) return { ok: false, motivo: 'Objeto desconocido.' };
    if (d.tam === 'E') return { ok: false, motivo: 'Eso es enorme: se arrastra, va en carro o entre varios.' };
    let r, cant;
    if (pila(c.tipo, this.cat) === 1 || c.dentro) {
      // una cosa sola (herramienta, prenda, contenedor con lo que lleve): entera, a la ruta o a la primera que valga
      if (n !== undefined && n !== c.n) return { ok: false, motivo: 'Cantidad no válida.' };
      cant = c.n;
      const rutas = a ? [a] : inv.rutasGuardar();
      r = { ok: false, motivo: 'No te cabe: no tienes sitio libre.' };
      for (const ruta of rutas) {
        if (inv.buscar(ruta).cosa) continue;
        const m = inv.meter(ruta, c);
        if (m.ok) { r = { ok: true, donde: [[ruta, cant]] }; break; }
        if (a) r = m;
      }
    } else {
      if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > c.n)) return { ok: false, motivo: 'Cantidad no válida.' };
      cant = n !== undefined ? n : Math.min(c.n, this.cabe(inv, c.tipo));
      if (cant < 1) return { ok: false, motivo: 'No te cabe: no tienes sitio libre.' };
      r = inv.meterDonde(c.tipo, cant, a); // primero en la ruta a, si se da; lo que no quepa ahí, donde quepa
    }
    if (!r.ok) return r;
    c.n -= cant;
    if (c.n <= 0) this.objetos = this.objetos.filter(x => x !== o);
    return { ok: true, objeto: c.tipo, cantidad: cant, donde: r.donde, queda: Math.max(0, c.n) };
  }

  // Lo que no cupo al cargar un guardado (inv.apartado, «a tus pies») cae al suelo en (x, z).
  dejarApartado(inv, x, z, ahora, autor, enTierras) {
    const n = inv.apartado.length;
    for (const c of inv.apartado) this.dejar(c, x, z, ahora, autor, enTierras);
    inv.apartado = [];
    return n;
  }

  exportar() { return { version: VERSION_SUELO, siguiente: this.siguiente, objetos: this.objetos.map(copiar) }; }
  // Lo guardado se comprueba con el catálogo de ahora: lo desconocido se descarta.
  importar(datos) {
    const d = migrarSuelo(datos);
    this.objetos = []; this.siguiente = 1;
    if (!d) return this;
    for (const o of d.objetos) {
      if (!o || !o.cosa || !this.cat[o.cosa.tipo] || !Number.isFinite(o.x) || !Number.isFinite(o.z)) continue;
      const n = Number.isInteger(o.cosa.n) && o.cosa.n > 0 ? o.cosa.n : 1;
      this.objetos.push({ id: String(o.id), cosa: { ...copiar(o.cosa), n }, x: o.x, z: o.z, autor: String(o.autor || ''),
        soltado: Number.isFinite(o.soltado) ? o.soltado : 0, desaparece: Number.isFinite(o.desaparece) ? o.desaparece : null });
    }
    const max = Math.max(0, ...this.objetos.map(o => Number(String(o.id).slice(1)) || 0));
    this.siguiente = Math.max(Number.isInteger(d.siguiente) ? d.siguiente : 1, max + 1);
    return this;
  }
}

// Paso de formatos antiguos al de ahora: MIGRACIONES_SUELO[v] pasa de v a v+1. Lo que no se entiende, se descarta.
export const MIGRACIONES_SUELO = {};
export function migrarSuelo(datos) {
  if (!datos || typeof datos !== 'object' || !Number.isInteger(datos.version)) return null;
  let d = datos;
  while (d && d.version < VERSION_SUELO) { const paso = MIGRACIONES_SUELO[d.version]; if (!paso) return null; d = paso(d); }
  if (!d || d.version !== VERSION_SUELO || !Array.isArray(d.objetos)) return null;
  return d;
}

export const CLAVE_SUELO = 'kinhold.suelo';
export function guardarSuelo(almacen, suelo, clave = CLAVE_SUELO) {
  try { almacen.setItem(clave, JSON.stringify(suelo.exportar())); return true; } catch (e) { return false; }
}
export function cargarSuelo(almacen, suelo, clave = CLAVE_SUELO) {
  try { const t = almacen.getItem(clave); if (t) suelo.importar(JSON.parse(t)); } catch (e) { /* roto o sin almacenamiento */ }
  return suelo;
}

// ---------------- Acciones con autor ----------------
// { autor, tipo: 'soltar_suelo', de, cantidad?, x, z }       — de la ruta del inventario del autor al suelo, a sus pies
// { autor, tipo: 'coger_suelo', objeto, x, z, a?, cantidad? } — del suelo al inventario del autor
// x, z: dónde está el autor (el servidor usará la suya). ahora: la hora del que valida, nunca la del mensaje.
// enTierras(autor, x, z): si ese sitio es de las tierras del autor (lo da quien conoce las tierras: el mundo).
// Se anota en el registro, salga bien o no.
export function ejecutarSuelo(suelo, invs, registro, accion, ahora, enTierras = () => false) {
  let r;
  const a = accion;
  const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  if (!a || typeof a !== 'object') r = { ok: false, motivo: 'Acción no válida.' };
  else if (!txt(a.autor)) r = { ok: false, motivo: 'Acción sin autor.' };
  else if (a.tipo !== 'soltar_suelo' && a.tipo !== 'coger_suelo') r = { ok: false, motivo: 'Acción desconocida.' };
  else if (!num(a.x) || !num(a.z) || (a.cantidad !== undefined && !num(a.cantidad)) || (a.a !== undefined && !txt(a.a))
    || (a.tipo === 'soltar_suelo' ? !txt(a.de) : !txt(a.objeto))) r = { ok: false, motivo: 'Datos no válidos.' };
  else if (!num(ahora)) r = { ok: false, motivo: 'Sin hora.' };
  else {
    const inv = invs.de(a.autor);
    if (a.tipo === 'soltar_suelo') r = suelo.soltar(inv, a.de, a.cantidad, a.x, a.z, ahora, a.autor, !!enTierras(a.autor, a.x, a.z));
    else r = suelo.coger(inv, a.objeto, a.x, a.z, ahora, a.a, a.cantidad);
  }
  const e = registro.anotar(accion || {}, r);
  e.ahora = ahora;
  if (r.ok) e.resultado = a.tipo === 'soltar_suelo' ? { objeto: r.objeto, cosa: r.cosa } : { objeto: r.objeto, cantidad: r.cantidad };
  return r;
}
