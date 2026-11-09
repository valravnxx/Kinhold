// Kinhold — la fauna del mundo: las liebres (P4, «Un primer día con sentido»; GDD, apartado 14: fauna realista, huyen
// salvo acorraladas). Lógica pura (sin three.js ni websocket): la lleva el servidor, para que todos vean la misma liebre
// en el mismo sitio, y la usan las pruebas.
//
// Cada trozo del mundo (los de la red, LADO_RED m: src/logica/trozos_red.js) tiene sus liebres, siempre las mismas por
// su sitio (el azar de la celda): de 0 a MAX_TROZO, cada una con su querencia (donde vive) en un prado o en la linde
// del bosque (lo dice habitat(x, z), que da el servidor con el terreno). Solo se mueven las de los trozos que tiene
// alguien cerca (RADIO_VIVO trozos alrededor de cada jugador); las de un trozo sin nadie cerca durante OLVIDO s se
// olvidan, y al volver alguien salen otra vez en su querencia.
//
// Lo que hace cada una (estados):
//   pastar  — come con la cabeza baja; de vez en cuando da unos saltos cortos a otro sitio cerca de su querencia.
//   saltar  — esos saltos cortos, despacio (VEL_SALTO).
//   alerta  — alguien se acerca (a menos de ALERTA m): se sienta erguida, las orejas tiesas, y no se mueve.
//   huir    — alguien llega a menos de HUYE m (o de HUYE_CORRE si viene corriendo): sale corriendo en dirección contraria
//             a VEL_HUIDA, con algún quiebro, de LARGO_HUIDA m; no se mete en el agua ni en lo muy empinado (si delante no
//             se puede, gira). Luego se para (alerta) y, cuando no hay nadie cerca, vuelve a pastar.
// Si se aleja más de RADIO_CASA m de su querencia, sus saltos tiran hacia ella.
//
// Decisiones provisionales (registro de la demo y diario, 9 nov): las cifras de aquí. Una liebre de verdad corre a
// 50–70 km/h y se agacha confiando en su color hasta que la tienes muy cerca; aquí, 11 m/s (unos 40 km/h, más que un
// jugador corriendo), alerta a 22 m y huida a 9 m (14 m si vienes corriendo). La densidad (hasta 2 por trozo de 128 m,
// unas 60 por km² en el mejor prado) es más alta que la real, para que se vean.

import { azarCelda } from './azar.js';
import { LADO_RED, trozoDe } from './trozos_red.js';

export const FAUNA = {
  MAX_TROZO: 2, PROB: [0.35, 0.4, 0.25],   // cuántas en un trozo: 0, 1 o 2 (antes de mirar si hay sitio para ellas)
  RADIO_VIVO: 1, OLVIDO: 120,              // trozos alrededor de cada jugador; s sin nadie cerca antes de olvidarlas
  ALERTA: 22, HUYE: 9, HUYE_CORRE: 14, CORRE: 2.5,   // m; m/s a partir del que se ve que vienes corriendo
  VEL_SALTO: 1.6, VEL_HUIDA: 11, LARGO_HUIDA: [40, 70],
  RADIO_CASA: 30, SALTO: [1.5, 5],         // m
  PASTA: [3, 9], CALMA: 4,                  // s pastando entre saltos; s sin nadie cerca para volver a pastar
  REAPARECE: 1800,                          // s: la cazada (src/logica/caza.js) no vuelve a salir hasta entonces
};
const CAPA = 77;   // la capa del azar de las liebres (azarCelda)
const r2 = v => Math.round(v * 100) / 100;

// Las liebres de un trozo ("i,j"), siempre las mismas: [{ id, x, z, giro }]. habitat(x, z) dice si ahí vive una liebre.
export function liebresDelTrozo(clave, habitat, semilla = 1) {
  const [i, j] = clave.split(',').map(Number);
  const r = azarCelda(i, j, CAPA, semilla), u = r();
  let n = 0;
  for (let acc = 0; n < FAUNA.MAX_TROZO; n++) { acc += FAUNA.PROB[n]; if (u < acc) break; }
  const lista = [];
  for (let k = 0; k < n; k++) {
    // hasta 12 intentos de sitio dentro del trozo (un prado; si es todo bosque o agua, no sale)
    for (let t = 0; t < 12; t++) {
      const x = (i + 0.08 + r() * 0.84) * LADO_RED, z = (j + 0.08 + r() * 0.84) * LADO_RED, giro = r() * Math.PI * 2;
      if (!habitat(x, z)) continue;
      lista.push({ id: `liebre:${clave}:${k}`, x: r2(x), z: r2(z), giro: r2(giro) });
      break;
    }
  }
  return lista;
}

const angulo = (a) => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
const entre = (r, [a, b]) => a + r() * (b - a);

// La fauna que lleva el servidor. habitat(x, z): si ahí puede vivir una liebre (prado o linde, en tierra); pisable(x, z):
// si puede correr por ahí (no agua, no un cortado). azar: el del servidor (Math.random), el de las pruebas con semilla.
export class Fauna {
  constructor({ habitat, pisable = habitat, semilla = 1, azar = Math.random } = {}) {
    this.habitat = habitat; this.pisable = pisable; this.semilla = semilla; this.r = azar;
    this.trozos = new Map();     // clave → { liebres: [...], visto: s de la última vez que alguien estuvo cerca }
    this.t = 0;                  // s desde que empezó
    this.cambiadas = new Set();  // ids de las que se han movido o cambiado de estado desde el último sacarCambios
    this.quitadas = [];          // ids de las olvidadas desde el último sacarCambios
    this.muertas = new Map();    // id → s hasta los que no vuelve a salir (las cazadas)
  }
  // La liebre cazada (src/logica/caza.js): sale de su trozo y no vuelve a salir hasta REAPARECE s. Devuelve si estaba.
  matar(id) {
    for (const v of this.trozos.values()) {
      const i = v.liebres.findIndex(l => l.id === id);
      if (i < 0) continue;
      v.liebres.splice(i, 1); this.cambiadas.delete(id); this.quitadas.push(id);
      this.muertas.set(id, this.t + FAUNA.REAPARECE);
      return true;
    }
    return false;
  }
  viva(id) { const h = this.muertas.get(id); if (h === undefined) return true; if (this.t >= h) { this.muertas.delete(id); return true; } return false; }
  // las liebres que se mueven ahora (las de los trozos vivos)
  todas() { const r = []; for (const v of this.trozos.values()) r.push(...v.liebres); return r; }
  de(id) { for (const v of this.trozos.values()) for (const l of v.liebres) if (l.id === id) return l; return null; }
  // lo que se manda de una: { id, x, z, giro, anim }
  static foto(l) { return { id: l.id, x: r2(l.x), z: r2(l.z), giro: r2(angulo(l.giro)), anim: l.estado }; }
  // Avanza dt s. jugadores: [{ x, z, vel }] (vel: m/s que se le ha visto andar). Devuelve nada; lo cambiado queda en
  // cambiadas y quitadas (sacarCambios).
  avanzar(dt, jugadores) {
    this.t += dt;
    // los trozos vivos: los de alrededor de cada jugador
    for (const p of jugadores) {
      const i0 = Math.floor(p.x / LADO_RED), j0 = Math.floor(p.z / LADO_RED), R = FAUNA.RADIO_VIVO;
      for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
        const k = `${i},${j}`;
        let v = this.trozos.get(k);
        if (!v) {
          v = { liebres: liebresDelTrozo(k, this.habitat, this.semilla).filter(l => this.viva(l.id)).map(l => ({ ...l, casa: { x: l.x, z: l.z }, estado: 'pastar', hasta: this.t + entre(this.r, FAUNA.PASTA), dest: null })), visto: this.t };
          this.trozos.set(k, v);
          for (const l of v.liebres) this.cambiadas.add(l.id);
        }
        v.visto = this.t;
      }
    }
    for (const [k, v] of this.trozos) if (this.t - v.visto > FAUNA.OLVIDO) {
      for (const l of v.liebres) { this.quitadas.push(l.id); this.cambiadas.delete(l.id); }
      this.trozos.delete(k);
    }
    for (const v of this.trozos.values()) for (const l of v.liebres) this.mover(l, dt, jugadores);
  }
  // el que tiene más cerca: { d, p } (d en m)
  static cercano(l, jugadores) {
    let d = Infinity, q = null;
    for (const p of jugadores) { const e = Math.hypot(p.x - l.x, p.z - l.z); if (e < d) { d = e; q = p; } }
    return { d, p: q };
  }
  mover(l, dt, jugadores) {
    const F = FAUNA, r = this.r, antes = l.estado, x0 = l.x, z0 = l.z;
    const { d, p } = Fauna.cercano(l, jugadores);
    const huye = p && d < ((p.vel || 0) > F.CORRE ? F.HUYE_CORRE : F.HUYE);
    if (huye && l.estado !== 'huir') {
      // sale corriendo en dirección contraria (con un poco de azar), de 40 a 70 m
      const a = Math.atan2(l.x - p.x, l.z - p.z) + (r() - 0.5) * 0.8;
      l.estado = 'huir'; l.giro = a; l.queda = entre(r, F.LARGO_HUIDA); l.quiebro = 0.6 + r() * 0.8;
    }
    if (l.estado === 'huir') {
      // algún quiebro y, si delante no se puede (agua, cortado), gira hasta encontrar por dónde
      if ((l.quiebro -= dt) <= 0) { l.giro += (r() - 0.5) * 0.9; l.quiebro = 0.6 + r() * 0.8; }
      if (p) {   // sin dejar de alejarse del que la persigue
        const lejos = Math.atan2(l.x - p.x, l.z - p.z);
        let dif = angulo(lejos - l.giro); if (dif > Math.PI) dif -= Math.PI * 2;
        if (Math.abs(dif) > 1.2) l.giro += Math.sign(dif) * Math.min(Math.abs(dif) - 1.2, 3 * dt);
      }
      const paso = F.VEL_HUIDA * dt;
      if (!this.avanzarHacia(l, l.giro, paso)) { l.queda = 0; }
      l.queda -= paso;
      if (l.queda <= 0) { l.estado = 'alerta'; l.hasta = this.t + F.CALMA; }
    } else if (p && d < F.ALERTA) {
      // alguien cerca: erguida y quieta, mirando (de lado) hacia él
      if (l.estado !== 'alerta') { l.estado = 'alerta'; l.giro = Math.atan2(p.x - l.x, p.z - l.z) + (r() < 0.5 ? 1.3 : -1.3); }
      l.hasta = this.t + F.CALMA;
    } else if (l.estado === 'alerta') {
      if (this.t >= l.hasta) { l.estado = 'pastar'; l.hasta = this.t + entre(r, F.PASTA); }
    } else if (l.estado === 'pastar') {
      if (this.t >= l.hasta) {
        // unos saltos a otro sitio cerca; si está lejos de su querencia, hacia ella
        const lejos = Math.hypot(l.casa.x - l.x, l.casa.z - l.z) > F.RADIO_CASA;
        const a = lejos ? Math.atan2(l.casa.x - l.x, l.casa.z - l.z) + (r() - 0.5) * 0.6 : r() * Math.PI * 2, s = entre(r, F.SALTO);
        const dx = l.x + Math.sin(a) * s, dz = l.z + Math.cos(a) * s;
        if (this.habitat(dx, dz) || lejos) { l.estado = 'saltar'; l.dest = { x: dx, z: dz }; l.giro = a; }
        else l.hasta = this.t + entre(r, F.PASTA);
      }
    } else if (l.estado === 'saltar') {
      const dx = l.dest.x - l.x, dz = l.dest.z - l.z, falta = Math.hypot(dx, dz), paso = F.VEL_SALTO * dt;
      if (falta <= paso || !this.avanzarHacia(l, Math.atan2(dx, dz), Math.min(paso, falta))) {
        l.estado = 'pastar'; l.dest = null; l.hasta = this.t + entre(r, F.PASTA);
      }
    }
    if (l.estado !== antes || Math.abs(l.x - x0) > 0.01 || Math.abs(l.z - z0) > 0.01) this.cambiadas.add(l.id);
  }
  // un paso hacia el ángulo a; si delante no se puede, prueba a girar (hasta 90° a cada lado). false: no hay por dónde.
  avanzarHacia(l, a, paso) {
    for (const g of [0, 0.5, -0.5, 1, -1, 1.57, -1.57]) {
      const b = a + g, x = l.x + Math.sin(b) * paso, z = l.z + Math.cos(b) * paso;
      if (this.pisable(x, z)) { l.x = x; l.z = z; l.giro = b; return true; }
    }
    return false;
  }
  // Lo cambiado desde la última vez: { cambiadas: [foto…], quitadas: [id…] }, y se vacía.
  sacarCambios() {
    const cambiadas = [];
    for (const id of this.cambiadas) { const l = this.de(id); if (l) cambiadas.push(Fauna.foto(l)); }
    const r = { cambiadas, quitadas: this.quitadas };
    this.cambiadas = new Set(); this.quitadas = [];
    return r;
  }
}

// Lo que se manda a cada jugador: solo las liebres de sus trozos (los de la red: VistaTrozos). Lleva qué tiene ya cada uno
// para mandarle enteras las que le entran y, de las demás, solo las que han cambiado. Devuelve, por autor, el mensaje
// { liebres: [foto…], fuera: [id…] } o nada si no hay que mandarle.
export class FaunaEnRed {
  constructor() { this.sabe = new Map(); }   // autor → Set de ids que ya tiene
  repartir(fauna, cambios, autores, trozosDe) {
    const cambiadas = new Set(cambios.cambiadas.map(f => f.id)), r = new Map();
    const todas = fauna.todas();
    for (const a of autores) {
      const tiene = trozosDe(a), sabe = this.sabe.get(a) || new Set(), liebres = [], fuera = [];
      for (const l of todas) {
        const dentro = tiene.has(trozoDe(l.x, l.z));
        if (dentro && (!sabe.has(l.id) || cambiadas.has(l.id))) { liebres.push(Fauna.foto(l)); sabe.add(l.id); }
        else if (!dentro && sabe.has(l.id)) { fuera.push(l.id); sabe.delete(l.id); }
      }
      for (const id of cambios.quitadas) if (sabe.delete(id)) fuera.push(id);
      this.sabe.set(a, sabe);
      if (liebres.length || fuera.length) r.set(a, { liebres, fuera });
    }
    return r;
  }
  quitar(autor) { this.sabe.delete(autor); }
}
