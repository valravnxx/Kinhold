// Tumbarse y levantarse para dormir (P4, la cama ligada; valravnx, 8 nov): las dos de Quaternius (CC0) ya pasadas al
// esqueleto del taller (IdleToLay y LayToIdle, en las 39 extra de taller-anim-v1), sacadas solas para que el juego no
// tenga que bajar el MB entero de las extra.
// Uso: node herramientas/taller/sacar_dormir.mjs && EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/dormir_src \
//   docs/recursos/personajes/taller-dormir-v1
import { mkdirSync } from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
for (const s of ['hombre', 'mujer']) {
  const doc = await io.read(`docs/recursos/personajes/taller-anim-v1/mh_${s}_extra.glb`);
  for (const a of doc.getRoot().listAnimations()) if (!['IdleToLay', 'LayToIdle'].includes(a.getName())) a.dispose();
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
  mkdirSync('/tmp/dormir_src', { recursive: true });
  await io.write(`/tmp/dormir_src/${s}_extra.glb`, doc);
  console.log(s, doc.getRoot().listAnimations().map(a => a.getName() + ':' + a.listChannels().length));
}
