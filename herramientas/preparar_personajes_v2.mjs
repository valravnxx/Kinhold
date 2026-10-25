// Recursos de personaje v2: los mismos modelos de la v1 (bases CC0 de Quaternius), comprimidos para que
// bajen antes, sobre todo en el móvil:
//   · geometría y animaciones con meshopt (EXT_meshopt_compression; three lo abre con MeshoptDecoder),
//   · texturas en WebP (EXT_texture_webp) en vez de PNG y JPEG, mismo tamaño en píxeles.
// La v1 publicada no se toca. Uso: node herramientas/preparar_personajes_v2.mjs [origen v1] [destino v2]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, process.argv[2] || 'docs/recursos/personajes/v1');
const destino = join(raiz, process.argv[3] || 'docs/recursos/personajes/v2');
mkdirSync(destino, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// pasa una imagen a WebP con Python (Pillow). Relieve (normales) con más calidad: los fallos se notan como arrugas
function aWebp(bytes, calidad) {
  const py = `
import sys, io
from PIL import Image
im = Image.open(io.BytesIO(sys.stdin.buffer.read()))
im = im.convert('RGBA') if ('A' in im.getbands() or 'transparency' in im.info) else im.convert('RGB')
out = io.BytesIO(); im.save(out, 'WEBP', quality=${calidad}, method=6)
sys.stdout.buffer.write(out.getvalue())`;
  return execFileSync('python3', ['-c', py], { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
}

const kb = (n) => Math.round(n / 1024);
const resumen = {};
for (const f of readdirSync(origen).filter(f => f.endsWith('.glb')).sort()) {
  const nombre = f.replace('.glb', '');
  const antes = statSync(join(origen, f)).size;
  if (nombre === 'animaciones_extra') { // ya va comprimida con meshopt en la v1
    copyFileSync(join(origen, f), join(destino, f));
    resumen[nombre] = { kb_v1: kb(antes), kb: kb(antes) };
    console.log(nombre.padEnd(24), kb(antes), 'KB (igual que la v1)');
    continue;
  }
  const doc = await io.read(join(origen, f));
  const relieve = new Set(doc.getRoot().listMaterials().map(m => m.getNormalTexture()).filter(Boolean));
  const texturas = doc.getRoot().listTextures();
  for (const t of texturas) t.setImage(aWebp(t.getImage(), relieve.has(t) ? 92 : 85)).setMimeType('image/webp');
  if (texturas.length) doc.createExtension(EXTTextureWebP).setRequired(true);
  // como en la v1 de las animaciones extra: la compresión va sobre el archivo ya escrito
  const limpio = await io.readBinary(await io.writeBinary(doc));
  if (!limpio.getRoot().listMeshes().length) await limpio.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  else {
    // como meshopt() pero sin cuantizar las posiciones: así no se cambia la escala de cada malla ni las matrices
    // de los huesos, y la ropa, el pelo y la barba pueden seguir compartiendo un solo esqueleto en el navegador
    const sinPosicion = /^(?!POSITION$).*$/;
    await limpio.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }), quantize({ pattern: sinPosicion, patternTargets: sinPosicion }));
    limpio.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  }
  const glb = await io.writeBinary(limpio);
  writeFileSync(join(destino, f), glb);
  resumen[nombre] = { kb_v1: kb(antes), kb: kb(glb.length) };
  console.log(nombre.padEnd(24), kb(antes), '→', kb(glb.length), 'KB');
}
for (const f of ['base-license.txt', 'outfits-license.txt', 'animations-license.txt']) copyFileSync(join(origen, f), join(destino, f));
const huellas = Object.fromEntries(Object.keys(resumen).map(n => [n, createHash('sha256').update(readFileSync(join(destino, n + '.glb'))).digest('hex')]));
const v1 = JSON.parse(readFileSync(join(origen, 'manifiesto.json'), 'utf8'));
writeFileSync(join(destino, 'manifiesto.json'), JSON.stringify({ origen: 'v1 (mismos modelos, comprimidos)', clips: v1.resumen.animaciones.clips, resumen, huellas }, null, 1));
const total = (k) => Object.values(resumen).reduce((s, r) => s + r[k], 0);
console.log('total', total('kb_v1'), '→', total('kb'), 'KB · listo en', destino);
