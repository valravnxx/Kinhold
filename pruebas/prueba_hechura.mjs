// Hechura de la ropa fabricada (src/logica/hechura.js): material, corte y tejido de cada prenda de tela, su receta y
// coserla. Lógica pura: por defecto, cada prenda como en el taller; lo que no vale vuelve al de siempre; el material
// decide el color sin teñir; coser pide las telas del material y del tejido elegidos y un autor.
// Uso: node pruebas/prueba_hechura.mjs        MUTAR=1 → el corte no se valida: tiene que fallar.
import { HECHURAS, MATERIALES_TELA, CORTES, TEJIDOS, NUM_TEJIDO, normalizarHechura, normalizarHechuras, deSiempre, naturalDe, largoDe, granoDe, recetaHechura, coserPrenda, rasgosPrenda, mismosRasgos, vestidoDe, nombrePrenda } from '../src/logica/hechura.js';
import { Inventario, Inventarios, ejecutarInventario } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { validarAspecto } from '../src/logica/presencia.js';
import { PRENDAS_TENIBLES } from '../src/logica/tintes.js';

let ok = 0, mal = 0;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const norm = process.env.MUTAR ? (p, h) => ({ ...normalizarHechura(p, h), corte: h?.corte ?? 'largo' }) : normalizarHechura;

console.log('Hechura de la ropa');
comprobar('las prendas de tela del taller tienen hechura (y son teñibles)', ['camisa', 'calzas', 'tunica', 'vestido', 'gambeson', 'sobreveste', 'manto', 'capucha', 'toca'].every(p => HECHURAS[p] && PRENDAS_TENIBLES[p]));
comprobar('el sombrero y el calzado no tienen hechura', ['sombrero', 'zapatos', 'botas'].every(p => !HECHURAS[p]) && normalizarHechura('sombrero', {}) === null);
comprobar('la cota de malla, sin tela: solo larga o corta, y no se cose en el banco', HECHURAS.cota.forja && HECHURAS.cota.cortes.join() === 'largo,corto' && norm('cota', { corte: 'corto', material: 'lino' }).material === 'malla' && recetaHechura('cota', {}) === null);
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


console.log('La prenda cosida en el inventario: su hechura y su tinte van con ella');
const tun = { hechura: { corte: 'corto', tejido: 'sarga' }, tinte: 'glasto' };
const rt = rasgosPrenda('tunica_lana', tun);
comprobar('los rasgos de una prenda: su hechura y su tinte, limpios', rt.tinte === 'glasto' && rt.hechura.corte === 'corto' && rt.hechura.tejido === 'sarga' && rt.hechura.material === 'lana', JSON.stringify(rt));
comprobar('el material es el de la prenda del catálogo (la camisa de lana, de lana)', rasgosPrenda('camisa_lana', { hechura: { material: 'lino', tejido: 'rayas' } }).hechura.material === 'lana');
comprobar('lo de siempre no se apunta (los guardados viejos siguen igual)', JSON.stringify(rasgosPrenda('tunica_lana', { hechura: { corte: 'largo' } })) === '{}' && JSON.stringify(rasgosPrenda('espada', tun)) === '{}');
comprobar('un tinte de otra paleta o desconocido no vale (zapatos: cuero; cota: no se tiñe)', !rasgosPrenda('zapatos_cuero', { tinte: 'glasto' }).tinte && rasgosPrenda('zapatos_cuero', { tinte: 'rojizo' }).tinte === 'rojizo' && !rasgosPrenda('cota_malla', { tinte: 'rubia' }).tinte);
comprobar('la cota corta en el inventario', rasgosPrenda('cota_malla', { hechura: { corte: 'corto' } }).hechura?.corte === 'corto');
comprobar('dos túnicas con distinta hechura no son la misma', !mismosRasgos({ tipo: 'tunica_lana', ...tun }, { tipo: 'tunica_lana' }) && mismosRasgos({ tipo: 'tunica_lana', ...tun }, { tipo: 'tunica_lana', ...rt }));
const invs = new Inventarios(), reg = { anotar: (a, r) => ({ a, r }) };
const ej = (a) => ejecutarInventario(invs, reg, { autor: 'ana', ...a });
const inv = invs.de('ana');
ej({ tipo: 'coger', objeto: 'tunica_lana', cantidad: 1, a: 'ropa:abrigo', ...tun });
comprobar('se coge con su hechura y su tinte', JSON.stringify(inv.lugares['ropa:abrigo']) === JSON.stringify({ tipo: 'tunica_lana', n: 1, ...rt }), JSON.stringify(inv.lugares['ropa:abrigo']));
ej({ tipo: 'coger', objeto: 'tunica_lana', cantidad: 1, a: 'mano:der', hechura: { tejido: 'cuadros' }, tinte: 'verde' });
const m1 = ej({ tipo: 'mover', de: 'mano:der', a: 'ropa:abrigo' });
comprobar('cada prenda la suya: otra túnica no entra donde ya hay una', !m1.ok && inv.lugares['mano:der'].tinte === 'verde' && inv.lugares['ropa:abrigo'].tinte === 'glasto');
ej({ tipo: 'mover', de: 'ropa:abrigo', a: 'mano:izq' }); ej({ tipo: 'mover', de: 'mano:der', a: 'ropa:abrigo' });
comprobar('al quitársela y ponerse la otra, cada una sigue con lo suyo', inv.lugares['mano:izq'].hechura?.corte === 'corto' && inv.lugares['ropa:abrigo'].tinte === 'verde' && inv.lugares['ropa:abrigo'].hechura?.tejido === 'cuadros');
const g = Inventarios.importar(JSON.parse(JSON.stringify(invs.exportar()))).de('ana');
comprobar('se guarda y se carga con su hechura y su tinte', JSON.stringify(g.lugares['mano:izq']) === JSON.stringify(inv.lugares['mano:izq']) && g.lugares['ropa:abrigo'].tinte === 'verde');
const roto = Inventario.importarJugador({ lugares: { 'ropa:abrigo': { tipo: 'tunica_lana', n: 1, hechura: { corte: 'minifalda', tejido: 'tartán' }, tinte: 'fucsia' } }, apartado: [] });
comprobar('un guardado con hechura o tinte que no valen: la de siempre', JSON.stringify(roto.lugares['ropa:abrigo']) === '{"tipo":"tunica_lana","n":1}', JSON.stringify(roto.lugares['ropa:abrigo']));
comprobar('acción con hechura que no es un objeto: rechazada', !ej({ tipo: 'coger', objeto: 'camisa_lino', cantidad: 1, a: 'mano:der', hechura: 'corta' }).ok);
const suelo = new Suelo();
const so = suelo.soltar(inv, 'mano:izq', undefined, 0, 0, 0, 'ana', false);
const co = suelo.coger(inv, so.objeto, 0, 0, 1, 'mano:der');
comprobar('al soltarla al suelo y cogerla otra vez, sigue con lo suyo', co.ok && inv.lugares['mano:der'].hechura?.corte === 'corto' && inv.lugares['mano:der'].tinte === 'glasto', JSON.stringify(inv.lugares['mano:der']));

console.log('Lo que se ve puesto');
const lug = { 'ropa:interior': { tipo: 'camisa_lana', n: 1 }, 'ropa:abrigo': { tipo: 'tunica_lana', n: 1, ...rt }, 'ropa:exterior': { tipo: 'cota_malla', n: 1, hechura: { corte: 'corto' } } };
const v = vestidoDe(lug, 'hombre');
comprobar('las capas de lo puesto (descalzo sin calzado)', v.capas.join() === 'tunica,cota,descalzo', v.capas.join());
comprobar('la túnica, corta, de sarga y azul; la cota, corta', v.tintes.prendas.tunica === 'glasto' && v.hechuras.tunica.corte === 'corto' && v.hechuras.tunica.tejido === 'sarga' && v.hechuras.cota.corte === 'corto');
comprobar('la camisa de lana se ve de lana', v.hechuras.camisa.material === 'lana');
const v0 = vestidoDe({ 'ropa:abrigo': { tipo: 'tunica_lana', n: 1 } }, 'hombre');
comprobar('sin tinte propio, el de siempre (la túnica parda del taller)', v0.tintes.prendas.tunica === 'pardo' && deSiempre('tunica', v0.hechuras.tunica));
comprobar('en la mujer, la túnica se dibuja como vestido, con su tinte', vestidoDe(lug, 'mujer').tintes.prendas.vestido === 'glasto');
comprobar('el nombre lleva la hechura y el tinte', nombrePrenda('tunica_lana', rt) === 'Túnica de lana · Corto, Sarga · Azul de glasto' && nombrePrenda('tunica_lana', {}) === 'Túnica de lana', nombrePrenda('tunica_lana', rt));
const asp = validarAspecto({ sexo: 'hombre', capas: v.capas, tintes: v.tintes, hechuras: v.hechuras });
comprobar('en línea: el aspecto lleva los tintes y la hechura, comprobados', asp && asp.tintes.prendas.tunica === 'glasto' && asp.hechuras.cota.corte === 'corto');
const asp2 = validarAspecto({ sexo: 'hombre', capas: [], tintes: { prendas: { tunica: 'neon' } }, hechuras: { cota: { corte: 'tanga' } } });
comprobar('en línea: lo que no vale, el de siempre; sin tintes, no se manda nada', asp2.tintes.prendas.tunica === 'pardo' && asp2.hechuras.cota.corte === 'largo' && !('tintes' in validarAspecto({ sexo: 'hombre', capas: [] })) && validarAspecto({ sexo: 'hombre', capas: [], tintes: [1] }) === null);

console.log(`\nHechura: ${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
