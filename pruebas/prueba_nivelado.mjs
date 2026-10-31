// Prueba: construir a la altura del suelo y nivelar (src/logica/nivelado.js, construccion.js y acciones.js).
// - Una construcción nueva queda a la altura del suelo donde empieza (oy) y el resto de sus piezas, en ella.
// - Un cimiento alisa su casilla (marca con autor); la brocha redonda solo en tu tierra y con radio de 0,5 a 4 m.
// - La altura nivelada: llana dentro, la de antes fuera del borde y suave en medio.
// - Los trozos del terreno salen con el suelo nivelado; los que no tocan, igual que antes.
// - Se guarda, se reproduce desde el registro y pasa por el mundo en línea igual.
// MUTAR=1 rompe la prueba a propósito (los trozos sin las marcas): tiene que fallar.
import { Mundo } from '../src/logica/construccion.js';
import { ejecutar, reproducir, RegistroAcciones } from '../src/logica/acciones.js';
import { nivelar, peso, aplicar, marcasEn, RADIO_CIMIENTO, BORDE } from '../src/logica/nivelado.js';
import { MundoEnLinea } from '../src/logica/en_linea.js';
import { generarMapa } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { hacerSueloTrozo } from '../src/mundo/trozo_suelo.js';
import { alturaDeTrozo, alturaEnMalla } from '../src/logica/trozos.js';

const MUTAR = process.env.MUTAR === '1';
let bien = 0, mal = 0;
const ok = (c, txt) => { if (c) bien++; else { mal++; console.log('FALLA:', txt); } };
const cerca = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// --- construcción a la altura del suelo ---
const m = new Mundo(), reg = new RegistroAcciones();
const A = (a) => ejecutar(m, reg, { autor: 'jugador:ana', ...a });
ok(A({ tipo: 'mojon', x: 0, z: 0 }).ok, 'mojón');
let r = A({ tipo: 'colocar', pieza: 'cim_tronco', x: 3, z: 3, k: 0, rot: 0, dir: 0, y: 4.25 });
ok(r.ok && r.construccion.oy === 4.25, 'la construcción nueva queda a la altura del suelo donde empieza');
r = A({ tipo: 'colocar', pieza: 'cim_tronco', x: 5, z: 3, k: 0, rot: 0, dir: 0, y: 7 });
ok(r.ok && m.construcciones.length === 1 && m.construcciones[0].oy === 4.25, 'la segunda pieza va en la misma construcción y a su altura (no a la de su punto)');
ok(!A({ tipo: 'colocar', pieza: 'cim_tronco', x: 7, z: 3, k: 0, rot: 0, dir: 0, y: 'alto' }).ok, 'una altura que no es número se rechaza');
r = A({ tipo: 'colocar', pieza: 'cim_tronco', x: -9, z: -9, k: 0, rot: 0, dir: 0 });
ok(r.ok && r.construccion.oy === 0, 'sin altura (los clientes de antes), a 0');
const c1 = m.construcciones[0];

// --- lo que alisan los cimientos ---
const cims = m.nivelados.filter(n => n.de === 'cimiento');
ok(cims.length === 3, `cada cimiento deja su marca (${cims.length})`);
ok(cims[0].autor === 'jugador:ana' && cims[0].y === 4.25 && cims[0].r === RADIO_CIMIENTO && cims[0].x === 3 && cims[0].z === 3, 'la marca del cimiento: su casilla, a la altura de la construcción, con autor');
ok(A({ tipo: 'colocar', pieza: 'cerca', x: 3, z: 6, k: 0, rot: 0, dir: 0, y: 4 }).ok && m.nivelados.length === 3, 'una cerca no alisa el suelo');
// se queda aunque se desmonte el cimiento (la tierra movida no vuelve sola)
const [k0] = [...c1.piezas.keys()].filter(k => k.startsWith('f:1,'));
ok(A({ tipo: 'desmontar', construccion: c1.id, clave: k0 }).ok && m.nivelados.length === 3, 'lo nivelado se queda al desmontar');

// --- la brocha ---
ok(A({ tipo: 'nivelar', x: 8, z: 2, y: 5, radio: 2 }).ok, 'una pasada de la brocha en tu tierra');
ok(m.nivelados.at(-1).de === 'brocha' && m.nivelados.at(-1).autor === 'jugador:ana', 'la pasada queda con su autor');
ok(!A({ tipo: 'nivelar', x: 80, z: 2, y: 5, radio: 2 }).ok, 'fuera de tu tierra, no');
ok(!A({ tipo: 'nivelar', x: 8, z: 2, y: 5, radio: 9 }).ok && !A({ tipo: 'nivelar', x: 8, z: 2, y: 5, radio: 0.1 }).ok, 'radio de 0,5 a 4 m');
ok(!ejecutar(new Mundo(), new RegistroAcciones(), { autor: 'b', tipo: 'nivelar', x: 0, z: 0, y: 1, radio: 1 }).ok, 'sin mojón, no');
ok(!ejecutar(m, reg, { tipo: 'nivelar', x: 8, z: 2, y: 5, radio: 2 }).ok, 'sin autor, no');

// --- la altura nivelada ---
const base = (x, z) => 0.3 * x + 0.1 * z;
const marca = { x: 0, z: 0, y: 2, r: 1.5, borde: BORDE };
const h = nivelar(base, [marca]);
ok(cerca(h(0, 0), 2) && cerca(h(1, 1), 2), 'dentro del radio, llano a su altura');
ok(cerca(h(5, 0), base(5, 0)) && cerca(h(0, -4), base(0, -4)), 'fuera del borde, como antes');
const hm = h(2.25, 0);
ok(hm > Math.min(2, base(2.25, 0)) - 1e-9 && hm < Math.max(2, base(2.25, 0)) + 1e-9 && peso(marca, 2.25, 0) > 0 && peso(marca, 2.25, 0) < 1, 'en el borde, entre las dos');
// suave: sin escalones (entre puntos a 1 cm, como mucho la pendiente más fuerte del borde: 1,5 × desnivel / borde)
let salto = 0;
for (let x = -4; x < 4; x += 0.01) salto = Math.max(salto, Math.abs(h(x + 0.01, 0.3) - h(x, 0.3)));
ok(salto < 0.01 * (1.5 * 3.5 / BORDE + 0.3), `sin escalones (${salto.toFixed(4)} m en 1 cm)`);
ok(cerca(aplicar(1, 0, 0, [marca, { ...marca, y: 3 }]), 3), 'la última manda donde se pisan');
ok(marcasEn([marca], 10, 10, 20, 20).length === 0 && marcasEn([marca], 2, 2, 20, 20).length === 1, 'las marcas de un rectángulo');
ok(nivelar(base, []) === base, 'sin marcas, la misma función');

// --- los trozos del terreno ---
const mapa = generarMapa(4242, { N: 96 }), pai = crearPaisaje(mapa);
// un sitio con tierra: junto al río más largo (como en la prueba de los trozos), en el centro de su trozo (i, j)
// (desde la mitad del río hacia los dos lados: con los ríos a la altura de lo más bajo de su tramo, 30 oct, junto al
// cauce puede quedar todo a menos de 1 m)
const rio = pai.rios.slice().sort((a, b) => b.length - a.length)[0], mitad = Math.floor(rio.length / 2);
let sitio = null, i = 0, j = 0;
for (let o = 0; o < rio.length && !sitio; o++) for (const k of [mitad + o, mitad - o]) {
  if (sitio || k < 0 || k >= rio.length) continue;
  const pr = rio[k], ii = Math.floor(pr.p[0] * 1000 / 64), jj = Math.floor(pr.p[1] * 1000 / 64);
  for (const [dx, dz] of [[32, 32], [16, 16], [48, 48], [16, 48], [48, 16]]) {
    const x = ii * 64 + dx, z = jj * 64 + dz, y = alturaDeTrozo(pai, ii, jj)(x, z);
    if (!sitio && y > 1) { sitio = { x, z, y }; i = ii; j = jj; }
  }
}
ok(!!sitio, 'hay tierra en el mapa de prueba');
const marcaW = { x: sitio.x, z: sitio.z, y: Math.round(sitio.y) + 1.5, r: 3, borde: BORDE };
const s0 = hacerSueloTrozo(pai, i, j, 1), s1 = hacerSueloTrozo(pai, i, j, 1, { marcas: MUTAR ? [] : [marcaW] });
ok(cerca(alturaEnMalla(s1, sitio.x, sitio.z), marcaW.y, 1e-3) && cerca(alturaEnMalla(s1, sitio.x + 1.7, sitio.z - 1.2), marcaW.y, 1e-3), 'el trozo sale llano donde se nivela');
ok(cerca(alturaEnMalla(s1, sitio.x + 20, sitio.z + 20), alturaEnMalla(s0, sitio.x + 20, sitio.z + 20)), 'lejos de la marca, el trozo como antes');
const otro = hacerSueloTrozo(pai, i + 3, j, 1, { marcas: [marcaW] }), otro0 = hacerSueloTrozo(pai, i + 3, j, 1);
ok(otro.H.every((v, n) => v === otro0.H[n]), 'un trozo que no toca la marca no cambia');
// el borde con el trozo de al lado casa
const vec = hacerSueloTrozo(pai, i + 1, j, 1, { marcas: [{ ...marcaW, x: (i + 1) * 64 }] }), aqui = hacerSueloTrozo(pai, i, j, 1, { marcas: [{ ...marcaW, x: (i + 1) * 64 }] });
let dif = 0;
for (let zz = j * 64; zz <= j * 64 + 64; zz += 1) dif = Math.max(dif, Math.abs(alturaEnMalla(vec, (i + 1) * 64, zz) - alturaEnMalla(aqui, (i + 1) * 64, zz)));
ok(dif < 1e-4, `una marca en el borde de dos trozos: los dos casan (${dif})`);

// --- guardado, registro y en línea ---
const datos = JSON.parse(JSON.stringify(m.exportar()));
const m2 = Mundo.importar(datos);
ok(m2.construcciones[0].oy === 4.25 && m2.nivelados.length === m.nivelados.length, 'se guarda y se carga con su altura y lo nivelado');
const viejo = { ...datos, construcciones: datos.construcciones.map(c => { const { oy, ...resto } = c; return resto; }) };
delete viejo.nivelados;
const m3 = Mundo.importar(viejo);
ok(m3.construcciones.every(c => c.oy === 0) && m3.nivelados.length === 0, 'un guardado de antes: todo a 0 y sin nivelar');
ok(JSON.stringify(reproducir(reg.exportar()).exportar()) === JSON.stringify(m.exportar()), 'reproducido desde el registro, el mismo mundo');
const enviados = [];
const red = new MundoEnLinea((msg) => enviados.push(msg));
red.recibir({ tipo: 'bienvenida', yo: 'jugador:ana', entradas: reg.exportar() });
ok(red.mundo.construcciones[0]?.oy === 4.25 && red.mundo.nivelados.length === m.nivelados.length, 'en línea: el mundo del servidor llega con su altura y lo nivelado');

console.log(`\n${bien} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
