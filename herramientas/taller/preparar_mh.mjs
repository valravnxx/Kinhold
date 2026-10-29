// Prepara para la web los personajes del taller (MakeHuman vestido por código + animaciones pasadas de Quaternius):
// texturas a WebP, animaciones sin fotogramas sobrantes y todo comprimido con meshopt (como los recursos v2).
// Uso: node herramientas/taller/preparar_mh.mjs <carpeta con hombre_anim.glb y mujer_anim.glb> [destino]
//   EXTRA=1: prepara en su lugar las animaciones sueltas (hombre_extra.glb y mujer_extra.glb, hechas con
//   SOLO_ANIM=1 pasar_animaciones.mjs) → mh_<sexo>_extra.glb, sin fotogramas sobrantes y comprimidas con meshopt.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, quantize, resample, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../..');
const origen = process.argv[2];
const destino = join(raiz, process.argv[3] || 'docs/recursos/personajes/taller-v1');
mkdirSync(destino, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
function aWebp(bytes) {
  const py = `
import sys, io
from PIL import Image
im = Image.open(io.BytesIO(sys.stdin.buffer.read()))
im = im.convert('RGBA') if im.mode in ('RGBA', 'LA') else im.convert('RGB')
out = io.BytesIO(); im.save(out, 'WEBP', quality=88, method=6)
sys.stdout.buffer.write(out.getvalue())`;
  return execFileSync('python3', ['-c', py], { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
}
const resumen = {};
if (process.env.EXTRA) {
  for (const sexo of ['hombre', 'mujer']) {
    const de = join(origen, `${sexo}_extra.glb`), doc = await io.read(de);
    await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const glb = await io.writeBinary(doc), f = join(destino, `mh_${sexo}_extra.glb`);
    writeFileSync(f, glb);
    resumen[`mh_${sexo}_extra`] = { kb: Math.round(glb.length / 1024), kb_antes: Math.round(statSync(de).size / 1024),
      sha256: createHash('sha256').update(glb).digest('hex'), clips: doc.getRoot().listAnimations().map(a => a.getName()) };
    console.log(`mh_${sexo}_extra`, resumen[`mh_${sexo}_extra`].kb_antes, '→', resumen[`mh_${sexo}_extra`].kb, 'KB');
  }
  writeFileSync(join(destino, 'manifiesto.json'), JSON.stringify(resumen, null, 1));
  process.exit(0);
}
for (const sexo of ['hombre', 'mujer']) {
  const doc = await io.read(join(origen, `${sexo}_anim.glb`));
  for (const t of doc.getRoot().listTextures()) t.setImage(aWebp(t.getImage())).setMimeType('image/webp');
  doc.createExtension(EXTTextureWebP).setRequired(true);
  await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
  const limpio = await io.readBinary(await io.writeBinary(doc));
  const sinPosicion = /^(?!POSITION$).*$/; // sin cuantizar posiciones: no cambia la escala de las mallas ni los huesos
  await limpio.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }), quantize({ pattern: sinPosicion, patternTargets: sinPosicion }));
  limpio.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const glb = await io.writeBinary(limpio);
  const f = join(destino, `mh_${sexo}.glb`);
  writeFileSync(f, glb);
  resumen[`mh_${sexo}`] = { kb: Math.round(glb.length / 1024), kb_antes: Math.round(statSync(join(origen, `${sexo}_anim.glb`)).size / 1024),
    sha256: createHash('sha256').update(glb).digest('hex'), clips: limpio.getRoot().listAnimations().map(a => a.getName()) };
  console.log(`mh_${sexo}`, resumen[`mh_${sexo}`].kb_antes, '→', resumen[`mh_${sexo}`].kb, 'KB');
}
writeFileSync(join(destino, 'manifiesto.json'), JSON.stringify(resumen, null, 1));
writeFileSync(join(destino, 'PROCEDENCIA.md'), `# Personajes del taller propio (v1)

- **Cuerpo:** malla base de MakeHuman a través de MPFB2 (github.com/makehumancommunity/mpfb2). Los recursos de MakeHuman
  (malla base, objetivos de forma y esqueleto «game_engine») son CC0.
- **Ropa, pelo, barba, cofia, piel y ojos:** hechos por código en este proyecto (herramientas/taller/vestir_mpfb.py),
  a partir de las mallas de ayuda de la propia base. No llevan recursos de terceros.
- **Animaciones:** Universal Animation Library de Quaternius (CC0), pasadas a este esqueleto con
  herramientas/taller/pasar_animaciones.mjs.
- Compresión: herramientas/taller/preparar_mh.mjs (WebP y meshopt).

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-v2…).
`);
