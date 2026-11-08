// Sentado en el suelo a descansar (P4, 8 nov: «se descansa sentado, una acción nueva, con su animación»). La de
// Quaternius (CC0), Sitting_Idle_Loop, pasada al esqueleto del taller (pasar_animaciones.mjs), es de sentarse en una
// silla: la pelvis a unos 55 cm y las piernas dobladas hacia abajo. Para sentarse en el suelo, como se descansa en el
// campo, se queda con su tronco, sus brazos y su respirar, y cambia dos cosas:
//   - la pelvis baja hasta SUELO (m: la articulación de la cadera, a lo que hay de ahí a las nalgas);
//   - las rodillas, rectas: la rotación de cada pantorrilla (calf_l, calf_r) es la de estar de pie quieto (Idle_Loop
//     de taller-v24), así la pierna sigue el muslo, que en la silla ya va horizontal, y queda estirada en el suelo con
//     los pies de punta hacia arriba (el tobillo no se toca).
// Uso (desde la raíz):
//   V=docs/recursos/personajes
//   SOLO_ANIM=1 node herramientas/taller/pasar_animaciones.mjs $V/v1/animaciones.glb $V/taller-v12/mh_hombre.glb /tmp/sentar/hombre_extra.glb Sitting_Idle_Loop
//   (lo mismo con mh_mujer.glb → mujer_extra.glb)
//   node herramientas/taller/hacer_sentarse.mjs /tmp/sentar
//   EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/sentar docs/recursos/personajes/taller-sentarse-vN
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const dir = process.argv[2] || '/tmp/sentar';
const SUELO = Number(process.env.SUELO || 0.12);
const RODILLA = /^calf_[lr]$/;
for (const s of ['hombre', 'mujer']) {
  const doc = await io.read(`${dir}/${s}_extra.glb`);
  const base = await io.read(`docs/recursos/personajes/taller-v24/mh_${s}.glb`);
  const idle = base.getRoot().listAnimations().find(a => a.getName() === 'Idle_Loop');
  const recta = new Map();
  for (const c of idle.listChannels()) if (c.getTargetPath() === 'rotation' && RODILLA.test(c.getTargetNode().getName())) recta.set(c.getTargetNode().getName(), Array.from(c.getSampler().getOutput().getArray().slice(0, 4)));
  const clip = doc.getRoot().listAnimations().find(a => a.getName() === 'Sitting_Idle_Loop');
  let bajada = null, rodillas = 0;
  for (const c of clip.listChannels()) {
    const n = c.getTargetNode().getName(), camino = c.getTargetPath(), sal = c.getSampler().getOutput();
    if (n === 'pelvis' && camino === 'translation') {
      const v = sal.getArray().slice();   // el alto va en la tercera (como en Idle_Loop: 0,88 de pie)
      bajada = v[2] - SUELO;
      for (let i = 2; i < v.length; i += 3) v[i] -= bajada;
      sal.setArray(v);
    } else if (camino === 'rotation' && recta.has(n)) {
      const q = recta.get(n), v = new Float32Array(sal.getArray().length);
      for (let i = 0; i < v.length; i += 4) v.set(q, i);
      sal.setArray(v); rodillas++;
    }
  }
  if (bajada === null || rodillas !== 2) throw new Error(`${s}: sin pelvis o sin las dos rodillas (${rodillas})`);
  await io.write(`${dir}/${s}_extra.glb`, doc);
  console.log(s, `pelvis ${bajada.toFixed(3)} m más abajo, ${rodillas} rodillas rectas`);
}
