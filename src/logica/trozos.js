// Kinhold — el terreno por trozos (lógica pura, sin three.js): qué trozos del mundo hay que tener cargados alrededor
// del jugador, con cuánto detalle cada uno, y la malla de cada trozo (alturas, triángulos y faldones).
//
// Cómo lo hacen otros (investigado al planificar el hito, 29 oct): el terreno se parte en trozos iguales y cada uno se
// dibuja con más o menos detalle según lo lejos que está (anillos alrededor del jugador, como los «clipmaps» o el
// método CDLOD); entre trozos de distinto detalle quedan rendijas, que se tapan con un faldón (una tira que cuelga del
// borde hacia abajo); y para no cargar y soltar el mismo trozo al ir y venir por una frontera, cada anillo tiene un
// margen: se entra en él al cruzar su límite, pero solo se sale al alejarse el margen más allá.
//
// - El mundo se parte en trozos de LADO m (64). El trozo (i, j) va de x = i·LADO a (i+1)·LADO y de z = j·LADO a (j+1)·LADO,
//   en metros del mundo (los mismos que usa el paisaje, src/logica/paisaje.js).
// - Cada anillo dice su rejilla (paso, en m) y hasta qué distancia llega. La distancia es la del jugador al punto más
//   cercano del trozo (0 si está dentro).
// - Las alturas se toman siempre de la misma función y en puntos de una rejilla común a todos (múltiplos del paso desde
//   el origen del mundo): dos trozos vecinos con el mismo detalle tienen exactamente las mismas alturas en su borde, y
//   uno basto comparte con el fino todos sus puntos del borde (el fino tiene además los de en medio).
// - El faldón de cada borde cuelga lo que de verdad hace falta: lo más que se aparta el terreno fino (rejilla de 1 m) de
//   la línea recta del borde basto, más un poco. Así tapa la rendija con cualquier vecino más fino.
//
// Lo que no hace: dibujar (eso es del cliente, con three.js) ni hacerlo en otro hilo (lo hace la siguiente tarea, con
// estas mismas funciones dentro de un Web Worker). Todo es determinista: lo mismo sirve para el servidor.

export const LADO = 64;
// Decisión provisional (29 oct, la tarea dice las rejillas pero no las distancias): rejilla de 1 m hasta 64 m del
// jugador, de 2 m hasta 192, de 4 m hasta 448 y de 8 m hasta 768. Cada anillo es más ancho que un trozo más el margen,
// así que dos trozos vecinos nunca se llevan más de un nivel de detalle (la rendija entre ellos es pequeña).
export const ANILLOS = [
  { paso: 1, hasta: 64 },
  { paso: 2, hasta: 192 },
  { paso: 4, hasta: 448 },
  { paso: 8, hasta: 768 },
];
export const MARGEN = 16;          // m: lo que hay que alejarse más allá del límite para bajar de detalle o soltar el trozo
export const FALDON_EXTRA = 0.25;  // m que cuelga el faldón por debajo de lo justo
// Los ríos tallan el terreno hasta 2.500 m de su cauce (paisaje.js); cada trozo coge los tramos de río que pasan a menos
// de esto, para que dos trozos vecinos vean el mismo río más cercano y den la misma altura en su borde común.
export const MARGEN_RIOS = 2600;

export const claveTrozo = (i, j) => i + ',' + j;
export const trozoDe = (x, z, lado = LADO) => ({ i: Math.floor(x / lado), j: Math.floor(z / lado) });

// distancia (m) del punto (x, z) al trozo (i, j): 0 si está dentro
export function distanciaTrozo(x, z, i, j, lado = LADO) {
  const x0 = i * lado, z0 = j * lado;
  const dx = Math.max(x0 - x, 0, x - (x0 + lado)), dz = Math.max(z0 - z, 0, z - (z0 + lado));
  return Math.hypot(dx, dz);
}

// el nivel que toca a una distancia (índice del anillo), o -1 si queda fuera de todos
export function nivelPara(d, anillos = ANILLOS) {
  for (let k = 0; k < anillos.length; k++) if (d < anillos[k].hasta) return k;
  return -1;
}

// El gestor de trozos: se le dice dónde está el jugador y devuelve qué cargar, qué cambiar de detalle y qué soltar.
// opciones.limites: { x0, z0, x1, z1 } en m (el borde del mundo, o de la isla); fuera no se carga nada.
export function crearGestor({ lado = LADO, anillos = ANILLOS, margen = MARGEN, limites = null } = {}) {
  const trozos = new Map();        // clave → { i, j, nivel }
  const maxD = anillos[anillos.length - 1].hasta;
  const dentro = (i, j) => !limites || ((i + 1) * lado > limites.x0 && i * lado < limites.x1 && (j + 1) * lado > limites.z0 && j * lado < limites.z1);

  // El nivel que se queda un trozo que ya está cargado con `actual`: se sube de detalle en cuanto se cruza el límite;
  // se baja (o se suelta) solo si se ha pasado el límite más el margen.
  function nivelCon(d, actual) {
    const nuevo = nivelPara(d, anillos);
    if (actual < 0) return nuevo;
    if (nuevo !== -1 && nuevo <= actual) return nuevo;
    // más lejos de lo que pide su nivel actual: bajar solo hasta donde lo permite el margen
    const conMargen = nivelPara(Math.max(0, d - margen), anillos);
    return conMargen === -1 ? -1 : Math.max(actual, conMargen);
  }

  // Devuelve { cargar, cambiar, soltar }: listas de { i, j, nivel, d } (cambiar lleva además `antes`), las de cargar y
  // cambiar ordenadas de cerca a lejos, para hacer primero lo que rodea al jugador.
  function actualizar(x, z) {
    const cargar = [], cambiar = [], soltar = [];
    const { i: pi, j: pj } = trozoDe(x, z, lado);
    const r = Math.ceil((maxD + margen) / lado) + 1;
    const vistos = new Set();
    for (let j = pj - r; j <= pj + r; j++) for (let i = pi - r; i <= pi + r; i++) {
      if (!dentro(i, j)) continue;
      const k = claveTrozo(i, j), t = trozos.get(k), d = distanciaTrozo(x, z, i, j, lado);
      const nivel = nivelCon(d, t ? t.nivel : -1);
      if (nivel === -1) continue;
      vistos.add(k);
      if (!t) { const n = { i, j, nivel }; trozos.set(k, n); cargar.push({ i, j, nivel, d }); }
      else if (t.nivel !== nivel) { cambiar.push({ i, j, nivel, antes: t.nivel, d }); t.nivel = nivel; }
    }
    for (const [k, t] of trozos) if (!vistos.has(k)) { soltar.push({ i: t.i, j: t.j, nivel: t.nivel, d: distanciaTrozo(x, z, t.i, t.j, lado) }); trozos.delete(k); }
    cargar.sort((a, b) => a.d - b.d); cambiar.sort((a, b) => a.d - b.d);
    return { cargar, cambiar, soltar };
  }

  return { actualizar, trozos, lado, anillos, margen, nivelDe: (i, j) => { const t = trozos.get(claveTrozo(i, j)); return t ? t.nivel : -1; } };
}

// La función de altura (m) para un trozo, sacada del paisaje: con los tramos de río que le tocan y el detalle fino
// (el mismo en todos los niveles: así las alturas compartidas son idénticas).
export function alturaDeTrozo(paisaje, i, j, lado = LADO) {
  const x0 = i * lado, z0 = j * lado;
  const tramos = paisaje.riosEn(x0, z0, x0 + lado, z0 + lado, MARGEN_RIOS);
  return (x, z) => paisaje.altura(x, z, tramos, true);
}

// La malla de un trozo con la rejilla `paso` (m). altura(x, z) da la altura en metros del mundo.
// Devuelve:
//   x0, z0: la esquina del trozo en el mundo; las posiciones van relativas a ella (más precisión en Float32)
//   n: puntos por lado (lado / paso + 1); H: las n × n alturas (fila a fila, de z0 hacia z0 + lado)
//   faldon: lo que cuelga el faldón en cada borde [z0 (norte), x0 + lado (este), z0 + lado (sur), x0 (oeste)]
//   posiciones (x, y, z), indices (triángulos), superficie: cuántos vértices son del suelo (los demás, del faldón)
export function mallaTrozo(i, j, paso, altura, { lado = LADO, faldon = true } = {}) {
  if (lado % paso) throw new Error(`el paso ${paso} no cabe un número entero de veces en ${lado} m`);
  const x0 = i * lado, z0 = j * lado, c = lado / paso, n = c + 1;
  const H = new Float32Array(n * n);
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) H[b * n + a] = altura(x0 + a * paso, z0 + b * paso);

  // lo que cuelga cada borde: lo más que se aparta el terreno a 1 m de la recta entre dos puntos del borde
  const caida = [0, 0, 0, 0];
  if (faldon && paso > 1) {
    const bordes = [
      (t) => [x0 + t, z0, t / paso, 0], (t) => [x0 + lado, z0 + t, c, t / paso],
      (t) => [x0 + t, z0 + lado, t / paso, c], (t) => [x0, z0 + t, 0, t / paso],
    ];
    for (let e = 0; e < 4; e++) {
      let peor = 0;
      for (let t = 1; t < lado; t++) {
        if (t % paso === 0) continue;
        const [x, z, ga, gb] = bordes[e](t);
        const recta = e % 2 === 0
          ? lerpRejilla(H, n, Math.floor(ga), gb, ga - Math.floor(ga), 'a')
          : lerpRejilla(H, n, ga, Math.floor(gb), gb - Math.floor(gb), 'b');
        peor = Math.max(peor, Math.abs(altura(x, z) - recta));
      }
      caida[e] = peor;
    }
  }
  const cuelga = caida.map(v => faldon ? v + FALDON_EXTRA : 0);

  const superficie = n * n, extra = faldon ? 4 * n : 0, total = superficie + extra;
  const posiciones = new Float32Array(total * 3);
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const k = b * n + a; posiciones[k * 3] = a * paso; posiciones[k * 3 + 1] = H[k]; posiciones[k * 3 + 2] = b * paso; }
  const Indices = total > 65535 ? Uint32Array : Uint16Array;
  const indices = new Indices(c * c * 6 + (faldon ? 4 * c * 6 : 0));
  let q = 0;
  // la diagonal de cada cuadro va por el lado que más se dobla el terreno (sigue mejor las crestas y las vaguadas)
  for (let b = 0; b < c; b++) for (let a = 0; a < c; a++) {
    const p = b * n + a, r = p + 1, s = p + n, t = s + 1;
    if (Math.abs(H[p] - H[t]) > Math.abs(H[r] - H[s])) { indices[q++] = p; indices[q++] = s; indices[q++] = r; indices[q++] = r; indices[q++] = s; indices[q++] = t; }
    else { indices[q++] = p; indices[q++] = s; indices[q++] = t; indices[q++] = p; indices[q++] = t; indices[q++] = r; }
  }
  if (faldon) {
    // cada borde: los puntos del borde (en orden) y su copia colgada; los triángulos miran hacia fuera del trozo
    const borde = [
      Array.from({ length: n }, (_, a) => a),                       // norte (z0), de oeste a este
      Array.from({ length: n }, (_, b) => b * n + c),               // este, de norte a sur
      Array.from({ length: n }, (_, a) => c * n + (c - a)),         // sur, de este a oeste
      Array.from({ length: n }, (_, b) => (c - b) * n),             // oeste, de sur a norte
    ];
    for (let e = 0; e < 4; e++) {
      const base = superficie + e * n;
      for (let m = 0; m < n; m++) {
        const k = borde[e][m], v = base + m;
        posiciones[v * 3] = posiciones[k * 3]; posiciones[v * 3 + 1] = posiciones[k * 3 + 1] - cuelga[e]; posiciones[v * 3 + 2] = posiciones[k * 3 + 2];
      }
      for (let m = 0; m < c; m++) {
        const a1 = borde[e][m], a2 = borde[e][m + 1], b1 = base + m, b2 = base + m + 1;
        indices[q++] = a1; indices[q++] = a2; indices[q++] = b2; indices[q++] = a1; indices[q++] = b2; indices[q++] = b1;
      }
    }
  }
  return { i, j, paso, lado, x0, z0, n, H, faldon: cuelga, posiciones, indices, superficie };
}

// la altura en la recta del borde entre dos puntos de la rejilla (a lo largo de a o de b)
function lerpRejilla(H, n, a, b, f, eje) {
  if (eje === 'a') { const p = H[b * n + a], q = f ? H[b * n + a + 1] : p; return p + (q - p) * f; }
  const p = H[b * n + a], q = f ? H[(b + 1) * n + a] : p; return p + (q - p) * f;
}

// La altura de una malla de trozo en un punto (x, z) del mundo dentro de él, siguiendo sus triángulos (lo que se ve).
export function alturaEnMalla(m, x, z) {
  const c = m.n - 1, ga = (x - m.x0) / m.paso, gb = (z - m.z0) / m.paso;
  const a = Math.min(c - 1, Math.max(0, Math.floor(ga))), b = Math.min(c - 1, Math.max(0, Math.floor(gb)));
  const fa = ga - a, fb = gb - b, n = m.n, H = m.H;
  const p = H[b * n + a], r = H[b * n + a + 1], s = H[(b + 1) * n + a], t = H[(b + 1) * n + a + 1];
  if (Math.abs(p - t) > Math.abs(r - s)) {   // diagonal r–s
    return fa + fb <= 1 ? p + (r - p) * fa + (s - p) * fb : t + (s - t) * (1 - fa) + (r - t) * (1 - fb);
  }
  return fa >= fb ? p + (r - p) * fa + (t - r) * fb : p + (s - p) * fb + (t - s) * fa;   // diagonal p–t
}
