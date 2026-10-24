// Sonidos sintetizados (sin archivos). Suenan solo después de que el jugador toque o haga clic.
let ctx = null, maestro = null;
export function activarSonido() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    maestro = ctx.createGain(); maestro.gain.value = 0.5; maestro.connect(ctx.destination);
  } catch (e) { ctx = null; }
}
export function silenciar(si) { if (maestro) maestro.gain.value = si ? 0 : 0.5; }

function ruido(dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function envolvente(g, t0, ataque, caida, pico) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(pico, t0 + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + caida);
}
function tono(frec, tipo, dur, pico, destino, t0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.value = frec;
  envolvente(g, t0, 0.003, dur, pico);
  o.connect(g); g.connect(destino); o.start(t0); o.stop(t0 + dur + 0.05);
}

// Choque de aceros: golpe de ruido agudo + parciales metálicos que resuenan
export function acero(fuerte = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = ruido(0.08), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.5;
  envolvente(g, t, 0.002, 0.07, 0.6 * fuerte);
  n.connect(f); f.connect(g); g.connect(maestro); n.start(t);
  for (const [fr, p] of [[1870, 0.12], [2930, 0.08], [4410, 0.05]]) tono(fr * (0.97 + Math.random() * 0.06), 'sine', 0.45 * fuerte, p * fuerte, maestro, t);
}
// Corte en carne o tela: ruido grave y breve
export function corte() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = ruido(0.15), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = 900;
  envolvente(g, t, 0.004, 0.13, 0.7);
  n.connect(f); f.connect(g); g.connect(maestro); n.start(t);
  tono(95, 'sine', 0.12, 0.35, maestro, t);
}
// Golpe contundente o en madera
export function golpeSordo() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tono(70, 'sine', 0.18, 0.6, maestro, t);
  const n = ruido(0.06), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = 500;
  envolvente(g, t, 0.002, 0.05, 0.5);
  n.connect(f); f.connect(g); g.connect(maestro); n.start(t);
}
// Silbido del arma al cortar el aire
export function silbido() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = ruido(0.25), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
  envolvente(g, t, 0.06, 0.16, 0.18);
  n.connect(f); f.connect(g); g.connect(maestro); n.start(t);
}
// Cuerda del arco al soltar
export function cuerda() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tono(165, 'triangle', 0.25, 0.4, maestro, t);
  tono(330, 'sine', 0.15, 0.12, maestro, t);
}
// Flecha clavándose
export function clavar() { golpeSordo(); }
