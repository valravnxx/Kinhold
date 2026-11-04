// Quitar el mojón (valravnx, 4 nov: «destruir el mojón y con ello dejar tu territorio, que avise que se perderán
// cualquier construcción, para poder reposicionar»). Ejecutar: node pruebas/prueba_quitar_mojon.mjs
// Comprueba, en la lógica pura: lo que se perdería se sabe antes (para el aviso); al quitarlo se pierden las
// construcciones y los muebles de esa tierra y solo esos; la tierra queda libre, los invitados dejan de serlo, y el
// mismo autor (u otro) puede poner un mojón ahí otra vez; con zonas y sin ellas; y rehecho desde el registro da lo mismo.
// Con MUTAR=1 quitar el mojón deja las construcciones: debe FALLAR.
import { Mundo, ponerZonas, RADIO_MOJON } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar, reproducir, acabarObra } from '../src/logica/acciones.js';

const MUTAR = process.env.MUTAR === '1';
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
if (MUTAR) { const q = Mundo.prototype.quitarMojon; Mundo.prototype.quitarMojon = function (a) { const c = this.construcciones; const r = q.call(this, a); this.construcciones = c; return r; }; }
const A = 'jugador:ana', B = 'jugador:bruno';

// Monta un mundo: Ana con mojón en (0,0), un cimiento terminado y una mesa; Bruno con mojón lejos y su cimiento.
function montar(reg) {
  const m = new Mundo();
  const E = (a) => ejecutar(m, reg, a);
  let r = E({ autor: A, tipo: 'rellenar', cantidad: 500 }); if (!r.ok) throw new Error('rellenar: ' + r.motivo);
  r = E({ autor: A, tipo: 'mojon', x: 500, z: 500 }); if (!r.ok) throw new Error('mojón de Ana: ' + r.motivo);
  r = E({ autor: A, tipo: 'colocar', pieza: 'cim_piedra', x: 504, z: 500, k: 0, rot: 0, dir: 0 }); if (!r.ok) throw new Error('cimiento de Ana: ' + r.motivo);
  const cA = m.construcciones.at(-1), kA = [...cA.piezas.keys()][0];
  r = acabarObra(m, reg, A, cA.id, kA); if (!r.ok) throw new Error('obra de Ana: ' + r.motivo);
  r = E({ autor: A, tipo: 'decorar', pieza: 'mesa', x: 502, y: 0, z: 502, rot: 0 }); if (!r.ok) throw new Error('mesa de Ana: ' + r.motivo);
  r = E({ autor: A, tipo: 'invitar', a: B }); if (!r.ok) throw new Error('invitar: ' + r.motivo);
  r = E({ autor: B, tipo: 'mojon', x: 3000, z: 3000 }); if (!r.ok) throw new Error('mojón de Bruno: ' + r.motivo);
  r = E({ autor: B, tipo: 'colocar', pieza: 'cim_piedra', x: 3004, z: 3000, k: 0, rot: 0, dir: 0 }); if (!r.ok) throw new Error('cimiento de Bruno: ' + r.motivo);
  return m;
}

for (const conZonas of [false, true]) {
  // con zonas: la de cada sitio es su cuadrado de 1 km (basta para la prueba); sin ellas, el círculo de RADIO_MOJON
  ponerZonas(conZonas ? (x, z) => `${Math.floor(x / 1000)},${Math.floor(z / 1000)}` : null);
  console.log(conZonas ? 'Con zonas (tu tierra es la zona entera)' : `Sin zonas (el círculo de ${RADIO_MOJON} m)`);
  const reg = new RegistroAcciones();
  const m = montar(reg);
  const E = (a) => ejecutar(m, reg, a);

  const p = m.perderiaSinMojon(A);
  comprobar('antes de quitarlo se sabe lo que se perdería: 1 construcción, 1 pieza, 1 mueble', !!p && p.construcciones.length === 1 && p.piezas === 1 && p.muebles.length === 1, JSON.stringify(p && { c: p.construcciones.length, p: p.piezas, m: p.muebles.length }));
  comprobar('quien no tiene mojón no tiene nada que perder (null)', m.perderiaSinMojon('jugador:nadie') === null);

  let r = E({ autor: 'jugador:nadie', tipo: 'quitar_mojon' });
  comprobar('sin mojón no se puede quitar', !r.ok && r.motivo === 'No tienes mojón.', r.motivo);
  const piedrasAntes = m.materiales.piedra;
  r = E({ autor: A, tipo: 'quitar_mojon', x: 1 });
  comprobar('la acción va con autor y sin datos de más que importen', r.ok, r.motivo);
  comprobar('dice lo perdido: 1 construcción, 1 pieza, 1 mueble', r.ok && r.perdidas.construcciones === 1 && r.perdidas.piezas === 1 && r.perdidas.muebles === 1, JSON.stringify(r.perdidas));
  comprobar('Ana ya no tiene mojón', !m.mojonDe(A));
  comprobar('su cimiento y su mesa ya no están', m.construcciones.every(c => Math.hypot(c.ox - 504, c.oz - 500) > 5) && m.decoracion.length === 0, `${m.construcciones.length} construcciones, ${m.decoracion.length} muebles`);
  comprobar('no se devuelve material (quien quiera el 75 % lo desmonta antes)', m.materiales.piedra === piedrasAntes, `${m.materiales.piedra} piedras (antes ${piedrasAntes})`);
  comprobar('lo de Bruno sigue: su mojón y su cimiento', !!m.mojonDe(B) && m.construcciones.some(c => Math.hypot(c.ox - 3004, c.oz - 3000) < 5), `${m.construcciones.length} construcciones`);
  comprobar('Bruno deja de ser invitado de Ana', !m.esInvitado(B) && !m.invitados[A]);
  comprobar('la tierra queda libre', m.tierraDe(500, 500) === null);
  r = E({ autor: A, tipo: 'quitar_mojon' });
  comprobar('quitarlo dos veces no se puede', !r.ok, r.motivo);
  r = E({ autor: A, tipo: 'mojon', x: 530, z: 500 });
  comprobar('Ana vuelve a poner su mojón (reposiciona), sin espera', r.ok && !!m.mojonDe(A), r.motivo);
  r = E({ autor: A, tipo: 'colocar', pieza: 'cim_piedra', x: 534, z: 500, k: 0, rot: 0, dir: 0 });
  comprobar('y construye en su tierra nueva', r.ok, r.motivo);

  const otra = reproducir(reg.entradas);
  comprobar('rehecho desde el registro da el mismo mundo', JSON.stringify(otra.exportar()) === JSON.stringify(m.exportar()));
}
ponerZonas(null);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
