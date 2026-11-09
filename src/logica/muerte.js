// Kinhold — morir y que te saqueen (P4, «Un primer día con sentido»; GDD, apartado 6; documento de sistemas, apartado
// 10). Lógica pura (sin three.js ni red): la usa servidor/servidor.mjs y la pueden usar las pruebas sin servidor.
//
// Se muere también de sed y de hambre (valravnx, 7 nov: «no es survival si no hay que sobrevivir»): con la sed o el
// hambre al máximo se pierde sangre poco a poco (la del luchador, src/combate/logica.js, la misma que en el combate) y,
// sin beber ni comer, se muere: unos 20 minutos de sed y 40 de hambre desde la sangre llena (las dos a la vez, antes).
// Mientras se está así, la sangre no se recupera.
// Mueras como mueras (sed, hambre, combate, ahogado), reapareces en tu cama ligada o, sin ella, en tu sitio de salida;
// tu cuerpo queda en el suelo 1 hora real (DURA_CUERPO) con la mitad de lo que llevabas, que cualquiera puede coger, y
// la otra mitad se rompe, elegida al azar por el servidor.
//
// Decisiones provisionales (registro de la demo y diario; para ajustar probando):
//   - «la mitad» se cuenta por unidades: cada piedra de una pila, cada prenda, cada herramienta y cada contenedor (que
//     se queda vacío; lo de dentro cuenta aparte); se barajan y se queda la mitad (si es impar, la del medio a suertes);
//   - lo que queda va al suelo alrededor del cuerpo, como lo soltado (src/logica/suelo.js): fuera de una tierra se va
//     a la hora, lo mismo que el cuerpo; en una tierra y los troncos y las piedras, se quedan;
//   - al volver, la sed y el hambre no pasan de 60 (con su aviso: hay que beber y comer pronto, pero da tiempo), el
//     cansancio a 0 y el frío como estaba (va hacia lo que pide el sitio); la sangre, llena y sin heridas;
//   - el cuerpo se ve tumbado con el aspecto de quien murió; no se guarda al reiniciar el servidor (lo que cayó al suelo, sí).
import { MAXIMO } from './necesidades.js';

export const MUERTE_SED = 20 * 60;      // s con la sed al máximo hasta morir, desde la sangre llena
export const MUERTE_HAMBRE = 40 * 60;   // s con el hambre al máximo
export const DURA_CUERPO = 3600 * 1000; // ms que se queda el cuerpo en el suelo
export const AL_VOLVER = { hambre: 60, sed: 60 };
export const MUERTO = 'muerto';         // la animación con la que se ve un cuerpo
// los motivos (los del combate, como «Desangrado», vienen de src/combate/logica.js)
export const MOTIVOS = { sed: 'De sed', hambre: 'De hambre', ahogado: 'Ahogado' };

// La sangre (de 0 a 100) que se pierde por segundo por la sed y el hambre (0 si ninguna está al máximo). tiempos: los
// segundos hasta morir de cada una (las pruebas los acortan).
export function sangrePerdida(n, { sed = MUERTE_SED, hambre = MUERTE_HAMBRE } = {}) {
  if (!n) return 0;
  return (n.sed >= MAXIMO ? 100 / sed : 0) + (n.hambre >= MAXIMO ? 100 / hambre : 0);
}
// de qué se muere quien se queda sin sangre por las necesidades (la sed, antes: mata más deprisa)
export const motivoNecesidades = (n) => (n && n.sed >= MAXIMO ? MOTIVOS.sed : MOTIVOS.hambre);

const copiar = (c) => JSON.parse(JSON.stringify(c));

// Todo lo que lleva un inventario (src/logica/inventario.js), cada cosa suelta: lo de sus lugares, lo de dentro de los
// contenedores (y estos, vacíos) y lo apartado. Lo saca: el inventario queda vacío.
export function despojar(inv) {
  const cosas = [];
  const sacar = (c) => {
    if (!c) return;
    const d = copiar(c);
    if (Array.isArray(d.dentro)) { for (const x of d.dentro) sacar(x); d.dentro = d.dentro.map(() => null); }
    cosas.push(d);
  };
  for (const l of Object.keys(inv.lugares)) { sacar(inv.lugares[l]); inv.lugares[l] = null; }
  for (const c of inv.apartado || []) sacar(c);
  inv.apartado = [];
  return cosas;
}

// La mitad que queda en el cuerpo y la que se rompe, por unidades (arriba). azar(): de 0 a 1 (el del servidor).
// Devuelve { quedan, rotas }: listas de cosas (las de pila, juntas otra vez).
export function repartir(cosas, azar = Math.random) {
  const unidades = [];
  cosas.forEach((c, i) => { for (let k = 0; k < (c.n || 1); k++) unidades.push(i); });
  for (let i = unidades.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [unidades[i], unidades[j]] = [unidades[j], unidades[i]]; }
  const mitad = Math.floor(unidades.length / 2) + (unidades.length % 2 && azar() < 0.5 ? 1 : 0);
  const cuenta = (lista) => {
    const n = new Map();
    for (const i of lista) n.set(i, (n.get(i) || 0) + 1);
    return [...n].sort((a, b) => a[0] - b[0]).map(([i, k]) => ({ ...copiar(cosas[i]), n: k }));
  };
  return { quedan: cuenta(unidades.slice(0, mitad)), rotas: cuenta(unidades.slice(mitad)) };
}

// Dónde va cada cosa que queda: en corro alrededor del cuerpo (x, z), a medio metro y más lejos si son muchas.
export function sitiosAlrededor(x, z, n) {
  const l = [];
  for (let i = 0; i < n; i++) {
    const r = 0.5 + 0.35 * Math.floor(i / 8), a = (i % 8) * Math.PI / 4 + Math.floor(i / 8) * 0.4;
    l.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r });
  }
  return l;
}

// Las necesidades con las que se vuelve (arriba)
export function necesidadesAlVolver(n) {
  return { ...n, hambre: Math.min(n.hambre, AL_VOLVER.hambre), sed: Math.min(n.sed, AL_VOLVER.sed), cansancio: 0 };
}

// Dónde se reaparece: en la cama ligada, si la hay; si no, en tu sitio de salida (o, si no se sabe, el que se dé).
export function reaparicion({ cama = null, salida = null, porDefecto = { x: 0, y: 0, z: 0 } } = {}) {
  if (cama) return { ...cama, enCama: true };
  return { ...(salida || porDefecto), enCama: false };
}

// Los cuerpos que hay en el mundo: id → { id, autor, x, y, z, giro, desde, hasta, motivo }
export class Cuerpos {
  constructor(dura = DURA_CUERPO) { this.dura = dura; this.lista = new Map(); this.siguiente = 1; }
  dejar(autor, pos, motivo, ahora) {
    const id = `cuerpo:${this.siguiente++}:${autor}`;
    const c = { id, autor, x: pos.x, y: pos.y || 0, z: pos.z, giro: pos.giro || 0, desde: ahora, hasta: ahora + this.dura, motivo };
    this.lista.set(id, c);
    return c;
  }
  // los que ya se han ido (pasada su hora): se quitan y se devuelven
  limpiar(ahora) {
    const fuera = [];
    for (const [id, c] of this.lista) if (ahora >= c.hasta) { fuera.push(c); this.lista.delete(id); }
    return fuera;
  }
  de(autor) { return [...this.lista.values()].filter(c => c.autor === autor); }
  todos() { return [...this.lista.values()]; }
}
