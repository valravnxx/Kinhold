// Kinhold — los campos de cultivo marcados con estacas (P11, la granja básica; sin gráficos, comprobable en Node).
// diseno/estudios/granja.html y las decisiones de valravnx del 13 nov: el campo se marca clavando estacas (cada una,
// de 1 rama, hecha con las manos) donde estás; de 3 a 16, y al clavar la última junto a la primera el campo se cierra,
// con su linde y su superficie en m². Solo en tu tierra o en la de quien te invita, sin cruzar obras, otros campos ni
// el agua, y sin pasar de una pendiente. Mientras esté vacío (hoy todos: aún no se labra), cada estaca se quita (y
// vuelve a lo que llevas) y se vuelve a clavar en otro sitio: así se mueve.
// Los campos viven en el mundo de construcción (src/logica/construccion.js, Mundo.campos): van por las acciones con
// autor (src/logica/acciones.js: «estaca» y «quitar_estaca»), el servidor las valida y las reparte, y todos los ven.
// Lo que la lógica sola no sabe (el agua, la pendiente, los puestos de trabajo) se lo da quien tiene el terreno:
// mundo.entorno = { agua(x, z) → bool, pendiente(x, z) → m por m, ocupado(x, z) → bool } (el servidor; sin él, no se
// mira).
// Un campo: { id, dueno, autor, puntos: [{ x, z }], cerrado, area }. dueno: de quién es la tierra; autor: quién lo
// está marcando (cada uno, como mucho uno abierto a la vez).

export const MIN_ESTACAS = 3, MAX_ESTACAS = 16;
export const CIERRE = 1.5;          // m: a menos de esto de la primera estaca, la última cierra el campo
export const ENTRE_ESTACAS = 1;     // m: como poco entre una estaca y la anterior
export const LADO_MAX = 50;         // m: como mucho entre dos estacas seguidas (provisional, 13 nov)
export const PENDIENTE_MAX = 0.35;  // m por m: más empinado no se cultiva (provisional, 13 nov: unos 19°)
export const AREA_MIN = 4;          // m²: lo más pequeño que se cierra (provisional)
const PASO = 0.75;                  // m: cada cuánto se mira el tramo entre dos estacas
const HOLGURA_OBRA = 0.3;           // m: lo que se aparta de una obra

const num = Number.isFinite;
const r2 = v => Math.round(v * 100) / 100;

// La superficie de un polígono (fórmula del lazo), en m².
export function areaPoligono(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.z - b.x * a.z; }
  return Math.abs(s) / 2;
}
// ¿Está (x, z) dentro del polígono p? (rayo hacia +x)
export function dentroPoligono(p, x, z) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) d = !d;
  }
  return d;
}
// ¿Se cortan los segmentos ab y cd (sin contar que se toquen en un extremo compartido)?
export function seCortan(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
// Los lados de un campo (el de cierre, solo si está cerrado).
export function ladosDe(c) {
  const l = [];
  for (let i = 0; i + 1 < c.puntos.length; i++) l.push([c.puntos[i], c.puntos[i + 1]]);
  if (c.cerrado && c.puntos.length >= MIN_ESTACAS) l.push([c.puntos[c.puntos.length - 1], c.puntos[0]]);
  return l;
}

// El campo abierto que está marcando autor, o null.
export const campoAbierto = (m, autor) => (m.campos || []).find(c => !c.cerrado && c.autor === autor) || null;
// ¿Cerraría el campo una estaca en (x, z)? (para el aviso del juego)
export function cerraria(m, autor, x, z) {
  const c = campoAbierto(m, autor);
  return !!c && c.puntos.length >= MIN_ESTACAS && Math.hypot(x - c.puntos[0].x, z - c.puntos[0].z) <= CIERRE;
}
// La estaca más cercana a (x, z), a menos de r m: { campo, i, x, z, d } o null.
export function estacaCercana(m, x, z, r = 1.2) {
  let mejor = null;
  for (const c of m.campos || []) c.puntos.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= r && (!mejor || d < mejor.d)) mejor = { campo: c, i, x: p.x, z: p.z, d };
  });
  return mejor;
}
// El campo cerrado en el que está (x, z), o null.
export const campoEn = (m, x, z) => (m.campos || []).find(c => c.cerrado && dentroPoligono(c.puntos, x, z)) || null;

// ¿Vale el tramo de a a b para el campo propio (c, o null si es la primera estaca)? Devuelve el motivo o null.
function malTramo(m, c, a, b, autor, cierre = false) {
  const L = Math.hypot(b.x - a.x, b.z - a.z);
  if (L > LADO_MAX) return 'Demasiado lejos de la estaca anterior.';
  const e = m.entorno || null, n = Math.max(1, Math.ceil(L / PASO));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (!m.dentroDeTierra(x, z, autor)) return 'El linde se sale de tu tierra.';
    if (e && e.agua && e.agua(x, z)) return 'El linde cruza el agua.';
    if (e && e.pendiente && e.pendiente(x, z) > PENDIENTE_MAX) return 'Demasiada pendiente para un campo.';
    if (e && e.ocupado && e.ocupado(x, z)) return 'El linde cruza un puesto.';
    if (m.obrasCerca(x, z, 1).some(o => Math.hypot(o.x - x, o.z - z) < o.r + HOLGURA_OBRA)) return 'El linde cruza una obra.';
    if ((m.decoracion || []).some(d => Math.hypot(d.x - x, d.z - z) < 0.6)) return 'El linde cruza un mueble.';
    if (!globalThis.__mutarCampos) for (const o of m.campos || []) if (o !== c && o.cerrado && dentroPoligono(o.puntos, x, z)) return 'Eso es otro campo.';
  }
  // (globalThis.__mutarCampos: solo para comprobar que la prueba falla sin esto)
  if (!globalThis.__mutarCampos) for (const o of m.campos || []) {
    if (o === c) continue;
    for (const [p, q] of ladosDe(o)) if (seCortan(a, b, p, q)) return 'El linde cruza otro campo.';
  }
  if (c) {   // que no se cruce consigo mismo (los lados que tocan este tramo en un extremo no cuentan)
    const l = ladosDe(c);
    for (let i = 0; i < l.length; i++) {
      const [p, q] = l[i];
      if (p === a || q === a || (cierre && (p === b || q === b))) continue;
      if (seCortan(a, b, p, q)) return 'El linde se cruza consigo mismo.';
    }
  }
  return null;
}

// Clavar una estaca en (x, z). gastar(): cobra la estaca (de lo que lleva el autor) y dice { ok } o { ok: false, motivo };
// solo se llama si se clava (cerrar el campo no gasta: la primera estaca hace de última).
export function clavarEstaca(m, x, z, autor, gastar = () => ({ ok: true })) {
  if (!num(x) || !num(z)) return { ok: false, motivo: 'Datos no válidos.' };
  if (!m.campos) m.campos = [];
  if (!m.mojonDe(autor) && !m.esInvitado(autor)) return { ok: false, motivo: 'Primero coloca tu mojón.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  x = r2(x); z = r2(z);
  const c = campoAbierto(m, autor);
  if (c) {
    const ult = c.puntos[c.puntos.length - 1], pri = c.puntos[0];
    if (c.puntos.length >= MIN_ESTACAS && Math.hypot(x - pri.x, z - pri.z) <= CIERRE) {
      const mal = malTramo(m, c, ult, pri, autor, true);
      if (mal) return { ok: false, motivo: mal };
      const area = areaPoligono(c.puntos);
      if (area < AREA_MIN) return { ok: false, motivo: 'El campo es demasiado pequeño.' };
      c.cerrado = true; c.area = Math.round(area);
      return { ok: true, cerrado: true, campo: c.id, area: c.area };
    }
    if (c.puntos.length >= MAX_ESTACAS) return { ok: false, motivo: 'Ya llevas 16 estacas: clava la última junto a la primera.' };
    if (c.puntos.some(p => Math.hypot(p.x - x, p.z - z) < ENTRE_ESTACAS)) return { ok: false, motivo: 'Ahí ya hay una estaca.' };
    const b = { x, z }, mal = malTramo(m, c, ult, b, autor);
    if (mal) return { ok: false, motivo: mal };
    const g = gastar();
    if (!g.ok) return g;
    c.puntos.push(b);
    return { ok: true, campo: c.id, estacas: c.puntos.length };
  }
  // la primera estaca de un campo nuevo
  const b = { x, z }, mal = malTramo(m, null, b, b, autor);
  if (mal) return { ok: false, motivo: mal === 'El linde cruza otro campo.' ? 'Eso es otro campo.' : mal };
  if (estacaCercana(m, x, z, ENTRE_ESTACAS)) return { ok: false, motivo: 'Ahí ya hay una estaca.' };
  const g = gastar();
  if (!g.ok) return g;
  const nuevo = { id: m.siguienteId++, dueno: m.tierraDe(x, z) || autor, autor, puntos: [b], cerrado: false, area: 0 };
  m.campos.push(nuevo);
  return { ok: true, campo: nuevo.id, estacas: 1, nuevo: true };
}

// Quitar la estaca i del campo (campo: su id). devolver(): la estaca vuelve a lo que lleva el autor ({ ok } o no se
// quita). Un campo cerrado vuelve a quedar abierto (y lo sigue marcando quien quita la estaca), con sus estacas en
// orden desde la siguiente a la quitada; sin estacas, el campo deja de existir.
export function quitarEstaca(m, campo, i, autor, devolver = () => ({ ok: true })) {
  const c = (m.campos || []).find(x => x.id === campo);
  if (!c || !Number.isInteger(i) || i < 0 || i >= c.puntos.length) return { ok: false, motivo: 'Ahí no hay estaca.' };
  const p = c.puntos[i];
  if (!m.dentroDeTierra(p.x, p.z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const otro = campoAbierto(m, autor);
  if (otro && otro !== c) return { ok: false, motivo: 'Termina antes el campo que estás marcando.' };
  if (c.labrado) return { ok: false, motivo: 'El campo ya está labrado: sus estacas no se mueven.' };
  const d = devolver();
  if (!d.ok) return d;
  if (c.cerrado) { c.puntos = [...c.puntos.slice(i + 1), ...c.puntos.slice(0, i)]; c.cerrado = false; c.area = 0; }
  else c.puntos.splice(i, 1);
  c.autor = autor;
  if (!c.puntos.length) m.campos = m.campos.filter(x => x !== c);
  return { ok: true, campo: c.id, estacas: c.puntos.length };
}

// Lo que queda por limpiar en el campo c (P11, «Limpiar el campo»): de cada lista de cosas con { x, z } (los árboles en
// pie, los caídos, los tocones, las matas y las piedras sueltas de alrededor), cuántas caen dentro de su linde.
// Devuelve { arboles, caidos, tocones, matas, piedras, total }.
export function porLimpiar(c, cosas = {}) {
  const r = { arboles: 0, caidos: 0, tocones: 0, matas: 0, piedras: 0, total: 0 };
  if (!c || !c.cerrado || c.puntos.length < MIN_ESTACAS) return r;
  for (const k of ['arboles', 'caidos', 'tocones', 'matas', 'piedras']) {
    for (const o of cosas[k] || []) if (o && num(o.x) && num(o.z) && dentroPoligono(c.puntos, o.x, o.z)) r[k]++;
    r.total += r[k];
  }
  return r;
}

// Para guardar y leer el mundo (Mundo.exportar / importar).
// ---------- Labrar (P11, «Labrar con la azada», 13 nov) ----------
// Con la azada en la mano, cada pasada voltea la tierra en un círculo de RADIO_LABRAR m alrededor de donde apuntas (a
// lo sumo ALCANCE_LABRAR m de donde estás), solo dentro del linde de un campo cerrado y donde no queda nada por limpiar.
// Lo labrado se guarda por casillas de 1 m (1 bit por m²) en la rejilla del campo; lo que se labra y no se siembra vuelve
// a ser hierba pasado PLAZO_BARBECHO desde la última pasada (decisiones provisionales: registro y diario).
// La hora de la pasada (a.t) la pone el servidor: así, al rehacer el mundo, todos cuentan el mismo plazo.
export const RADIO_LABRAR = 1.2;
export const ALCANCE_LABRAR = 3;
export const SEGUNDOS_LABRAR = 2;
export const PLAZO_BARBECHO = 14 * 24 * 3600 * 1000;   // ms: dos semanas reales sin sembrar y vuelve a ser hierba
// la rejilla del campo: casillas de 1 m desde la esquina de su recuadro
export function rejilla(c) {
  // (se guarda en el campo mientras no cambien sus estacas: el decorado la pregunta para cada mata de hierba)
  const n = c.puntos.length, clave = n ? `${n}:${c.puntos[0].x},${c.puntos[0].z}:${c.puntos[n - 1].x},${c.puntos[n - 1].z}` : '';
  if (c._rej && c._rej.clave === clave) return c._rej;
  const xs = c.puntos.map(p => p.x), zs = c.puntos.map(p => p.z);
  const x0 = Math.floor(Math.min(...xs)), z0 = Math.floor(Math.min(...zs));
  const r = { clave, x0, z0, w: Math.max(1, Math.ceil(Math.max(...xs)) - x0), h: Math.max(1, Math.ceil(Math.max(...zs)) - z0) };
  Object.defineProperty(c, '_rej', { value: r, writable: true, enumerable: false, configurable: true });
  return r;
}
const aBase64 = (u8) => (globalThis.Buffer ? globalThis.Buffer.from(u8).toString('base64') : btoa(Array.from(u8, b => String.fromCharCode(b)).join('')));
function deBase64(t, n) {
  const u8 = new Uint8Array(n);
  try {
    const b = globalThis.Buffer ? globalThis.Buffer.from(t, 'base64') : Uint8Array.from(atob(t), ch => ch.charCodeAt(0));
    u8.set(b.subarray ? b.subarray(0, n) : b.slice(0, n));
  } catch (e) { /* roto: sin labrar */ }
  return u8;
}
// los bits de lo labrado (en memoria, sin guardar: se rehacen de c.labrado, también si c.labrado cambia por fuera, como
// cuando al navegador le llega el campo de nuevo del servidor)
function ponerBits(c, b) {
  Object.defineProperty(c, '_bits', { value: b, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(c, '_bitsDe', { value: c.labrado, writable: true, enumerable: false, configurable: true });
  return b;
}
function bits(c) {
  if (c._bits && c._bitsDe === c.labrado) return c._bits;
  const r = rejilla(c), n = Math.ceil(r.w * r.h / 8);
  return ponerBits(c, c.labrado ? deBase64(c.labrado, n) : new Uint8Array(n));
}
// ¿Sigue labrado el campo (no ha pasado el plazo desde la última pasada, o ya tiene algo sembrado: lo sembrado no vuelve
// a ser hierba)?
export const labradoVivo = (c, ahora) => !!(c && c.labradoEn && (ahora - c.labradoEn <= PLAZO_BARBECHO || sembrado(c)));
// ¿Está labrado (x, z) en el campo c a la hora ahora?
export function labradoEn(c, x, z, ahora) {
  if (!labradoVivo(c, ahora)) return false;
  const r = rejilla(c), i = Math.floor(x) - r.x0, j = Math.floor(z) - r.z0;
  if (i < 0 || j < 0 || i >= r.w || j >= r.h) return false;
  const k = j * r.w + i;
  return !!(bits(c)[k >> 3] & (1 << (k & 7)));
}
// Las casillas labradas del campo (sus esquinas, en m): [{ x, z }]
export function casillasLabradas(c, ahora) {
  if (!labradoVivo(c, ahora)) return [];
  const r = rejilla(c), b = bits(c), out = [];
  for (let k = 0; k < r.w * r.h; k++) if (b[k >> 3] & (1 << (k & 7))) out.push({ x: r.x0 + (k % r.w), z: r.z0 + Math.floor(k / r.w) });
  return out;
}
// ¿Algún sitio labrado de algún campo en (x, z)?
export const labradoAqui = (m, x, z, ahora) => (m.campos || []).some(c => c.cerrado && labradoEn(c, x, z, ahora));
// Una pasada de azada en (x, z) del campo de id campo, a la hora t. entorno.estorbo(x, z, r): lo que queda por limpiar
// ahí (lo dice quien tiene el mundo: el servidor). Devuelve { ok, campo, nuevas, labradas } o { ok: false, motivo }.
export function labrar(m, campo, x, z, t, autor) {
  if (!num(x) || !num(z) || !num(t)) return { ok: false, motivo: 'Datos no válidos.' };
  const c = (m.campos || []).find(k => k.id === campo);
  if (!c || !c.cerrado) return { ok: false, motivo: 'Aquí no hay ningún campo cerrado.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  if (!dentroPoligono(c.puntos, x, z)) return { ok: false, motivo: 'Fuera del campo: se labra dentro de su linde.' };
  const e = m.entorno || null;
  if (e && e.estorbo && e.estorbo(x, z, RADIO_LABRAR, c)) return { ok: false, motivo: 'Antes limpia ahí: quedan árboles, tocones, matas o piedras.' };
  const r = rejilla(c);
  const b = labradoVivo(c, t) ? bits(c) : new Uint8Array(Math.ceil(r.w * r.h / 8));   // pasado el plazo, vuelve a ser hierba
  let nuevas = 0;
  const i0 = Math.floor(x - RADIO_LABRAR) - r.x0, i1 = Math.floor(x + RADIO_LABRAR) - r.x0, j0 = Math.floor(z - RADIO_LABRAR) - r.z0, j1 = Math.floor(z + RADIO_LABRAR) - r.z0;
  for (let j = Math.max(0, j0); j <= Math.min(r.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(r.w - 1, i1); i++) {
    const cx = r.x0 + i + 0.5, cz = r.z0 + j + 0.5;
    if ((cx - x) ** 2 + (cz - z) ** 2 > RADIO_LABRAR * RADIO_LABRAR || !dentroPoligono(c.puntos, cx, cz)) continue;
    const k = j * r.w + i;
    if (!(b[k >> 3] & (1 << (k & 7)))) { b[k >> 3] |= 1 << (k & 7); nuevas++; }
  }
  if (!nuevas) return { ok: false, motivo: 'Ahí ya está labrado.' };
  c.labradoEn = t;
  c.labrado = aBase64(b); ponerBits(c, b);
  let labradas = 0; for (const v of b) { let q = v; while (q) { labradas += q & 1; q >>= 1; } }
  return { ok: true, campo: c.id, nuevas, labradas };
}

// ---------- Sembrar y crecer (P11, «Sembrar y crecer», 13 nov) ----------
// Sobre la tierra labrada (y aún sin sembrar), con las semillas en la mano. La cebada, a voleo: cada pasada esparce un
// círculo de RADIO_VOLEO m donde apuntas (todas las casillas labradas de 1 m cuyo centro cae dentro) y gasta 1 puñado
// cada M2_POR_PUNADO m² (al menos 1). Las habas, la col y el nabo, planta a planta, a su distancia de las demás (1
// semilla cada una). Todo crece por fases (brote, verde, espiga o cabeza, maduro) en una semana real (valravnx, 13 nov),
// por el tiempo pasado desde que se sembró, con la hora del servidor: así todos ven lo mismo.
// En el campo: c.voleo = { t: [hora de cada pasada], celdas: base64 (1 byte por casilla: 0 sin sembrar, i+1 la pasada
// i) } y c.plantas = [{ c: cultivo, x, z, t }]. (Decisiones provisionales: registro y diario.)
export const CULTIVOS = {
  cebada: { semilla: 'semilla_cebada', voleo: true, nombre: 'cebada' },
  habas: { semilla: 'habas', distancia: 0.35, nombre: 'habas' },
  col: { semilla: 'semilla_col', distancia: 0.6, nombre: 'col' },
  nabo: { semilla: 'semilla_nabo', distancia: 0.3, nombre: 'nabo' },
};
export const CULTIVO_DE_SEMILLA = Object.fromEntries(Object.entries(CULTIVOS).map(([k, v]) => [v.semilla, k]));
export const RADIO_VOLEO = 2;          // m
export const M2_POR_PUNADO = 10;       // m² sembrados con cada puñado de cebada
export const ALCANCE_SEMBRAR = 3;      // m: como mucho, de donde estás a donde siembras
export const SEGUNDOS_VOLEO = 1.5, SEGUNDOS_PLANTAR = 1;
export const CRECER = 7 * 24 * 3600 * 1000;   // ms: de sembrar a maduro, una semana real (valravnx)
export const FASES = ['brote', 'verde', 'espiga', 'maduro'];   // (la col y el nabo: «cabeza» en vez de espiga)
export const LIMITE_FASES = [0.15, 0.5, 1];                    // fracción de CRECER en la que empieza cada fase siguiente
const MAX_PASADAS_VOLEO = 255, MAX_PLANTAS = 6000;
// La fase (0 a 3) de algo sembrado a la hora t, a la hora ahora.
export function fase(t, ahora) {
  const f = (ahora - t) / CRECER;
  return f < LIMITE_FASES[0] ? 0 : f < LIMITE_FASES[1] ? 1 : f < LIMITE_FASES[2] ? 2 : 3;
}
export const nombreFase = (cultivo, i) => (i === 2 && cultivo !== 'cebada' && cultivo !== 'habas' ? 'cabeza' : i === 2 && cultivo === 'habas' ? 'vaina' : FASES[i]);
// La hora a la que cambia de fase algo sembrado a la hora t (después de ahora), o Infinity si ya está maduro.
export function siguienteCambio(t, ahora) {
  for (const l of LIMITE_FASES) { const h = t + l * CRECER; if (h > ahora) return h; }
  return Infinity;
}
export const sembrado = (c) => !!(c && ((c.voleo && c.voleo.t && c.voleo.t.length && celdasVoleo(c).some(Boolean)) || (c.plantas && c.plantas.length)));
// los bytes de lo sembrado a voleo (en memoria, rehechos de c.voleo.celdas si cambia por fuera, como los de lo labrado)
function celdasVoleo(c) {
  const v = c.voleo, n = rejilla(c).w * rejilla(c).h;
  if (c._voleo && c._voleoDe === (v ? v.celdas : null) && c._voleo.length === n) return c._voleo;
  const u8 = v && v.celdas ? deBase64(v.celdas, n) : new Uint8Array(n);
  Object.defineProperty(c, '_voleo', { value: u8, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(c, '_voleoDe', { value: v ? v.celdas : null, writable: true, enumerable: false, configurable: true });
  return u8;
}
// La hora a la que se sembró a voleo la casilla de (x, z), o null.
export function voleoEn(c, x, z) {
  if (!c || !c.voleo) return null;
  const r = rejilla(c), i = Math.floor(x) - r.x0, j = Math.floor(z) - r.z0;
  if (i < 0 || j < 0 || i >= r.w || j >= r.h) return null;
  const p = celdasVoleo(c)[j * r.w + i];
  return p ? c.voleo.t[p - 1] : null;
}
// Las casillas sembradas a voleo: [{ x, z, t }] (x, z: su esquina)
export function casillasVoleo(c) {
  if (!c || !c.voleo) return [];
  const r = rejilla(c), u = celdasVoleo(c), out = [];
  for (let k = 0; k < u.length; k++) if (u[k]) out.push({ x: r.x0 + (k % r.w), z: r.z0 + Math.floor(k / r.w), t: c.voleo.t[u[k] - 1] });
  return out;
}
// La planta más cercana a (x, z) en el campo, a menos de r m: { p, d } o null.
export function plantaCercana(c, x, z, r) {
  let mejor = null;
  for (const p of (c && c.plantas) || []) { const d = Math.hypot(p.x - x, p.z - z); if (d <= r && (!mejor || d < mejor.d)) mejor = { p, d }; }
  return mejor;
}
// ¿Se puede sembrar algo de cultivo en (x, z) del campo c a la hora t? Devuelve null o el motivo (para el aviso del
// juego, sin mandar nada).
export function malSembrar(c, cultivo, x, z, t) {
  const cu = CULTIVOS[cultivo];
  if (!cu) return 'Eso no se siembra.';
  if (!c || !c.cerrado) return 'Aquí no hay ningún campo cerrado.';
  if (!dentroPoligono(c.puntos, x, z)) return 'Fuera del campo: se siembra dentro de su linde.';
  if (cu.voleo) return null;   // (lo de cada casilla lo mira sembrarVoleo)
  if (!labradoEn(c, x, z, t)) return 'Primero labra ahí.';
  if (voleoEn(c, x, z) !== null) return 'Ahí ya está sembrado.';
  const otra = plantaCercana(c, x, z, 2);
  if (otra && otra.d < Math.max(cu.distancia, CULTIVOS[otra.p.c] ? CULTIVOS[otra.p.c].distancia : 0)) return 'Demasiado cerca de otra planta.';
  return null;
}
// Sembrar cultivo en (x, z) del campo de id campo, a la hora t. gastar(n): cobra n semillas de lo que lleva el autor
// ({ ok } o { ok: false, motivo }). Devuelve { ok, campo, cultivo, nuevas | planta } o { ok: false, motivo }.
export function sembrar(m, campo, cultivo, x, z, t, autor, gastar = () => ({ ok: true })) {
  if (!num(x) || !num(z) || !num(t)) return { ok: false, motivo: 'Datos no válidos.' };
  const c = (m.campos || []).find(k => k.id === campo);
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const mal = malSembrar(c, cultivo, x, z, t);
  if (mal) return { ok: false, motivo: mal };
  const cu = CULTIVOS[cultivo];
  if (cu.voleo) {
    if (!c.voleo) c.voleo = { t: [], celdas: '' };
    if (c.voleo.t.length >= MAX_PASADAS_VOLEO) return { ok: false, motivo: 'Ya no caben más pasadas en este campo.' };
    const r = rejilla(c), u = celdasVoleo(c).slice(), nueva = c.voleo.t.length + 1;
    let nuevas = 0;
    const i0 = Math.floor(x - RADIO_VOLEO) - r.x0, i1 = Math.floor(x + RADIO_VOLEO) - r.x0, j0 = Math.floor(z - RADIO_VOLEO) - r.z0, j1 = Math.floor(z + RADIO_VOLEO) - r.z0;
    for (let j = Math.max(0, j0); j <= Math.min(r.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(r.w - 1, i1); i++) {
      const cx = r.x0 + i + 0.5, cz = r.z0 + j + 0.5;
      if ((cx - x) ** 2 + (cz - z) ** 2 > RADIO_VOLEO * RADIO_VOLEO || u[j * r.w + i]) continue;
      if (!labradoEn(c, cx, cz, t)) continue;
      if (!globalThis.__mutarSembrar && (c.plantas || []).some(p => Math.floor(p.x) === r.x0 + i && Math.floor(p.z) === r.z0 + j)) continue;   // (no encima de lo plantado)
      u[j * r.w + i] = nueva; nuevas++;
    }
    if (!nuevas) return { ok: false, motivo: 'Ahí no queda tierra labrada sin sembrar.' };
    const punados = Math.max(1, Math.round(nuevas / M2_POR_PUNADO));
    const g = gastar(punados);
    if (!g.ok) return g;
    c.voleo = { t: [...c.voleo.t, t], celdas: aBase64(u) };
    if (c.escarda) { const b = bitsEscarda(c).slice(); for (let k = 0; k < u.length; k++) if (u[k] === nueva) b[k >> 3] &= ~(1 << (k & 7)); guardarEscarda(c, b); }   // (lo recién sembrado, aún sin escardar)
    return { ok: true, campo: c.id, cultivo, nuevas, punados };
  }
  if (!c.plantas) c.plantas = [];
  if (c.plantas.length >= MAX_PLANTAS) return { ok: false, motivo: 'Ya no caben más plantas en este campo.' };
  const g = gastar(1);
  if (!g.ok) return g;
  const planta = { c: cultivo, x: r2(x), z: r2(z), t };
  c.plantas.push(planta);
  return { ok: true, campo: c.id, cultivo, planta };
}

// ---------- Cosechar (P11, «Cosechar», 13 nov) ----------
// La cebada madura se siega con la hoz de sílex a pasadas: cada pasada siega un círculo de RADIO_SEGAR m donde apuntas
// (las casillas sembradas a voleo y maduras) y deja en el suelo una gavilla cada M2_POR_GAVILLA m² segados (lo que
// sobra de m² se guarda en el campo para la siguiente pasada). Las habas, la col y el nabo maduros se cogen a mano, uno a
// uno. Cada planta da unas 4 veces lo sembrado (la proporción de la época; provisional): un puñado de cebada siembra 10 m²
// y lo segado de 10 m² da 4 gavillas; una haba da 4 habas; una semilla de col da la col y 3 semillas, y la de nabo, el
// nabo y 3 semillas. Lo segado o cogido deja la tierra labrada (sin sembrar).
export const RADIO_SEGAR = 1.2, ALCANCE_SEGAR = 3, SEGUNDOS_SEGAR = 2, SEGUNDOS_COGER = 1;
export const M2_POR_GAVILLA = 2.5;
export const DA_PLANTA = { habas: { habas: 4 }, col: { col: 1, semilla_col: 3 }, nabo: { nabo: 1, semilla_nabo: 3 } };
const MADURO = 3;
// La planta madura más cercana a (x, z), a menos de r m: { p, i, d } o null (con todas: también las verdes, si todas).
export function plantaMadura(c, x, z, ahora, r = 0.6, todas = false) {
  let mejor = null;
  ((c && c.plantas) || []).forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= r && (todas || fase(p.t, ahora) === MADURO) && (!mejor || d < mejor.d)) mejor = { p, i, d };
  });
  return mejor;
}
// Cuántas casillas de cebada hay a menos de RADIO_SEGAR de (x, z): { maduras, verdes }
export function cebadaCerca(c, x, z, ahora) {
  const r = { maduras: 0, verdes: 0 };
  if (!c || !c.voleo) return r;
  const g = rejilla(c), u = celdasVoleo(c);
  for (let j = Math.max(0, Math.floor(z - RADIO_SEGAR) - g.z0); j <= Math.min(g.h - 1, Math.floor(z + RADIO_SEGAR) - g.z0); j++)
    for (let i = Math.max(0, Math.floor(x - RADIO_SEGAR) - g.x0); i <= Math.min(g.w - 1, Math.floor(x + RADIO_SEGAR) - g.x0); i++) {
      const k = j * g.w + i, cx = g.x0 + i + 0.5, cz = g.z0 + j + 0.5;
      if (!u[k] || (cx - x) ** 2 + (cz - z) ** 2 > RADIO_SEGAR * RADIO_SEGAR) continue;
      if (globalThis.__mutarCosechar || fase(c.voleo.t[u[k] - 1], ahora) === MADURO) r.maduras++; else r.verdes++;
    }
  return r;
}
// Segar en (x, z) del campo de id campo, a la hora t. Devuelve { ok, campo, segadas, gavillas } o { ok: false, motivo }.
export function segar(m, campo, x, z, t, autor) {
  if (!num(x) || !num(z) || !num(t)) return { ok: false, motivo: 'Datos no válidos.' };
  const c = (m.campos || []).find(k => k.id === campo);
  if (!c || !c.cerrado) return { ok: false, motivo: 'Aquí no hay ningún campo cerrado.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const hay = cebadaCerca(c, x, z, t);
  if (!hay.maduras) return { ok: false, motivo: hay.verdes ? 'La cebada aún no está madura.' : 'Aquí no hay cebada que segar.' };
  const g = rejilla(c), u = celdasVoleo(c).slice();
  let segadas = 0, escardadas = 0, cuenta = 0;   // (cuenta: los m² que valen, con lo escardado de más)
  for (let j = Math.max(0, Math.floor(z - RADIO_SEGAR) - g.z0); j <= Math.min(g.h - 1, Math.floor(z + RADIO_SEGAR) - g.z0); j++)
    for (let i = Math.max(0, Math.floor(x - RADIO_SEGAR) - g.x0); i <= Math.min(g.w - 1, Math.floor(x + RADIO_SEGAR) - g.x0); i++) {
      const k = j * g.w + i, cx = g.x0 + i + 0.5, cz = g.z0 + j + 0.5;
      if (!u[k] || (cx - x) ** 2 + (cz - z) ** 2 > RADIO_SEGAR * RADIO_SEGAR) continue;
      if (!globalThis.__mutarCosechar && fase(c.voleo.t[u[k] - 1], t) !== MADURO) continue;   // (lo verde se queda)
      u[k] = 0; segadas++;
      if (escardadaK(c, k)) { escardadas++; if (!globalThis.__mutarEscardar) cuenta += EXTRA_ESCARDA - 1; }
    }
  cuenta += segadas;
  if (escardadas) { const b = bitsEscarda(c).slice(); for (let k = 0; k < u.length; k++) if (!u[k]) b[k >> 3] &= ~(1 << (k & 7)); guardarEscarda(c, b); }   // (lo segado, de nuevo sin escardar)
  const total = (num(c.segado) ? c.segado : 0) + cuenta, gavillas = Math.floor(total / M2_POR_GAVILLA + 1e-9);
  c.segado = Math.round((total - gavillas * M2_POR_GAVILLA) * 100) / 100;
  c.voleo = { t: [...c.voleo.t], celdas: aBase64(u) };
  if (c.labradoEn < t) c.labradoEn = t;   // (lo segado queda labrado: el barbecho cuenta desde ahora)
  return { ok: true, campo: c.id, segadas, gavillas, escardadas };
}
// Coger a mano la planta madura más cercana a (x, z) del campo. Devuelve { ok, campo, cultivo, da } o { ok: false, motivo }.
export function cogerPlanta(m, campo, x, z, t, autor) {
  if (!num(x) || !num(z) || !num(t)) return { ok: false, motivo: 'Datos no válidos.' };
  const c = (m.campos || []).find(k => k.id === campo);
  if (!c || !c.cerrado) return { ok: false, motivo: 'Aquí no hay ningún campo cerrado.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const p = plantaMadura(c, x, z, t);
  if (!p) return { ok: false, motivo: plantaMadura(c, x, z, t, 0.6, true) ? 'Aún no está madura.' : 'Aquí no hay nada que coger.' };
  c.plantas = c.plantas.filter((_, i) => i !== p.i);
  if (c.labradoEn < t) c.labradoEn = t;
  const da = { ...DA_PLANTA[p.p.c] };
  if (p.p.e && !globalThis.__mutarEscardar) { const k = p.p.c === 'habas' ? 'habas' : 'semilla_' + p.p.c; da[k] = (da[k] || 0) + 1; }   // (escardada, 1 más: una haba, o una semilla)
  return { ok: true, campo: c.id, cultivo: p.p.c, da, escardada: !!p.p.e };
}

// ---------- Escardar (P11, «Escardar», 14 nov) ----------
// valravnx, 14 nov: «meteremos… escardar». Mientras lo sembrado está verde o echando espiga (las fases 1 y 2) salen
// malas hierbas entre ello, como en la época (la escarda de junio). Con las manos vacías o con la azada, cada pasada
// escarda un círculo de RADIO_ESCARDAR m donde apuntas (unos 2 s): las casillas sembradas a voleo y las plantas que hay
// en él, en esas fases. Es optativo y da más al cosechar: la cebada, cada m² escardado cuenta EXTRA_ESCARDA m² al hacer
// gavillas (5 gavillas en vez de 4 de lo que siembra un puñado); cada planta escardada da 1 más de lo que da (decisiones
// provisionales: registro y diario). Sin escardar se cosecha como siempre.
// En el campo: c.escarda = base64 (1 bit por casilla de la rejilla, como lo labrado) y en cada planta, p.e = 1.
export const RADIO_ESCARDAR = 1.2, ALCANCE_ESCARDAR = 3, SEGUNDOS_ESCARDAR = 2;
export const EXTRA_ESCARDA = 1.25;
// ¿Tiene malas hierbas algo sembrado a la hora t (y escardado o no), a la hora ahora? (fases verde y espiga)
export const conHierbas = (t, ahora, escardado) => !escardado && (globalThis.__mutarEscardar ? true : fase(t, ahora) === 1 || fase(t, ahora) === 2);
// los bits de lo escardado (en memoria, rehechos de c.escarda si cambia por fuera)
function bitsEscarda(c) {
  const r = rejilla(c), n = Math.ceil(r.w * r.h / 8);
  if (c._esc && c._escDe === (c.escarda || null) && c._esc.length === n) return c._esc;
  const b = c.escarda ? deBase64(c.escarda, n) : new Uint8Array(n);
  Object.defineProperty(c, '_esc', { value: b, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(c, '_escDe', { value: c.escarda || null, writable: true, enumerable: false, configurable: true });
  return b;
}
function guardarEscarda(c, b) {
  c.escarda = aBase64(b);
  Object.defineProperty(c, '_esc', { value: b, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(c, '_escDe', { value: c.escarda, writable: true, enumerable: false, configurable: true });
}
// ¿Está escardada la casilla k de la rejilla del campo?
const escardadaK = (c, k) => !!(c.escarda && (bitsEscarda(c)[k >> 3] & (1 << (k & 7))));
// ¿Está escardada la casilla de (x, z)?
export function escardadoEn(c, x, z) {
  if (!c || !c.escarda) return false;
  const r = rejilla(c), i = Math.floor(x) - r.x0, j = Math.floor(z) - r.z0;
  return i >= 0 && j >= 0 && i < r.w && j < r.h && escardadaK(c, j * r.w + i);
}
// Lo que tiene malas hierbas a menos de RADIO_ESCARDAR de (x, z), a la hora ahora: { casillas: [k], plantas: [i] }
export function hierbasCerca(c, x, z, ahora) {
  const out = { casillas: [], plantas: [] };
  if (!c) return out;
  if (c.voleo) {
    const g = rejilla(c), u = celdasVoleo(c);
    for (let j = Math.max(0, Math.floor(z - RADIO_ESCARDAR) - g.z0); j <= Math.min(g.h - 1, Math.floor(z + RADIO_ESCARDAR) - g.z0); j++)
      for (let i = Math.max(0, Math.floor(x - RADIO_ESCARDAR) - g.x0); i <= Math.min(g.w - 1, Math.floor(x + RADIO_ESCARDAR) - g.x0); i++) {
        const k = j * g.w + i, cx = g.x0 + i + 0.5, cz = g.z0 + j + 0.5;
        if (!u[k] || (cx - x) ** 2 + (cz - z) ** 2 > RADIO_ESCARDAR * RADIO_ESCARDAR) continue;
        if (conHierbas(c.voleo.t[u[k] - 1], ahora, escardadaK(c, k))) out.casillas.push(k);
      }
  }
  ((c.plantas) || []).forEach((p, i) => { if ((p.x - x) ** 2 + (p.z - z) ** 2 <= RADIO_ESCARDAR * RADIO_ESCARDAR && conHierbas(p.t, ahora, p.e)) out.plantas.push(i); });
  return out;
}
// Escardar en (x, z) del campo de id campo, a la hora t. Devuelve { ok, campo, casillas, plantas } o { ok: false, motivo }.
export function escardar(m, campo, x, z, t, autor) {
  if (!num(x) || !num(z) || !num(t)) return { ok: false, motivo: 'Datos no válidos.' };
  const c = (m.campos || []).find(k => k.id === campo);
  if (!c || !c.cerrado) return { ok: false, motivo: 'Aquí no hay ningún campo cerrado.' };
  if (!m.dentroDeTierra(x, z, autor)) return { ok: false, motivo: 'Fuera de tu tierra.' };
  const h = hierbasCerca(c, x, z, t);
  if (!h.casillas.length && !h.plantas.length) return { ok: false, motivo: 'Aquí no hay malas hierbas que quitar.' };
  if (h.casillas.length) { const b = bitsEscarda(c).slice(); for (const k of h.casillas) b[k >> 3] |= 1 << (k & 7); guardarEscarda(c, b); }
  if (h.plantas.length) c.plantas = c.plantas.map((p, i) => (h.plantas.includes(i) ? { ...p, e: 1 } : p));
  return { ok: true, campo: c.id, casillas: h.casillas.length, plantas: h.plantas.length };
}

// Para guardar y leer el mundo (Mundo.exportar / importar).
export const exportarCampos = (l) => (l || []).map(c => ({ id: c.id, dueno: c.dueno, autor: c.autor, puntos: c.puntos.map(p => ({ ...p })), cerrado: c.cerrado, area: c.area,
  ...(c.labrado ? { labrado: c.labrado, labradoEn: c.labradoEn } : {}),
  ...(c.voleo && c.voleo.t.length ? { voleo: { t: [...c.voleo.t], celdas: c.voleo.celdas } } : {}),
  ...(c.plantas && c.plantas.length ? { plantas: c.plantas.map(p => ({ ...p })) } : {}),
  ...(c.segado ? { segado: c.segado } : {}),
  ...(c.escarda ? { escarda: c.escarda } : {}) }));
export function importarCampos(l) {
  if (!Array.isArray(l)) return [];
  return l.filter(c => c && Number.isInteger(c.id) && Array.isArray(c.puntos))
    .map(c => ({ id: c.id, dueno: c.dueno, autor: c.autor, puntos: c.puntos.filter(p => p && num(p.x) && num(p.z)).map(p => ({ x: p.x, z: p.z })), cerrado: !!c.cerrado, area: num(c.area) ? c.area : 0,
      // (13 nov) lo labrado: los bits en base64 y la hora de la última pasada
      ...(typeof c.labrado === 'string' && c.labrado.length < 200000 && num(c.labradoEn) ? { labrado: c.labrado, labradoEn: c.labradoEn } : {}),
      // (13 nov) lo sembrado: a voleo (las horas de cada pasada y un byte por casilla) y planta a planta
      ...(c.voleo && Array.isArray(c.voleo.t) && c.voleo.t.every(num) && typeof c.voleo.celdas === 'string' && c.voleo.celdas.length < 2000000 ? { voleo: { t: [...c.voleo.t], celdas: c.voleo.celdas } } : {}),
      ...(num(c.segado) && c.segado > 0 && c.segado < 100 ? { segado: c.segado } : {}),
      // (14 nov) lo escardado: 1 bit por casilla, como lo labrado; en cada planta, e
      ...(typeof c.escarda === 'string' && c.escarda.length < 200000 ? { escarda: c.escarda } : {}),
      ...(Array.isArray(c.plantas) ? { plantas: c.plantas.filter(p => p && CULTIVOS[p.c] && num(p.x) && num(p.z) && num(p.t)).map(p => ({ c: p.c, x: p.x, z: p.z, t: p.t, ...(p.e ? { e: 1 } : {}) })) } : {}) }));
}
