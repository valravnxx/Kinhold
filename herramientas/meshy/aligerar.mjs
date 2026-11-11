// Aligera un modelo de Meshy para el juego: node herramientas/meshy/aligerar.mjs <entrada.glb> <salida.glb> <triángulos> <alto_m>
// Para los encargos sin el remallado de Meshy («remallado»: false en pedido.json), que salen con la malla entera: une los
// vértices repetidos, simplifica con meshoptimizer hasta el tope de triángulos (guardando el contorno), pone el modelo a su
// altura de verdad con el pie en y = 0 y centrado, y deja las texturas en WebP de 1024 (móvil). Sin meshopt en la salida
// para que la abra cualquier visor; el juego, al meterlos, ya los comprime.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [entrada, salida, triS, altoS] = process.argv.slice(2);
if (!salida) { console.log('uso: aligerar.mjs <entrada.glb> <salida.glb> <triángulos> <alto_m>'); process.exit(1); }
const tope = Number(triS || 5000), alto = Number(altoS || 1);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(entrada);
const tris = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const antes = tris();
await MeshoptSimplifier.ready;
await doc.transform(weld(), dedup());
// la proporción que deja el tope; error grande permitido para que llegue (el contorno lo guarda el simplificador)
if (tris() > tope) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: tope / tris(), error: 0.05, lockBorder: false }));
await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
// a su altura, el pie en el suelo y centrado: una escala y un desplazamiento en el nodo raíz de la escena
const escena = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const b = getBounds(escena), h = b.max[1] - b.min[1], k = alto / h;
const raiz = doc.createNode('aligerado').setScale([k, k, k]).setTranslation([-k * (b.min[0] + b.max[0]) / 2, -k * b.min[1], -k * (b.min[2] + b.max[2]) / 2]);
for (const n of escena.listChildren()) { escena.removeChild(n); raiz.addChild(n); }
escena.addChild(raiz);
await io.write(salida, doc);
console.log(JSON.stringify({ entrada, antes: Math.round(antes), despues: Math.round(tris()), tope, alto }));
