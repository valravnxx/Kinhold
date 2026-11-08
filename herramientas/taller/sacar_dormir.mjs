// Tumbarse, estar dormido y levantarse (P4, la cama ligada; valravnx, 8 nov): las dos de Quaternius (CC0) ya pasadas al
// esqueleto del taller (IdleToLay y LayToIdle, en las 39 extra de taller-anim-v1), sacadas solas para que el juego no
// tenga que bajar el MB entero de las extra, y una tercera, Lay_Loop: el último fotograma de IdleToLay (tumbado boca
// arriba) con los brazos de estar de pie quieto (Idle_Loop de taller-v24): en el cuerpo tumbado, las manos quedan
// sobre la tripa (IdleToLay acaba con los brazos levantados hacia delante: no es como se duerme).
// Uso: node herramientas/taller/sacar_dormir.mjs && EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/dormir_src \
//   docs/recursos/personajes/taller-dormir-v1
import { mkdirSync } from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const BRAZO = /^(clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;
mkdirSync('/tmp/dormir_src', { recursive: true });
for (const s of ['hombre', 'mujer']) {
  const doc = await io.read(`docs/recursos/personajes/taller-anim-v1/mh_${s}_extra.glb`);
  for (const a of doc.getRoot().listAnimations()) if (!['IdleToLay', 'LayToIdle'].includes(a.getName())) a.dispose();
  // los brazos de estar quieto: el primer fotograma de Idle_Loop, por nombre de hueso
  const base = await io.read(`docs/recursos/personajes/taller-v24/mh_${s}.glb`);
  const idle = base.getRoot().listAnimations().find(a => a.getName() === 'Idle_Loop');
  const brazos = new Map();
  for (const c of idle.listChannels()) if (c.getTargetPath() === 'rotation' && BRAZO.test(c.getTargetNode().getName())) brazos.set(c.getTargetNode().getName(), Array.from(c.getSampler().getOutput().getArray().slice(0, 4)));
  const tumbar = doc.getRoot().listAnimations().find(a => a.getName() === 'IdleToLay');
  const lay = doc.createAnimation('Lay_Loop'), buf = doc.getRoot().listBuffers()[0];
  const tiempos = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(buf);
  let n = 0;
  for (const c of tumbar.listChannels()) {
    const nodo = c.getTargetNode(), camino = c.getTargetPath(), sal = c.getSampler().getOutput(), k = sal.getElementSize(), v = sal.getArray();
    const ultimo = Array.from(v.slice(v.length - k));
    const valor = camino === 'rotation' && brazos.has(nodo.getName()) ? brazos.get(nodo.getName()) : ultimo;
    const salida = doc.createAccessor().setType(sal.getType()).setArray(new Float32Array([...valor, ...valor])).setBuffer(buf);
    const m = doc.createAnimationSampler().setInput(tiempos).setOutput(salida).setInterpolation('LINEAR');
    lay.addSampler(m).addChannel(doc.createAnimationChannel().setTargetNode(nodo).setTargetPath(camino).setSampler(m));
    n++;
  }
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
  await io.write(`/tmp/dormir_src/${s}_extra.glb`, doc);
  console.log(s, doc.getRoot().listAnimations().map(a => a.getName() + ':' + a.listChannels().length).join(' '), `(${brazos.size} huesos de brazo de Idle_Loop, ${n} canales)`);
}
