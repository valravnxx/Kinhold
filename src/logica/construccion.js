// Kinhold — lógica de construcción (sin gráficos, comprobable en Node)
import { PIEZAS, DECORACION, MODULO, ALTURA, RECUPERACION, MAX_PLANTA, MATERIALES_INICIALES } from './piezas.js';

export const RADIO_MOJON = 20;        // radio de tierra del mojón de nivel 1 (m)
export const DIST_ENGANCHE = 3 * MODULO; // a esta distancia de una construcción, se encaja en su rejilla

const HUECOS_ARISTA = new Set(['e', 'b', 'g', 'p']);

export function clave(hueco, i, j, k, d) {
  return HUECOS_ARISTA.has(hueco) ? `${hueco}:${i},${j},${k},${d}` : `${hueco}:${i},${j},${k}`;
}

// ---------- Conversión de coordenadas (mismo convenio que three.js con rotation.y = rot) ----------
export function localAMundo(c, lx, lz) {
  const co = Math.cos(c.rot), si = Math.sin(c.rot);
  return { x: c.ox + lx * co + lz * si, z: c.oz - lx * si + lz * co };
}
export function mundoALocal(c, x, z) {
  const dx = x - c.ox, dz = z - c.oz;
  const co = Math.cos(c.rot), si = Math.sin(c.rot);
  return { lx: dx * co - dz * si, lz: dx * si + dz * co };
}

// Centro local (metros) de una pieza
export function centroLocal(p) {
  const S = MODULO;
  switch (p.hueco) {
    case 'f': case 'r': case 'l': return { lx: (p.i + 0.5) * S, lz: (p.j + 0.5) * S };
    case 'v': return { lx: p.i * S, lz: p.j * S };
    default: // aristas
      return p.d === 0 ? { lx: (p.i + 0.5) * S, lz: p.j * S } : { lx: p.i * S, lz: (p.j + 0.5) * S };
  }
}
export function centroMundo(c, p) {
  const l = centroLocal(p);
  return localAMundo(c, l.lx, l.lz);
}

// Hueco de la rejilla más cercano a un punto local (en metros) para un tipo de hueco
export function huecoDesdeLocal(hueco, lx, lz, k) {
  const u = lx / MODULO, v = lz / MODULO;
  if (hueco === 'v') return { hueco, i: Math.round(u), j: Math.round(v), k };
  const i = Math.floor(u), j = Math.floor(v);
  if (hueco === 'f' || hueco === 'r' || hueco === 'l') return { hueco, i, j, k };
  const fu = u - i, fv = v - j;
  const opciones = [
    { dist: fv, i, j, d: 0 },
    { dist: 1 - fv, i, j: j + 1, d: 0 },
    { dist: fu, i, j, d: 1 },
    { dist: 1 - fu, i: i + 1, j, d: 1 },
  ];
  opciones.sort((a, b) => a.dist - b.dist);
  const o = opciones[0];
  return { hueco, i: o.i, j: o.j, k, d: o.d };
}

// ---------- Mundo ----------
export class Mundo {
  constructor() {
    this.construcciones = [];
    this.decoracion = [];
    this.mojon = null; // { x, z }
    this.materiales = { ...MATERIALES_INICIALES };
    this.siguienteId = 1;
  }

  // --- materiales ---
  puedePagar(coste) {
    return Object.entries(coste).every(([m, n]) => (this.materiales[m] || 0) >= n);
  }
  faltan(coste) {
    return Object.entries(coste).filter(([m, n]) => (this.materiales[m] || 0) < n).map(([m, n]) => ({ m, n, hay: this.materiales[m] || 0 }));
  }
  pagar(coste) { for (const [m, n] of Object.entries(coste)) this.materiales[m] -= n; }
  devolver(coste, fraccion) {
    const devuelto = {};
    for (const [m, n] of Object.entries(coste)) {
      const r = Math.floor(n * fraccion);
      if (r > 0) { this.materiales[m] = (this.materiales[m] || 0) + r; devuelto[m] = r; }
    }
    return devuelto;
  }

  // --- tierra ---
  colocarMojon(x, z) {
    if (this.mojon) return { ok: false, motivo: 'Ya tienes un mojón.' };
    const coste = PIEZAS.mojon.coste;
    if (!this.puedePagar(coste)) return { ok: false, motivo: 'Faltan materiales.', faltan: this.faltan(coste) };
    this.pagar(coste);
    this.mojon = { x, z };
    return { ok: true };
  }
  dentroDeTierra(x, z) {
    if (!this.mojon) return false;
    return Math.hypot(x - this.mojon.x, z - this.mojon.z) <= RADIO_MOJON;
  }

  // --- elegir rejilla ---
  // Devuelve la construcción cuya rejilla debe usar una pieza colocada en (x,z), o null si va suelta.
  construccionCercana(x, z) {
    let mejor = null, mejorDist = Infinity;
    for (const c of this.construcciones) {
      if (c.piezas.size === 0) continue;
      for (const p of c.piezas.values()) {
        const m = centroMundo(c, p);
        const dd = Math.hypot(m.x - x, m.z - z);
        if (dd < mejorDist) { mejorDist = dd; mejor = c; }
      }
    }
    return mejorDist <= DIST_ENGANCHE ? mejor : null;
  }

  // Calcula la pieza candidata (sin colocarla) para un tipo en un punto del mundo.
  // rotLibre: giro elegido por el jugador cuando la pieza empieza una construcción nueva.
  candidata(tipo, x, z, k, rotLibre = 0, dir = 0) {
    const def = PIEZAS[tipo];
    if (!def || def.hueco === 'libre') return null;
    let c = this.construccionCercana(x, z);
    let nueva = false;
    if (!c) {
      // la primera pieza fija la rejilla: el punto queda en el centro de la casilla (0,0)
      const co = Math.cos(rotLibre), si = Math.sin(rotLibre);
      const ox = x - (MODULO / 2) * co - (MODULO / 2) * si;
      const oz = z + (MODULO / 2) * si - (MODULO / 2) * co;
      c = { id: -1, ox, oz, rot: rotLibre, piezas: new Map() };
      nueva = true;
    }
    const l = mundoALocal(c, x, z);
    const h = huecoDesdeLocal(def.hueco, l.lx, l.lz, k);
    const p = { tipo, ...h, dir, abierta: false };
    if (!HUECOS_ARISTA.has(p.hueco)) delete p.d;
    return { construccion: c, nueva, pieza: p };
  }

  // ---------- Apoyos ----------
  // Devuelve { suelo: bool, lista: [claves] } siguiendo prioridades realistas.
  soportes(c, p) {
    const def = PIEZAS[p.tipo];
    const { i, j, k } = p;
    // solo cuentan como apoyo las piezas que pueden sostener peso (cercas, empalizadas y
    // medio muro tienen capacidad 0 y nunca sostienen nada; los tejados solo sostienen
    // el tramo de tejado de al lado, nunca muros ni suelos)
    const tiene = (key) => { const q = c.piezas.get(key); return !!q && PIEZAS[q.tipo].cap > 0; };
    const filtra = (keys) => keys.filter(tiene);
    // piezas iguales (suelo o tejado) en las casillas de al lado que descansan directamente en muros o vigas
    const vecinasApoyadas = (hueco, i, j, k) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([di, dj]) => clave(hueco, i + di, j + dj, k))
      .filter(key => {
        const q = c.piezas.get(key);
        if (!q) return false;
        return aristasDeCasilla(q.i, q.j, k - 1).some(a => tiene(clave('e', ...a)) || tiene(clave('b', ...a)));
      });

    switch (p.hueco) {
      case 'f': {
        if (k === 0) return { suelo: true, lista: [] };
        const directo = filtra(aristasDeCasilla(i, j, k - 1).flatMap(a => [clave('e', ...a), clave('b', ...a)]));
        if (directo.length) return { suelo: false, lista: directo };
        // vano de una casilla: se apoya en los suelos vecinos que sí tienen muros o vigas debajo
        return { suelo: false, lista: vecinasApoyadas('f', i, j, k) };
      }
      case 'v': {
        if (k === 0) return { suelo: true, lista: [] };
        const abajo = clave('v', i, j, k - 1);
        if (tiene(abajo)) return { suelo: false, lista: [abajo] };
        return { suelo: false, lista: filtra(casillasDeVertice(i, j).map(([a, b]) => clave('f', a, b, k))) };
      }
      case 'e': {
        if (def.suelo) return { suelo: k === 0, lista: [] };
        const d = p.d;
        const debajo = k > 0 ? filtra([clave('e', i, j, k - 1, d), clave('b', i, j, k - 1, d)]) : [];
        if (debajo.length) return { suelo: false, lista: debajo };
        const [v1, v2] = verticesDeArista(i, j, d);
        const postes = [clave('v', ...v1, k), clave('v', ...v2, k)];
        if (postes.every(tiene)) return { suelo: false, lista: postes };
        return { suelo: false, lista: filtra(casillasDeArista(i, j, d).map(([a, b]) => clave('f', a, b, k))) };
      }
      case 'b': {
        const [v1, v2] = verticesDeArista(i, j, p.d);
        const postes = [clave('v', ...v1, k), clave('v', ...v2, k)];
        if (postes.every(tiene)) return { suelo: false, lista: postes };
        return { suelo: false, lista: filtra([clave('e', i, j, k, p.d)]) };
      }
      case 'r': {
        if (k === 0) return { suelo: false, lista: [] };
        const directo = filtra(aristasDeCasilla(i, j, k - 1).flatMap(a => [clave('e', ...a), clave('b', ...a)]));
        if (directo.length) return { suelo: false, lista: directo };
        // vano de una casilla: se apoya en los tramos de tejado vecinos que sí descansan en muros o vigas
        return { suelo: false, lista: vecinasApoyadas('r', i, j, k) };
      }
      case 'g': {
        if (k === 0) return { suelo: false, lista: [] };
        return { suelo: false, lista: filtra([clave('e', i, j, k - 1, p.d), clave('b', i, j, k - 1, p.d)]) };
      }
      case 'p': {
        const muro = c.piezas.get(clave('e', i, j, k, p.d));
        if (muro && PIEZAS[muro.tipo].conPuerta) return { suelo: false, lista: [clave('e', i, j, k, p.d)] };
        return { suelo: false, lista: [] };
      }
      case 'l': {
        const f = clave('f', i, j, k);
        if (tiene(f)) return { suelo: false, lista: [f] };
        return { suelo: k === 0, lista: [] };
      }
    }
    return { suelo: false, lista: [] };
  }

  apoyada(c, p) {
    const s = this.soportes(c, p);
    return s.suelo || s.lista.length > 0;
  }

  // ---------- Carga ----------
  // Carga que soporta cada pieza (kg encima de ella), repartiendo a partes iguales entre sus apoyos.
  cargas(c) {
    const sostiene = new Map(); // clave apoyo -> [claves de piezas que descansan en él]
    const nApoyos = new Map();
    for (const [key, p] of c.piezas) {
      const s = this.soportes(c, p);
      nApoyos.set(key, s.suelo ? 0 : s.lista.length);
      if (s.suelo) continue;
      for (const a of s.lista) {
        if (!sostiene.has(a)) sostiene.set(a, []);
        sostiene.get(a).push(key);
      }
    }
    const memo = new Map();
    const enCurso = new Set();
    const carga = (key) => {
      if (memo.has(key)) return memo.get(key);
      if (enCurso.has(key)) return 0; // no debería pasar: los apoyos siempre están por debajo
      enCurso.add(key);
      let total = 0;
      for (const q of sostiene.get(key) || []) {
        const pq = c.piezas.get(q);
        total += (PIEZAS[pq.tipo].peso + carga(q)) / nApoyos.get(q);
      }
      enCurso.delete(key);
      memo.set(key, total);
      return total;
    };
    const res = new Map();
    for (const key of c.piezas.keys()) res.set(key, carga(key));
    return res;
  }

  // Pieza más sobrecargada (o null si todas aguantan)
  sobrecarga(c) {
    const cs = this.cargas(c);
    let peor = null;
    for (const [key, carga] of cs) {
      const cap = PIEZAS[c.piezas.get(key).tipo].cap;
      if (carga > cap + 1e-6) {
        const ratio = cap > 0 ? carga / cap : Infinity;
        if (!peor || ratio > peor.ratio) peor = { clave: key, carga, cap, ratio };
      }
    }
    return peor;
  }

  // ---------- Validar y colocar ----------
  validar(cand) {
    if (!cand) return { ok: false, motivo: 'Pieza no válida.' };
    const { construccion: c, pieza: p } = cand;
    const def = PIEZAS[p.tipo];
    if (!this.mojon) return { ok: false, motivo: 'Primero coloca tu mojón.' };
    const m = centroMundo(c, p);
    if (!this.dentroDeTierra(m.x, m.z)) return { ok: false, motivo: 'Fuera de tu tierra.' };
    if (p.k < 0 || p.k > MAX_PLANTA) return { ok: false, motivo: 'Planta no permitida.' };
    if (def.soloPlanta0 && p.k !== 0) return { ok: false, motivo: 'Esta pieza solo va en el suelo.' };
    if (def.noPlanta0 && p.k === 0) return { ok: false, motivo: 'En la planta baja usa un cimiento.' };
    const key = clave(p.hueco, p.i, p.j, p.k, p.d);
    if (c.piezas.has(key)) return { ok: false, motivo: 'Ese hueco ya está ocupado.' };
    if (!this.puedePagar(def.coste)) return { ok: false, motivo: 'Faltan materiales.', faltan: this.faltan(def.coste) };
    if (!this.apoyada(c, p)) return { ok: false, motivo: motivoSinApoyo(p) };
    // prueba de carga con la pieza puesta
    c.piezas.set(key, p);
    const peor = this.sobrecarga(c);
    c.piezas.delete(key);
    if (peor) return { ok: false, motivo: 'La estructura no soporta ese peso.', debil: peor.clave, carga: peor.carga, cap: peor.cap };
    return { ok: true, clave: key };
  }

  colocar(cand) {
    const v = this.validar(cand);
    if (!v.ok) return v;
    let { construccion: c, pieza: p, nueva } = cand;
    if (nueva) {
      c = { id: this.siguienteId++, ox: c.ox, oz: c.oz, rot: c.rot, piezas: new Map() };
      this.construcciones.push(c);
    }
    p.id = this.siguienteId++;
    c.piezas.set(v.clave, p);
    this.pagar(PIEZAS[p.tipo].coste);
    return { ok: true, clave: v.clave, construccion: c };
  }

  // ---------- Desmontar ----------
  // Qué pasaría al desmontar: piezas que caerían en cascada, o bloqueo por sobrecarga.
  previsualizarDesmontaje(c, key) {
    if (!c.piezas.has(key)) return { ok: false, motivo: 'No existe.' };
    const copia = new Map(c.piezas);
    const tmp = { ...c, piezas: copia };
    copia.delete(key);
    const caen = [];
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const [k2, p2] of copia) {
        if (!this.apoyada(tmp, p2)) { copia.delete(k2); caen.push(k2); cambio = true; }
      }
    }
    const peor = this.sobrecarga(tmp);
    if (peor) return { ok: false, motivo: 'No se puede desmontar: otra pieza quedaría sobrecargada.', debil: peor.clave, caen };
    return { ok: true, caen };
  }

  desmontar(c, key) {
    const pre = this.previsualizarDesmontaje(c, key);
    if (!pre.ok) return pre;
    const p = c.piezas.get(key);
    c.piezas.delete(key);
    for (const k2 of pre.caen) c.piezas.delete(k2);
    const devuelto = this.devolver(PIEZAS[p.tipo].coste, RECUPERACION);
    if (c.piezas.size === 0) this.construcciones = this.construcciones.filter(x => x !== c);
    return { ok: true, caen: pre.caen, devuelto };
  }

  // ---------- Decoración libre ----------
  colocarDecoracion(tipo, x, y, z, rot) {
    const def = DECORACION[tipo];
    if (!def) return { ok: false, motivo: 'No válida.' };
    if (!this.mojon) return { ok: false, motivo: 'Primero coloca tu mojón.' };
    if (!this.dentroDeTierra(x, z)) return { ok: false, motivo: 'Fuera de tu tierra.' };
    if (!this.puedePagar(def.coste)) return { ok: false, motivo: 'Faltan materiales.', faltan: this.faltan(def.coste) };
    this.pagar(def.coste);
    const d = { id: this.siguienteId++, tipo, x, y, z, rot };
    this.decoracion.push(d);
    return { ok: true, deco: d };
  }
  quitarDecoracion(id) {
    const d = this.decoracion.find(x => x.id === id);
    if (!d) return { ok: false };
    this.decoracion = this.decoracion.filter(x => x !== d);
    const devuelto = this.devolver(DECORACION[d.tipo].coste, RECUPERACION);
    return { ok: true, devuelto };
  }

  // ---------- Guardado (versionado) ----------
  exportar() {
    return {
      version: 1,
      materiales: this.materiales,
      mojon: this.mojon,
      siguienteId: this.siguienteId,
      construcciones: this.construcciones.map(c => ({ id: c.id, ox: c.ox, oz: c.oz, rot: c.rot, piezas: [...c.piezas.values()] })),
      decoracion: this.decoracion,
    };
  }
  static importar(datos) {
    const m = new Mundo();
    if (!datos || datos.version !== 1) return m;
    m.materiales = { ...MATERIALES_INICIALES, ...datos.materiales };
    m.mojon = datos.mojon;
    m.siguienteId = datos.siguienteId || 1;
    m.construcciones = (datos.construcciones || []).map(c => {
      const mapa = new Map();
      for (const p of c.piezas) mapa.set(clave(p.hueco, p.i, p.j, p.k, p.d), p);
      return { id: c.id, ox: c.ox, oz: c.oz, rot: c.rot, piezas: mapa };
    });
    m.decoracion = datos.decoracion || [];
    return m;
  }
}

// ---------- Forma de los tejados ----------
// dir 0..3: hacia dónde sube el tramo en la rejilla. Mismo convenio que el dibujo (rotation.y = -dir·π/2).
const SUBE = [[0, 1], [-1, 0], [0, -1], [1, 0]];
const X_LOCAL = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function aristaHacia(i, j, di, dj) {
  if (di === 1) return [i + 1, j, 1];
  if (di === -1) return [i, j, 1];
  if (dj === 1) return [i, j + 1, 0];
  return [i, j, 0];
}
// Para cada tramo de tejado: altura de arranque (en tramos) y rellenos de muro necesarios
// para que los muros de debajo cierren hasta el tejado.
//   lado: triángulo o trapecio en un extremo (x local = ±1), de hBajo a hAlto
//   alto: rectángulo bajo el borde alto (z local = +1), de 0 a h
export function geometriaTejados(c) {
  const tejado = (i, j, k) => c.piezas.get(clave('r', i, j, k));
  const memo = new Map();
  const arranque = (p, prof = 0) => {
    const key = clave('r', p.i, p.j, p.k);
    if (memo.has(key)) return memo.get(key);
    const d = p.dir || 0, [ui, uj] = SUBE[d];
    const bajo = tejado(p.i - ui, p.j - uj, p.k);
    const v = bajo && (bajo.dir || 0) === d && prof < 16 ? arranque(bajo, prof + 1) + 1 : 0;
    memo.set(key, v);
    return v;
  };
  const muroBajo = (p, a) => {
    if (p.k < 1) return null;
    const m = c.piezas.get(clave('e', a[0], a[1], p.k - 1, a[2]));
    if (!m) return null;
    const def = PIEZAS[m.tipo];
    return def.medio || def.suelo ? null : m;
  };
  const res = new Map();
  for (const [key, p] of c.piezas) {
    if (p.hueco !== 'r') continue;
    const d = p.dir || 0, off = arranque(p);
    const [ui, uj] = SUBE[d], [xi, xj] = X_LOCAL[d];
    const rellenos = [];
    for (const lado of [1, -1]) {
      const n = tejado(p.i + lado * xi, p.j + lado * xj, p.k);
      const continua = n && (n.dir || 0) === d && arranque(n) === off;
      if (continua) continue;
      const m = muroBajo(p, aristaHacia(p.i, p.j, lado * xi, lado * xj));
      if (m) rellenos.push({ tipo: 'lado', lado, muro: m.tipo, hBajo: off, hAlto: off + 1 });
    }
    const n = tejado(p.i + ui, p.j + uj, p.k);
    const sigue = n && (n.dir || 0) === d && arranque(n) === off + 1;
    const cumbrera = n && (n.dir || 0) === (d + 2) % 4 && arranque(n) === off;
    if (!sigue && !cumbrera) {
      const m = muroBajo(p, aristaHacia(p.i, p.j, ui, uj));
      if (m) rellenos.push({ tipo: 'alto', muro: m.tipo, h: off + 1 });
    }
    res.set(key, { arranque: off, rellenos });
  }
  return res;
}

// ---------- utilidades de rejilla ----------
// aristas [i,j,k,d] de una casilla en la planta k
function aristasDeCasilla(i, j, k) {
  return [[i, j, k, 0], [i, j + 1, k, 0], [i, j, k, 1], [i + 1, j, k, 1]];
}
function casillasDeVertice(i, j) {
  return [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]];
}
function verticesDeArista(i, j, d) {
  return d === 0 ? [[i, j], [i + 1, j]] : [[i, j], [i, j + 1]];
}
function casillasDeArista(i, j, d) {
  return d === 0 ? [[i, j - 1], [i, j]] : [[i - 1, j], [i, j]];
}
export { aristasDeCasilla, verticesDeArista, casillasDeArista };

function motivoSinApoyo(p) {
  switch (p.hueco) {
    case 'f': return 'Un suelo en alto necesita muros o vigas debajo, o un suelo al lado que los tenga.';
    case 'v': return 'El poste necesita otro poste o un suelo debajo.';
    case 'e': return 'El muro necesita un cimiento o suelo al lado, un muro debajo o postes en los dos extremos.';
    case 'b': return 'La viga necesita postes en los dos extremos o un muro debajo.';
    case 'r': return 'El tejado necesita muros o vigas debajo, o un tramo de tejado al lado que los tenga.';
    case 'g': return 'El hastial va encima de un muro o una viga.';
    case 'p': return 'La puerta va en un muro con hueco de puerta.';
    case 'l': return 'La escalera necesita un suelo.';
  }
  return 'Sin apoyo.';
}
