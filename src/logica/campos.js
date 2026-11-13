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
export const exportarCampos = (l) => (l || []).map(c => ({ ...c, puntos: c.puntos.map(p => ({ ...p })) }));
export function importarCampos(l) {
  if (!Array.isArray(l)) return [];
  return l.filter(c => c && Number.isInteger(c.id) && Array.isArray(c.puntos))
    .map(c => ({ id: c.id, dueno: c.dueno, autor: c.autor, puntos: c.puntos.filter(p => p && num(p.x) && num(p.z)).map(p => ({ x: p.x, z: p.z })), cerrado: !!c.cerrado, area: num(c.area) ? c.area : 0 }));
}
