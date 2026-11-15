// Kinhold — el pozo (P11b, «La lluvia y el riego»; lógica pura, sin three.js, comprobable en Node).
// valravnx, 14 nov: «el pozo es algo que define muchísimo el "sobrevivir sin río", con lo que entiendo que debe ser
// laborioso». Una obra por tramos de 1 m: cada tramo se cava con la pala de madera (GOLPES_TRAMO golpes; la tierra
// que sale queda en un montón al lado) y se reviste de piedra seca (PIEDRAS_TRAMO piedras, en uno o varios viajes) antes de bajar más, que si
// no, la pared de tierra se viene abajo. Cuando el último tramo cavado llega al agua y está revestido, el pozo tiene
// agua (sacarla, con el brocal, el travesaño, la cuerda y el cubo, es otra tarea: «El pozo (3)»).
//
// A qué hondura está el agua sale del terreno (lo mira quien lo tiene: el servidor, con honduraEn): cerca de un río,
// poco más abajo que el agua del río; en el fondo de un valle, poco hondo; en un alto, lejos del río, hondo. Más hondo
// que TOPE no se llega: ahí no se puede hacer pozo.
// Los pozos viven en el mundo de construcción (src/logica/construccion.js, Mundo.pozos) y van por las acciones con
// autor (src/logica/acciones.js: «pozo», «cavar_pozo» y «revestir_pozo»): el servidor las valida, las guarda y las
// reparte, y todos los ven. Solo en tu tierra o en la de quien te invita.
// Un pozo: { id, dueno, autor, x, z, hondura, cavados, golpes, revestidos, piedras }. hondura: a cuántos m está el
// agua; cavados: los tramos ya cavados; golpes: los del tramo que se está cavando; revestidos: los tramos con su
// piedra; piedras: las ya puestas en el tramo que se está revistiendo.
//
// Decisiones provisionales (15 nov; anotadas en el diario): los números de abajo y el modelo del agua bajo tierra
// (honduraAgua).

export const TRAMO = 1;              // m: lo que baja cada tramo
export const GOLPES_TRAMO = 10;      // golpes de pala para cavar un tramo (unos 20 s de pala: SEGUNDOS_CAVAR cada uno)
export const SEGUNDOS_CAVAR = 2;     // s: lo que dura cada golpe de pala (lo espera el navegador)
export const PIEDRAS_TRAMO = 8;      // piedras para revestir un tramo (8 × 3 kg)
export const TOPE = 12;              // m: más hondo no se llega con pala
export const HONDURA_MIN = 2;        // m: lo menos hondo que está el agua (junto al río, en el fondo de un valle)
export const POR_M_ENCIMA = 0.1;     // m de hondura por cada m que el sitio queda por encima del río (o del mar)
export const POR_M_RELIEVE = 0.5;    // m de más (o de menos) por cada m que el sitio queda por encima (o por debajo) de lo de alrededor
export const RADIO_POZO = 0.6;       // m: el hoyo
export const ENTRE_POZOS = 4;        // m: como poco entre dos pozos
export const ALCANCE_POZO = 2.5;     // m: de donde estás al pozo, para cavar o revestir
export const TIERRA_TRAMO = Math.round(Math.PI * RADIO_POZO * RADIO_POZO * TRAMO * 100) / 100;   // m³ de tierra que saca cada tramo

const num = Number.isFinite;
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;

// La hondura del agua (m) a partir de lo que se sabe del sitio: suelo, su altura (en la escena); media, la de lo de
// alrededor (a 30 y 90 m); fondo, lo más bajo de alrededor (hasta 300 m: el fondo del valle); rio, el río más cercano
// ({ d: m hasta él, nivel: altura de su agua }) o null; mar, la altura del mar en la escena. El agua bajo tierra va por
// debajo del suelo siguiéndolo de lejos: cuanto más alto queda el sitio sobre lo que lo drena (el fondo del valle, el
// río o el mar, lo más alto de los tres que quede por debajo), más honda; y en un alto de lo de alrededor, más, y en
// una hondonada, menos. Devuelve los m (de HONDURA_MIN a TOPE, con un decimal) o null si queda más hondo que TOPE.
export function honduraAgua({ suelo, media, fondo, rio = null, mar }) {
  if (![suelo, media, fondo, mar].every(num)) return null;
  const drena = Math.max(mar, Math.min(suelo, fondo), rio && num(rio.nivel) && rio.nivel <= suelo ? rio.nivel : -Infinity);
  const h = Math.max(HONDURA_MIN, HONDURA_MIN + POR_M_ENCIMA * (suelo - drena) + POR_M_RELIEVE * (suelo - media));
  return h > TOPE ? null : r1(h);
}

// Lo que el sitio (x, z) de la escena dice del agua bajo tierra, con el terreno del servidor (src/logica/terreno_servidor.js:
// suelo, rioEn y y0): la altura del suelo, la media de alrededor (a 30 y 90 m, en 8 direcciones), lo más bajo de
// alrededor (a 50, 150 y 300 m, en 8 direcciones), el río más cercano y la altura del mar en la escena.
// Devuelve { suelo, media, fondo, rio, mar }.
export function sitioDelAgua(t, x, z) {
  const suelo = t.suelo(x, z), en = (R, i) => t.suelo(x + R * Math.cos(i * Math.PI / 4), z + R * Math.sin(i * Math.PI / 4));
  let s = 0, n = 0, fondo = suelo;
  for (const R of [30, 90]) for (let i = 0; i < 8; i++) { s += en(R, i); n++; }
  for (const R of [50, 150, 300]) for (let i = 0; i < 8; i++) fondo = Math.min(fondo, en(R, i));
  return { suelo, media: s / n, fondo, rio: t.rioEn ? t.rioEn(x, z) : null, mar: -(t.y0 || 0) };
}
// La hondura del agua en (x, z) de la escena con el terreno del servidor, o null (más que TOPE).
export const honduraEn = (t, x, z) => honduraAgua(sitioDelAgua(t, x, z));

// Cuántos tramos tiene un pozo (hasta llegar al agua).
export const tramosDe = (p) => Math.max(1, Math.ceil(p.hondura / TRAMO - 1e-9));
// ¿Ya tiene agua? (cavado hasta el agua y revestido entero)
export const conAgua = (p) => !!p && p.cavados >= tramosDe(p) && p.revestidos >= tramosDe(p);
// m³ de tierra sacada (el montón de al lado)
export const tierraSacada = (p) => r2(p.cavados * TIERRA_TRAMO);
// Lo que le toca: 'cavar', 'revestir' o 'agua' (terminado).
export const siguientePaso = (p) => (conAgua(p) ? 'agua' : p.cavados > p.revestidos ? 'revestir' : 'cavar');
// El pozo más cercano a (x, z), a menos de r m, o null.
export function pozoCercano(m, x, z, r = ALCANCE_POZO) {
  let mejor = null, dm = Infinity;
  for (const p of m.pozos || []) { const d = Math.hypot(p.x - x, p.z - z); if (d <= r && d < dm) { mejor = p; dm = d; } }
  return mejor;
}

// Marcar un pozo en (x, z) (donde estás). hondura: la del agua ahí (la pone el servidor con honduraEn; null, más que
// TOPE). Lo que no sabe la lógica sola (el agua de encima, si hay obra) lo dice m.entorno = { agua(x, z) → bool,
// ocupado(x, z) → bool } (el servidor; sin él, no se mira). Devuelve { ok, pozo, hondura } o { ok: false, motivo }.
export function marcarPozo(m, x, z, hondura, autor) {
  if (!num(x) || !num(z)) return { ok: false, motivo: 'Datos no válidos.' };
  if (!m.pozos) m.pozos = [];
  if (!m.mojonDe(autor) && !m.esInvitado(autor)) return { ok: false, motivo: 'Primero coloca tu mojón.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const e = m.entorno || null;
  if (e && e.agua && e.agua(x, z)) return { ok: false, motivo: 'Aquí hay agua encima: el pozo se cava en seco.' };
  if (hondura === null || hondura === undefined) return { ok: false, motivo: `Aquí el agua está a más de ${TOPE} m: busca más abajo, cerca del río o en el fondo de un valle.` };
  if (!num(hondura) || hondura < HONDURA_MIN || hondura > TOPE) return { ok: false, motivo: 'Datos no válidos.' };
  if ((m.pozos || []).some(p => Math.hypot(p.x - x, p.z - z) < ENTRE_POZOS)) return { ok: false, motivo: 'Ahí al lado ya hay un pozo.' };
  if (e && e.ocupado && e.ocupado(x, z)) return { ok: false, motivo: 'Ahí hay algo: el pozo va en suelo libre.' };
  const pozo = { id: m.siguienteId++, dueno: m.tierraDe(x, z) || autor, autor, x: r2(x), z: r2(z), hondura: r1(hondura), cavados: 0, golpes: 0, revestidos: 0, piedras: 0 };
  m.pozos.push(pozo);
  return { ok: true, pozo: pozo.id, hondura: pozo.hondura, tramos: tramosDe(pozo) };
}

const pozoDe = (m, id) => (m.pozos || []).find(p => p.id === id) || null;

// Un golpe de pala en el pozo de id. Devuelve { ok, pozo, golpes, cavados, tramo (si este golpe acaba un tramo),
// agua (si este tramo llega al agua) } o { ok: false, motivo }.
export function cavarPozo(m, id, autor) {
  const p = pozoDe(m, id);
  if (!p) return { ok: false, motivo: 'Aquí no hay pozo.' };
  if (!m.dentroDeTierra(p.x, p.z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  if (p.cavados >= tramosDe(p)) return { ok: false, motivo: conAgua(p) ? 'El pozo ya tiene agua.' : 'Ya has llegado al agua: reviste de piedra el último tramo.' };
  if (p.cavados > p.revestidos && !globalThis.__mutarPozo) return { ok: false, motivo: 'Reviste antes de piedra este tramo: si bajas más, la tierra se viene abajo.' };
  p.golpes++;
  if (p.golpes < GOLPES_TRAMO) return { ok: true, pozo: p.id, golpes: p.golpes, cavados: p.cavados };
  p.golpes = 0; p.cavados++;
  return { ok: true, pozo: p.id, golpes: 0, cavados: p.cavados, tramo: true, agua: p.cavados >= tramosDe(p), tierra: tierraSacada(p) };
}

// Revestir de piedra seca el tramo cavado, con las piedras que lleva el autor (las que le falten al tramo, o las que
// lleve si son menos: se puede ir y volver por más). gastar(n): cobra hasta n piedras de lo que lleva el autor y dice
// { ok, n: las cobradas } o { ok: false, motivo }. Devuelve { ok, pozo, piedras (las puestas en este tramo), revestidos,
// tramo (si con esto queda revestido), agua (si con esto el pozo ya tiene agua) } o { ok: false, motivo }.
export function revestirPozo(m, id, autor, gastar = () => ({ ok: true })) {
  const p = pozoDe(m, id);
  if (!p) return { ok: false, motivo: 'Aquí no hay pozo.' };
  if (!m.dentroDeTierra(p.x, p.z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  if (p.revestidos >= p.cavados) return { ok: false, motivo: conAgua(p) ? 'El pozo ya está revestido entero.' : 'Antes cava el tramo: aún no hay pared que revestir.' };
  const falta = PIEDRAS_TRAMO - (p.piedras || 0), g = gastar(falta);
  if (!g.ok) return g;
  const n = Number.isInteger(g.n) ? Math.max(0, Math.min(falta, g.n)) : falta;
  if (!n) return { ok: false, motivo: 'No llevas piedras.' };
  p.piedras = (p.piedras || 0) + n;
  if (p.piedras < PIEDRAS_TRAMO) return { ok: true, pozo: p.id, piedras: p.piedras, puestas: n, revestidos: p.revestidos };
  p.piedras = 0; p.revestidos++;
  return { ok: true, pozo: p.id, piedras: PIEDRAS_TRAMO, puestas: n, revestidos: p.revestidos, tramo: true, agua: conAgua(p) };
}

export const exportarPozos = (l) => (l || []).map(p => ({ ...p }));
export function importarPozos(l) {
  return (Array.isArray(l) ? l : []).filter(p => p && num(p.id) && num(p.x) && num(p.z) && num(p.hondura))
    .map(p => ({ id: p.id, dueno: p.dueno, autor: p.autor, x: p.x, z: p.z, hondura: p.hondura,
      cavados: num(p.cavados) ? p.cavados : 0, golpes: num(p.golpes) ? p.golpes : 0, revestidos: num(p.revestidos) ? p.revestidos : 0, piedras: num(p.piedras) ? p.piedras : 0 }));
}
