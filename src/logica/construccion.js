// Kinhold — lógica de construcción (sin gráficos, comprobable en Node)
import { PIEZAS, DECORACION, MODULO, ALTURA, RECUPERACION, MAX_PLANTA, MATERIALES_INICIALES, CLASE_PESO } from './piezas.js';

export const RADIO_MOJON = 20;        // radio de tierra del mojón de nivel 1 (m)
export const DIST_ENGANCHE = 3 * MODULO; // a esta distancia de una construcción, se encaja en su rejilla
export const MAX_RATO = 5;            // segundos de trabajo como mucho en una sola acción «trabajar»

// Segundos de trabajo de una persona para terminar una obra con todo su material (provisional: el GDD dice «un
// tiempo según la pieza» sin cifras; aquí, 4 s más 1 s por cada 20 kg de la pieza).
export function tiempoObra(tipo) { return Math.round(4 + PIEZAS[tipo].peso / 20); }

// Subir lo pesado (GDD, «Obras»): segundos de trabajo, sumando los de todos, para subir UNA unidad (un tronco, una
// piedra) una planta. Entre dos (o más): 2 × SUBIR_PLANTA por planta, o sea SUBIR_PLANTA de reloj si tiran a la vez.
// Una persona sola rodándolo por dos varas con una cuerda: el doble de trabajo (y, sola, cuatro veces más de reloj).
// Con una polea en una viga, una persona sola hace lo mismo que dos a pulso: 2 × SUBIR_PLANTA por planta.
// Con un polipasto con torno, lo pesado igual que con polea; lo muy pesado (sillares) solo así y entre dos (uno en el
// torno y otro que guía): 4 × SUBIR_PLANTA por planta, sumando los dos.
// Provisional: el GDD no da cifras.
export const SUBIR_PLANTA = 2.5;
export const VARAS_PARA_RODAR = { vara: 2, cuerda: 1 }; // no se gastan: se vuelven a usar
// Planta a la que hay que llevar el material de una obra: la de la pieza (lo que se apoya en lo alto de la planta
// baja, como las vigas o el tejado de una cabaña, se alcanza desde el suelo; provisional).
export function plantaObra(p) { return p.k; }
export function clasePeso(material) { return CLASE_PESO[material] || 'ligero'; }
export function trabajoSubida(planta, personas, conVaras, conPolea = false, clase = 'pesado') {
  if (clase === 'muy_pesado') return personas >= 2 ? 4 * SUBIR_PLANTA * planta : Infinity; // con polipasto
  if (personas >= 2 || conPolea) return 2 * SUBIR_PLANTA * planta;
  return conVaras ? 4 * SUBIR_PLANTA * planta : Infinity;
}

const HUECOS_ARISTA = new Set(['e', 'b', 'g', 'p', 'q', 'w']);

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
    case 'f': case 'r': case 'l': case 't': case 'h': return { lx: (p.i + 0.5) * S, lz: (p.j + 0.5) * S };
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
  if (hueco === 'f' || hueco === 'r' || hueco === 'l' || hueco === 't' || hueco === 'h') return { hueco, i, j, k };
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
    this.obrasTerminadas = []; // quién llevó qué y quién trabajó en cada obra terminada (para el servidor; no se guarda)
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
    if (def.andamio) p.dir = dirAndamio(c, p.i, p.j, p.k);
    if (def.hogar) p.dir = dirHogar(c, p.i, p.j);
    if (p.hueco === 't') { const e = escaleraAndando(c, p.i, p.j, p.k - 1); if (e) p.dir = dirTrampilla(c, p.i, p.j, p.k, e); }
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
    // una obra a medias (solo el marco) tampoco sostiene nada hasta que se termina
    const tiene = (key) => { const q = c.piezas.get(key); return !!q && !q.obra && PIEZAS[q.tipo].cap > 0; };
    const filtra = (keys) => keys.filter(tiene);
    // piezas iguales (suelo o tejado) en las casillas de al lado que descansan directamente en muros o vigas
    const vecinasApoyadas = (hueco, i, j, k) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([di, dj]) => clave(hueco, i + di, j + dj, k))
      .filter(key => {
        const q = c.piezas.get(key);
        if (!q || q.obra) return false;
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
        if (muro && !muro.obra && PIEZAS[muro.tipo].conPuerta) return { suelo: false, lista: [clave('e', i, j, k, p.d)] };
        return { suelo: false, lista: [] };
      }
      case 'w': { // la contraventana cuelga del marco de la ventana de su muro
        const muro = c.piezas.get(clave('e', i, j, k, p.d));
        if (muro && !muro.obra && PIEZAS[muro.tipo].conVentana) return { suelo: false, lista: [clave('e', i, j, k, p.d)] };
        return { suelo: false, lista: [] };
      }
      case 't': { // la trampilla tapa el hueco de una escalera de tablas y descansa en los suelos de alrededor
        if (k < 1 || !escaleraAndando(c, i, j, k - 1)) return { suelo: false, lista: [] };
        return { suelo: false, lista: filtra([[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => clave('f', i + di, j + dj, k))) };
      }
      case 'l': {
        const f = clave('f', i, j, k);
        if (tiene(f)) return { suelo: false, lista: [f] };
        if (def.andamio && k > 0 && andamioEn(c, i, j, k - 1)) return { suelo: false, lista: [clave('l', i, j, k - 1)] };
        return { suelo: k === 0, lista: [] };
      }
      case 'h': { // la chimenea descansa en el cimiento de piedra de su casilla (terminado)
        const f = c.piezas.get(clave('f', i, j, 0));
        return { suelo: false, lista: k === 0 && f && !f.obra && f.tipo === 'cim_piedra' ? [clave('f', i, j, 0)] : [] };
      }
      case 'q': { // la polea cuelga de su viga
        const b = clave('b', i, j, k, p.d);
        return { suelo: false, lista: tiene(b) ? [b] : [] };
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
  // marco: se pone solo el marco de la obra (los materiales se entregan después), así que no se miran los materiales
  validar(cand, marco = false) {
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
    if (def.andando && p.k >= MAX_PLANTA) return { ok: false, motivo: 'La escalera de tablas sube a la planta de arriba: en la última no cabe.' };
    if (def.andando && c.piezas.has(clave('f', p.i, p.j, p.k + 1))) return { ok: false, motivo: 'Encima de la escalera tiene que quedar el hueco abierto: quita ese suelo.' };
    if (p.hueco === 't') {
      const e = escaleraAndando(c, p.i, p.j, p.k - 1);
      if (!e) return { ok: false, motivo: motivoSinApoyo(p) };
      p.dir = dirTrampilla(c, p.i, p.j, p.k, e);
    }
    if (p.hueco === 'f' && escaleraAndando(c, p.i, p.j, p.k - 1)) return { ok: false, motivo: 'Ahí está el hueco de una escalera.' };
    if (p.hueco === 'f' && c.piezas.has(clave('l', p.i, p.j, p.k - 1)) && PIEZAS[c.piezas.get(clave('l', p.i, p.j, p.k - 1)).tipo].andamio) return { ok: false, motivo: 'Ahí está la plataforma de un andamio.' };
    // por la casilla de la chimenea sube su cañón hasta el tejado: ahí no caben escaleras ni andamios, en ninguna planta
    if (p.hueco === 'l' && hogarEn(c, p.i, p.j)) return { ok: false, motivo: 'Por esa casilla sube el cañón de una chimenea.' };
    if (def.hogar && [0, 1, 2, 3].some(kk => c.piezas.has(clave('l', p.i, p.j, kk)))) return { ok: false, motivo: 'La chimenea no cabe donde hay una escalera o un andamio.' };
    if (def.andamio) {
      if (p.k >= MAX_PLANTA) return { ok: false, motivo: 'El andamio llega a la planta de arriba: en la última no cabe.' };
      if (c.piezas.has(clave('f', p.i, p.j, p.k + 1))) return { ok: false, motivo: 'Encima del andamio va su plataforma: ahí ya hay un suelo.' };
      if (!pegadoAlMuro(c, p.i, p.j, p.k)) return { ok: false, motivo: 'El andamio va pegado a un muro (o a la obra de un muro), en esta planta o en la de arriba.' };
    }
    if (!marco && !this.puedePagar(def.coste)) return { ok: false, motivo: 'Faltan materiales.', faltan: this.faltan(def.coste) };
    if (!this.apoyada(c, p)) return { ok: false, motivo: motivoSinApoyo(p) };
    // prueba de carga con la pieza puesta
    c.piezas.set(key, p);
    const peor = this.sobrecarga(c);
    c.piezas.delete(key);
    if (peor) return { ok: false, motivo: 'La estructura no soporta ese peso.', debil: peor.clave, carga: peor.carga, cap: peor.cap };
    return { ok: true, clave: key };
  }

  // Coloca una pieza. Con marco = true (como se construye en el juego: «Obras», GDD) solo pone el marco de la obra:
  // no paga nada, se ve como un armazón, no sostiene nada y su peso ya cuenta (así, al terminarla, aguanta seguro).
  // Sin marco, la pieza sale terminada y pagada de golpe (lo usan las pruebas de la estructura).
  colocar(cand, marco = false) {
    const v = this.validar(cand, marco);
    if (!v.ok) return v;
    let { construccion: c, pieza: p, nueva } = cand;
    if (nueva) {
      c = { id: this.siguienteId++, ox: c.ox, oz: c.oz, rot: c.rot, piezas: new Map() };
      this.construcciones.push(c);
    }
    p.id = this.siguienteId++;
    if (PIEZAS[p.tipo].andamio) p.dir = dirAndamio(c, p.i, p.j, p.k);
    if (PIEZAS[p.tipo].hogar) p.dir = dirHogar(c, p.i, p.j);
    c.piezas.set(v.clave, p);
    if (marco) p.obra = { entregado: {}, trabajo: 0, aportes: [] };
    else this.pagar(PIEZAS[p.tipo].coste);
    return { ok: true, clave: v.clave, construccion: c, obra: !!marco };
  }

  // ---------- Obras: marco, materiales y tiempo ----------
  // Lo que le falta a una obra por entregar: [{ m, n }]
  faltaEntregar(p) {
    if (!p.obra) return [];
    return Object.entries(PIEZAS[p.tipo].coste).map(([m, n]) => ({ m, n: n - (p.obra.entregado[m] || 0) })).filter(x => x.n > 0);
  }
  // Lleva material a una obra. Se entrega como mucho lo que le falta; queda anotado quién lo entrega.
  // desde: planta en la que está quien lo lleva. Si la obra está en alto, lo ligero se sube a mano por la escalera
  // (hay que estar en su planta) y lo pesado no se entrega así: se sube con subir().
  entregar(c, key, material, cantidad, autor, desde = 0) {
    const p = c.piezas.get(key);
    if (!p) return { ok: false, motivo: 'No existe.' };
    if (!p.obra) return { ok: false, motivo: 'Esa pieza ya está terminada.' };
    const falta = this.faltaEntregar(p).find(x => x.m === material);
    if (!falta) return { ok: false, motivo: 'A esa obra no le falta ese material.' };
    if (!Number.isInteger(cantidad) || cantidad <= 0) return { ok: false, motivo: 'Cantidad no válida.' };
    const planta = plantaObra(p);
    if (planta > 0 && clasePeso(material) === 'muy_pesado') return { ok: false, motivo: 'Lo muy pesado solo se sube con un polipasto con torno, entre dos.', subir: true };
    if (planta > 0 && clasePeso(material) !== 'ligero') return { ok: false, motivo: 'Lo pesado no se sube a mano: entre dos, con una polea, o rodándolo por dos varas con una cuerda.', subir: true };
    if (planta > 0 && !(desde >= planta)) return { ok: false, motivo: 'Súbelo a mano por la escalera o el andamio hasta la planta de la obra.', escalera: true };
    const n = Math.min(cantidad, falta.n);
    if ((this.materiales[material] || 0) < n) return { ok: false, motivo: 'Faltan materiales.', faltan: [{ m: material, n, hay: this.materiales[material] || 0 }] };
    this.materiales[material] -= n;
    p.obra.entregado[material] = (p.obra.entregado[material] || 0) + n;
    p.obra.aportes.push({ autor, entrega: material, n });
    return { ok: true, entregado: n, falta: this.faltaEntregar(p) };
  }
  // Un rato subiendo una unidad de material pesado hasta una obra en alto. metodo: 'entre_dos' (cada uno coge de un
  // lado: hasta que no ayuda otro, no sube) o 'varas' (rodándolo por dos varas con una cuerda: puede una sola persona,
  // más despacio). Los segundos de todos se suman; al llegar al trabajo de la subida, la unidad queda entregada.
  subir(c, key, material, segundos, autor, metodo) {
    const p = c.piezas.get(key);
    if (!p) return { ok: false, motivo: 'No existe.' };
    if (!p.obra) return { ok: false, motivo: 'Esa pieza ya está terminada.' };
    if (!(segundos > 0 && segundos <= MAX_RATO)) return { ok: false, motivo: 'Rato de trabajo no válido.' };
    if (!['entre_dos', 'varas', 'polea', 'polipasto'].includes(metodo)) return { ok: false, motivo: 'Datos no válidos.' };
    const planta = plantaObra(p);
    if (planta === 0) return { ok: false, motivo: 'Esa obra está a ras de suelo: no hace falta subir nada.' };
    const clase = clasePeso(material);
    if (clase === 'ligero') return { ok: false, motivo: 'Eso no hace falta subirlo así.' };
    if (clase === 'muy_pesado' && metodo !== 'polipasto') return { ok: false, motivo: 'Lo muy pesado solo se sube con un polipasto con torno, entre dos.' };
    const s = p.obra.subida;
    if (s && s.material !== material) return { ok: false, motivo: 'Ya se está subiendo otro material a esta obra.' };
    if (!s && !this.faltaEntregar(p).some(x => x.m === material)) return { ok: false, motivo: 'A esa obra no le falta ese material.' };
    if (metodo === 'varas' && !this.puedePagar(VARAS_PARA_RODAR)) return { ok: false, motivo: 'Para rodarlo hacen falta dos varas y una cuerda.' };
    if (metodo === 'polea' && !poleaPara(c, p)) return { ok: false, motivo: 'Para subirlo con polea hace falta una polea en una viga de esta construcción, a la altura de la obra o más arriba.' };
    if (metodo === 'polipasto' && !polipastoPara(c, p)) return { ok: false, motivo: 'Para subirlo con polipasto hace falta un polipasto en una viga de esta construcción, a la altura de la obra o más arriba.' };
    if (!s) { // la unidad sale de la reserva al empezar a subirla
      if ((this.materiales[material] || 0) < 1) return { ok: false, motivo: 'Faltan materiales.', faltan: [{ m: material, n: 1, hay: this.materiales[material] || 0 }] };
      this.materiales[material] -= 1;
      p.obra.subida = { material, varas: false, polea: false, seg: {} };
    }
    const sub = p.obra.subida;
    if (metodo === 'varas') sub.varas = true;
    if (metodo === 'polea') sub.polea = true;
    if (metodo === 'polipasto') sub.polipasto = true;
    sub.seg[autor] = +((sub.seg[autor] || 0) + segundos).toFixed(3);
    const personas = Object.keys(sub.seg).length;
    const hecho = Object.values(sub.seg).reduce((a, b) => a + b, 0);
    const necesario = trabajoSubida(planta, personas, sub.varas, sub.polea || !!sub.polipasto, clase);
    if (hecho >= necesario - 1e-9) {
      p.obra.entregado[material] = (p.obra.entregado[material] || 0) + 1;
      p.obra.aportes.push({ sube: material, n: 1, planta, metodo: sub.polipasto ? 'polipasto' : sub.polea ? 'polea' : personas >= 2 ? 'entre_dos' : 'varas', autores: { ...sub.seg } });
      delete p.obra.subida;
      return { ok: true, subido: true, progreso: 1, falta: this.faltaEntregar(p) };
    }
    // sin varas y sin nadie más (o algo muy pesado con una sola persona en el polipasto), se espera a que ayude otro
    // (lo que se lleva hecho no pasa de la mitad)
    const esperaAyuda = !Number.isFinite(necesario);
    const progreso = esperaAyuda ? Math.min(0.5, hecho / trabajoSubida(planta, 2, false, false, clase)) : hecho / necesario;
    return { ok: true, subido: false, progreso, esperaAyuda };
  }
  // Un rato de trabajo en una obra con todo el material. Los segundos de todos los que trabajan se suman: si te
  // ayudan, se termina antes. Al llegar al tiempo de la pieza, queda terminada.
  trabajar(c, key, segundos, autor) {
    const p = c.piezas.get(key);
    if (!p) return { ok: false, motivo: 'No existe.' };
    if (!p.obra) return { ok: false, motivo: 'Esa pieza ya está terminada.' };
    if (!(segundos > 0 && segundos <= MAX_RATO)) return { ok: false, motivo: 'Rato de trabajo no válido.' };
    if (this.faltaEntregar(p).length) return { ok: false, motivo: 'Primero hay que llevarle todo el material.' };
    const total = tiempoObra(p.tipo);
    p.obra.trabajo = Math.min(total, p.obra.trabajo + segundos);
    const suyo = p.obra.aportes.find(x => x.autor === autor && x.trabajo !== undefined);
    if (suyo) suyo.trabajo = +(suyo.trabajo + segundos).toFixed(3);
    else p.obra.aportes.push({ autor, trabajo: +segundos.toFixed(3) });
    if (p.obra.trabajo >= total - 1e-9) {
      this.obrasTerminadas.push({ construccion: c.id, clave: key, tipo: p.tipo, aportes: p.obra.aportes });
      delete p.obra;
      return { ok: true, terminada: true, progreso: 1 };
    }
    return { ok: true, terminada: false, progreso: p.obra.trabajo / total };
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
    // una obra a medias devuelve entero lo que se le había llevado (aún no se había gastado en nada)
    const obra = p.obra && { ...p.obra.entregado };
    if (p.obra && p.obra.subida) obra[p.obra.subida.material] = (obra[p.obra.subida.material] || 0) + 1; // la que iba subiendo
    const devuelto = p.obra ? this.devolver(obra, 1) : this.devolver(PIEZAS[p.tipo].coste, RECUPERACION);
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
// Remates de tejado (esquinas): una casilla donde se juntan dos caídas que van en ángulo recto. Con «dir» como un
// tramo: sube hacia SUBE[dir] y también hacia X_LOCAL[dir]. La forma sale sola de los vecinos:
//   limatesa (esquina de fuera, la de un tejado a cuatro aguas): sus dos lados bajos son alero; alto = el menor de los dos
//   limahoya (rincón, la de un tejado en L): tiene tejado en algún lado bajo; alto = el mayor de los dos
export const esEsquina = (p) => !!p && !!PIEZAS[p.tipo] && !!PIEZAS[p.tipo].esquina;
// alto (en tramos) de una pieza de tejado en el vértice (a, b) de su casilla (a, b = 0 o 1, hacia +i y +j)
function altoEnVertice(p, forma, off, a, b) {
  const d = p.dir || 0, w = [2 * a - 1, 2 * b - 1];
  const z = (w[0] * SUBE[d][0] + w[1] * SUBE[d][1] + 1) / 2, x = (w[0] * X_LOCAL[d][0] + w[1] * X_LOCAL[d][1] + 1) / 2;
  if (forma === 'tesa') return Math.min(z, x);
  if (forma === 'hoya') return Math.max(z, x);
  return off + z;
}
// los dos vértices del lado de la casilla que mira hacia (di, dj), en el orden en que los ve el vecino de ese lado
function verticesDeLado(di, dj) {
  if (di) { const a = di > 0 ? 1 : 0; return [[a, 0], [a, 1]]; }
  const b = dj > 0 ? 1 : 0; return [[0, b], [1, b]];
}
// Para cada pieza de tejado: altura de arranque (en tramos) y rellenos de muro necesarios
// para que los muros de debajo cierren hasta el tejado.
//   lado: triángulo o trapecio en un extremo (x local = ±1), de hBajo a hAlto
//   alto: rectángulo bajo el borde alto (z local = +1), de 0 a h
// En los remates (esquinas), además, forma: 'tesa' o 'hoya'.
export function geometriaTejados(c) {
  const tejado = (i, j, k) => c.piezas.get(clave('r', i, j, k));
  const tramo = (i, j, k) => { const p = tejado(i, j, k); return p && !esEsquina(p) ? p : null; };
  const memo = new Map();
  const arranque = (p, prof = 0) => {
    if (esEsquina(p)) return 0; // los remates van siempre en la primera fila (no se apilan)
    const key = clave('r', p.i, p.j, p.k);
    if (memo.has(key)) return memo.get(key);
    const d = p.dir || 0, [ui, uj] = SUBE[d];
    const bajo = tramo(p.i - ui, p.j - uj, p.k);
    const v = bajo && (bajo.dir || 0) === d && prof < 16 ? arranque(bajo, prof + 1) + 1 : 0;
    memo.set(key, v);
    return v;
  };
  // forma de un remate: rincón si hay tejado detrás de alguno de sus lados bajos
  const forma = (p) => {
    if (!esEsquina(p)) return null;
    const d = p.dir || 0, [ui, uj] = SUBE[d], [xi, xj] = X_LOCAL[d];
    return tejado(p.i - ui, p.j - uj, p.k) || tejado(p.i - xi, p.j - xj, p.k) ? 'hoya' : 'tesa';
  };
  // altos de la pieza en los dos vértices del lado que mira hacia (di, dj)
  const altosLado = (p, di, dj) => verticesDeLado(di, dj).map(([a, b]) => altoEnVertice(p, forma(p), arranque(p), a, b));
  // el tejado sigue sin escalón por ese lado: el vecino tiene los mismos altos en los dos vértices que comparten
  const seJunta = (p, di, dj) => {
    const n = tejado(p.i + di, p.j + dj, p.k);
    if (!n) return false;
    const [a1, a2] = altosLado(p, di, dj), [b1, b2] = altosLado(n, -di, -dj);
    return Math.abs(a1 - b1) < 1e-6 && Math.abs(a2 - b2) < 1e-6;
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
    const d = p.dir || 0, off = arranque(p), fo = forma(p);
    const [ui, uj] = SUBE[d], [xi, xj] = X_LOCAL[d];
    const rellenos = [];
    const par = ((p.i + p.j) % 2 + 2) % 2;
    if (fo) {
      // remate: los lados altos de un rincón se cierran como el borde alto de un tramo si no tienen tejado al lado
      if (fo === 'hoya') {
        if (!seJunta(p, ui, uj)) { const m = muroBajo(p, aristaHacia(p.i, p.j, ui, uj)); if (m) rellenos.push({ tipo: 'alto', muro: m.tipo, h: 1 }); }
        if (!seJunta(p, xi, xj)) { const m = muroBajo(p, aristaHacia(p.i, p.j, xi, xj)); if (m) rellenos.push({ tipo: 'lado', lado: 1, muro: m.tipo, hBajo: 1, hAlto: 1 }); }
      }
      res.set(key, { arranque: 0, rellenos, extremos: [], cumbrera: false, par, forma: fo });
      continue;
    }
    for (const lado of [1, -1]) {
      if (seJunta(p, lado * xi, lado * xj)) continue;
      const m = muroBajo(p, aristaHacia(p.i, p.j, lado * xi, lado * xj));
      if (m) rellenos.push({ tipo: 'lado', lado, muro: m.tipo, hBajo: off, hAlto: off + 1 });
    }
    const n = tejado(p.i + ui, p.j + uj, p.k);
    const sigue = n && !esEsquina(n) && (n.dir || 0) === d && arranque(n) === off + 1;
    const cumbreraTramo = n && !esEsquina(n) && (n.dir || 0) === (d + 2) % 4 && arranque(n) === off;
    // contra un rincón (limahoya), el borde alto del tramo es cumbrera y la pone el tramo (el remate no la lleva)
    const contraRincon = n && forma(n) === 'hoya' && off === 0 && seJunta(p, ui, uj);
    if (!sigue && !cumbreraTramo && !contraRincon) {
      const m = muroBajo(p, aristaHacia(p.i, p.j, ui, uj));
      if (m) rellenos.push({ tipo: 'alto', muro: m.tipo, h: off + 1 });
    }
    // para el dibujo: lados sin tramo que siga (ahí el tejado vuela y se remata), si cierra una cumbrera
    // (la pone uno solo de los dos tramos) y la paridad de la casilla (los tramos vecinos se montan sin coincidir)
    const extremos = [1, -1].filter(lado => !seJunta(p, lado * xi, lado * xj));
    res.set(key, { arranque: off, rellenos, extremos, cumbrera: (!!cumbreraTramo && d < 2) || !!contraRincon, par });
  }
  return res;
}

// ---------- Chimenea (hogar interior) ----------
// La chimenea (pieza hogar, hueco 'h') de la casilla (i, j), terminada o en obras, o null. Solo va en la planta baja.
export function hogarEn(c, i, j) {
  const p = c.piezas.get(clave('h', i, j, 0));
  return p || null;
}
// Hacia dónde mira la chimenea (dir, como el andamio): se arrima al primer muro de su casilla en la planta baja (el
// cañón va pegado a él, por dentro); sin muros, hacia +z local. Solo cambia dónde se dibuja y qué se choca.
export function dirHogar(c, i, j) {
  for (let dir = 0; dir < 4; dir++) {
    const [ai, aj, d] = aristaHacia(i, j, ...SUBE[dir]);
    if (c.piezas.has(clave('e', ai, aj, 0, d))) return dir;
  }
  return 0;
}
// Medidas de la chimenea en su marco (m; z hacia el lado arrimado, x a lo ancho; y desde el suelo de la planta baja).
// El hogar: un banco de piedra bajo con el fuego; encima, la campana que recoge el humo y el cañón hasta arriba.
export const HOGAR = { ancho: 1.5, fondo0: 0.05, fondo1: 0.92, canonAncho: 0.7, canon0: 0.42, canon1: 0.92, sobreTejado: 0.75 };
// Esquinas (local de la construcción, m) de lo que ocupa la chimenea en el suelo (el hogar entero) o, por encima de la
// planta baja, solo el cañón. Sirve para el choque: no se puede entrar en el fuego ni atravesar el cañón.
export function huellaHogar(p, soloCanon = false) {
  const H = HOGAR, a = (soloCanon ? H.canonAncho : H.ancho) / 2, z0 = soloCanon ? H.canon0 : H.fondo0, z1 = soloCanon ? H.canon1 : H.fondo1;
  const [ui, uj] = SUBE[p.dir || 0], [xi, xj] = X_LOCAL[p.dir || 0], cl = centroLocal(p);
  return [[-a, z0], [a, z0], [a, z1], [-a, z1]].map(([x, z]) => ({ lx: cl.lx + x * xi + z * ui, lz: cl.lz + x * xj + z * uj }));
}
// Altura (m, desde el suelo) a la que acaba el cañón: por encima de lo más alto que haya sobre su casilla (los suelos
// y muros de las plantas de arriba y el tejado, terminados o en obras), para que el humo salga por encima del tejado.
// Sin nada encima, sube una planta y un poco más. subidaTejado: lo que sube un tramo de tejado (del dibujo).
export function altoCanon(c, p, subidaTejado = 1.2) {
  let alto = 1 * ALTURA;
  const tejados = geometriaTejados(c);
  for (let k = 0; k <= MAX_PLANTA + 1; k++) {
    if (k > 0 && c.piezas.has(clave('f', p.i, p.j, k))) alto = Math.max(alto, k * ALTURA);
    if (k <= MAX_PLANTA && aristasDeCasilla(p.i, p.j, k).some(a => { const m = c.piezas.get(clave('e', ...a)); return m && !PIEZAS[m.tipo].suelo; })) alto = Math.max(alto, (k + 1) * ALTURA);
    const key = clave('r', p.i, p.j, k), r = c.piezas.get(key);
    if (r) alto = Math.max(alto, k * ALTURA + ((tejados.get(key)?.arranque || 0) + 1) * subidaTejado);
  }
  return alto + HOGAR.sobreTejado;
}

// ---------- Escalera de tablas ----------
// Escalera que se sube andando en la casilla (i,j) de la planta k, o null.
// Andamio terminado en la casilla (i, j) de la planta k (su plataforma está a la altura del suelo de la planta k + 1).
export function andamioEn(c, i, j, k) {
  const p = c.piezas.get(clave('l', i, j, k));
  return p && !p.obra && PIEZAS[p.tipo].andamio ? p : null;
}
// El andamio va pegado a un muro (terminado o en obras) de su casilla, en su planta o en la de encima.
function pegadoAlMuro(c, i, j, k) {
  return [k, k + 1].some(kk => aristasDeCasilla(i, j, kk).some(a => c.piezas.has(clave('e', ...a))));
}
// Hacia dónde mira el andamio (dir, como las escaleras): hacia el primer muro de su casilla, en su planta o en la de
// encima. Solo cambia cómo se ve (la barandilla y la escalerilla quedan por fuera).
export function dirAndamio(c, i, j, k) {
  for (const kk of [k, k + 1]) for (let dir = 0; dir < 4; dir++) {
    const [ai, aj, d] = aristaHacia(i, j, ...SUBE[dir]);
    if (c.piezas.has(clave('e', ai, aj, kk, d))) return dir;
  }
  return 0;
}
// Polea terminada de esta construcción con la que se puede subir algo a la obra p: cuelga de una viga a la altura de
// su planta o más arriba (la viga de lo alto de la planta k está a la altura del suelo de la planta k + 1).
// poleaPara: la polea simple; polipastoPara: el polipasto con torno (los dos van en el mismo hueco de la viga).
export function poleaPara(c, p) { return aparejoPara(c, p, false); }
export function polipastoPara(c, p) { return aparejoPara(c, p, true); }
function aparejoPara(c, p, polipasto) {
  const planta = plantaObra(p);
  let mejor = null;
  for (const q of c.piezas.values()) {
    if (q.hueco !== 'q' || q.obra || q.k + 1 < planta || !!PIEZAS[q.tipo].polipasto !== polipasto) continue;
    const a = centroLocal(q), b = centroLocal(p);
    const d = Math.hypot(a.lx - b.lx, a.lz - b.lz);
    if (!mejor || d < mejor.d) mejor = { q, d };
  }
  return mejor ? mejor.q : null;
}
// Trampilla terminada y cerrada en el hueco de la escalera de la casilla (i, j) de la planta k (la trampilla está en k + 1).
// Cerrada se pisa como un suelo y no deja pasar por la escalera.
export function trampillaCerrada(c, i, j, k) {
  const t = c.piezas.get(clave('t', i, j, k + 1));
  return !!t && !t.obra && !t.abierta;
}
// Hacia dónde mira la trampilla (dir, como las escaleras): su bisagra va en el borde -SUBE[dir] de la casilla. Se
// cuelga de un lado de la escalera que tenga suelo al lado; si no, del lado del arranque con suelo; si no hay suelo
// en ninguno de esos, de un lado. Nunca del lado por el que se sale arriba: abierta, de pie, taparía la salida.
export function dirTrampilla(c, i, j, k, escalera) {
  const e = escalera.dir || 0;
  const bisagra = (dir) => { const [ui, uj] = SUBE[dir]; return c.piezas.has(clave('f', i - ui, j - uj, k)); };
  const lados = [(e + 1) % 4, (e + 3) % 4]; // la bisagra en el borde -SUBE[dir]: para dir = e + 1 y e + 3, un lado
  for (const d of lados) if (bisagra(d)) return d;
  if (bisagra(e)) return e; // con dir = e, la bisagra queda en el borde del arranque
  return lados[0];
}
export function escaleraAndando(c, i, j, k) {
  const p = c.piezas.get(clave('l', i, j, k));
  return p && !p.obra && PIEZAS[p.tipo].andando ? p : null;
}
// Cuánto has subido (0 abajo, 1 arriba) en un punto local (m) de la casilla de la escalera.
// Sube en la dirección dir (mismo convenio que los tejados): arriba se sale a la casilla de al lado.
export function progresoEscalera(p, lx, lz) {
  const [ui, uj] = SUBE[p.dir || 0];
  const cx = (p.i + 0.5) * MODULO, cz = (p.j + 0.5) * MODULO;
  const t = ((lx - cx) * ui + (lz - cz) * uj) / MODULO + 0.5;
  return Math.max(0, Math.min(1, t));
}
// Casilla a la que se sale por arriba
export function salidaEscalera(p) {
  const [ui, uj] = SUBE[p.dir || 0];
  return { i: p.i + ui, j: p.j + uj, k: p.k + 1 };
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
    case 'w': return 'La contraventana va en un muro con ventana.';
    case 't': return 'La trampilla va en el hueco de arriba de una escalera de tablas, con suelo al lado.';
    case 'l': return 'La escalera necesita un suelo; el andamio, la tierra, un suelo u otro andamio debajo.';
    case 'h': return 'La chimenea va en la planta baja, sobre un cimiento de piedra terminado.';
    case 'q': return PIEZAS[p.tipo]?.polipasto ? 'El polipasto se cuelga de una viga terminada.' : 'La polea se cuelga de una viga terminada.';
  }
  return 'Sin apoyo.';
}
