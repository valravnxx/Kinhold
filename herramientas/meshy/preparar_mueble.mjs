// Kinhold — prepara un mueble o estación que manda valravnx hecho en Meshy (valravnx, 11 nov: «los muebles te los iré
// enviando yo»): lo simplifica a un tope de triángulos, lo pone de pie sobre el suelo (y=0) y centrado, escala su lado
// largo a la medida pedida, texturas WebP de 1024 y meshopt, para el móvil.
//   node herramientas/meshy/preparar_mueble.mjs <entrada.glb> <salida.glb> <triángulos> <largo en m> [hundir en m]
// (hundir: cuánto entra en el suelo, p. ej. las estacas del acopio para que el durmiente pise el suelo)
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, meshopt, transformMesh } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [entrada, salida, tope = '6000', largo = '0', hundir = '0'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(entrada), raiz = doc.getRoot();
const triangulos = () => raiz.listMeshes().flatMap(m => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
const antes = triangulos();
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, Number(tope) / antes), error: 0.02, lockBorder: false }));
// de pie sobre el suelo, centrado y a su medida
const caja = getBounds(raiz.listScenes()[0]), lado = Math.max(caja.max[0] - caja.min[0], caja.max[2] - caja.min[2]);
const k = Number(largo) > 0 ? Number(largo) / lado : 1;
const cx = (caja.max[0] + caja.min[0]) / 2, cz = (caja.max[2] + caja.min[2]) / 2;
const m = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -cx * k, -caja.min[1] * k - Number(hundir), -cz * k, 1];   // escala y luego traslado (por columnas)
for (const malla of raiz.listMeshes()) transformMesh(malla, m);
if (process.env.SIN_MESHOPT) { await io.write(salida, doc); process.exit(0); }
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(salida, doc);
const c2 = getBounds(raiz.listScenes()[0]);
console.log(`triángulos ${antes} → ${triangulos()}; medida ${c2.max.map((v, i) => (v - c2.min[i]).toFixed(2)).join(' × ')} m`);
