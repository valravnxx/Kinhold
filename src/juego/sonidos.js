// Kinhold — los sonidos del mundo, hechos por código con Web Audio (sin archivos): de momento, los del árbol que se tala
// (tarea «Crujido de aviso y daño», 12 nov): el crujido de aviso cuando está a punto de caer, el chasquido al soltarse
// y el golpe sordo al dar en el suelo. Suenan más flojos cuanto más lejos (a 40 m ya no se oyen).
//
// Cómo se hacen (provisional, para afinar de oído):
//  - crujido: la madera que se dobla es un gemido grave y desigual (una sierra muy grave, de tono que sube y baja a
//    tirones, por un filtro estrecho) con chasquidos sueltos de fibra que se rompe (ráfagas cortas de ruido agudo).
//  - chasquido: una ráfaga de ruido seca y fuerte con un golpe grave debajo.
//  - golpe en el suelo: ruido grave filtrado que cae en medio segundo, con un temblor de ramas (ruido medio, más largo).
// El navegador no deja sonar nada hasta que el jugador ha tocado la página: se crea el contexto al primer sonido y, si
// está parado, se intenta reanudar (si no puede, ese sonido no suena; los avisos de texto siguen saliendo).

const OIDO = 40;   // m: más allá, no se oye
let ctx = null, ruido = null;
export const oidos = [];   // lo que ha sonado (las pruebas): { que, vol }

function contexto() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  // dos segundos de ruido blanco, para todo
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
function rafaga(c, salida, t, { dura, frec, q = 1, tipo = 'bandpass', vol = 1, ataque = 0.004 }) {
  const s = c.createBufferSource(); s.buffer = ruido; s.loop = true;
  const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0008, t + dura);
  s.connect(f); f.connect(g); g.connect(salida);
  s.start(t, Math.random() * 1.5); s.stop(t + dura + 0.05);
}

// distancia: m desde quien escucha (0 si es el suyo)
export function sonar(que, distancia = 0) {
  const vol = Math.max(0, 1 - distancia / OIDO) ** 1.5;
  oidos.push({ que, vol: Math.round(vol * 100) / 100 }); if (oidos.length > 20) oidos.shift();
  if (vol <= 0.01) return;
  const c = contexto(); if (!c || c.state !== 'running' && c.state !== 'suspended') return;
  const t = c.currentTime + 0.02, salida = c.createGain(); salida.gain.value = vol * 0.6; salida.connect(c.destination);
  if (que === 'crujido') {
    const dura = 1.6;
    const o = c.createOscillator(); o.type = 'sawtooth';
    // el tono a tirones: sube y baja entre 55 y 110 Hz
    o.frequency.setValueAtTime(70, t);
    for (let k = 1; k <= 8; k++) o.frequency.linearRampToValueAtTime(55 + Math.random() * 55, t + dura * k / 8);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0, t);
    for (let k = 1; k <= 10; k++) g.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.6, t + dura * 0.9 * k / 10);
    g.gain.linearRampToValueAtTime(0, t + dura);
    o.connect(f); f.connect(g); g.connect(salida); o.start(t); o.stop(t + dura + 0.05);
    for (let k = 0; k < 7; k++) rafaga(c, salida, t + Math.random() * dura, { dura: 0.03 + Math.random() * 0.05, frec: 1800 + Math.random() * 2500, q: 2, vol: 0.5 });
  } else if (que === 'chasquido') {
    rafaga(c, salida, t, { dura: 0.25, frec: 2200, q: 0.7, vol: 1, ataque: 0.002 });
    rafaga(c, salida, t + 0.01, { dura: 0.4, frec: 160, tipo: 'lowpass', q: 1, vol: 0.9 });
    for (let k = 0; k < 4; k++) rafaga(c, salida, t + 0.05 + k * 0.06 + Math.random() * 0.04, { dura: 0.05, frec: 2500 + Math.random() * 2000, q: 2, vol: 0.4 });
  } else if (que === 'suelo') {
    rafaga(c, salida, t, { dura: 0.6, frec: 90, tipo: 'lowpass', q: 1, vol: 1.2, ataque: 0.006 });
    rafaga(c, salida, t + 0.02, { dura: 1.1, frec: 1200, q: 0.6, vol: 0.35, ataque: 0.05 });   // las ramas
  }
}
