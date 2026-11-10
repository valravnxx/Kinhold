// Kinhold — une los lotes de animaciones de Meshy de un personaje (lo que deja herramientas/meshy/encargo.py, acción
// «animar», en la rama meshy/<n>: <quien>_anim_00…50_animation_glb_url.glb, de 10 clips cada uno y la misma malla)
// en un solo .glb: la malla del primero y todos los clips, los de andar sin avanzar, texturas WebP de 1024 y meshopt.
// Y los movimientos hechos con Text to Motion (acción «movimientos»: <quien>_<nombre>.glb, un clip cada uno), con el
// nombre «mov_<nombre>», si se da su carpeta.
// Y lotes de más de la biblioteca (otra ejecución de «animar» sobre el mismo rig): EXTRA=<carpeta>, con SOLO_EXTRA=<clip,clip>
// para coger solo esos (los que ya están no se repiten).
// Uso: node herramientas/meshy/unir_personaje.mjs <carpeta de los lotes> <hombre|mujer> <salida.glb> [carpeta de los movimientos]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
const [carpeta, quien, salida, carpetaMov] = process.argv.slice(2);
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const lote = (n) => `${carpeta}/${quien}_anim_${n}_animation_glb_url.glb`;
const base = await io.read(lote('00'));
const raiz = base.getRoot();
const buf = raiz.listBuffers()[0];
const nodos = new Map(raiz.listNodes().map(n => [n.getName(), n]));
const fuentes = ['10','20','30','40','50'].map(n => [lote(n), null]);
if (carpetaMov) for (const f of fs.readdirSync(carpetaMov).sort()) if (f.startsWith(quien + '_') && f.endsWith('.glb')) fuentes.push([`${carpetaMov}/${f}`, 'mov_' + f.slice(quien.length + 1, -4)]);
if (process.env.EXTRA) for (const f of fs.readdirSync(process.env.EXTRA).sort()) if (f.startsWith(quien + '_anim_') && f.endsWith('_glb_url.glb')) fuentes.push([`${process.env.EXTRA}/${f}`, null, true]);
const soloExtra = process.env.SOLO_EXTRA ? new Set(process.env.SOLO_EXTRA.split(',')) : null;
for (const [archivo, nombre, extra] of fuentes) {
  const otro = await io.read(archivo);
  const anims = otro.getRoot().listAnimations();
  for (const a of nombre ? anims.slice(-1) : anims) {
    if (extra && (raiz.listAnimations().some(x => x.getName() === a.getName()) || (soloExtra && !soloExtra.has(a.getName())))) continue;
    const na = base.createAnimation(nombre || a.getName());
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
const ANDAN = new Set(['mov_hombro_andar','mov_empujar_andar','mov_arrastrar','mov_cargar_brazos','Casual_Walk','Walking_Woman','Quick_Walk','Walk_Backward','Run_02','RunFast','Carry_Heavy_Object_Walk','Carry_Water_Bucket_Walk','Injured_Walk','Cautious_Crouch_Walk_Forward','Swim_Forward','Push_and_Walk_Forward','walking_2']);
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
