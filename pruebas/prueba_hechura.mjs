// Hechura de la ropa fabricada (src/logica/hechura.js): material, corte y tejido de cada prenda de tela, su receta y
// coserla. Lógica pura: por defecto, cada prenda como en el taller; lo que no vale vuelve al de siempre; el material
// decide el color sin teñir; coser pide las telas del material y del tejido elegidos y un autor.
// Uso: node pruebas/prueba_hechura.mjs        MUTAR=1 → el corte no se valida: tiene que fallar.
import { HECHURAS, MATERIALES_TELA, CORTES, TEJIDOS, NUM_TEJIDO, normalizarHechura, normalizarHechuras, deSiempre, naturalDe, largoDe, granoDe, recetaHechura, coserPrenda } from '../src/logica/hechura.js';
import { PRENDAS_TENIBLES } from '../src/logica/tintes.js';

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const norm = process.env.MUTAR ? (p, h) => ({ ...normalizarHechura(p, h), corte: h?.corte ?? 'largo' }) : normalizarHechura;

console.log('Hechura de la ropa');
comprobar('las prendas de tela del taller tienen hechura (y son teñibles)', ['camisa', 'calzas', 'tunica', 'vestido', 'gambeson', 'sobreveste', 'manto', 'capucha', 'toca'].every(p => HECHURAS[p] && PRENDAS_TENIBLES[p]));
comprobar('la cota, el sombrero y el calzado no tienen hechura de tela', ['cota', 'sombrero', 'zapatos', 'botas'].every(p => !HECHURAS[p]) && normalizarHechura('cota', {}) === null);
comprobar('los tejidos del GDD', Object.keys(TEJIDOS).join() === 'liso,sarga,espiguilla,cuadros,rayas' && NUM_TEJIDO.liso === 0);
const todas = normalizarHechuras();
comprobar('por defecto, cada prenda como en el taller', Object.entries(todas).every(([p, h]) => deSiempre(p, h)), JSON.stringify(todas.tunica));
const raro = norm('tunica', { material: 'seda', corte: 'minifalda', tejido: 'tartán' });
comprobar('lo que no vale vuelve al de siempre', raro.material === 'lana' && raro.corte === 'largo' && raro.tejido === 'liso', JSON.stringify(raro));
comprobar('cada prenda solo con sus cortes (las calzas no se acortan)', norm('calzas', { corte: 'corto' }).corte === 'largo' && norm('sobreveste', { corte: 'medio' }).corte === 'medio');
comprobar('cada prenda solo con sus materiales (el manto, de lana)', norm('manto', { material: 'lino' }).material === 'lana' && norm('camisa', { material: 'lana' }).material === 'lana');
const h1 = { material: 'lino', corte: 'corto', tejido: 'cuadros' };
comprobar('una hechura válida se guarda y no cambia al normalizarla otra vez', JSON.stringify(normalizarHechura('tunica', normalizarHechura('tunica', h1))) === JSON.stringify(h1));
comprobar('con su material de siempre, el color sin teñir del taller', naturalDe('tunica', 'lana', PRENDAS_TENIBLES.tunica.natural) === PRENDAS_TENIBLES.tunica.natural);
comprobar('con otro material, el de ese material (túnica de lino: lino crudo, más claro)', naturalDe('tunica', 'lino', PRENDAS_TENIBLES.tunica.natural) === MATERIALES_TELA.lino.natural && MATERIALES_TELA.lino.natural[0] > PRENDAS_TENIBLES.tunica.natural[0]);
comprobar('cortes: largo entero, más corto cuanto más corto', largoDe('largo') === 1 && largoDe('corto') < largoDe('medio') && largoDe('medio') < 1 && largoDe('nada') === 1);
comprobar('la lana tiene más grano que el lino', granoDe('lana') > granoDe('lino'));
comprobar('colores apagados (nada chillón)', Object.values(MATERIALES_TELA).every(({ natural: c }) => (Math.max(...c) - Math.min(...c)) / Math.max(...c) <= 0.4));
comprobar('todos los cortes tienen nombre', Object.values(CORTES).every(c => c.nombre));

console.log('Recetas y coser');
const r = recetaHechura('gambeson', { material: 'lana', tejido: 'liso' });
comprobar('gambesón: 4 telas, relleno e hilo en el banco (sistemas.html)', r.estacion === 'banco' && r.piden.tela_lana === 4 && r.piden.relleno === 1 && r.piden.hilo === 1, JSON.stringify(r));
comprobar('la tela pedida es la del tejido elegido', recetaHechura('tunica', { material: 'lino', tejido: 'cuadros' }).piden.tela_lino_cuadros === 2);
const sin = coserPrenda({ autor: 'ana', prenda: 'tunica', hechura: h1 }, { tela_lino_cuadros: 1 });
comprobar('sin bastante tela, dice lo que falta', sin.falta && sin.falta.tela_lino_cuadros === 1 && sin.falta.hilo === 1, JSON.stringify(sin));
const con = coserPrenda({ autor: 'ana', prenda: 'tunica', hechura: h1, tinte: 'glasto' }, { tela_lino_cuadros: 2, hilo: 3 });
comprobar('con todo, sale la prenda con su hechura, su tinte y su autor', con.hecha && con.hecha.autor === 'ana' && con.hecha.tinte === 'glasto' && JSON.stringify(con.hecha.hechura) === JSON.stringify(h1) && con.gasta.hilo === 1, JSON.stringify(con));
comprobar('un tinte que no es de esa prenda queda sin teñir', coserPrenda({ autor: 'ana', prenda: 'tunica', hechura: h1, tinte: 'negro_azabache' }, { tela_lino_cuadros: 2, hilo: 1 }).hecha.tinte === 'natural');
comprobar('sin autor no se cose', !!coserPrenda({ prenda: 'tunica', hechura: h1 }, { tela_lino_cuadros: 2, hilo: 1 }).error);
comprobar('la cota de malla no se cose en el banco', !!coserPrenda({ autor: 'ana', prenda: 'cota' }).error);

console.log(`\nHechura: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
