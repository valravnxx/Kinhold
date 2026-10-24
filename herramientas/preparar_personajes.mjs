// Prepara los personajes a partir de los paquetes CC0 de Quaternius (Universal Base Characters,
// Modular Character Outfits – Fantasy y Universal Animation Library) para usarlos en el navegador:
// texturas reducidas (1024 color, 512 relieve y rugosidad), un .glb por pieza y un .glb solo con las
// animaciones que usa el juego. Resultado en docs/recursos/personajes/v1/ (se publica en la web).
//
// Uso: node herramientas/preparar_personajes.mjs <carpeta del paquete>
//   La carpeta es la de la copia redistribuida (CC0) en github.com/OpenAgentsInc/openagents,
//   assets/verse/characters/quaternius (commit e2247fd8101517d768c5937d7df720d35e89c77e o posterior).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = process.argv[2];
if (!origen || !existsSync(join(origen, 'base'))) { console.error('Uso: node herramientas/preparar_personajes.mjs <carpeta quaternius>'); process.exit(1); }
// se publica tal cual en la web; si cambian los modelos, subir la versión (v2…) y no tocar las anteriores
const destino = join(raiz, process.argv[3] || 'docs/recursos/personajes/v1');
mkdirSync(destino, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// reduce una imagen con Python (Pillow): devuelve los bytes nuevos y su tipo
function reducir(bytes, lado, formato) {
  const py = `
import sys, io
from PIL import Image
im = Image.open(io.BytesIO(sys.stdin.buffer.read()))
lado, fmt = ${lado}, '${formato}'
if max(im.size) > lado: im = im.resize((lado, lado), Image.LANCZOS)
out = io.BytesIO()
if fmt == 'jpeg': im.convert('RGB').save(out, 'JPEG', quality=86, optimize=True)
else: im.save(out, 'PNG', optimize=True)
sys.stdout.buffer.write(out.getvalue())`;
  return execFileSync('python3', ['-c', py], { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
}

const PIEZAS = {
  'base_hombre': 'base/Superhero_Male_FullBody.gltf',
  'base_mujer': 'base/Superhero_Female_FullBody.gltf',
  'ropa_campesino_hombre': 'outfits/Male_Peasant.gltf',
  'ropa_campesino_mujer': 'outfits/Female_Peasant.gltf',
  'ropa_explorador_hombre': 'outfits/Male_Ranger.gltf',
  'ropa_explorador_mujer': 'outfits/Female_Ranger.gltf',
  'pelo_raya': 'hair/Hair_SimpleParted.gltf',
  'pelo_rapado': 'hair/Hair_Buzzed.gltf',
  'pelo_rapado_mujer': 'hair/Hair_BuzzedFemale.gltf',
  'pelo_largo': 'hair/Hair_Long.gltf',
  'pelo_mono': 'hair/Hair_Buns.gltf',
  'barba': 'hair/Hair_Beard.gltf',
  'cejas_hombre': 'hair/Eyebrows_Regular.gltf',
  'cejas_mujer': 'hair/Eyebrows_Female.gltf',
};

const resumen = {};
for (const [nombre, ruta] of Object.entries(PIEZAS)) {
  const doc = await io.read(join(origen, ruta));
  // papel de cada textura según el hueco del material en el que se usa
  const papel = new Map();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getBaseColorTexture()) papel.set(m.getBaseColorTexture(), 'color');
    if (m.getNormalTexture()) papel.set(m.getNormalTexture(), 'relieve');
    if (m.getMetallicRoughnessTexture()) papel.set(m.getMetallicRoughnessTexture(), 'rugosidad');
  }
  for (const t of doc.getRoot().listTextures()) {
    const p = papel.get(t) || 'color';
    // el color con transparencia (pelo) se queda en PNG; el resto del color, en JPEG
    const conAlfa = p === 'color' && t.getMimeType() === 'image/png' && /RGBA|LA|P/.test(execFileSync('python3', ['-c', 'import sys,io;from PIL import Image;print(Image.open(io.BytesIO(sys.stdin.buffer.read())).mode)'], { input: Buffer.from(t.getImage()) }).toString());
    const formato = p === 'relieve' || conAlfa ? 'png' : 'jpeg';
    const lado = p === 'color' ? 1024 : 512;
    t.setImage(reducir(t.getImage(), lado, formato)).setMimeType(formato === 'png' ? 'image/png' : 'image/jpeg');
    t.setURI('');
  }
  for (const b of doc.getRoot().listBuffers()) b.setURI('');
  // un solo búfer para el .glb
  const bufs = doc.getRoot().listBuffers();
  for (const a of doc.getRoot().listAccessors()) a.setBuffer(bufs[0]);
  for (const b of bufs.slice(1)) b.dispose();
  await doc.transform(dedup(), prune());
  const glb = await io.writeBinary(doc);
  writeFileSync(join(destino, nombre + '.glb'), glb);
  resumen[nombre] = { origen: ruta, kb: Math.round(glb.length / 1024) };
  console.log(nombre.padEnd(24), resumen[nombre].kb, 'KB');
}

// animaciones: solo las que usa el juego, sin mallas
const CLIPS = {
  'gaits.glb': ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sword_Idle', 'Sword_Attack', 'Hit_Chest', 'Hit_Head', 'Death01', 'Interact', 'PickUp_Table', 'Crouch_Idle_Loop', 'Sitting_Idle_Loop', 'Roll', 'Idle_Talking_Loop'],
  'animations.glb': ['TreeChopping_Loop', 'Farm_Harvest', 'Walk_Carry_Loop', 'Sword_Block', 'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Idle_Shield_Loop', 'Consume', 'Idle_FoldArms_Loop', 'Hit_Knockback'],
};
{
  const salida = await io.read(join(origen, 'gaits.glb'));
  const quedan = new Set(CLIPS['gaits.glb']);
  for (const a of salida.getRoot().listAnimations()) if (!quedan.has(a.getName())) a.dispose();
  // añade los de la segunda librería copiando sus canales sobre los huesos del mismo nombre
  const otra = await io.read(join(origen, 'animations.glb'));
  const huesos = Object.fromEntries(salida.getRoot().listNodes().map(n => [n.getName(), n]));
  const buf = salida.getRoot().listBuffers()[0];
  for (const a of otra.getRoot().listAnimations()) {
    if (!CLIPS['animations.glb'].includes(a.getName())) continue;
    const nueva = salida.createAnimation(a.getName());
    for (const c of a.listChannels()) {
      const destinoNodo = huesos[c.getTargetNode()?.getName()];
      if (!destinoNodo) continue;
      const s = c.getSampler();
      const copia = (acc) => salida.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
      const sm = salida.createAnimationSampler().setInput(copia(s.getInput())).setOutput(copia(s.getOutput())).setInterpolation(s.getInterpolation());
      nueva.addSampler(sm).addChannel(salida.createAnimationChannel().setTargetNode(destinoNodo).setTargetPath(c.getTargetPath()).setSampler(sm));
    }
  }
  // sin mallas ni materiales: solo esqueleto y animaciones
  for (const m of salida.getRoot().listMeshes()) m.dispose();
  for (const n of salida.getRoot().listNodes()) if (n.getSkin()) n.setSkin(null);
  for (const s of salida.getRoot().listSkins()) s.dispose();
  // los huesos solo giran: fuera escalas y desplazamientos salvo los de la pelvis y la raíz
  for (const a of salida.getRoot().listAnimations()) for (const c of a.listChannels()) {
    const n = c.getTargetNode()?.getName(), path = c.getTargetPath();
    if (path === 'scale' || (path === 'translation' && n !== 'pelvis' && n !== 'root')) { const sm = c.getSampler(); c.dispose(); sm.dispose(); }
  }
  // quita fotogramas clave que no aportan nada (interpolación lineal sin pérdida visible)
  await salida.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
  const glb = await io.writeBinary(salida);
  writeFileSync(join(destino, 'animaciones.glb'), glb);
  resumen.animaciones = { clips: salida.getRoot().listAnimations().map(a => a.getName()), kb: Math.round(glb.length / 1024) };
  console.log('animaciones'.padEnd(24), resumen.animaciones.kb, 'KB ·', resumen.animaciones.clips.length, 'clips');
}

// licencias y procedencia
for (const f of ['base-license.txt', 'outfits-license.txt', 'animations-license.txt']) copyFileSync(join(origen, f), join(destino, f));
const huellas = Object.fromEntries(Object.keys(resumen).map(n => [n, createHash('sha256').update(readFileSync(join(destino, n + '.glb'))).digest('hex')]));
writeFileSync(join(destino, 'manifiesto.json'), JSON.stringify({ resumen, huellas }, null, 1));
console.log('listo en', destino);
