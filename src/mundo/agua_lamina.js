// Kinhold — la lámina de agua de cerca (ríos y mar) sobre una rejilla del terreno: la misma en la vista «como en el
// juego» del mapa (src/mapa/juego.js) y en el juego (src/mundo/agua_mundo.js). Generador: cada `yield` deja seguir al
// fotograma. Devuelve la malla (en coordenadas de la rejilla: x0 + i·paso, z0 + j·paso desde el centro cx, cz) o null
// si no hay agua.
//   pai: el paisaje; tramos: sus ríos de la zona; H: la altura del suelo en cada punto de la rejilla (n × n)
import * as THREE from 'three';
import { atributosAgua, distanciaOrilla } from '../mapa/agua.js';

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function* hacerLaminaAgua({ pai, tramos, cx, cz, x0, z0, n, paso, H, material }) {
    // el agua en el trozo de cerca (ríos y mar): una lámina a la altura del agua sobre la misma rejilla; donde corta el
    // terreno sale la orilla, lisa. Cada vértice lleva su hondura, la corriente del río y, en el mar, el oleaje (que se
    // apaga en lo somero y en el borde del trozo, donde sigue el mar de lejos, plano)
    const W = new Float32Array(n * n).fill(NaN), T = new Uint8Array(n * n);
    let hayAgua = false;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, w = pai.agua(cx + x0 + i * paso, cz + z0 + j * paso, tramos);
        if (w !== null) { W[k] = w; hayAgua = true; } else if (H[k] < 0.3) { W[k] = 0; T[k] = 1; hayAgua = true; }
      }
      if (j % 8 === 7) yield;
    }
    if (hayAgua) {
      const pa = new Float32Array(n * n * 3), ia = [], fl = new Float32Array(n * n * 2), ho = new Float32Array(n * n), ti = new Float32Array(n * n), ol = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i, x = x0 + i * paso, z = z0 + j * paso;
        // un vértice seco junto al agua se queda a la altura del agua de al lado: la lámina sigue plana bajo la orilla
        // (si bajara al terreno, en un cortado subiría como una cortina)
        let yv = W[k];
        if (isNaN(yv)) { let sm = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && !isNaN(W[jj * n + ii])) { sm += W[jj * n + ii]; c++; } } yv = c ? sm / c - 0.05 : H[k] - 0.5; }
        pa.set([x, yv, z], k * 3);
        if (isNaN(W[k])) continue;
        ho[k] = Math.max(0, W[k] - H[k]); ti[k] = T[k];
        if (T[k]) { const borde = Math.min(i, j, n - 1 - i, n - 1 - j) * paso; ol[k] = suave(0.4, 4, ho[k]) * suave(4, 30, borde); }
        else { const co = pai.corriente(cx + x, cz + z, tramos); fl[k * 2] = co.dx * co.vel; fl[k * 2 + 1] = co.dy * co.vel; }
        if (i === n - 1 && j % 16 === 15) yield;
      }
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
        if (isNaN(W[a]) && isNaN(W[b]) && isNaN(W[c2]) && isNaN(W[d])) continue;
        ia.push(a, c2, b, b, c2, d);
      }
      yield;
      const ga = new THREE.BufferGeometry(); ga.setAttribute('position', new THREE.BufferAttribute(pa, 3)); ga.setIndex(ia); ga.computeVertexNormals();
      // la orilla exacta: hondura con signo (negativa en seco, con el agua de al lado) y, en cada lado de la rejilla que
      // cruza la orilla, dónde corta el agua; la distancia sale de ahí (no de los puntos), y la línea queda lisa
      const seco = new Uint8Array(n * n), hs = new Float32Array(n * n), sem = new Float32Array(n * n).fill(NaN);
      for (let k = 0; k < n * n; k++) { hs[k] = pa[k * 3 + 1] - H[k]; seco[k] = hs[k] <= 0 ? 1 : 0; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const q = jj * n + ii; if (seco[k] === seco[q]) continue;
          const t = hs[k] / (hs[k] - hs[q]);                   // de k (0) a q (1), dónde la hondura pasa por 0
          const v = seco[k] ? -t * paso : t * paso;
          if (isNaN(sem[k]) || Math.abs(v) < Math.abs(sem[k])) sem[k] = v;
        }
      }
      yield;
      // la poza de espuma al pie de cada salto de agua: se apaga en unos 15 m aguas abajo y a los lados
      const es = new Float32Array(n * n);
      for (const sa of pai.saltosEn(tramos)) {
        const bx = sa.x - cx + sa.dx * 2, bz = sa.y - cz + sa.dy * 2, R = 8 + sa.ancho;
        const i0 = Math.max(0, Math.floor((bx - R * 2 - x0) / paso)), i1 = Math.min(n - 1, Math.ceil((bx + R * 2 - x0) / paso));
        const j0 = Math.max(0, Math.floor((bz - R * 2 - z0) / paso)), j1 = Math.min(n - 1, Math.ceil((bz + R * 2 - z0) / paso));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const ux = x0 + i * paso - bx, uz = z0 + j * paso - bz, a = ux * sa.dx + uz * sa.dy, l = -ux * sa.dy + uz * sa.dx;
          if (a < -2) continue;
          es[j * n + i] = Math.max(es[j * n + i], Math.max(0, 1 - Math.hypot(a / (R * 1.8), l / R)));
        }
      }
      atributosAgua(ga, { flujo: fl, hondo: ho, tipo: ti, ola: ol, orilla: distanciaOrilla(seco, n, paso, 60, sem), espuma: es });
      yield;
      const lamina = new THREE.Mesh(ga, material); lamina.name = 'aguaCerca'; lamina.receiveShadow = true;
      return lamina;
    }
    return null;
}
