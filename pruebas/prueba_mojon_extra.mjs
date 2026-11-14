// Los mojones de más del admin (valravnx, 14 nov: «en el modo admin poner otro mojón para hacer construcciones visuales
// de prueba bonitas»). Ejecutar: node pruebas/prueba_mojon_extra.mjs
// Comprueba, en la lógica pura (con zonas): sin «extra» nadie pone un segundo mojón; con él, sí, en otra zona, y esa zona
// es suya (construye, y su invitada también); otro no puede tocar lo de ahí; quitar el de más pierde solo lo de su zona
// y deja el suyo; no quita el de otro; la tierra que vuelve al rey de un mojón de más no rompe; y el servidor quita
// «extra» a quien no tiene el modo autoconstruir (servidor/sistemas/conexion.mjs: se mira el código).
// Con MUTAR=1 el mojón de más pisa el de siempre: debe FALLAR.
import { readFileSync } from 'fs';
import { Mundo, ponerZonas, duenoBase } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';
import { Abandono, DIA } from '../src/logica/abandono.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
if (MUTAR) { const c = Mundo.prototype.colocarMojon; Mundo.prototype.colocarMojon = function (x, z, a, r) { delete this.mojones[a]; return c.call(this, x, z, a, r, false); }; }
const ADMIN = 'jugador:admin', CHICA = 'jugador:chica', OTRO = 'jugador:otro';
ponerZonas((x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`);
const reg = new RegistroAcciones(), m = new Mundo();
const E = (a) => ejecutar(m, reg, a);
let r = E({ autor: ADMIN, tipo: 'rellenar', cantidad: 500 });
r = E({ autor: ADMIN, tipo: 'mojon', x: 500, z: 500 });
comprobar('el admin pone su mojón', r.ok, r.motivo);
r = E({ autor: ADMIN, tipo: 'mojon', x: 1500, z: 500 });
comprobar('sin «extra», un segundo mojón no se puede', !r.ok, r.motivo);
r = E({ autor: ADMIN, tipo: 'mojon', x: 1500, z: 500, extra: true });
comprobar('con «extra», sí, en otra zona', r.ok && r.clave === ADMIN + '~2', r.clave || r.motivo);
comprobar('y el suyo sigue donde estaba', m.mojonDe(ADMIN) && m.mojonDe(ADMIN).x === 500);
r = E({ autor: ADMIN, tipo: 'mojon', x: 1600, z: 600, extra: true });
comprobar('en una zona que ya es suya, no', !r.ok, r.motivo);
r = E({ autor: ADMIN, tipo: 'mojon', x: 2500, z: 500, extra: true });
comprobar('un tercero, en otra zona', r.ok && r.clave === ADMIN + '~3', r.clave || r.motivo);
comprobar('la tierra de la zona de más es suya', duenoBase(m.tierraDe(1500, 500)) === ADMIN && m.dentroDeTierra(1550, 550, ADMIN));
r = E({ autor: ADMIN, tipo: 'colocar', pieza: 'cim_piedra', x: 1504, z: 500, k: 0, rot: 0, dir: 0 });
comprobar('construye en ella', r.ok, r.motivo);
const c = m.construcciones.at(-1); r = acabarObra(m, reg, ADMIN, c.id, [...c.piezas.keys()][0]);
r = E({ autor: ADMIN, tipo: 'colocar', pieza: 'cim_piedra', x: 504, z: 500, k: 0, rot: 0, dir: 0 });
comprobar('y en la suya', r.ok, r.motivo);
r = E({ autor: ADMIN, tipo: 'invitar', a: CHICA });
r = E({ autor: CHICA, tipo: 'colocar', pieza: 'cim_piedra', x: 1520, z: 520, k: 0, rot: 0, dir: 0 });
comprobar('su invitada también construye en la zona de más', r.ok, r.motivo);
r = E({ autor: OTRO, tipo: 'colocar', pieza: 'cim_piedra', x: 1530, z: 530, k: 0, rot: 0, dir: 0 });
comprobar('otro no', !r.ok, r.motivo);
comprobar('otro no puede tocar lo de ahí', !m.puedeTocar(1504, 500, OTRO).ok);
r = E({ autor: OTRO, tipo: 'mojon', x: 1700, z: 700 });
comprobar('ni poner su mojón en esa zona', !r.ok, r.motivo);
r = E({ autor: OTRO, tipo: 'quitar_mojon', mojon: ADMIN + '~2' });
comprobar('ni quitar el mojón de más del admin', !r.ok && !!m.mojones[ADMIN + '~2'], r.motivo);

const p = m.perderiaSinMojon(ADMIN, ADMIN + '~2');
comprobar('lo que se perdería es solo lo de esa zona', p && p.construcciones.length === 2 && p.construcciones.every(x => x.ox > 1000 && x.ox < 2000), p && String(p.construcciones.length));
const antes = m.construcciones.length;
r = E({ autor: ADMIN, tipo: 'quitar_mojon', mojon: ADMIN + '~2' });
comprobar('quitar el de más: solo ese y lo de su zona', r.ok && !m.mojones[ADMIN + '~2'] && !!m.mojonDe(ADMIN) && !!m.mojones[ADMIN + '~3'] && m.construcciones.length === antes - 2, r.motivo);
comprobar('la invitada lo sigue siendo', m.invitadosDe(ADMIN).includes(CHICA));
r = E({ autor: ADMIN, tipo: 'mojon', x: 1500, z: 500, extra: true });
comprobar('se vuelve a poner (con el primer número libre)', r.ok && r.clave === ADMIN + '~2', r.clave || r.motivo);

// la tierra al rey: el de más cuenta lo que entra el admin (no se va antes) y, si se va, no rompe
const ab = new Abandono(), t0 = Date.now();
ab.visto(ADMIN, t0);
let rev = ab.revisar(m, t0 + 2 * DIA);
comprobar('el de más no vuelve al rey si el admin entra', !rev.liberar.length && !rev.avisar.length, JSON.stringify(rev));
rev = ab.revisar(m, t0 + 10 * DIA);
comprobar('ni manda correos aparte (avisa el suyo)', rev.avisar.length === 1 && rev.avisar[0].dueno === ADMIN, JSON.stringify(rev.avisar));
r = E({ autor: 'rey', tipo: 'tierra_al_rey', dueno: ADMIN + '~3' });
comprobar('la tierra de un mojón de más vuelve al rey sin romper', r.ok && !m.mojones[ADMIN + '~3'] && !!m.mojonDe(ADMIN), r.motivo);

const otra = reproducir(reg.entradas);
comprobar('rehecho desde el registro da el mismo mundo', JSON.stringify(otra.exportar()) === JSON.stringify(m.exportar()));
const cod = readFileSync(new URL('../servidor/sistemas/conexion.mjs', import.meta.url), 'utf8');
comprobar('el servidor solo deja «extra» con el modo autoconstruir', /accion\.extra !== true \|\| !auto\)\) delete accion\.extra/.test(cod));
ponerZonas(null);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
