// Kinhold — el ciclo de día y noche (valravnx, 7 nov: «el ciclo dia y noche, cielo estrellado limpio, sol y luna, y
// toda la iluminación dinámica que dará el sol»). Lógica pura (sin three.js): la hora del mundo, dónde están el sol, la
// luna y las estrellas, y los colores y las luces de cada momento. El navegador lo dibuja (src/mundo/cielo.js) y el
// servidor da la hora (la suya, en la bienvenida: todos ven el mismo cielo).
//
// GDD (apartado 2): «Día de 2 h y noche de 1 h»; un ciclo, 3 horas reales. GDD (noche): «oscura pero jugable: la luna,
// las antorchas, los candiles y las hogueras dan luz de verdad». Así:
//   - la hora del mundo va de 0 a 24: el día, de 6 a 18 (2 h reales), y la noche, de 18 a 6 (1 h real). El sol sale a
//     las 6 por el este, a mediodía está al sur, a 48° de alto, y se pone a las 18 por el oeste (el norte es −z).
//   - la luna sigue el mismo camino, retrasada respecto al sol según su fase (llena: sale cuando se pone el sol); una
//     vuelta de fases cada 8 días del mundo (un día real). Su cara iluminada sale de dónde está el sol (src/mundo/cielo.js).
//   - las estrellas giran alrededor del polo norte del cielo, a 42° sobre el horizonte norte.
//   - los colores: por lo alto que está el sol, entre momentos fijos (noche cerrada, crepúsculo, el sol en el horizonte,
//     la hora dorada, la tarde y el día, que es la luz «mañana» del estilo v5). De noche, la luna alumbra según su fase.
// Decisiones provisionales (registro de la demo): el 0 del reloj, la latitud, las 8 noches de la luna y los colores.

export const CICLO_MS = 3 * 3600e3;       // un día del mundo: 3 horas reales
export const DIA_MS = 2 * 3600e3;         // de ellas, el día (de 6 a 18)
export const LUNA_DIAS = 8;               // días del mundo de una luna llena a la siguiente
export const LATITUD = 42 * Math.PI / 180;   // de ella sale lo alto del sol a mediodía (90° − 42° = 48°) y el polo
// el 0 del reloj (el 7 nov de 2026, 6:00 en la hora de la península, UTC+1): sale el sol y empieza la luna nueva
export const ORIGEN_MS = Date.UTC(2026, 10, 7, 5, 0, 0);

const TAU = Math.PI * 2;
const mod = (a, b) => ((a % b) + b) % b;

// la hora del mundo (0–24) y cuántos días han pasado, a partir de la hora real (ms, la del servidor)
export function horaDe(ms) {
  const t = ms - ORIGEN_MS, dias = Math.floor(t / CICLO_MS), f = mod(t, CICLO_MS);
  const DIA = globalThis.__mutarCielo === 1 ? CICLO_MS / 2 : DIA_MS;   // (la prueba lo rompe a propósito: día y noche iguales)
  const hora = f < DIA ? 6 + 12 * f / DIA : mod(18 + 12 * (f - DIA) / (CICLO_MS - DIA), 24);
  return { hora, dias: dias + (hora < 6 ? 1 : 0) };   // (el día cambia a medianoche)
}
// y al revés: qué hora real (la siguiente desde «desde») tiene esa hora del mundo
export function msDeHora(hora, desde = ORIGEN_MS) {
  hora = mod(hora, 24);
  const f = hora >= 6 && hora < 18 ? (hora - 6) / 12 * DIA_MS : DIA_MS + mod(hora - 18, 24) / 12 * (CICLO_MS - DIA_MS);
  const base = ORIGEN_MS + Math.floor((desde - ORIGEN_MS) / CICLO_MS) * CICLO_MS;
  return base + f < desde ? base + CICLO_MS + f : base + f;
}

// la dirección (unitaria, en la escena: x este, y arriba, z sur) de algo del cielo con ángulo horario h (0: al sur, en
// lo más alto; −π/2: en el este) y declinación 0, como el sol en el equinoccio
export function direccionHoraria(h, latitud = LATITUD) {
  return [-Math.sin(h), Math.cos(latitud) * Math.cos(h), Math.sin(latitud) * Math.cos(h)];
}
// el polo norte del cielo (alrededor de él giran las estrellas)
export const POLO = [0, Math.sin(LATITUD), -Math.cos(LATITUD)];

// fase de la luna: 0 nueva, 0,5 llena; y lo que se ve iluminado (0–1)
export function faseLuna(hora, dias) {
  const p = mod((dias + (hora - 6) / 24) / LUNA_DIAS, 1);
  return { fase: p, luz: (1 - Math.cos(TAU * p)) / 2 };
}

// Momentos fijos, por lo alto del sol (grados). arriba / horizonte: el cielo (sRGB); sol: la luz del sol (color e
// intensidad); hemi: la luz del cielo (de arriba, del suelo, intensidad). El día es la luz «mañana» del estilo v5
// (src/mundo/estilos.js) y la tarde, la «tarde».
export const MOMENTOS = [
  { alto: -18, arriba: 0x060a14, horizonte: 0x111a2a, sol: [0xff8a4a, 0], hemi: [0x7c92d4, 0x40465c, 2.3] },
  { alto: -8, arriba: 0x141d36, horizonte: 0x3c3a52, sol: [0xff8a4a, 0], hemi: [0x8896cc, 0x484656, 2.3] },
  { alto: -2, arriba: 0x34476a, horizonte: 0xb97a62, sol: [0xff7a3c, 0], hemi: [0xaaa8c2, 0x54494a, 2.3] },
  { alto: 3, arriba: 0x6a82a0, horizonte: 0xe8955a, sol: [0xff9a5a, 1.6], hemi: [0xc0b8c4, 0x6a5238, 1.7] },
  { alto: 10, arriba: 0x86a2c0, horizonte: 0xf0c08c, sol: [0xffbf80, 2.7], hemi: [0xc2c4d2, 0x76603c, 1.25] },
  { alto: 22, arriba: 0x7fa6cc, horizonte: 0xecd9b6, sol: [0xffd49c, 3.3], hemi: [0xbccbe2, 0x806c44, 1.0] },
  { alto: 40, arriba: 0x79a5d2, horizonte: 0xe4dfcc, sol: [0xffe4bc, 3.3], hemi: [0xb8cdea, 0x847248, 1.0] },
];
// la luz de la luna (llena y alta; se multiplica por su fase y lo alto que está) y lo que añade a la luz del cielo
export const LUNA = { color: 0xa8bce8, intensidad: 0.85, hemi: 0.3 };

const canal = (c, k) => (c >> (16 - 8 * k)) & 255;
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const srgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
// mezcla dos colores hex sRGB en luz lineal (así el paso de uno a otro no se ensucia)
export function mezclar(a, b, t) {
  let r = 0;
  for (let k = 0; k < 3; k++) r = (r << 8) | Math.max(0, Math.min(255, srgb(lin(canal(a, k)) * (1 - t) + lin(canal(b, k)) * t)));
  return r;
}
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// los colores y las luces para un sol a «alto» grados (interpolando entre los momentos)
export function momentoDe(alto) {
  const M = MOMENTOS;
  if (alto <= M[0].alto) return { ...M[0] };
  if (alto >= M[M.length - 1].alto) return { ...M[M.length - 1] };
  let i = 0; while (alto > M[i + 1].alto) i++;
  const a = M[i], b = M[i + 1], t = suave(a.alto, b.alto, alto);
  const n = (x, y) => x + (y - x) * t;
  return {
    alto, arriba: mezclar(a.arriba, b.arriba, t), horizonte: mezclar(a.horizonte, b.horizonte, t),
    sol: [mezclar(a.sol[0], b.sol[0], t), n(a.sol[1], b.sol[1])],
    hemi: [mezclar(a.hemi[0], b.hemi[0], t), mezclar(a.hemi[1], b.hemi[1], t), n(a.hemi[2], b.hemi[2])],
  };
}

// Todo el cielo de un momento: ms (hora real del servidor) o { hora, dias } fijados (las pruebas, el admin).
// Devuelve la hora, el sol y la luna (dirección, alto en grados), la fase, el giro de las estrellas, cuánto se ven, los
// colores del cielo y la luz que alumbra la escena: la del sol de día y la de la luna de noche (una sola luz con
// sombras: de la una a la otra cuando el sol se ha puesto y aún no alumbra nada).
export function cieloDe(ms, fijo = null) {
  const { hora, dias } = fijo || horaDe(ms);
  const ang = TAU * (hora - 12) / 24;                    // ángulo horario del sol
  const sol = direccionHoraria(ang);
  const { fase, luz } = fijo && fijo.fase !== undefined ? { fase: fijo.fase, luz: (1 - Math.cos(TAU * fijo.fase)) / 2 } : faseLuna(hora, dias);
  const luna = direccionHoraria(ang - TAU * fase);
  const altoSol = Math.asin(sol[1]) * 180 / Math.PI, altoLuna = Math.asin(luna[1]) * 180 / Math.PI;
  const m = momentoDe(altoSol);
  const estrellas = suave(-3, -12, altoSol);
  // la luz de la luna: según su fase y lo alto que está, y solo cuando el sol ya no alumbra
  const deNoche = suave(-1, -7, altoSol);
  const fuerzaLuna = LUNA.intensidad * luz * suave(0, 12, altoLuna) * deNoche;
  // la luz con sombras: la del sol mientras alumbra (hasta un poco por debajo del horizonte), luego la de la luna
  const usaLuna = altoSol < -1.5;
  let luzDir = usaLuna ? luna : sol, luzColor = usaLuna ? LUNA.color : m.sol[0], luzI = usaLuna ? fuerzaLuna : m.sol[1] * (globalThis.__mutarCielo === 2 ? 1 : suave(-1.5, 2, altoSol));   // (2: sin fundido)
  // la sombra no se calcula con la luz rasante (sale a tiras): la dirección, como mucho a 8° del horizonte
  const d = [...luzDir];
  if (d[1] < Math.sin(8 * Math.PI / 180)) {
    const h = Math.hypot(d[0], d[2]) || 1, y = Math.sin(8 * Math.PI / 180), k = Math.cos(8 * Math.PI / 180) / h;
    d[0] *= k; d[2] *= k; d[1] = y;
  }
  return {
    hora, dias, sol, luna, altoSol, altoLuna, fase, luzLuna: luz, giro: ang, estrellas,
    arriba: m.arriba, horizonte: m.horizonte,
    luz: { direccion: d, color: luzColor, intensidad: luzI, deLuna: usaLuna },
    hemi: { arriba: m.hemi[0], suelo: m.hemi[1], intensidad: m.hemi[2] + LUNA.hemi * luz * suave(-5, 10, altoLuna) * deNoche },
    // el color del sol para el cielo (el halo y el disco)
    colorSol: m.sol[0],
  };
}

// la hora del mundo como texto (para el panel y el admin): «14:05»
export function horaTexto(hora) {
  const m = Math.floor(mod(hora, 24) * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
