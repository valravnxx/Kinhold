// Prepara un modelo de naturaleza de Meshy (árbol, mata, planta o roca) para el mundo (src/mundo/naturaleza_meshy.js):
//   node herramientas/meshy/naturaleza.mjs <entrada.glb> <salida.glb> <alto_m> <tri_cerca> <tri_medio> <tri_lejos> [opciones]
// opciones: --peso-uv=<n> (cuánto cuesta estirar la textura al simplificar; la haya, 2), --tosco (la de lejos en bultos), --holgura-lejos=<n> (en la de lejos, cuántas veces el tope se acepta para no perder el tronco: el abedul), --ancho (alto_m es el ancho, no el alto: las rocas), --pie (centra en el pie del tronco, no en la caja: los árboles inclinados), --hundir=<m> (lo mete en el suelo),
//           --tex=<px> (la textura, 1024 por defecto), --suelo=<m> (hasta dónde oscurece el pie: la oclusión de contacto).
// Deja tres mallas: «cerca» (con su textura), «medio» y «lejos» (con el color de la textura en los vértices y menos triángulos), con el pie en y = 0, a su alto
// de verdad, una sola textura (el color, en WebP; sin brillo ni relieve, que el juego usa luz difusa) y el pie más oscuro
// horneado en el color de los vértices, como lo de código (src/mundo/estilos.js, Lote). Con meshopt, como los personajes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, prune, dedup, textureCompress, transformMesh, simplifyPrimitive, weldPrimitive, compactPrimitive, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2), op = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [entrada, salida, altoS, cercaS, medioS, lejosS] = args.filter(a => !a.startsWith('--'));
if (!lejosS) { console.log('uso: naturaleza.mjs <entrada.glb> <salida.glb> <alto_m> <tri_cerca> <tri_medio> <tri_lejos> [--pie] [--ancho] [--hundir=m] [--tex=px] [--suelo=m]'); process.exit(1); }
const ALTO = Number(altoS), TRI_CERCA = Number(cercaS), TRI_MEDIO = Number(medioS), TRI_LEJOS = Number(lejosS);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(entrada), root = doc.getRoot();

// todo en el espacio de la escena, en una sola primitiva
await doc.transform(flatten());
for (const n of root.listNodes()) if (n.getMesh()) { transformMesh(n.getMesh(), n.getMatrix()); n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]); }
await doc.transform(dedup(), join({ keepNamed: false }), weld(), prune());
const prims = root.listMeshes().flatMap(m => m.listPrimitives());
if (prims.length !== 1) console.log('aviso: quedan', prims.length, 'primitivas; se usa la más grande');
const prim = prims.sort((a, b) => b.getAttribute('POSITION').getCount() - a.getAttribute('POSITION').getCount())[0];
const triangulos = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
const antes = triangulos(prim);

// a su alto, el pie en y = 0 y centrado (en la caja, o en el pie del tronco con --pie)
const pos = prim.getAttribute('POSITION'), P = pos.getArray(), n = pos.getCount();
let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (let i = 0; i < n; i++) { const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
const k = ALTO / (op.ancho ? Math.max(x1 - x0, z1 - z0) : y1 - y0);
let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
if (op.pie) {   // el centro de lo que hay en el 4 % de abajo (el pie del tronco, sin las raíces de los lados: los del medio)
  const lim = y0 + (y1 - y0) * 0.04, xs = [], zs = [];
  for (let i = 0; i < n; i++) if (P[3 * i + 1] <= lim) { xs.push(P[3 * i]); zs.push(P[3 * i + 2]); }
  const med = (l) => l.sort((a, b) => a - b)[l.length >> 1];
  if (xs.length) { cx = med(xs); cz = med(zs); }
}
const hundir = Number(op.hundir || 0);
for (const m of root.listMeshes()) transformMesh(m, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -k * cx, -k * y0 - hundir, -k * cz, 1]);

// el pie, más oscuro (oclusión de contacto): como el Lote del juego, 0,55 en el suelo y 1 desde «suelo» m
const SUELO = Number(op.suelo || Math.min(0.6, k * (y1 - y0) * 0.25));
function oscurecerPie(p, base) {   // (base: el color de la textura en cada vértice, en las que no la llevan)
  const a = p.getAttribute('POSITION').getArray(), m = a.length / 3, col = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) { const h = Math.max(0, (a[3 * i + 1] + hundir) / SUELO), v = 0.55 + 0.45 * Math.min(1, Math.sqrt(h)); for (let q = 0; q < 3; q++) col[3 * i + q] = v * (base ? base[3 * i + q] : 1); }
  p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(col).setBuffer(root.listBuffers()[0]));
}
// el material: solo el color (el juego lo pinta con luz difusa, como lo demás)
const mat = prim.getMaterial();
if (mat) { mat.setMetallicFactor(0).setRoughnessFactor(1).setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]).setDoubleSided(false); }

// las dos: cerca (hasta su tope) y lejos (la misma, simplificada), cada una en su nodo
const otra = (p) => { const q = p.clone(); for (const s of p.listSemantics()) q.setAttribute(s, p.getAttribute(s).clone()); if (p.getIndices()) q.setIndices(p.getIndices().clone()); return q; };
// cerca: el simplificador normal (las costuras de las islas de la textura de Meshy quedan fijas: de 24 000 no baja de
// unos 8000, que ya vale). Lejos: el color de la textura pasado a los vértices y sin textura, y entonces se puede juntar
// por las costuras («Permissive») hasta muy pocos triángulos sin que el tronco salga verde.
// En los árboles (--pie), el tronco no se toca: sus vértices quedan fijos (los de cerca del eje, hasta 2,5 veces el radio
// del tronco), porque es fino y el simplificador lo quitaba entero antes que un bulto de la copa (11 nov: el abedul y la
// haya joven salían sin tronco).
const fijos = (p) => {
  if (!op.pie) return null;
  const a = p.getAttribute('POSITION').getArray(), m = a.length / 3, H = k * (y1 - y0), r = [];
  for (let i = 0; i < m; i++) { const y = a[3 * i + 1]; if (y > H * 0.04 && y < H * 0.15) r.push(Math.hypot(a[3 * i], a[3 * i + 2])); }
  r.sort((x, z) => x - z); const rt = r.length ? r[Math.floor(r.length * 0.5)] : 0, R = Math.max(H * 0.006, rt * 1.6);
  const l = new Uint8Array(m); for (let i = 0; i < m; i++) if (Math.hypot(a[3 * i], a[3 * i + 2]) < R && a[3 * i + 1] < H * 0.85) l[i] = 1;
  return l;
};
const PESO_UV = Number(op['peso-uv'] || process.env.PESO_UV || 0.5);   // (cuánto cuesta estirar la textura al juntar: con 0,5 la haya salía con rayas claras)
let costuras = false;   // (si la de cerca se ha tenido que juntar por las costuras de la textura: puede verse con rayas)
const reducir = (p, tope, permisivo, err = 0.012, holgura = 1.3, sloppy = false) => {
  weldPrimitive(p);
  const t = triangulos(p); if (t <= tope) return p;
  // primero, sin fijar nada, solo lo que no cambia la forma (error de 2 milésimas): el tronco queda con menos vértices
  if (op.pie) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: tope / t, error: 0.002, lockBorder: false });
  if (triangulos(p) <= tope) return p;
  const idx = () => new Uint32Array(p.getIndices().getArray()), pos = new Float32Array(p.getAttribute('POSITION').getArray()), n = pos.length / 3;
  const uvA = p.getAttribute('TEXCOORD_0'), uv = new Float32Array(n * 2), e = [0, 0];
  if (uvA) for (let i = 0; i < n; i++) { uvA.getElement(i, e); uv[2 * i] = e[0]; uv[2 * i + 1] = e[1]; }
  const antes = idx(), sinFijar = new Uint8Array(n);
  const hacer = (lock) => {
    const paso = (error, flags) => { const [nuevo] = MeshoptSimplifier.simplifyWithAttributes(idx(), pos, 3, uv, 2, [PESO_UV, PESO_UV], lock, Math.floor(tope) * 3, error, flags); p.getIndices().setArray(new Uint32Array(nuevo)); };
    if (!permisivo) {
      paso(0.08, []);
      if (triangulos(p) <= tope * 1.5) return;   // (si las costuras no le dejan bajar, también por ellas: arbusto de las bayas)
    }
    if (!permisivo && process.env.SIN_COSTURAS) return;
    paso(err, ['Permissive']); if (!permisivo) costuras = true;
  };
  const lock = fijos(p);
  if (sloppy) {   // (--tosco: de lejos, bultos que juntan lo pequeño en vez de quitarlo; el abedul, de hojas sueltas)
    const [nuevo] = MeshoptSimplifier.simplifySloppy(antes, pos, 3, lock || sinFijar, Math.floor(tope) * 3, 0.08);
    p.getIndices().setArray(new Uint32Array(nuevo)); return p;
  }
  if (lock) { hacer(lock); if (triangulos(p) <= tope * holgura) return p; p.getIndices().setArray(antes); }   // (si lo fijo no deja bajar, sin fijar: el roble, de tronco gordo, o el abeto)
  hacer(sinFijar);
  return p;
};
const pCerca = reducir(otra(prim), TRI_CERCA), pColor = otra(pCerca);
// el color de la textura en cada vértice de las de media distancia y lejos (sin textura)
const texColor = mat && mat.getBaseColorTexture();
let colorVert = null;
if (texColor) {
  const { data, info } = await sharp(Buffer.from(texColor.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const UV = pColor.getAttribute('TEXCOORD_0'), m = UV.getCount(), e = [0, 0], c = new Float32Array(m * 3), W = info.width, H = info.height;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  for (let i = 0; i < m; i++) {
    UV.getElement(i, e);   // (getElement: descuantizada)
    const u = e[0] - Math.floor(e[0]), v = e[1] - Math.floor(e[1]), px = Math.floor(u * (W - 1)), py = Math.floor(v * (H - 1));
    let r = 0, g = 0, b = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = Math.min(W - 1, Math.max(0, px + dx)), y = Math.min(H - 1, Math.max(0, py + dy)), o = (y * W + x) * 4; r += lin(data[o]); g += lin(data[o + 1]); b += lin(data[o + 2]); k++; }
    c[3 * i] = r / k; c[3 * i + 1] = g / k; c[3 * i + 2] = b / k;
  }
  colorVert = c;
  pColor.setAttribute('TEXCOORD_0', null);
  pColor.setMaterial(doc.createMaterial('sinTextura').setMetallicFactor(0).setRoughnessFactor(1));
}
oscurecerPie(pCerca, null); oscurecerPie(pColor, colorVert);
const pMedio = reducir(otra(pColor), TRI_MEDIO, true, 0.012, 2.2),   // (a media distancia el tronco se ve: se le deja más)
  pLejos = reducir(otra(pColor), TRI_LEJOS, true, 0.04, Number(op['holgura-lejos'] || 1.3), !!op.tosco);   // (de lejos se puede perder algo fino)
for (const p of [pCerca, pMedio, pLejos]) compactPrimitive(p);   // (fuera los vértices que ya no usa ningún triángulo)
for (const node of root.listNodes()) node.dispose();
for (const m of root.listMeshes()) m.dispose();
const escena = root.listScenes()[0] || doc.createScene();
for (const [nombre, p] of [['cerca', pCerca], ['medio', pMedio], ['lejos', pLejos]]) escena.addChild(doc.createNode(nombre).setMesh(doc.createMesh(nombre).addPrimitive(p)));
const tex = Number(op.tex || 1024);
await doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 85 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(salida, doc);
console.log(JSON.stringify({ salida, antes, cerca: triangulos(pCerca), medio: triangulos(pMedio), lejos: triangulos(pLejos), costuras, alto: ALTO, escala: +k.toFixed(4), pie: op.pie ? [+(k * (cx - (x0 + x1) / 2)).toFixed(2), +(k * (cz - (z0 + z1) / 2)).toFixed(2)] : null }));
