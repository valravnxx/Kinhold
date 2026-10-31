// Comprueba la capa (manto) del taller (desde taller-v15, rehecha porque valravnx la vio «la capa que no es capa»: era la
// malla del cuerpo empujada hacia fuera y parecía un chaleco sin mangas que se metía en la cintura). Mira, en el hombre
// y en la mujer:
//  - que está, en dos piezas como las demás prendas (cuerpo y falda, src/logica/prendas.js), con el tinte de la ropa y la
//    prenda «manto», y con su broche;
//  - que cae: por detrás, a la altura de la cintura, queda igual o más atrás que a la altura del pecho (no se mete);
//  - que cuelga ancha: abajo es al menos tan ancha como en los hombros, y el bajo pasa de la rodilla (más de 90 cm de largo);
//  - que va abierta por delante: a media altura no hay tela delante del centro del pecho.
//  - (desde taller-v16) que los pliegues de la espalda se ven: a 30 cm del bajo, por detrás, la tela entra y sale al
//    menos 6,5 cm (en la v15, 5 cm: de espalda no se distinguían).
// Uso: node pruebas/prueba_manto.mjs [carpeta de recursos]   (por defecto, la última taller-vN publicada)
//      MUTAR=1 → mira la taller-v19, con los pliegues finos de antes: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
import sharp from 'sharp';

const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
const carpeta = process.env.MUTAR ? `${base}/taller-v19` : (process.argv[2] || `${base}/${ultima}`);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const puntos = (n) => {
  const r = [], v = [];
  for (const p of n.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'); for (let k = 0; k < a.getCount(); k++) { a.getElement(k, v); r.push([...v]); } }
  return r;
};
const cm = (x) => `${(x * 100).toFixed(1)} cm`;
console.log('Capa en', carpeta);
for (const sexo of ['hombre', 'mujer']) {
  const nodos = (await io.read(`${carpeta}/mh_${sexo}.glb`)).getRoot().listNodes();
  const nodo = (s) => nodos.find(n => n.getName() === `${sexo}_${s}` && n.getMesh());
  const m = nodo('capa_manto');
  comprobar(`${sexo}: hay capa`, !!m);
  if (!m) continue;
  const ex = m.getExtras() || {};
  comprobar(`${sexo}: tinte de la ropa, prenda «manto»`, ex.tinte === 'ropa' && ex.prenda === 'manto', JSON.stringify(ex));
  const falda = nodo('capa_manto_falda');
  comprobar(`${sexo}: con su falda`, !!falda);
  comprobar(`${sexo}: con broche`, !!nodo('capa_manto_broche'));
  // glTF: y arriba, z delante, x a los lados
  const P = [...puntos(m), ...(falda ? puntos(falda) : [])];
  const arriba = Math.max(...P.map(p => p[1])), abajo = Math.min(...P.map(p => p[1]));
  const franja = (y, ancho = 0.02) => P.filter(p => Math.abs(p[1] - y) < ancho);
  const atras = (y) => Math.min(...franja(y).filter(p => Math.abs(p[0]) < 0.06).map(p => p[2]));
  const ancho = (y) => { const f = franja(y); return Math.max(...f.map(p => p[0])) - Math.min(...f.map(p => p[0])); };
  const pecho = arriba - 0.25, cintura = arriba - 0.5;
  comprobar(`${sexo}: por detrás cae, no se mete en la cintura`, atras(cintura) <= atras(pecho) + 0.005, `atrás en el pecho ${cm(-atras(pecho))}, en la cintura ${cm(-atras(cintura))}`);
  comprobar(`${sexo}: abajo, al menos tan ancha como en los hombros`, ancho(abajo + 0.04) >= ancho(arriba - 0.12), `hombros ${cm(ancho(arriba - 0.12))}, bajo ${cm(ancho(abajo + 0.04))}`);
  comprobar(`${sexo}: larga (más de 90 cm de alto)`, arriba - abajo > 0.9, cm(arriba - abajo));
  const delante = franja(arriba - 0.4).filter(p => Math.abs(p[0]) < 0.05 && p[2] > 0);
  comprobar(`${sexo}: abierta por delante (nada delante del pecho a media altura)`, delante.length === 0, `${delante.length} puntos`);
  const medio = (Math.max(...P.map(p => p[2])) + Math.min(...P.map(p => p[2]))) / 2;
  const tras = P.filter(p => Math.abs(p[1] - (abajo + 0.3)) < 0.01 && Math.abs(p[0]) < 0.15 && p[2] < medio).map(p => p[2]);
  const hondo = tras.length ? Math.max(...tras) - Math.min(...tras) : 0;
  comprobar(`${sexo}: pliegues hondos por detrás (al menos 6,5 cm a 30 cm del bajo)`, hondo >= 0.065, cm(hondo));
  // (desde taller-v20) los pliegues de la espalda, anchos y que la malla dibuja: a 30 cm del bajo, de lado a lado de la
  // espalda (40 cm), lo más saliente de cada centímetro, sin la curva de la espalda (media de 16 cm): de lomo a
  // valle, al menos 9 cm y no más de 3 lomos (en la taller-v19, 4 lomos y 7 cm: muchos y finos, y de espalda se veía lisa)
  const banda = P.filter(p => Math.abs(p[1] - (abajo + 0.3)) < 0.015 && Math.abs(p[0]) < 0.2 && p[2] < medio);
  const fuera = []; // por centímetro: cuánto sale hacia atrás
  for (let i = 0; i < 40; i++) { const e = banda.filter(p => p[0] >= -0.2 + i / 100 && p[0] < -0.19 + i / 100).map(p => -p[2]); fuera.push(e.length ? Math.max(...e) : NaN); }
  const relleno = fuera.map((v, i) => Number.isNaN(v) ? fuera.find((w, j) => j > i && !Number.isNaN(w)) ?? fuera.findLast(w => !Number.isNaN(w)) : v);
  const resto = relleno.map((v, i) => { const t = relleno.slice(Math.max(0, i - 8), i + 9); return v - t.reduce((a, b) => a + b, 0) / t.length; });
  let lomos = 0, sube = 0;
  for (let i = 1; i < 39; i++) if (resto[i] > resto[i - 1] && resto[i] >= resto[i + 1] && resto[i] > 0.004) lomos++;
  for (let i = 0; i < 40; i++) for (let j = i; j < Math.min(40, i + 10); j++) sube = Math.max(sube, Math.abs(resto[j] - resto[i]));
  // (desde taller-v20) la sombra de los pliegues pintada en la tela, que es lo que los dibuja de espalda y en sombra (en el
  // juego, solo con la luz del cielo, la capa salía casi negra y lisa): en la mitad de abajo, por el centro de la tela,
  // el fondo de los pliegues a lo sumo al 70 % de la luz de los lomos, en sRGB (en la taller-v19, al 80 %)
  const tex = m.getMesh().listPrimitives()[0].getMaterial()?.getBaseColorTexture();
  if (tex) {
    const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
    const col = [];
    for (let x = Math.floor(info.width * 0.25); x < info.width * 0.75; x += 4) {
      let suma = 0, n = 0;
      for (let y = Math.floor(info.height * 0.6); y < info.height * 0.9; y += 4) { const k = (y * info.width + x) * info.channels; suma += data[k] + data[k + 1] + data[k + 2]; n++; }
      col.push(suma / n);
    }
    const proporcion = Math.min(...col) / Math.max(...col);
    comprobar(`${sexo}: la sombra de los pliegues, pintada en la tela (fondo a lo sumo al 70 % del lomo)`, proporcion <= 0.70, `${Math.round(proporcion * 100)} %`);
  } else comprobar(`${sexo}: la capa lleva su textura`, false);
  comprobar(`${sexo}: pliegues de la espalda anchos y marcados (9 cm o más de lomo a valle, como mucho 3 lomos en 40 cm)`, sube >= 0.09 && lomos >= 1 && lomos <= 3, `${lomos} lomos, ${cm(sube)} de lomo a valle`);
}
console.log(`Capa: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
