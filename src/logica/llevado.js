// Lo que se ve que lleva un jugador (roadmap, hito «Equipo y carga»: «lo que llevas se ve puesto en el personaje»).
// Lógica pura (sin three.js): sale del inventario por huecos (src/logica/inventario.js) y es lo que se dibuja en el
// personaje (src/juego/llevado.js). En línea lo saca el servidor de su inventario (el que vale) y lo reparte con el
// aspecto de cada jugador, así los demás ven lo mismo sin fiarse del navegador.
//
// { cintura: tipo | null,            el cinturón
//   colgado: [tipo | null, …],       lo de cada hueco del cinturón (como mucho 4), en su orden
//   espalda: tipo | null,            la mochila o el bastidor
//   dentro:  { tipo: n, … },         lo que lleva dentro la espalda, sumado por tipo (se ve asomar)
//   hombro:  tipo | null,            el saco, la bandolera, el odre o el tronco corto
//   der: tipo | null, izq: tipo | null, n: { der, izq }   lo de cada mano y cuántos; lo grande va en 'der' con dos: true
//   dos: bool }                      lo de la mano derecha es grande y ocupa las dos
//
// Decisiones provisionales (anotadas en el diario y en el registro de la demo):
//  - Lo que se ve de lo de dentro de la espalda es lo que más hay de cada tipo, sumado (no hueco por hueco).
//  - En la mano solo se ve un objeto aunque haya varios apilados (tres piedras: una piedra en la mano).
import { CATALOGO } from './inventario.js';

const MAX_COLGADO = 4, MAX_DENTRO = 8, MAX_N = 999;
const tipo = c => (c && typeof c.tipo === 'string' ? c.tipo : null);

export function llevadoDe(lugares, cat = CATALOGO) {
  const l = lugares || {};
  const cint = l.cintura, esp = l.espalda;
  const der = l['mano:der'], izq = l['mano:izq'];
  const dentro = {};
  for (const c of (esp && esp.dentro) || []) if (c && cat[c.tipo]) dentro[c.tipo] = (dentro[c.tipo] || 0) + (c.n || 1);
  const r = {
    cintura: tipo(cint),
    colgado: ((cint && cint.dentro) || []).slice(0, MAX_COLGADO).map(tipo),
    espalda: tipo(esp),
    dentro,
    hombro: tipo(l.hombro),
    der: tipo(der), izq: tipo(izq),
    n: { der: der ? der.n || 1 : 0, izq: izq ? izq.n || 1 : 0 },
    dos: false,
  };
  // lo grande en una mano ocupa las dos: se dibuja una vez, entre las dos manos
  const grande = t => t && cat[t] && cat[t].tam === 'G';
  if (grande(r.izq) && !r.der) { r.der = r.izq; r.n.der = r.n.izq; r.izq = null; r.n.izq = 0; }
  if (grande(r.der)) { r.dos = true; r.izq = null; r.n.izq = 0; }
  return r;
}

// Comprueba lo que llega por la red (o de un guardado): cada tipo tiene que existir en el catálogo y estar en su
// sitio (un cinturón en la cintura, una mochila a la espalda…); lo que no vale se quita. Devuelve el limpio o null.
export function normalizarLlevado(m, cat = CATALOGO) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const vale = t => typeof t === 'string' && Object.prototype.hasOwnProperty.call(cat, t);
  const en = (t, lugar) => (vale(t) && (cat[t].lugar === lugar || (lugar === 'hombro' && cat[t].hombro)) ? t : null);
  const mano = t => (vale(t) && cat[t].tam !== 'E' ? t : null);
  const num = v => (Number.isInteger(v) && v > 0 ? Math.min(v, MAX_N) : 0);
  const dentro = {};
  if (m.dentro && typeof m.dentro === 'object' && !Array.isArray(m.dentro))
    for (const [t, n] of Object.entries(m.dentro).slice(0, MAX_DENTRO)) if (vale(t) && num(n)) dentro[t] = num(n);
  const r = {
    cintura: en(m.cintura, 'cintura'),
    colgado: Array.isArray(m.colgado) ? m.colgado.slice(0, MAX_COLGADO).map(t => (vale(t) && cat[t].tam !== 'G' && cat[t].tam !== 'E' ? t : null)) : [],
    espalda: en(m.espalda, 'espalda'),
    dentro,
    hombro: en(m.hombro, 'hombro'),
    der: mano(m.der), izq: mano(m.izq),
    n: { der: 0, izq: 0 },
    dos: false,
  };
  if (!r.cintura) r.colgado = [];
  if (!r.espalda) r.dentro = {};
  const nn = m.n && typeof m.n === 'object' ? m.n : {};
  r.n.der = r.der ? num(nn.der) || 1 : 0; r.n.izq = r.izq ? num(nn.izq) || 1 : 0;
  if (r.der && cat[r.der].tam === 'G') { r.dos = true; r.izq = null; r.n.izq = 0; }
  else if (r.izq && cat[r.izq].tam === 'G') { r.izq = null; r.n.izq = 0; }
  return r;
}

// Huella para saber si ha cambiado (y no rehacer los modelos ni volver a mandarlo si no).
export const huellaLlevado = l => JSON.stringify(l || null);
