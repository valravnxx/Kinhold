// Kinhold — la medida de rendimiento de cada aparato, para mandarla al servidor (hito «Orden», 12 nov).
// Con un botón del panel de rendimiento se mide un rato (MEDIR_SEGUNDOS) lo que tarda cada fotograma, los triángulos y
// las llamadas de dibujo, y se manda al servidor con lo que se sabe del aparato (navegador, tarjeta gráfica, pantalla,
// perfil gráfico). El servidor la apunta en rendimiento.jsonl con la cuenta, y la cuenta de admin ve las últimas.
// Lógica pura (sin three.js ni red): la usan el navegador (src/mundo/rendimiento.js) y el servidor
// (servidor/sistemas/rendimiento.mjs).

export const MEDIR_SEGUNDOS = 10;        // lo que dura una medida
export const ENVIAR_CADA_MS = 15000;     // una medida por jugador cada tanto, como mucho (el servidor la rechaza antes)
export const ULTIMAS = 30;               // las que ve el admin
export const DEMASIADO_PRONTO = 'Espera un poco antes de mandar otra medida.';
export const NO_VALE = 'Medida no válida.';

// Lo que se va midiendo, fotograma a fotograma: ms que tarda (desde el anterior), triángulos y llamadas de dibujo.
export class TomaRendimiento {
  constructor() { this.n = 0; this.suma = 0; this.peor = 0; this.tri = 0; this.triMax = 0; this.llam = 0; this.llamMax = 0; this.lentos = 0; }
  fotograma(ms, triangulos, llamadas) {
    if (!(ms > 0) || !Number.isFinite(ms)) return;
    this.n++; this.suma += ms; this.peor = Math.max(this.peor, ms);
    if (ms > 50) this.lentos++;   // por debajo de 20 fotogramas por segundo: un tirón que se nota
    this.tri += triangulos || 0; this.triMax = Math.max(this.triMax, triangulos || 0);
    this.llam += llamadas || 0; this.llamMax = Math.max(this.llamMax, llamadas || 0);
  }
  // null si aún no hay fotogramas
  resultado() {
    if (!this.n) return null;
    return {
      segundos: +(this.suma / 1000).toFixed(1), fotogramas: this.n,
      fps: +(this.n * 1000 / this.suma).toFixed(1), ms: +(this.suma / this.n).toFixed(1), peor: Math.round(this.peor), lentos: this.lentos,
      triangulos: Math.round(this.tri / this.n), triangulosMax: this.triMax, llamadas: Math.round(this.llam / this.n), llamadasMax: this.llamMax,
    };
  }
}

const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
const ent = (v, min, max) => { const n = num(v, min, max); return n === null ? null : Math.round(n); };
const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : null);

// La medida que llega del navegador, limpia: solo lo que toca, números en su sitio y textos cortos; null si no vale.
export function validarMedida(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const r = m.resultado, a = m.aparato;
  if (!r || typeof r !== 'object' || !a || typeof a !== 'object') return null;
  const res = {
    segundos: num(r.segundos, 0.5, 120), fotogramas: ent(r.fotogramas, 1, 100000),
    fps: num(r.fps, 0, 1000), ms: num(r.ms, 0, 60000), peor: ent(r.peor, 0, 600000), lentos: ent(r.lentos, 0, 100000),
    triangulos: ent(r.triangulos, 0, 1e9), triangulosMax: ent(r.triangulosMax, 0, 1e9), llamadas: ent(r.llamadas, 0, 1e6), llamadasMax: ent(r.llamadasMax, 0, 1e6),
  };
  if (Object.values(res).some(v => v === null)) return null;
  const ancho = ent(a.ancho, 1, 20000), alto = ent(a.alto, 1, 20000);
  if (ancho === null || alto === null) return null;
  return {
    resultado: res,
    aparato: {
      navegador: txt(a.navegador, 200) || '?', grafica: txt(a.grafica, 120) || '?',
      ancho, alto, resolucion: num(a.resolucion, 0.1, 8) ?? 1,
      nucleos: ent(a.nucleos, 1, 512), memoria: num(a.memoria, 0.1, 1024), tactil: a.tactil === true,
    },
    perfil: txt(m.perfil, 30), nota: txt(m.nota, 80),
  };
}

// Puede mandar otra medida (el último envío de este jugador, en ms; null si ninguno)
export function puedeMandar(ultimo, ahora) { return ultimo === null || ultimo === undefined || ahora - ultimo >= ENVIAR_CADA_MS; }

// Una línea para leerla de un vistazo: «58 fps · peor 41 ms · 120 mil tri · 85 llamadas · 1920×1080 ×1 · alta»
export function resumenMedida(e) {
  const r = e.resultado, a = e.aparato;
  return `${Math.round(r.fps)} fps · peor ${r.peor} ms · ${Math.round(r.triangulos / 1000)} mil tri · ${r.llamadas} llamadas · ${a.ancho}×${a.alto} ×${a.resolucion}${e.perfil ? ' · ' + e.perfil : ''}`;
}
