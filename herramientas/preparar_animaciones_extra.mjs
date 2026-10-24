// Animaciones extra de la Universal Animation Library 2 completa (versión Source, CC0, de Quaternius):
// trabajos, arco, espada ligera y pesada, bloqueos, vendarse, pasos en todas direcciones.
// Uso: node herramientas/preparar_animaciones_extra.mjs <UAL2_Source.glb>
//   Origen: copia CC0 en github.com/Arod231/monomachia, game/assets/quaternius/animations/UAL2_Source.glb
//   (su CREDITS.md la identifica como el UAL2.glb del paquete Source, licencia CC0 1.0).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = process.argv[2];
const destino = join(raiz, process.argv[3] || 'docs/recursos/personajes/v1/animaciones_extra.glb');
const CLIPS = ['Bandage_Loop', 'Bow_Aim_Neutral', 'Bow_Aim_Up', 'Bow_Aim_Down', 'Bow_Notch', 'Bow_Shoot', 'Mining_Loop', 'Farm_PickingTree',
  'Farm_ScatteringSeeds', 'Farm_PlantSeed', 'Farm_Watering', 'Fish_Cast', 'Fish_Cast_Idle_Loop', 'Fish_Reel', 'Sword_Light_A', 'Sword_Light_B',
  'Sword_Light_C', 'Sword_Light_D', 'Sword_Heavy_A', 'Sword_Heavy_B', 'Sword_Heavy_C', 'Sword_Heavy_D', 'Sword_Block', 'Idle_Shield_Loop',
  'Shield_OneShot', 'Walk_Fwd_Loop', 'Walk_Bwd_Loop', 'Walk_L_Loop', 'Walk_R_Loop', 'Turn180_L', 'Turn180_R', 'ClimbUp_1m', 'Consume',
  'Chest_Open', 'IdleToLay', 'LayToIdle', 'Idle_FoldArms_Loop', 'Hit_Knockback', 'OverhandThrow'];
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
// comprimido con meshopt (EXT_meshopt_compression): 12 MB → 1 MB; three lo abre con MeshoptDecoder
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(origen);
const quedan = new Set(CLIPS);
for (const a of doc.getRoot().listAnimations()) if (!quedan.has(a.getName())) a.dispose();
for (const a of doc.getRoot().listAnimations()) for (const c of a.listChannels()) {
  const n = c.getTargetNode()?.getName(), path = c.getTargetPath();
  if (path === 'scale' || (path === 'translation' && n !== 'pelvis' && n !== 'root')) { const sm = c.getSampler(); c.dispose(); sm.dispose(); }
}
for (const m of doc.getRoot().listMeshes()) m.dispose();
for (const n of doc.getRoot().listNodes()) if (n.getSkin()) n.setSkin(null);
for (const s of doc.getRoot().listSkins()) s.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
// la compresión se aplica sobre el archivo ya escrito (aplicada en el mismo paso no reducía las animaciones)
const limpio = await io.readBinary(await io.writeBinary(doc));
await limpio.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const glb = await io.writeBinary(limpio);
writeFileSync(destino, glb);
const faltan = CLIPS.filter(c => !doc.getRoot().listAnimations().some(a => a.getName() === c));
console.log(destino, Math.round(glb.length / 1024), 'KB ·', doc.getRoot().listAnimations().length, 'clips', faltan.length ? '· faltan: ' + faltan.join(', ') : '');
