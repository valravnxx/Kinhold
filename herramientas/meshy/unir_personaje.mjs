// Kinhold — une los lotes de animaciones de Meshy de un personaje (lo que deja herramientas/meshy/encargo.py, acción
// «animar», en la rama meshy/<n>: <quien>_anim_00…50_animation_glb_url.glb, de 10 clips cada uno y la misma malla)
// en un solo .glb: la malla del primero y todos los clips, los de andar sin avanzar, texturas WebP de 1024 y meshopt.
// Uso: node herramientas/meshy/unir_personaje.mjs <carpeta de los lotes> <hombre|mujer> <salida.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
const [carpeta, quien, salida] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const lote = (n) => `${carpeta}/${quien}_anim_${n}_animation_glb_url.glb`;
const base = await io.read(lote('00'));
const raiz = base.getRoot();
const buf = raiz.listBuffers()[0];
const nodos = new Map(raiz.listNodes().map(n => [n.getName(), n]));
for (const n of ['10','20','30','40','50']) {
  const otro = await io.read(lote(n));
  for (const a of otro.getRoot().listAnimations()) {
    const na = base.createAnimation(a.getName());
    for (const c of a.listChannels()) {
      const s = c.getSampler();
      const cp = (acc) => base.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
      const ns = base.createAnimationSampler().setInput(cp(s.getInput())).setOutput(cp(s.getOutput())).setInterpolation(s.getInterpolation());
      const destino = nodos.get(c.getTargetNode().getName());
      if (!destino) throw new Error('falta el hueso ' + c.getTargetNode().getName());
      na.addSampler(ns).addChannel(base.createAnimationChannel().setTargetNode(destino).setTargetPath(c.getTargetPath()).setSampler(ns));
    }
  }
}
// los de andar, sin avanzar: se quita a las caderas lo que avanzan de principio a fin (el juego ya mueve al personaje)
const ANDAN = new Set(['Casual_Walk','Walking_Woman','Quick_Walk','Walk_Backward','Run_02','RunFast','Carry_Heavy_Object_Walk','Carry_Water_Bucket_Walk','Injured_Walk','Cautious_Crouch_Walk_Forward','Swim_Forward','Push_and_Walk_Forward']);
for (const a of raiz.listAnimations()) if (ANDAN.has(a.getName())) for (const c of a.listChannels()) {
  if (c.getTargetNode().getName() !== 'Hips' || c.getTargetPath() !== 'translation') continue;
  const t = c.getSampler().getInput().getArray(), o = c.getSampler().getOutput().getArray().slice(), n = t.length, T = t[n - 1] - t[0];
  const d0 = [o[0], o[2]], d1 = [o[3 * (n - 1)], o[3 * (n - 1) + 2]];
  for (let i = 0; i < n; i++) { const f = (t[i] - t[0]) / T; o[3 * i] -= (d1[0] - d0[0]) * f; o[3 * i + 2] -= (d1[1] - d0[1]) * f; }
  c.getSampler().setOutput(c.getSampler().getOutput().clone().setArray(o));
}
await MeshoptEncoder.ready;
await base.transform(resample(), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(salida, base);
console.log(quien, raiz.listAnimations().map(a => a.getName()).join(', '));
