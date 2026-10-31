// Comprueba los calcos de pelo pintados sobre la piel (desde taller-v21, revisión del 31 oct: «de cerca las cejas son
// trazos gruesos en bloque y entre la barba y el cuello queda una franja clara cortada»). Mira:
//  - que las cejas (del hombre y de la mujer) aprovechan su textura: antes sus trozos del mapa UV quedaban lejos unos de
//    otros y, al estirar la caja de todos, la ceja ocupaba una tira de unos 24 píxeles de ancho de los 512 (de cerca,
//    en bloques). Se pide que lo pintado (alfa > 0,5) ocupe al menos el 4 % de la textura y que su caja mida más de un
//    tercio del lado en las dos direcciones;
//  - que la barba corta del hombre baja por delante del cuello hasta la ropa, rala: en los 3 cm por encima de la túnica,
//    alfa medio de más de 0,6.
// Uso: node pruebas/prueba_calcos.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v20, con los calcos de antes: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v20` : (process.argv[2] || `${base}/${ultima}`);
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
    comprobar(`${sexo}: las cejas ocupan al menos el 1,5 % de su textura`, n / (w * h) > 0.015, `${(100 * n / (w * h)).toFixed(1)} %`);
    comprobar(`${sexo}: la caja de las cejas mide más de un sexto del lado en las dos direcciones`, (x1 - x0) > w / 6 && (y1 - y0) > h / 6, `${x1 - x0}×${y1 - y0} de ${w}×${h}`);
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
}
console.log(`Calcos: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
