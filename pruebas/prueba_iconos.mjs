// Las imágenes de cada cosa para el panel de fabricar (herramientas/iconos/sacar.py, en docs/recursos/iconos-vN/):
// que no falte ninguna de lo que el panel enseña (lo que dan y piden las recetas, lo que hay que llevar, las
// estaciones y lo del catálogo que se puede llevar), que cada una sea una imagen WebP de verdad y no esté vacía, que el
// índice diga cuáles aún no tienen su modelo, y que cada receta diga para qué sirve lo que da.
// Uso: node pruebas/prueba_iconos.mjs
//      MUTAR=1 → como si faltara la imagen del hacha de piedra (tiene que fallar)
//      MUTAR=2 → como si la lasca de sílex no dijera para qué sirve (tiene que fallar)
//      MUTAR=3 → como si una imagen estuviera vacía (tiene que fallar)
//      MUTAR=4 → como si el odre saliera aún con el hatillo (tiene que fallar)
//      MUTAR=5 → como si el cinto de cuero saliera aún con el hatillo (tiene que fallar)
//      MUTAR=6 → como si faltara el hueco del kit de la interfaz (tiene que fallar)
import { readFileSync, existsSync, statSync } from 'fs';
import { RECETAS, ESTACIONES, PARA } from '../src/logica/fabricacion.js';
import { CATALOGO } from '../src/logica/inventario.js';
import { PRENDAS } from '../src/logica/prendas.js';
import { CARPETA_ICONOS, CARPETA_INTERFAZ, CARPETA_PIEZAS } from '../src/logica/iconos.js';
import { PIEZAS, DECORACION, enEsteTramo } from '../src/logica/piezas.js';

const MUTAR = process.env.MUTAR;
const carpeta = 'docs/' + CARPETA_ICONOS;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) bien++; else { fallos++; console.log('FALLO: ' + txt); } };

ok(existsSync(carpeta + 'indice.json'), `existe ${carpeta}indice.json`);
const indice = JSON.parse(readFileSync(carpeta + 'indice.json', 'utf8')).iconos;
if (MUTAR === '1') delete indice.hacha_piedra;

// lo que el panel enseña
const hace = new Set();
for (const r of Object.values(RECETAS)) { hace.add(r.da); for (const t of Object.keys(r.gasta)) hace.add(t); }
for (const [t, e] of Object.entries(ESTACIONES)) { hace.add('est_' + t); for (const k of Object.keys(e.coste)) hace.add(k); for (const k of e.requiere || []) hace.add(k); }
for (const t of Object.keys(CATALOGO)) if (!Object.hasOwn(PRENDAS, t)) hace.add(t);

for (const n of hace) {
  const f = carpeta + n + '.webp';
  ok(Object.hasOwn(indice, n) && typeof indice[n].propio === 'boolean', `«${n}» está en el índice y dice si tiene su modelo`);
  if (!existsSync(f)) { ok(false, `existe la imagen de «${n}» (${f})`); continue; }
  const b = readFileSync(f);
  ok(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', `«${n}» es una imagen WebP`);
  const tam = MUTAR === '3' && n === 'rama' ? 40 : statSync(f).size;
  ok(tam > 1500, `la imagen de «${n}» no está vacía (${tam} bytes)`);
}
// las que aún salen con el hatillo: tiene que decirlo el índice (el panel pone «sin modelo aún»)
const sinModelo = Object.entries(indice).filter(([, v]) => !v.propio).map(([k]) => k);
ok(sinModelo.includes('hacha_hierro'), 'el hacha de hierro sale como provisional (hoy usa el modelo del hacha de mano)');
// lo que piden y dan las recetas de P3 ya tiene su modelo (src/juego/modelos_objetos.js): ninguna receta enseña el hatillo
const deRecetas = new Set(); for (const r of Object.values(RECETAS)) { deRecetas.add(r.da); for (const t of Object.keys(r.gasta)) deRecetas.add(t); }
for (const t of deRecetas) ok(indice[t] && (MUTAR === '4' && t === 'odre' ? false : indice[t].propio), `«${t}», de las recetas, tiene su modelo`);
// lo que se lleva puesto (el panel de equipo, 7 nov): los cinturones y lo del hombro, con su modelo
for (const [t, d] of Object.entries(CATALOGO)) if (d.lugar) ok(indice[t] && (MUTAR === '5' && t === 'cinto_cuero' ? false : indice[t].propio), `«${t}», que se lleva puesto, tiene su modelo`);
ok(indice.rama && indice.rama.propio && indice.lenero && indice.lenero.propio && indice.est_piedra_tallar && indice.est_piedra_tallar.propio, 'la rama, el leñero y la piedra de tallar tienen su modelo');

// para qué sirve lo que da cada receta
const para = { ...PARA };
if (MUTAR === '2') delete para.lasca_silex;
for (const k of Object.keys(RECETAS)) ok(typeof para[k] === 'string' && para[k].length > 3, `la receta «${k}» dice para qué sirve`);
for (const k of Object.keys(para)) ok(Object.hasOwn(RECETAS, k), `«para qué» de una receta que existe (${k})`);
// y está traducido (los textos del juego, src/idiomas)
for (const l of ['en', 'ru']) {
  const dic = JSON.parse(readFileSync(`src/idiomas/${l}.json`, 'utf8'));
  for (const t of new Set(Object.values(para))) ok(Object.hasOwn(dic, t), `«${t}» traducido (${l})`);
}

// el kit de la interfaz (herramientas/interfaz/kit.py): lo que piden la plantilla y la barra de abajo, en su carpeta y
// la plantilla con la misma carpeta que el código
{
  const kit = 'docs/' + CARPETA_INTERFAZ, plantilla = readFileSync('src/plantilla.html', 'utf8');
  const pide = new Set([...plantilla.matchAll(/recursos\/interfaz-v\d+\/([a-z_]+\.webp)/g)].map(m => m[1]));
  for (const n of ['g_soltar', 'g_alhombro', 'g_amanos']) pide.add(n + '.webp');
  ok(pide.size >= 5, `la plantilla pide el kit (${pide.size} imágenes)`);
  ok([...plantilla.matchAll(/recursos\/(interfaz-v\d+)\//g)].every(m => m[1] + '/' === CARPETA_INTERFAZ.replace('recursos/', '')), 'la plantilla usa la misma carpeta del kit que el código');
  for (const n of pide) {
    const f = kit + n, hay = existsSync(f) && !(MUTAR === '6' && n === 'hueco.webp');
    ok(hay, `existe ${f}`);
    if (hay) { const b = readFileSync(f); ok(b.toString('ascii', 8, 12) === 'WEBP' && b.length > 800, `${n} es una imagen WebP de verdad`); }
  }
}

// las imágenes del menú de construir (sacar.py conjunto=piezas): cada pieza y cada mueble de este tramo con la suya
// (rota a propósito con MUTAR=7: falta la del muro de zarzo)
{
  const dir = 'docs/' + CARPETA_PIEZAS;
  const piden = [...Object.entries(PIEZAS).filter(([t, d]) => t !== 'mojon' && enEsteTramo(d)).map(([t]) => 'pz_' + t), ...Object.entries(DECORACION).filter(([, d]) => enEsteTramo(d)).map(([t]) => 'deco_' + t)];
  ok(piden.length >= 15, `el menú de construir enseña ${piden.length} piezas y muebles`);
  for (const n of piden) {
    const f = dir + n + '.webp', hay = existsSync(f) && !(MUTAR === '7' && n === 'pz_muro_zarzo');
    ok(hay, `existe ${f}`);
    if (hay) { const b = readFileSync(f); ok(b.toString('ascii', 8, 12) === 'WEBP' && b.length > 800, `${n} es una imagen WebP de verdad`); }
  }
}

console.log(`${bien} bien, ${fallos} fallos · ${hace.size} imágenes que enseña el panel, ${sinModelo.length} aún sin su modelo`);
process.exit(fallos ? 1 : 0);
