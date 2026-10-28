// Pruebas de los datos de cada prenda (src/logica/prendas.js): zonas, protección por tipo de golpe, abrigo y peso,
// y que salen de lo mismo que se ve (las piezas de la ropa por capas del taller, en los .glb publicados).
// Uso: node pruebas/prueba_ropa.mjs
//      MUTAR=1 → la cota de malla pierde las mangas en los datos (el taller sí las tiene): tiene que fallar.
//      MUTAR=2 → el gambesón frena el doble de corte que en el combate: tiene que fallar.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync, readFileSync } from 'fs';
import { PRENDAS, MATERIALES_ROPA, ZONAS_PARTE, ZONAS_CUERPO, GOLPES, TALLER, DIBUJO_EN_OTRO_CUERPO, PRENDA_DE_DIBUJO,
  zonasDe, proteccion, abrigo, peso, puestasDe, capasDibujo, prendasDeCapas } from '../src/logica/prendas.js';
import { Inventario, CATALOGO, CAPAS } from '../src/logica/inventario.js';
import { ZONAS, ARMADURAS } from '../src/combate/logica.js';

if (process.env.MUTAR === '1') PRENDAS.cota_malla.partes = ['cuerpo', 'falda'];
if (process.env.MUTAR === '2') MATERIALES_ROPA.acolchado.proteccion = { ...MATERIALES_ROPA.acolchado.proteccion, corte: 0.275 };

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const cerca = (a, b) => Math.abs(a - b) < 0.01;

console.log('Datos de cada prenda');
const dibujos = [...TALLER.orden, ...TALLER.siempre, ...TALLER.tocados, ...TALLER.calzado];
for (const [k, p] of Object.entries(PRENDAS)) {
  const fallos = [];
  if (!CAPAS.includes(p.capa)) fallos.push('capa ' + p.capa);
  if (!MATERIALES_ROPA[p.material]) fallos.push('material ' + p.material);
  if (!p.partes.length || p.partes.some(x => !ZONAS_PARTE[x])) fallos.push('partes');
  if (!(p.peso > 0)) fallos.push('peso');
  if (!dibujos.includes(p.dibujo)) fallos.push('dibujo ' + p.dibujo);
  if (!zonasDe(k).length) fallos.push('no cubre nada');
  comprobar(`${k}: capa, material, partes, peso y pieza del taller`, !fallos.length, fallos.join(', ') || zonasDe(k).join(' '));
}
comprobar('las zonas del cuerpo incluyen todas las del combate', ZONAS.every(z => ZONAS_CUERPO.includes(z)));
comprobar('cada pieza del taller tiene su prenda', dibujos.every(d => PRENDAS[PRENDA_DE_DIBUJO[d]]?.dibujo === d));
for (const g of GOLPES) for (const m of Object.values(MATERIALES_ROPA)) if (!(m.proteccion[g] > 0 && m.proteccion[g] <= 1)) comprobar(`protección de ${m.nombre} entre 0 y 1`, false);

console.log('Lo que se ve y lo que protege: las piezas del taller');
const base = 'docs/recursos/personajes';
const ultima = readdirSync(base).filter(d => /^taller-v\d+$/.test(d)).sort((a, b) => +a.slice(8) - +b.slice(8)).at(-1);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const sexo of ['hombre', 'mujer']) {
  const doc = await io.read(`${base}/${ultima}/mh_${sexo}.glb`);
  const nombres = new Set(doc.getRoot().listNodes().map(n => n.getName()));
  const piezas = [...nombres].map(n => n.match(new RegExp(`^${sexo}_capa_([a-z]+)$`))?.[1]).filter(Boolean);
  comprobar(`${sexo} (${ultima}): todas sus capas tienen prenda y están en el orden del taller`,
    piezas.length >= 10 && piezas.every(d => PRENDA_DE_DIBUJO[d] && dibujos.includes(d)), piezas.join(' '));
  const cambia = DIBUJO_EN_OTRO_CUERPO[sexo];
  for (const [k, p] of Object.entries(PRENDAS)) {
    const d = p.dibujo in cambia ? cambia[p.dibujo] : p.dibujo;
    if (d === null) { comprobar(`${sexo}: ${k} no se dibuja y el modelo no tiene esa pieza`, !nombres.has(`${sexo}_capa_${p.dibujo}`)); continue; }
    const tiene = x => nombres.has(`${sexo}_capa_${d}_${x}`);
    const bien = nombres.has(`${sexo}_capa_${d}`) && tiene('mangas') === p.partes.includes('mangas') && tiene('falda') === p.partes.includes('falda');
    comprobar(`${sexo}: ${k} cubre lo que se ve (${d}: ${['mangas', 'falda'].filter(tiene).join(', ') || 'una pieza'})`, bien, zonasDe(k).join(' '));
  }
}
const fuente = readFileSync('src/personajes/makehuman.js', 'utf8');
comprobar('el cargador del taller toma el orden de las capas de los datos de las prendas',
  /from '\.\.\/logica\/prendas\.js'/.test(fuente) && /const ORDEN = TALLER\.orden/.test(fuente) && !/\['camisa', 'tunica'/.test(fuente));

console.log('Protección por tipo de golpe');
const lino = ['camisa_lino', 'pantalon_lino'], gamb = [...lino, 'gambeson'], malla = [...gamb, 'cota_malla'];
for (const g of GOLPES) {
  comprobar(`torso, ${g}: camisa = «lino» del combate`, cerca(proteccion(lino, 'torso', g), ARMADURAS.lino[g]));
  comprobar(`torso, ${g}: camisa y gambesón = «gambesón» del combate`, cerca(proteccion(gamb, 'torso', g), ARMADURAS.gambeson[g]), proteccion(gamb, 'torso', g).toFixed(3));
  comprobar(`torso, ${g}: y con cota = «malla» del combate`, cerca(proteccion(malla, 'torso', g), ARMADURAS.malla[g]), proteccion(malla, 'torso', g).toFixed(3));
}
comprobar('la cota protege los brazos', proteccion(malla, 'brazoD', 'corte') < proteccion(gamb, 'brazoD', 'corte'));
comprobar('la cabeza queda sin proteger (aún no hay yelmo)', proteccion(malla, 'cabeza', 'corte') === 1);
comprobar('la sobreveste no tiene mangas: no cubre los brazos', !zonasDe('sobreveste_lino').includes('brazoI'));
comprobar('la malla frena más el corte que el golpe contundente', proteccion(['cota_malla'], 'torso', 'corte') < proteccion(['cota_malla'], 'torso', 'contundente'));
comprobar('lo desconocido no protege ni pesa', proteccion(['nada'], 'torso', 'corte') === 1 && peso(['nada']) === 0);

console.log('Abrigo y peso');
comprobar('la camisa de lana abriga más que la de lino', abrigo(['camisa_lana']) > abrigo(['camisa_lino']));
comprobar('el manto abriga', abrigo([...lino, 'manto_lana']) > abrigo(lino), `${abrigo(lino)} → ${abrigo([...lino, 'manto_lana'])}`);
comprobar('la cota no abriga', abrigo([...gamb, 'cota_malla']) === abrigo(gamb));
comprobar('peso de camisa, pantalón, gambesón y cota', cerca(peso(malla), 0.3 + 0.3 + 3.5 + 10), peso(malla) + ' kg');

console.log('Del inventario al dibujo y vuelta');
const inv = Inventario.inicial();
comprobar('con lo puesto al empezar: camisa y pantalón de lino', puestasDe(inv.lugares).join() === 'camisa_lino,pantalon_lino');
comprobar('toda la ropa está en el catálogo, en su capa', Object.entries(PRENDAS).every(([k, p]) => CATALOGO[k]?.capa === p.capa));
inv.coger('gambeson', 1, 'mano:der');
const r = inv.ponerse('mano:der');
comprobar('ponerse el gambesón (capa de abrigo)', r.ok && inv.lugares['ropa:abrigo']?.tipo === 'gambeson', r.motivo);
comprobar('y ahora protege el torso', proteccion(puestasDe(inv.lugares), 'torso', 'corte') < 1);
inv.coger('tunica_lana', 1, 'mano:der');
const r2 = inv.ponerse('mano:der');
comprobar('la túnica va en la misma capa: no se pone encima del gambesón', !r2.ok, r2.motivo);
comprobar('hombre: lo puesto se dibuja con sus piezas', capasDibujo([...malla, 'manto_lana', 'botas_cuero'], 'hombre').join() === 'gambeson,cota,manto,botas');
comprobar('mujer: la túnica se dibuja como vestido y el pantalón no', capasDibujo(['camisa_lino', 'pantalon_lino', 'tunica_lana'], 'mujer').join() === 'vestido');
comprobar('hombre: la toca no se dibuja', capasDibujo(['toca_lino'], 'hombre').length === 0);
comprobar('del visor: túnica y capucha → camisa, pantalón, zapatos, túnica y capucha',
  prendasDeCapas(['tunica', 'capucha'], 'hombre').join() === 'camisa_lino,pantalon_lino,zapatos_cuero,tunica_lana,capucha_lana');
comprobar('del visor: mujer con botas → sin pantalón ni zapatos', prendasDeCapas(['vestido', 'botas'], 'mujer').join() === 'camisa_lino,vestido_lana,botas_cuero');
for (const sexo of ['hombre', 'mujer']) {
  const capas = sexo === 'hombre' ? ['tunica', 'gambeson', 'cota', 'sobreveste', 'capucha', 'botas'] : ['vestido', 'gambeson', 'manto', 'toca'];
  comprobar(`${sexo}: del visor a las prendas y vuelta da lo mismo`, capasDibujo(prendasDeCapas(capas, sexo), sexo).join() === capas.join());
}

console.log(`\n${ok} correctas, ${mal} fallos`);
process.exit(mal ? 1 : 0);
