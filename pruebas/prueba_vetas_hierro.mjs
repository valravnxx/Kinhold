// Prueba de lógica: las vetas pequeñas de hierro en la roca (P10, «Hierro y tablas», 19 nov). Con el mundo de verdad
// (src/logica/vetas_hierro.js, recogida_mundo.js, recoleccion.js, terreno_servidor.js y objetos_red.js):
//   - las vetas pequeñas de hierro del mapa (una por bloque de 14 km con tierra) de la isla tienen su sitio en el mundo,
//     el apuntado en VETAS_HIERRO, en ladera, en seco y sin árboles ni rocas encima;
//   - cada una sale como un punto «veta_hierro» en su trozo de recogida, sin nada más a su lado, y el servidor la conoce;
//   - con el pico en la mano, cada 5 golpes sueltan 1 mineral de hierro al suelo, junto a la veta (al mismo montón);
//     da de 30 a 40 antes de agotarse (mucho más que las 3 a 5 de la mancha de pantano) y vuelve en unos meses reales;
//   - sin pico en la mano (o solo guardado), con algo al hombro o lejos, no; no se «recoge» con las manos;
//   - lo que llevan los golpes se guarda; picar cansa; en tierra de otro solo pican su dueño y sus invitados.
// MUTAR=1: la veta no se agota; MUTAR=2: se pica sin el pico en la mano. Tienen que FALLAR.
import { Recoleccion, ejecutarRecoleccion, RECOLECTABLES, VETA, pasadasDe, QUE_PIDE } from '../src/logica/recoleccion.js';
import { recogidaTrozo, LADO_RECOGIDA, VETA_LIBRE, idPunto } from '../src/logica/recogida_mundo.js';
import { VETAS_HIERRO, buscarVetasHierro, BUSCAR_VETA } from '../src/logica/vetas_hierro.js';
import { Inventarios } from '../src/logica/inventario.js';
import { Suelo } from '../src/logica/suelo.js';
import { RegistroAcciones } from '../src/logica/acciones.js';
import { ESFUERZOS } from '../src/logica/necesidades.js';

const MUTAR = process.env.MUTAR;
let fallos = 0, total = 0;
function comprobar(nombre, cond, detalle = '') {
  total++; if (!cond) fallos++;
  console.log(`${cond ? '  bien' : '  MAL '}  ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
if (MUTAR === '1') { const d = Recoleccion.prototype.picar; Recoleccion.prototype.picar = function (...a) { const r = d.apply(this, a); if (r.ok && r.quedan === 0) delete this.estado[a[1].id]; return r; }; }
if (MUTAR === '2') { const d = Recoleccion.prototype.picar; Recoleccion.prototype.picar = function (inv, ...a) { if (!inv.lugares['mano:der']) inv.meterDonde('pico', 1, 'mano:der'); return d.call(this, inv, ...a); }; }

const DIA = 24 * 3600 * 1000, T0 = Date.UTC(2026, 10, 19, 21);

console.log('Las vetas en el mapa y en el mundo');
const { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } = await import('../src/logica/mapa.js');
const { crearPaisaje } = await import('../src/logica/paisaje.js');
const { alturaMundo, dentroDeIsla, SALIDA } = await import('../src/logica/whitholm.js');
const { zonasRecogida } = await import('../src/logica/recogida_mundo.js');
const t0 = Date.now();
const mapa = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), paisaje = crearPaisaje(mapa), alt = alturaMundo(paisaje);
console.log(`  (mapa en ${Date.now() - t0} ms)`);
const buscadas = buscarVetasHierro(mapa, paisaje, alt);
comprobar('los sitios apuntados en VETAS_HIERRO son los que salen del mapa', JSON.stringify(buscadas) === JSON.stringify(VETAS_HIERRO), JSON.stringify(buscadas));
const delMapa = mapa.vetas.filter(v => v.tipo === 'hierroVeta' && dentroDeIsla((v.x + 0.5) * mapa.celda, (v.y + 0.5) * mapa.celda));
comprobar('una por cada veta pequeña de hierro del mapa en la isla', VETAS_HIERRO.length === delMapa.length && VETAS_HIERRO.length >= 10, `${VETAS_HIERRO.length} de ${delMapa.length}`);
comprobar('cada una, dentro de su celda del mapa (a menos de 450 m de su centro)', VETAS_HIERRO.every((s, k) => Math.hypot(s.x - (delMapa[k].x + 0.5) * mapa.celda, s.z - (delMapa[k].y + 0.5) * mapa.celda) <= BUSCAR_VETA.radio));
const bien = VETAS_HIERRO.every(s => { const zr = zonasRecogida(paisaje, alt, mapa.semilla, s.x, s.z, paisaje.riosEn(s.x - 40, s.z - 40, s.x + 40, s.z + 40)); return zr && zr.s >= 0.15 && zr.s <= 0.6; });
comprobar('cada una en ladera (pendiente de 0,15 a 0,6) y en seco', bien);
const cerca = VETAS_HIERRO.map(s => Math.hypot(s.x - SALIDA.x, s.z - SALIDA.z) / 1000).sort((a, b) => a - b);
console.log(`  (la más cercana a la salida común, a ${cerca[0].toFixed(1)} km; la más lejana, a ${cerca[cerca.length - 1].toFixed(1)} km)`);
const v0 = VETAS_HIERRO[7], L = LADO_RECOGIDA, ti = Math.floor(v0.x / L), tj = Math.floor(v0.z / L);
const enTrozo = recogidaTrozo(paisaje, alt, mapa.semilla, ti, tj);
const pv = enTrozo.find(p => p.tipo === 'veta_hierro');
comprobar('sale en su trozo de recogida como un punto «veta_hierro», con su nombre por su sitio', !!pv && pv.id === idPunto('veta_hierro', v0.x, v0.z) && pv.x === v0.x && pv.z === v0.z, JSON.stringify(pv));
let otros = 0;
for (let j = tj - 1; j <= tj + 1; j++) for (let i = ti - 1; i <= ti + 1; i++) otros += recogidaTrozo(paisaje, alt, mapa.semilla, i, j).filter(p => p.tipo !== 'veta_hierro' && Math.hypot(p.x - v0.x, p.z - v0.z) < VETA_LIBRE).length;
comprobar(`y nada más que recoger a menos de ${VETA_LIBRE} m (tampoco en los trozos de al lado)`, otros === 0, `${otros}`);
comprobar('solo en su trozo (no se repite en el de al lado)', recogidaTrozo(paisaje, alt, mapa.semilla, ti + 1, tj).every(p => p.tipo !== 'veta_hierro'));

console.log('Picar la veta en la lógica');
const veta = { id: idPunto('veta_hierro', 40, 4), tipo: 'veta_hierro', x: 40, z: 4 };
const rec = new Recoleccion([veta]);
const invs = new Inventarios(), reg = new RegistroAcciones(), suelo = new Suelo();
const yo = 'ana', inv = invs.de(yo);
const picar = (ahora, x = veta.x + 1.8, a = yo) => ejecutarRecoleccion(rec, invs, reg, { autor: a, tipo: 'romper', punto: veta.id, x, z: veta.z }, ahora, suelo);
const enSuelo = () => suelo.objetos.filter(o => o.cosa.tipo === 'mineral_hierro').reduce((n, o) => n + o.cosa.n, 0);
comprobar('da mineral de hierro, de 30 a 40 veces (la mancha de pantano, de 3 a 5)', RECOLECTABLES.veta_hierro.da === 'mineral_hierro' && RECOLECTABLES.veta_hierro.pasadas[0] >= 6 * RECOLECTABLES.hierro_pantano.pasadas[1] && RECOLECTABLES.veta_hierro.pasadas[1] === 40, JSON.stringify(RECOLECTABLES.veta_hierro.pasadas));
let r = picar(T0);
comprobar('sin pico, no', !r.ok && r.motivo === QUE_PIDE.picar, r.motivo);
inv.coger('cinto_anillas', 1, 'cintura'); inv.meterDonde('pico', 1, 'cintura/0');
r = picar(T0 + 1000);
comprobar('con el pico guardado en el cinto (no en la mano), tampoco', !r.ok && inv.lugares['cintura'] && !inv.lugares['mano:der'], r.motivo);
r = rec.recoger(inv, veta.id, veta.x + 1, veta.z, T0 + 1000);
comprobar('no se recoge con las manos (se pica)', !r.ok, r.motivo);
comprobar('ni sale entre lo que se recoge', rec.cercanos(veta.x + 1, veta.z, T0 + 1000, 5).length === 0);
inv.mover(inv.rutasCon('pico')[0], 'mano:der');
comprobar('(el pico, ahora en la mano)', inv.lugares['mano:der'] && inv.lugares['mano:der'].tipo === 'pico');
r = picar(T0 + 2000, veta.x + 5);
comprobar('lejos (a más de 2 m de su borde), no', !r.ok && r.motivo === 'Está demasiado lejos.', r.motivo);
let t = T0 + 3000, golpes = 0;
for (let k = 0; k < VETA.golpes - 1; k++) { t += 900; r = picar(t); golpes++; }
comprobar(`con el pico en la mano, los ${VETA.golpes - 1} primeros golpes no sueltan nada`, r.ok && !r.deja && enSuelo() === 0 && r.faltan === 1, `${r.motivo || ''} faltan ${r.faltan}`);
r = picar(t + 100);
comprobar('dos golpes demasiado seguidos, no', !r.ok, r.motivo);
t += 900; r = picar(t); golpes++;
comprobar(`al ${VETA.golpes}º golpe suelta 1 mineral de hierro al suelo, junto a la veta y del lado del que pica`, r.ok && r.deja && enSuelo() === 1 && suelo.objetos[0].x > veta.x && Math.hypot(suelo.objetos[0].x - veta.x, suelo.objetos[0].z - veta.z) < VETA.radio + 0.1, JSON.stringify(r.deja));
comprobar('y no al inventario', inv.cuantos('mineral_hierro') === 0);
comprobar('picar cansa (menos que un golpe de mazo a una roca)', ESFUERZOS.picar > 0 && ESFUERZOS.picar < ESFUERZOS.romper);
// lo que llevan los golpes se guarda
for (let k = 0; k < 2; k++) { t += 900; picar(t); golpes++; }
const rec2 = new Recoleccion([veta]).importar(JSON.parse(JSON.stringify(rec.exportar())));
comprobar('lo que llevan los golpes y lo sacado se guarda', rec2.estado[veta.id] && rec2.estado[veta.id].golpes === golpes && rec2.estado[veta.id].sacadas === 1 && Math.abs(rec2.progresoVeta(veta.id) - 2 / VETA.golpes) < 1e-9, JSON.stringify(rec2.estado[veta.id]));
const totalPasadas = pasadasDe(veta, 0);
let n = 0;
while (n < 400) { t += 900; r = picar(t); n++; if (!r.ok || r.quedan === 0) break; }
comprobar(`da ${totalPasadas} minerales antes de agotarse (todos al mismo montón)`, r.ok && r.quedan === 0 && enSuelo() === totalPasadas && suelo.objetos.length === 1, `${enSuelo()} en ${suelo.objetos.length} montón(es)`);
comprobar('una veta entera son de 150 a 200 golpes', golpes + n === totalPasadas * VETA.golpes && totalPasadas * VETA.golpes >= 150 && totalPasadas * VETA.golpes <= 200, `${golpes + n}`);
t += 900; r = picar(t);
comprobar('agotada, no da más', !r.ok, r.motivo);
comprobar('pero el afloramiento se queda (no se quita: se ve agotado)', rec.enPie(veta.id, t) && !rec.disponible(veta.id, t));
t += 90 * DIA; r = picar(t);
comprobar('en unos meses reales (90 días) vuelve a dar', r.ok, r.motivo);
{
  const i3 = new Inventarios(), j = i3.de('luis'); j.coger('tronco_corto', 1, 'hombro'); j.meterDonde('pico', 1, 'mano:der');
  const r3 = ejecutarRecoleccion(new Recoleccion([veta]), i3, new RegistroAcciones(), { autor: 'luis', tipo: 'romper', punto: veta.id, x: veta.x + 1.5, z: veta.z }, T0, new Suelo());
  comprobar('con algo al hombro, no', !r3.ok, r3.motivo);
}
const ultima = reg.entradas[reg.entradas.length - 1];
comprobar('se anota en el registro con su autor y lo que da', ultima.autor === yo && ultima.ok, JSON.stringify(ultima));

console.log('En el servidor, con el terreno de Whitholm');
const { crearTerreno } = await import('../src/logica/terreno_servidor.js');
const { ObjetosServidor } = await import('../src/logica/objetos_red.js');
const terreno = crearTerreno({ paisaje, semilla: mapa.semilla });
const O = terreno.origen || SALIDA;
const vx = v0.x - O.x, vz = v0.z - O.z, idv = idPunto('veta_hierro', v0.x, v0.z);
const tv = terreno.punto(idv, Math.round(vx * 100) / 100, Math.round(vz * 100) / 100);
comprobar('el servidor conoce la veta por su nombre, en su sitio', !!tv && tv.tipo === 'veta_hierro', JSON.stringify(tv));
comprobar('y una que no existe, no', !terreno.punto(idPunto('veta_hierro', v0.x + 30, v0.z), vx + 30, vz));
const pos = { x: Math.round((vx + 2) * 100) / 100, z: Math.round(vz * 100) / 100 };
let tierraAjena = false;
const obj = new ObjetosServidor({ terreno, posicion: () => pos, puedeTocar: () => tierraAjena ? { ok: false, motivo: 'Es tierra de otro.' } : { ok: true } });
obj.invs.de('eva').meterDonde('pico', 1, 'mano:der');
const golpe = (ahora) => obj.ejecutar({ autor: 'eva', tipo: 'romper', punto: idv, x: pos.x, z: pos.z, px: tv ? tv.x : vx, pz: tv ? tv.z : vz, clase: 'veta_hierro' }, ahora);
let tt = T0, q;
for (let k = 0; k < VETA.golpes; k++) { tt += 900; q = golpe(tt); }
comprobar(`en el servidor, ${VETA.golpes} golpes de pico sueltan 1 mineral a su suelo`, q.ok && q.picar && q.suelo && obj.suelo.objetos.filter(o => o.cosa.tipo === 'mineral_hierro').reduce((s, o) => s + o.cosa.n, 0) === 1, q.motivo || '');
comprobar('lo picado sale en lo que se reparte', !!obj.recoleccionVisible().estado[idv]);
tierraAjena = true; tt += 900; q = golpe(tt);
comprobar('en tierra de otro (sin invitación), no se pica', !q.ok && q.motivo === 'Es tierra de otro.', q.motivo);
const otro = new ObjetosServidor({ terreno, posicion: () => pos }).importar(JSON.parse(JSON.stringify(obj.exportar())));
comprobar('y se guarda: al volver a abrir el servidor sigue lo picado', otro.recoleccion.estado[idv] && otro.recoleccion.estado[idv].sacadas === 1);

console.log(`\n${total - fallos}/${total} bien`);
process.exit(fallos ? 1 : 0);
