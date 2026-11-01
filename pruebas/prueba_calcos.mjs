// Comprueba los calcos de pelo pintados sobre la piel (desde taller-v21, revisión del 31 oct: «de cerca las cejas son
// trazos gruesos en bloque y entre la barba y el cuello queda una franja clara cortada»). Mira:
//  - que las cejas (del hombre y de la mujer) aprovechan su textura: antes sus trozos del mapa UV quedaban lejos unos de
//    otros y, al estirar la caja de todos, la ceja ocupaba una tira de unos 24 píxeles de ancho de los 512 (de cerca,
//    en bloques). Se pide que lo pintado (alfa > 0,5) ocupe al menos 6000 píxeles y que su caja mida más de un sexto del
//    lado en las dos direcciones;
//  - que las cejas no se cortan en el borde de su malla (desde taller-v22: salían en escalones rectos);
//  - que la barba clarea en pelos sueltos y no en una neblina gris (desde taller-v22: «como escarcha»);
//  - que la barba corta del hombre baja por delante del cuello hasta la ropa, rala: en los 3 cm por encima de la túnica,
//    alfa medio de más de 0,6;
//  - (desde taller-v24, revisión del 1 nov: «el bigote sigue siendo una banda oscura gruesa con el borde duro sobre el
//    labio, y bajo la barbilla la barba pasa de golpe de un bloque oscuro a motas grises sobre el cuello claro») que el
//    bigote con volumen no se aparta más de 6,5 mm de la piel (en la taller-v23, 8 mm), y que bajo la barbilla, de 2 a
//    4,5 cm por encima de la túnica, la piel queda a la vista (alfa < 0,25) en menos de un 6 % de la barba: las motas
//    empiezan justo encima de la ropa y no a media garganta.
// Uso: node pruebas/prueba_calcos.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v20, con los calcos de antes: tiene que fallar.
//      MUTAR=2 → mira la taller-v23 (bigote grueso y barba del cuello a motas): fallan las dos comprobaciones de la v24.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR === '2' ? `${base}/taller-v23` : process.env.MUTAR ? `${base}/taller-v20` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };

// alfa de una imagen (webp o png) con Pillow: ancho, alto y un byte por píxel
function alfa(bytes) {
  const py = `
import sys, io
from PIL import Image
im = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
sys.stdout.buffer.write(im.size[0].to_bytes(4, 'little') + im.size[1].to_bytes(4, 'little') + im.split()[3].tobytes())`;
  const b = execFileSync('python3', ['-c', py], { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
  return { w: b.readUInt32LE(0), h: b.readUInt32LE(4), a: b.subarray(8) };
}

// Lo pintado que toca el borde de la malla del calco (desde taller-v22, revisión del 31 oct, noche: las cejas se cortaban
// en escalones rectos porque la malla no llegaba a todo lo que se pinta). Se dibujan los triángulos en el mapa UV y se
// cuentan los píxeles pintados (alfa > 0,4) que tienen a menos de 2 píxeles uno que no cae en ningún triángulo, contando
// solo los bordes de la malla (una costura con otra isla no cuenta: el mismo punto sigue en la otra isla). Devuelve la
// parte de lo pintado que está así.
function cortados(prim, w, h, a) {
  const UV = prim.getAttribute('TEXCOORD_0'), P = prim.getAttribute('POSITION'), I = prim.getIndices();
  const tapa = new Uint8Array(w * h), uv = [], q = [];
  const tri = (k) => [0, 1, 2].map(j => I ? I.getScalar(3 * k + j) : 3 * k + j);
  const n = (I ? I.getCount() : P.getCount()) / 3;
  // aristas que son borde de la malla (por posición, para que las costuras UV no cuenten)
  const clave = (i) => { P.getElement(i, q); return q.map(x => Math.round(x * 1e5)).join(','); };
  const usos = new Map();
  for (let k = 0; k < n; k++) { const t = tri(k).map(clave); for (let j = 0; j < 3; j++) { const e = [t[j], t[(j + 1) % 3]].sort().join('|'); usos.set(e, (usos.get(e) || 0) + 1); } }
  const borde = new Uint8Array(w * h);
  for (let k = 0; k < n; k++) {
    const t = tri(k), c = t.map(i => { UV.getElement(i, uv); return [uv[0] * w, uv[1] * h]; }), cl = t.map(clave);
    const x0 = Math.max(0, Math.floor(Math.min(...c.map(v => v[0])))), x1 = Math.min(w - 1, Math.ceil(Math.max(...c.map(v => v[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...c.map(v => v[1])))), y1 = Math.min(h - 1, Math.ceil(Math.max(...c.map(v => v[1]))));
    const d = (c[1][1] - c[2][1]) * (c[0][0] - c[2][0]) + (c[2][0] - c[1][0]) * (c[0][1] - c[2][1]);
    if (Math.abs(d) < 1e-12) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const w0 = ((c[1][1] - c[2][1]) * (X - c[2][0]) + (c[2][0] - c[1][0]) * (Y - c[2][1])) / d;
      const w1 = ((c[2][1] - c[0][1]) * (X - c[2][0]) + (c[0][0] - c[2][0]) * (Y - c[2][1])) / d;
      if (w0 >= -0.01 && w1 >= -0.01 && 1 - w0 - w1 >= -0.01) tapa[y * w + x] = 1;
    }
    // los píxeles a lo largo de las aristas de borde de la malla
    for (let j = 0; j < 3; j++) {
      const e = [cl[j], cl[(j + 1) % 3]].sort().join('|');
      if (usos.get(e) !== 1) continue;
      const [ax, ay] = c[j], [bx, by] = c[(j + 1) % 3], pasos = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1;
      for (let s = 0; s <= pasos; s++) { const x = Math.floor(ax + (bx - ax) * s / pasos), y = Math.floor(ay + (by - ay) * s / pasos); if (x >= 0 && y >= 0 && x < w && y < h) borde[y * w + x] = 1; }
    }
  }
  let pintado = 0, malos = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x] <= 102 || !tapa[y * w + x]) continue;
    pintado++;
    let cerca = false;
    for (let dy = -2; dy <= 2 && !cerca; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && borde[Y * w + X]) { cerca = true; break; } }
    if (cerca) malos++;
  }
  return malos / Math.max(pintado, 1);
}

console.log('Calcos en', carpeta);
for (const sexo of ['hombre', 'mujer']) {
  const d = await io.read(`${carpeta}/mh_${sexo}.glb`);
  const nodos = d.getRoot().listNodes();
  const nodo = (s) => nodos.find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const cejas = nodo('cejas');
  comprobar(`${sexo}: hay cejas`, !!cejas);
  if (cejas) {
    const t = cejas.getMesh().listPrimitives()[0].getMaterial()?.getBaseColorTexture();
    const { w, h, a } = alfa(t.getImage());
    let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] > 127) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    // en píxeles y no en parte de la textura (desde taller-v22 la textura de las cejas es de 1024: su malla coge ahora todo
    // lo que se pinta y ocupa más del mapa UV). En la taller-v20 eran unos 800 píxeles; en la v21, unos 8000
    comprobar(`${sexo}: las cejas ocupan al menos 6000 píxeles de su textura`, n > 6000, `${n} px (${(100 * n / (w * h)).toFixed(1)} % de ${w}×${h})`);
    comprobar(`${sexo}: la caja de las cejas mide más de un sexto del lado en las dos direcciones`, (x1 - x0) > w / 6 && (y1 - y0) > h / 6, `${x1 - x0}×${y1 - y0} de ${w}×${h}`);
    const cortes = cortados(cejas.getMesh().listPrimitives()[0], w, h, a);
    comprobar(`${sexo}: las cejas no se cortan en el borde de su malla (sin escalones)`, cortes < 0.002, `${(100 * cortes).toFixed(2)} % de lo pintado`);
  }
  if (sexo !== 'hombre') continue;
  const barba = nodo('barba_corta'), tunica = nodo('capa_tunica');
  comprobar('hombre: hay barba corta y túnica', !!barba && !!tunica);
  if (!barba || !tunica) continue;
  // glTF: y hacia arriba, z hacia delante. Por columnas de 1 cm de ancho en la parte de delante del cuello (hasta 6 cm
  // del centro): la barba en los 3 cm que quedan por encima de lo más alto de la túnica en esa columna. Con la franja
  // clara de antes, ahí la barba ya se había ido aclarando (alfa medio de 0,42 en la taller-v20); ahora llega hasta la ropa
  const col = (p) => (p[0] >= 0 && p[0] < 0.06 && p[2] > 0) ? Math.floor(p[0] * 100) : null;
  const pb = barba.getMesh().listPrimitives()[0];
  const { w, h, a } = alfa(pb.getMaterial().getBaseColorTexture().getImage());
  // donde la barba clarea, pelos sueltos (cada píxel, pelo o piel) y no una neblina medio transparente: castaña sobre la piel
  // clara salía gris, «como escarcha» (revisión del 31 oct, noche; en la taller-v21, el 12,7 % de lo pintado tenía alfa
  // entre 0,2 y 0,7). Se pide menos del 7 %.
  let pint = 0, nieb = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] > 13) { pint++; if (a[k] > 51 && a[k] < 179) nieb++; } }
  comprobar('hombre: la barba clarea en pelos sueltos, sin neblina gris (alfa entre 0,2 y 0,7 en menos del 7 % de lo pintado)', nieb / pint < 0.07, `${(100 * nieb / pint).toFixed(1)} %`);
  const P = pb.getAttribute('POSITION'), UV = pb.getAttribute('TEXCOORD_0'), p = [], uv = [], alto = {};
  for (const pr of tunica.getMesh().listPrimitives()) {
    const T = pr.getAttribute('POSITION');
    for (let k = 0; k < T.getCount(); k++) { T.getElement(k, p); const c = col(p); if (c !== null) alto[c] = Math.max(alto[c] ?? -Infinity, p[1]); }
  }
  let suma = 0, n = 0;
  for (let k = 0; k < P.getCount(); k++) {
    P.getElement(k, p); UV.getElement(k, uv); const c = col(p);
    if (c === null || alto[c] === undefined || p[1] > alto[c] || p[1] < alto[c] - 0.03) continue;
    suma += a[Math.min(h - 1, Math.floor(uv[1] * h)) * w + Math.min(w - 1, Math.floor(uv[0] * w))] / 255; n++;
  }
  comprobar('hombre: la barba baja por el cuello hasta la ropa (alfa medio > 0,6 en los 3 cm sobre la túnica)', n > 10 && suma / n > 0.6, `${(suma / Math.max(n, 1)).toFixed(2)} en ${n} puntos`);
  // bajo la barbilla, sin motas a media garganta (desde taller-v24): se muestrea dentro de cada triángulo de la barba (los
  // vértices son pocos en el cuello) y, por columnas como arriba, se cuenta dónde se ve la piel entre los pelos
  const I = pb.getIndices(), el = (A, i) => { const o = []; A.getElement(i, o); return o; };
  let enBanda = 0, piel = 0;
  for (let t = 0; t < I.getCount() / 3; t++) {
    const ii = [0, 1, 2].map(j => I.getScalar(3 * t + j)), ps = ii.map(i => el(P, i)), us = ii.map(i => el(UV, i));
    for (let s1 = 0; s1 < 6; s1++) for (let s2 = 0; s1 + s2 < 6; s2++) {
      const u = (s1 + 0.33) / 6.5, v = (s2 + 0.33) / 6.5, w0 = 1 - u - v;
      if (w0 < 0) continue;
      const q = [0, 1, 2].map(k => ps[0][k] * w0 + ps[1][k] * u + ps[2][k] * v), uq = [0, 1].map(k => us[0][k] * w0 + us[1][k] * u + us[2][k] * v);
      const c = col(q);
      if (c === null || alto[c] === undefined || q[1] < alto[c] + 0.02 || q[1] > alto[c] + 0.045) continue;
      enBanda++; if (a[Math.min(h - 1, Math.floor(uq[1] * h)) * w + Math.min(w - 1, Math.floor(uq[0] * w))] < 64) piel++;
    }
  }
  comprobar('hombre: bajo la barbilla, sin motas a media garganta (piel a la vista en menos del 6 % de 2 a 4,5 cm sobre la túnica)', enBanda > 200 && piel / enBanda < 0.06, `${(100 * piel / Math.max(enBanda, 1)).toFixed(1)} % de ${enBanda} muestras`);
  // el bigote con volumen, fino (desde taller-v24): lo más que se aparta de la piel
  const mo = nodo('barba_mostacho'), pi = nodo('piel');
  if (mo && pi) {
    const pts = (nd) => { const r = []; for (const pr of nd.getMesh().listPrimitives()) { const A = pr.getAttribute('POSITION'); for (let k = 0; k < A.getCount(); k++) r.push(el(A, k)); } return r; };
    const cara = pts(pi).filter(q => q[2] > 0.03), bm = pts(mo);
    let mx = 0;
    for (const q of bm) { let m = Infinity; for (const r of cara) { const d = (q[0] - r[0]) ** 2 + (q[1] - r[1]) ** 2 + (q[2] - r[2]) ** 2; if (d < m) m = d; } mx = Math.max(mx, Math.sqrt(m)); }
    comprobar('hombre: el bigote no se aparta más de 6,5 mm de la piel (sin banda gruesa)', mx < 0.0065, `${(1000 * mx).toFixed(1)} mm`);
  } else comprobar('hombre: hay bigote con volumen y piel', false);
}
console.log(`Calcos: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
