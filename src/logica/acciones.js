// Acciones que cambian el mundo. Lógica pura (sin three.js): el servidor podrá usarla tal cual.
//
// Toda acción es un mensaje { autor, tipo, ...datos } con datos sencillos (números, textos, ids),
// nunca objetos de la escena. Se comprueba, se aplica y se anota en un registro, salga bien o no.
// Con el registro de la construcción se puede rehacer el mundo desde cero (reproducir): así el
// servidor podrá validar y auditar lo que pasa, y las pruebas ven si algo cambia el mundo sin pasar por aquí.
import { Mundo, MAX_RATO, plantaObra, clasePeso, poleaPara, polipastoPara, alAlcance, plantaDeAltura } from './construccion.js';
import { PIEZAS } from './piezas.js';
import { OBJETO_DE_MATERIAL, MATERIAL_DE_OBJETO } from './inventario.js';
import { resolverGolpe, crearProyectil, moverProyectil } from '../combate/logica.js';
import { AUTOR_REY } from './abandono.js';
import { clavarEstaca, quitarEstaca, labrar, sembrar, segar, cogerPlanta, escardar, CULTIVOS } from './campos.js';

// Autor provisional mientras no haya cuentas (hito de servidor): el jugador de este navegador.
export const AUTOR_LOCAL = 'jugador:local';

export class RegistroAcciones {
  // max: cuántas entradas se guardan como mucho (las más antiguas se van). Sin límite por defecto.
  constructor(max = Infinity) { this.entradas = []; this.total = 0; this.max = max; }
  anotar(accion, r) {
    const { autor, tipo, ...datos } = accion;
    const e = { n: ++this.total, autor, tipo, datos, ok: !!r.ok };
    if (!r.ok && r.motivo) e.motivo = r.motivo;
    if (r.resultado) e.resultado = r.resultado;
    this.entradas.push(e);
    if (this.entradas.length > this.max) this.entradas.shift();
    return e;
  }
  exportar() { return this.entradas.map(e => ({ ...e, datos: { ...e.datos } })); }
}

const numero = v => typeof v === 'number' && Number.isFinite(v);
// un texto de datos: no vacío, corto y que no sea el nombre de algo que tienen todos los objetos («constructor»,
// «__proto__», «toString»…), que si no se colaría al buscarlo en las tablas de piezas o materiales
const texto = v => typeof v === 'string' && v.length > 0 && v.length <= 64 && !(v in Object.prototype);

// Comprueba la forma del mensaje: autor, tipo conocido y datos del tipo correcto.
function forma(accion, campos) {
  if (!accion || typeof accion !== 'object') return 'Acción no válida.';
  if (!texto(accion.autor)) return 'Acción sin autor.';
  const c = Object.hasOwn(campos, accion.tipo) ? campos[accion.tipo] : null;   // «constructor», «__proto__»… no son tipos
  if (!c) return 'Acción desconocida.';
  for (const [nombre, tipo] of Object.entries(c)) {
    const v = accion[nombre];
    if (tipo === 'n' && !numero(v)) return 'Datos no válidos.';
    if (tipo === 't' && !texto(v)) return 'Datos no válidos.';
  }
  return null;
}

// ---------------- Construcción ----------------
// Piezas que se abren y cierran con Usar: las puertas de muro, los portones (el de la empalizada y el portillo de la
// cerca), las contraventanas y las trampillas.
// La chimenea se enciende y se apaga con Usar (al terminarla queda encendida; p.apagado la apaga).
export function seEnciende(p) { return !!(PIEZAS[p.tipo] && PIEZAS[p.tipo].hogar); }
export function seAbre(p) { return p.hueco === 'p' || p.hueco === 'w' || p.hueco === 't' || !!(PIEZAS[p.tipo] && PIEZAS[p.tipo].portón); }

const CAMPOS_CONSTRUCCION = {
  mojon: { x: 'n', z: 'n' },
  quitar_mojon: {},          // destruir tu mojón: dejas tu tierra y se pierde lo construido en ella (para reposicionar)
  invitar: { a: 't' },       // dejar construir en tu tierra a otro jugador (a: su autor)
  desinvitar: { a: 't' },    // y quitárselo
  tierra_al_rey: { dueno: 't' }, // la tierra de un dueño vuelve al rey (src/logica/abandono.js): solo la hace el servidor
  admin_terminar: { construccion: 'n', clave: 't' }, // el modo autoconstruir del admin termina la obra que acaba de poner: solo la hace el servidor (src/logica/admin.js)
  colocar: { pieza: 't', x: 'n', z: 'n', k: 'n', rot: 'n', dir: 'n' },
  decorar: { pieza: 't', x: 'n', y: 'n', z: 'n', rot: 'n' },
  nivelar: { x: 'n', z: 'n', y: 'n', radio: 'n' },   // una pasada de la brocha redonda (y: la altura a la que deja el suelo)
  estaca: { x: 'n', z: 'n' },         // clavar una estaca del campo que marcas (src/logica/campos.js, P11)
  quitar_estaca: { campo: 'n', i: 'n' }, // y quitarla (vuelve a lo que llevas)
  labrar: { campo: 'n', x: 'n', z: 'n', t: 'n' },   // una pasada de azada en el campo (t: la hora, la pone el servidor)
  sembrar: { campo: 'n', cultivo: 't', x: 'n', z: 'n', t: 'n' },
  segar: { campo: 'n', x: 'n', z: 'n', t: 'n' },          // segar la cebada madura con la hoz (deja gavillas en el suelo)
  coger_planta: { campo: 'n', x: 'n', z: 'n', t: 'n' },   // coger a mano la planta madura (habas, col, nabo)
  escardar: { campo: 'n', x: 'n', z: 'n', t: 'n' },       // quitar las malas hierbas de lo sembrado (con las manos o la azada; 14 nov)   // sembrar en lo labrado (a voleo o una planta; t: del servidor)
  desmontar: { construccion: 'n', clave: 't' },
  quitar: { id: 'n' },
  entregar: { construccion: 'n', clave: 't', material: 't', cantidad: 'n' }, // llevar material a una obra (desde: planta en la que estás)
  subir: { construccion: 'n', clave: 't', material: 't', segundos: 'n', metodo: 't' }, // subir lo pesado a una obra en alto
  trabajar: { construccion: 'n', clave: 't', segundos: 'n' },                 // un rato de trabajo en una obra
  usar: { construccion: 'n', clave: 't' },           // abrir o cerrar una puerta o un portón, o encender o apagar una chimenea
  rellenar: { cantidad: 'n' },                        // botón de pruebas del prototipo: llena el arcón de pruebas
  sacar_arcon: { material: 't', cantidad: 'n' },      // coger material del arcón de pruebas (a: ruta preferida, opcional)
  dejar_arcon: { de: 't', cantidad: 'n' },            // dejar en el arcón de pruebas el material de una ruta
};

// Obras con lo que llevas (roadmap, hito «Equipo y carga»): con los inventarios (invs), lo que se entrega a una obra
// sale de lo que lleva el autor encima, no de un montón común. El montón común del mundo (mundo.materiales) pasa a
// ser el arcón de pruebas del prototipo: de ahí se coge el material, y el botón de rellenar lo llena.
// Sin inventarios (el atajo acabarObra) se sigue usando el montón común.
// En línea (valravnx, 30 oct: siempre en línea), el servidor ejecuta estas acciones con los inventarios que lleva él
// (src/logica/objetos_red.js). Lo que sale bien se anota ya pagado: la entrada lleva «lleva: true» y la cantidad que
// de verdad se entregó (en dejar_arcon, también el material). Así, al rehacer el mundo sin inventarios (el servidor
// al volver a arrancar, el navegador de los demás con las entradas que reparte), esas entregas no vuelven a cobrar ni
// tocan el montón común, y el arcón de materiales queda igual en todos. Con inventarios, «lleva» no cuenta (lo que
// diga el navegador se pisa): solo vale al rehacer.
// El mojón y los muebles (roadmap, hito «Jugar entre dos sin trampas»), igual: con los inventarios se pagan de lo que
// lleva el autor, y al quitar un mueble lo que devuelve va a lo que llevas (todo o nada: si no te cabe, no se quita).
// Al desmontar una pieza, igual, pero lo que no te cabe cae al suelo a tus pies (r.sobra) en vez de no desmontarse.
// Al rehacer, con «lleva: true» ni cobran ni devuelven al montón común.
export const USAN_INVENTARIO = new Set(['entregar', 'subir', 'sacar_arcon', 'dejar_arcon', 'mojon', 'decorar', 'quitar', 'desmontar', 'estaca', 'quitar_estaca', 'labrar', 'sembrar', 'segar', 'coger_planta', 'escardar']);
const RESERVA_PAGADA = { hay: () => Infinity, gastar: () => {}, parcial: true };
export function reservaDe(inv) {
  const tipo = m => OBJETO_DE_MATERIAL[m];
  return { hay: m => (tipo(m) ? inv.cuantos(tipo(m)) : 0), gastar: (m, n) => { inv.gastar(tipo(m), n); }, parcial: true };
}

// De dónde paga una acción que cuesta algo al ponerla (el mojón, un mueble): con inventarios, de lo que lleva el autor
// (y queda anotada como pagada); al rehacer una ya pagada, de nada; si no, del montón común.
function pagaCon(m, a, invs) {
  if (invs) { delete a.lleva; return reservaDe(invs.de(a.autor)); }
  return a.lleva === true ? RESERVA_PAGADA : m.reservaComun();
}
const pagada = (r, a, invs) => { if (r.ok && invs) a.lleva = true; return r; };

// Lo que devuelve un mueble al quitarlo, a lo que lleva el autor: todo o nada (si no cabe entero, nada cambia).
function devolverA(inv, devuelto) {
  const antes = inv.exportarJugador();
  for (const [mat, n] of Object.entries(devuelto)) {
    const tipo = Object.hasOwn(OBJETO_DE_MATERIAL, mat) ? OBJETO_DE_MATERIAL[mat] : null;
    const r = tipo ? inv.meterDonde(tipo, n) : { ok: false, motivo: 'No válida.' };
    if (!r.ok) { inv.restaurar(antes); return { ok: false, motivo: 'No te cabe lo que devuelve: haz sitio.' }; }
  }
  return { ok: true };
}
// Lo que devuelve una pieza al desmontarla (sin arcón en el juego de verdad, valravnx 1 nov): a lo que lleva el autor
// lo que le quepa, y lo demás cae al suelo a sus pies (lo pone quien tiene el suelo: el servidor, o la página sin él).
// Provisional: una pieza grande devuelve más de lo que se puede llevar, y no se quiere que no se pueda desmontar.
// Devuelve { ok: true, sobra: { tipo de objeto: n } }.
function devolverOSuelo(inv, devuelto) {
  const sobra = {};
  for (const [mat, n] of Object.entries(devuelto)) {
    const tipo = Object.hasOwn(OBJETO_DE_MATERIAL, mat) ? OBJETO_DE_MATERIAL[mat] : null;
    if (!tipo) continue;
    let k = n;
    while (k > 0 && !inv.meterDonde(tipo, k).ok) k--;
    if (n - k > 0) sobra[tipo] = n - k;
  }
  return { ok: true, sobra };
}

// El servidor no se fía del navegador en las obras (hito «Jugar entre dos sin trampas»): entregar, subir, trabajar y
// desmontar solo valen si el jugador, donde lo tiene el servidor (pos: su último estado { x, y, z }, o null), está al
// alcance de la pieza (alAlcance, con holgura m de más por el retraso) y, al entregar, en la planta que dice («desde»).
// Devuelve null si vale, o { ok: false, motivo } si no. Las demás acciones no se miran aquí.
export const OBRA_CERCA = new Set(['entregar', 'subir', 'trabajar', 'desmontar']);
export function fueraDeAlcance(m, a, pos, holgura = 3) {
  if (!a || !OBRA_CERCA.has(a.tipo)) return null;
  const c = m.construcciones.find(x => x.id === a.construccion);
  const p = c && typeof a.clave === 'string' && c.piezas.get(a.clave);
  if (!p) return null;   // lo que no existe lo dice la acción misma
  if (!pos || ![pos.x, pos.y, pos.z].every(numero)) return { ok: false, motivo: 'El servidor aún no sabe dónde estás.' };
  const k = plantaDeAltura(c, pos.y);
  const r = alAlcance(c, p, pos.x, pos.z, k, holgura, 1);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  // lo ligero a una obra en alto se sube a mano por la escalera: no vale decir que estás arriba estando abajo
  if (a.tipo === 'entregar' && numero(a.desde) && a.desde > k) return { ok: false, motivo: 'No estás en su planta.' };
  return null;
}

function aplicarConstruccion(m, a, invs) {
  switch (a.tipo) {
    case 'mojon': return pagada(m.colocarMojon(a.x, a.z, a.autor, pagaCon(m, a, invs)), a, invs);
    case 'quitar_mojon': return m.quitarMojon(a.autor);
    case 'invitar': return m.invitar(a.autor, a.a);
    case 'desinvitar': return m.desinvitar(a.autor, a.a);
    case 'tierra_al_rey': return a.autor === AUTOR_REY ? m.tierraAlRey(a.dueno) : { ok: false, motivo: 'Eso solo lo hace el rey.' };
    // el servidor nunca la acepta de un navegador (servidor.mjs): solo la crea él, tras el «colocar» de la cuenta de
    // admin con el modo autoconstruir; aquí se aplica al rehacer y en los navegadores que la reciben
    case 'admin_terminar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      return c ? m.terminarAdmin(c, a.clave, a.autor) : { ok: false, motivo: 'No existe.' };
    }
    // se construye por obras (GDD): colocar pone el marco; luego se entregan los materiales y se trabaja
    // y (opcional): la altura del suelo donde se pone; la planta baja de una construcción nueva queda ahí
    case 'colocar': {
      if (a.y !== undefined && !numero(a.y)) return { ok: false, motivo: 'Datos no válidos.' };
      return m.colocar(m.candidata(a.pieza, a.x, a.z, a.k, a.rot, a.dir, a.y === undefined ? 0 : a.y), true, a.autor);
    }
    case 'nivelar': return m.nivelar(a, a.autor);
    // los campos (P11): la estaca sale de lo que llevas al clavarla y vuelve a lo que llevas al quitarla; al rehacer una
    // ya cobrada («lleva»), ni se cobra ni se devuelve, y sin inventarios (pruebas sueltas, sin servidor), tampoco
    case 'estaca': {
      const inv = invs ? invs.de(a.autor) : null;
      if (invs) delete a.lleva;
      const gastar = inv ? () => (inv.cuantos('estaca') >= 1 ? (inv.gastar('estaca', 1), { ok: true }) : { ok: false, motivo: 'No llevas ninguna estaca.' }) : undefined;
      return pagada(clavarEstaca(m, a.x, a.z, a.autor, gastar), a, invs);
    }
    case 'labrar': {   // (P11) con la azada en la mano (no gasta nada; al rehacer una ya hecha, no se mira)
      if (invs) {
        delete a.lleva;
        const l = invs.de(a.autor).lugares;
        if (!['mano:der', 'mano:izq'].some(r => l[r] && l[r].tipo === 'azada')) return { ok: false, motivo: 'Necesitas la azada en la mano para labrar.' };
      }
      return pagada(labrar(m, a.campo, a.x, a.z, a.t, a.autor), a, invs);
    }
    case 'sembrar': {   // (P11) con las semillas en la mano; cobra de lo que lleva (al rehacer una ya hecha, no se mira)
      let gastar;
      if (invs) {
        delete a.lleva;
        const inv = invs.de(a.autor), cu = CULTIVOS[a.cultivo], l = inv.lugares;
        if (!cu) return { ok: false, motivo: 'Eso no se siembra.' };
        if (!['mano:der', 'mano:izq'].some(r => l[r] && l[r].tipo === cu.semilla)) return { ok: false, motivo: 'Necesitas las semillas en la mano para sembrar.' };
        gastar = (n) => (inv.cuantos(cu.semilla) >= n ? (inv.gastar(cu.semilla, n), { ok: true }) : { ok: false, motivo: 'No llevas bastantes semillas.' });
      }
      return pagada(sembrar(m, a.campo, a.cultivo, a.x, a.z, a.t, a.autor, gastar), a, invs);
    }
    case 'segar': {   // (P11) con la hoz en la mano; las gavillas, al suelo donde se siega (r.sobra: el servidor)
      if (invs) {
        delete a.lleva;
        const l = invs.de(a.autor).lugares;
        if (!['mano:der', 'mano:izq'].some(r => l[r] && l[r].tipo === 'hoz_silex')) return { ok: false, motivo: 'Necesitas la hoz en la mano para segar.' };
      }
      const r = segar(m, a.campo, a.x, a.z, a.t, a.autor);
      return pagada(r.ok && r.gavillas ? { ...r, sobra: { gavilla: r.gavillas }, sobraEn: { x: a.x, z: a.z } } : r, a, invs);
    }
    case 'coger_planta': {   // (P11) a mano: a lo que llevas lo que quepa, lo demás al suelo a tus pies
      if (invs) delete a.lleva;
      const r = cogerPlanta(m, a.campo, a.x, a.z, a.t, a.autor);
      if (!r.ok || !invs) return r;
      const inv = invs.de(a.autor), sobra = {};
      for (const [tipo, n] of Object.entries(r.da)) { let k = n; while (k > 0 && !inv.meterDonde(tipo, k).ok) k--; if (n - k > 0) sobra[tipo] = n - k; }
      return pagada({ ...r, sobra }, a, invs);
    }
    case 'escardar': {   // (P11, 14 nov) con las manos vacías o con la azada en la mano (no gasta nada)
      if (invs) {
        delete a.lleva;
        const l = invs.de(a.autor).lugares, manos = ['mano:der', 'mano:izq'];
        if (!manos.some(r => l[r] && l[r].tipo === 'azada') && manos.some(r => l[r])) return { ok: false, motivo: 'Para escardar, las manos vacías o la azada.' };
      }
      return pagada(escardar(m, a.campo, a.x, a.z, a.t, a.autor), a, invs);
    }
    case 'quitar_estaca': {
      const inv = invs ? invs.de(a.autor) : null;
      if (invs) delete a.lleva;
      const devolver = inv ? () => { const r = inv.meterDonde('estaca', 1); return r.ok ? { ok: true } : { ok: false, motivo: 'No te cabe la estaca: haz sitio.' }; } : undefined;
      return pagada(quitarEstaca(m, a.campo, a.i, a.autor, devolver), a, invs);
    }
    case 'entregar': case 'trabajar': case 'subir': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      if (!c) return { ok: false, motivo: 'No existe.' };
      const reserva = invs ? reservaDe(invs.de(a.autor)) : a.lleva === true ? RESERVA_PAGADA : undefined;
      if (invs) delete a.lleva;
      if (a.tipo === 'entregar') {
        if (a.desde !== undefined && !numero(a.desde)) return { ok: false, motivo: 'Datos no válidos.' };
        const r = m.entregar(c, a.clave, a.material, a.cantidad, a.autor, a.desde === undefined ? 0 : a.desde, reserva);
        if (r.ok && invs) { a.cantidad = r.entregado; a.lleva = true; }   // ya pagado: lo que de verdad se entregó
        return r;
      }
      if (a.tipo === 'subir') {
        const r = m.subir(c, a.clave, a.material, a.segundos, a.autor, a.metodo, reserva);
        if (r.ok && invs) a.lleva = true;
        return r;
      }
      return m.trabajar(c, a.clave, a.segundos, a.autor);
    }
    case 'decorar': return pagada(m.colocarDecoracion(a.pieza, a.x, a.y, a.z, a.rot, a.autor, pagaCon(m, a, invs)), a, invs);
    case 'quitar': {
      // con lo que llevas: solo en tu tierra (o en la de quien te invita), y lo que devuelve va a lo que llevas
      if (invs) {
        delete a.lleva;
        const d = m.decoracion.find(x => x.id === a.id);
        if (!d) return { ok: false };
        if (!m.dentroDeTierra(d.x, d.z, a.autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
        const inv = invs.de(a.autor);
        return pagada(m.quitarDecoracion(a.id, (devuelto) => devolverA(inv, devuelto)), a, invs);
      }
      return m.quitarDecoracion(a.id, a.lleva === true ? () => ({ ok: true }) : null);
    }
    case 'desmontar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      if (!c) return { ok: false, motivo: 'No existe.' };
      // solo en tu tierra, en la de quien te invita o en tierra de nadie; con lo que llevas, lo que devuelve va a lo que
      // llevas (sin arcón en el juego de verdad, valravnx 1 nov), y al rehacer una ya cobrada no toca el montón común
      if (invs) {
        delete a.lleva;
        const inv = invs.de(a.autor);
        let sobra = {};
        const r = m.desmontar(c, a.clave, a.autor, (devuelto) => { const d = devolverOSuelo(inv, devuelto); sobra = d.sobra; return d; });
        return pagada(r.ok ? { ...r, sobra } : r, a, invs);
      }
      return m.desmontar(c, a.clave, a.autor, a.lleva === true ? () => ({ ok: true }) : null);
    }
    case 'usar': {
      const c = m.construcciones.find(x => x.id === a.construccion);
      const p = c && c.piezas.get(a.clave);
      if (!p) return { ok: false, motivo: 'No existe.' };
      if (p.obra) return { ok: false, motivo: 'Está en obras.' };
      const t = m.puedeTocar(c.ox, c.oz, a.autor);   // las puertas y el fuego de otro, solo él y sus invitados
      if (!t.ok) return t;
      if (seEnciende(p)) { p.apagado = !p.apagado; return { ok: true, encendido: !p.apagado }; }
      if (!seAbre(p)) return { ok: false, motivo: 'Eso no se abre.' };
      p.abierta = !p.abierta;
      return { ok: true, abierta: p.abierta };
    }
    case 'rellenar': {
      if (a.cantidad <= 0 || a.cantidad > 1000) return { ok: false, motivo: 'Cantidad no válida.' };
      for (const k of Object.keys(m.materiales)) m.materiales[k] += a.cantidad;
      return { ok: true };
    }
    case 'sacar_arcon': {
      if (!invs && a.lleva === true) { // ya hecho en el servidor: al rehacer, solo sale del arcón
        if (!Object.hasOwn(OBJETO_DE_MATERIAL, a.material) || !Number.isInteger(a.cantidad) || a.cantidad < 1) return { ok: false, motivo: 'Datos no válidos.' };
        if ((m.materiales[a.material] || 0) < a.cantidad) return { ok: false, motivo: 'En el arcón no hay tanto.' };
        m.materiales[a.material] -= a.cantidad;
        return { ok: true };
      }
      if (!invs) return { ok: false, motivo: 'Aquí no hay arcón.' };
      delete a.lleva;
      const tipo = Object.hasOwn(OBJETO_DE_MATERIAL, a.material) ? OBJETO_DE_MATERIAL[a.material] : null;
      if (!tipo) return { ok: false, motivo: 'Eso no está en el arcón.' };
      if (!Number.isInteger(a.cantidad) || a.cantidad < 1) return { ok: false, motivo: 'Cantidad no válida.' };
      if (a.a !== undefined && !texto(a.a)) return { ok: false, motivo: 'Datos no válidos.' };
      if ((m.materiales[a.material] || 0) < a.cantidad) return { ok: false, motivo: 'En el arcón no hay tanto.' };
      // con ruta, justo ahí (como coger del suelo); sin ella, donde quepa
      const inv = invs.de(a.autor), r = a.a !== undefined ? inv.coger(tipo, a.cantidad, a.a) : inv.meterDonde(tipo, a.cantidad);
      if (!r.ok) return r;
      m.materiales[a.material] -= a.cantidad;
      a.lleva = true;
      return { ok: true, donde: r.donde };
    }
    case 'dejar_arcon': {
      if (!invs && a.lleva === true) { // ya hecho en el servidor: al rehacer, solo entra en el arcón
        if (!Object.hasOwn(OBJETO_DE_MATERIAL, a.material) || !Number.isInteger(a.cantidad) || a.cantidad < 1) return { ok: false, motivo: 'Datos no válidos.' };
        m.materiales[a.material] = (m.materiales[a.material] || 0) + a.cantidad;
        return { ok: true, material: a.material, n: a.cantidad };
      }
      if (!invs) return { ok: false, motivo: 'Aquí no hay arcón.' };
      delete a.lleva;
      const inv = invs.de(a.autor), b = inv.buscar(a.de);
      if (b.motivo) return { ok: false, motivo: b.motivo };
      const mat = b.cosa && Object.hasOwn(MATERIAL_DE_OBJETO, b.cosa.tipo) ? MATERIAL_DE_OBJETO[b.cosa.tipo] : null;
      if (!mat) return { ok: false, motivo: b.cosa ? 'Eso no va en el arcón de materiales.' : 'Ahí no hay nada.' };
      const r = inv.sacar(a.de, a.cantidad);
      if (!r.ok) return r;
      m.materiales[mat] = (m.materiales[mat] || 0) + r.cosa.n;
      a.material = mat; a.cantidad = r.cosa.n; a.lleva = true;
      return { ok: true, material: mat, n: r.cosa.n };
    }
  }
}

// Ejecuta una acción de construcción sobre el mundo y la anota. Devuelve lo mismo que el método del mundo.
// invs: los inventarios de los jugadores (Inventarios, inventario.js); sin ellos, las obras cobran del montón común.
export function ejecutar(mundo, registro, accion, invs = null) {
  const fallo = forma(accion, CAMPOS_CONSTRUCCION);
  const r = fallo ? { ok: false, motivo: fallo } : aplicarConstruccion(mundo, accion, invs);
  registro.anotar(accion, r);
  return r;
}

// Lleva todo el material que le falta a una obra y trabaja en ella hasta terminarla, siempre con acciones (una
// entrega por material y ratos de MAX_RATO s). Si está en alto, lo ligero se lleva desde su planta y lo pesado se
// sube con la polea si la hay, si no con el polipasto, y si no rodándolo por dos varas (una persona sola; lo muy
// pesado, solo con polipasto y entre dos: una persona sola no lo acaba). Para las pruebas y los atajos de prueba del prototipo.
export function acabarObra(mundo, registro, autor, construccion, claveObra) {
  const c = mundo.construcciones.find(x => x.id === construccion);
  const p = c && c.piezas.get(claveObra);
  if (!p || !p.obra) return { ok: false, motivo: 'No hay obra ahí.' };
  const planta = plantaObra(p);
  for (const f of mundo.faltaEntregar(p)) {
    if (planta > 0 && clasePeso(f.m) !== 'ligero') {
      for (let i = 0; i < 10000 && mundo.faltaEntregar(p).some(x => x.m === f.m); i++) {
        const metodo = clasePeso(f.m) === 'muy_pesado' ? 'polipasto' : poleaPara(c, p) ? 'polea' : polipastoPara(c, p) ? 'polipasto' : 'varas';
        const r = ejecutar(mundo, registro, { autor, tipo: 'subir', construccion, clave: claveObra, material: f.m, segundos: MAX_RATO, metodo });
        if (!r.ok) return r;
        if (r.esperaAyuda) return { ok: false, motivo: 'Lo muy pesado solo se sube con un polipasto con torno, entre dos.' };
      }
      continue;
    }
    const r = ejecutar(mundo, registro, { autor, tipo: 'entregar', construccion, clave: claveObra, material: f.m, cantidad: f.n, desde: planta });
    if (!r.ok) return r;
  }
  let r = { ok: true, terminada: false };
  for (let i = 0; i < 1000 && r.ok && !r.terminada; i++) r = ejecutar(mundo, registro, { autor, tipo: 'trabajar', construccion, clave: claveObra, segundos: MAX_RATO });
  return r;
}

// Rehace un mundo desde cero aplicando, en orden, las acciones que salieron bien.
export function reproducir(entradas) { return reproducirDesde(null, entradas); }

// Lo mismo, pero desde un estado guardado (Mundo.exportar()) en vez de desde cero: el servidor guarda el mundo entero al
// arrancar (mundo_estado.json, 12 nov) y, la vez siguiente, solo aplica las acciones que vinieron después.
export function reproducirDesde(estado, entradas) {
  const m = estado ? Mundo.importar(estado) : new Mundo();
  const reg = new RegistroAcciones();
  for (const e of entradas) if (e.ok) ejecutar(m, reg, { autor: e.autor, tipo: e.tipo, ...e.datos });
  return m;
}

// ---------------- Combate ----------------
// ctx = { luchadores: { id: Luchador }, r: azar }. Los luchadores se nombran por su id.
const CAMPOS_COMBATE = {
  golpe: { objetivo: 't', linea: 't' },
  disparo: { x: 'n', y: 'n', z: 'n', tension: 'n', tTenso: 'n' },
  curar: { herida: 'n', metodo: 't' },
};

function luchadorAutor(ctx, a) {
  const L = ctx.luchadores[a.autor];
  if (!L) return { motivo: 'El autor no está en el combate.' };
  if (L.fuera) return { motivo: 'El autor está fuera de combate.' };
  return { L };
}

// Golpe cuerpo a cuerpo en el instante del impacto: { autor, tipo: 'golpe', objetivo, linea }
// Disparo: { autor, tipo: 'disparo', x, y, z, tension, tTenso } → devuelve { ok, proyectil }
// Curarse: { autor, tipo: 'curar', herida (índice en sus heridas), metodo (de TRATAMIENTOS) } → empieza la cura
export function ejecutarCombate(ctx, registro, accion) {
  let r;
  const fallo = forma(accion, CAMPOS_COMBATE);
  if (fallo) r = { ok: false, motivo: fallo };
  else {
    const { L, motivo } = luchadorAutor(ctx, accion);
    if (!L) r = { ok: false, motivo };
    else if (accion.tipo === 'golpe') {
      const de = ctx.luchadores[accion.objetivo];
      // ctx.protegido (opcional): si dice un motivo, el golpe se rechaza sin herida (Strandvang, tierras del rey)
      const prot = de && ctx.protegido ? ctx.protegido(L, de) : null;
      if (!de) r = { ok: false, motivo: 'El objetivo no está en el combate.' };
      else if (prot) r = { ok: false, motivo: prot };
      else r = { ok: true, ...resolverGolpe(L, de, accion.linea, ctx.r) };
    } else if (accion.tipo === 'curar') {
      const motivo = L.motivoNoCurar(accion.herida, accion.metodo);
      r = motivo ? { ok: false, motivo } : (L.curar(accion.herida, accion.metodo), { ok: true });
    } else {
      const p = crearProyectil(L, { x: accion.x, y: accion.y, z: accion.z }, { tension: accion.tension, tTenso: accion.tTenso }, ctx.r);
      p.autor = accion.autor;
      r = { ok: true, proyectil: p };
    }
  }
  const e = registro.anotar(accion, r);
  if (r.ok && accion.tipo === 'golpe') { if (r.zona) e.zona = r.zona; if (r.gravedad) e.gravedad = r.gravedad; }
  return r;
}

// Avanza un proyectil disparado con ejecutarCombate. Si da a alguien (herida o escudo), lo anota
// como consecuencia del disparo, con el mismo autor.
// blancos: a quién puede dar (por defecto, todos los luchadores del combate).
// Con ctx.protegido, la flecha que llega a alguien protegido se para sin herir y se anota rechazada, con su autor.
export function avanzarProyectil(ctx, registro, p, dt, blancos = Object.values(ctx.luchadores), dianas = []) {
  const tirador = ctx.protegido ? ctx.luchadores[p.autor] || p.tirador : null;
  const protegido = tirador ? (L) => ctx.protegido(tirador, L) : null;
  const m = ctx.mundo ? { suelo: ctx.mundo.suelo, presas: ctx.mundo.presas ? ctx.mundo.presas() : [] } : null;
  const res = moverProyectil(p, dt, blancos, ctx.r, dianas, protegido, m);
  if (res && res.tipo === 'protegido') {
    const objetivo = Object.keys(ctx.luchadores).find(id => ctx.luchadores[id] === res.luchador);
    registro.anotar({ autor: p.autor || 'desconocido', tipo: 'impacto', objetivo, arma: p.arma }, { ok: false, motivo: res.motivo });
  } else if (res && (res.tipo === 'blanco' || res.tipo === 'escudo')) {
    const objetivo = Object.keys(ctx.luchadores).find(id => ctx.luchadores[id] === res.luchador);
    const e = registro.anotar({ autor: p.autor || 'desconocido', tipo: 'impacto', objetivo, arma: p.arma }, { ok: true, resultado: res.tipo === 'blanco' ? 'herida' : 'escudo' });
    if (res.zona) { e.zona = res.zona; e.gravedad = res.gravedad; }
  }
  return res;
}
