// El ciclo de día y noche (src/logica/cielo.js; valravnx, 7 nov). Ejecutar: node pruebas/prueba_cielo.mjs
// Comprueba, con la hora real cada 2 s durante dos días del mundo: el día dura 2 h y la noche 1 h (GDD); el sol sale
// por el este a las 6, a mediodía está al sur a 48° y se pone por el oeste a las 18; la hora del mundo y la real van y
// vuelven; nada salta de un momento al siguiente (los colores, la luz y su dirección; al pasar de la luz del sol a la de
// la luna, las dos casi apagadas); la luna llena está alta a medianoche y la nueva junto al sol, una vuelta cada 8 días
// del mundo; las estrellas solo de noche; la sombra nunca rasante; de noche, oscuro pero se ve (más luz que nada y
// menos que de día); a mediodía, la luz «mañana» del estilo v5; y la misma hora del servidor da el mismo cielo.
// Con el servidor de verdad: su bienvenida lleva su reloj (la hora del cielo), para que todos vean el mismo.
// MUTAR=1: el día y la noche duran lo mismo; MUTAR=2: la luz del sol se apaga de golpe al ponerse; MUTAR=3: la
// bienvenida sin el reloj. Las tres deben FALLAR.
import { cieloDe, horaDe, msDeHora, faseLuna, momentoDe, CICLO_MS, ORIGEN_MS, LUNA_DIAS, MOMENTOS, horaTexto } from '../src/logica/cielo.js';
import { LUCES } from '../src/mundo/estilos.js';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

if (process.env.MUTAR) globalThis.__mutarCielo = Number(process.env.MUTAR);
let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const grados = (r) => r * 180 / Math.PI;
const canales = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const salto = (a, b) => Math.max(...canales(a).map((v, i) => Math.abs(v - canales(b)[i])));

console.log('La hora del mundo');
const T0 = ORIGEN_MS + 5 * CICLO_MS + 1234;   // un día cualquiera
let arriba = 0, n = 0;
const muestras = [];
for (let t = T0; t < T0 + 2 * CICLO_MS; t += 2000) { const c = cieloDe(t); muestras.push(c); n++; if (c.altoSol > 0) arriba++; }
comprobar('el día dura 2 h y la noche 1 h (el sol, arriba 2/3 del tiempo)', Math.abs(arriba / n - 2 / 3) < 0.005, `${(100 * arriba / n).toFixed(1)} %`);
const a6 = cieloDe(0, { hora: 6, dias: 0 }), a12 = cieloDe(0, { hora: 12, dias: 0 }), a18 = cieloDe(0, { hora: 18, dias: 0 });
comprobar('a las 6 el sol sale por el este', a6.sol[0] > 0.999 && Math.abs(a6.altoSol) < 0.01, a6.sol.map(v => v.toFixed(3)).join(' '));
comprobar('a mediodía está al sur (z+) a 48°', a12.sol[2] > 0.6 && Math.abs(a12.sol[0]) < 1e-9 && Math.abs(a12.altoSol - 48) < 0.01, `${a12.altoSol.toFixed(2)}°`);
comprobar('a las 18 se pone por el oeste', a18.sol[0] < -0.999 && Math.abs(a18.altoSol) < 0.01);
let ida = true;
for (const h of [0, 3.5, 6, 9.25, 12, 17.99, 18, 21, 23.9]) {
  const m = msDeHora(h, T0), v = horaDe(m).hora;
  if (Math.abs(v - h) > 1e-6 || m < T0 || m >= T0 + CICLO_MS) ida = false;
}
comprobar('de la hora del mundo a la real y de vuelta (la próxima vez que es esa hora)', ida);
comprobar('la hora como texto', horaTexto(13.5) === '13:30' && horaTexto(6) === '06:00' && horaTexto(24.25) === '00:15');

console.log('Sin saltos');
let peorColor = 0, peorI = 0, peorDir = 0, enCambio = 1, cambios = 0;
for (let i = 1; i < muestras.length; i++) {
  const a = muestras[i - 1], b = muestras[i];
  peorColor = Math.max(peorColor, salto(a.arriba, b.arriba), salto(a.horizonte, b.horizonte), salto(a.hemi.arriba, b.hemi.arriba));
  peorI = Math.max(peorI, Math.abs(a.luz.intensidad - b.luz.intensidad), Math.abs(a.hemi.intensidad - b.hemi.intensidad));
  const d = grados(Math.acos(Math.min(1, a.luz.direccion.reduce((s, v, k) => s + v * b.luz.direccion[k], 0))));
  if (a.luz.deLuna !== b.luz.deLuna) { cambios++; enCambio = Math.min(enCambio, 1 - Math.max(a.luz.intensidad, b.luz.intensidad)); }
  else peorDir = Math.max(peorDir, d);
}
comprobar('los colores del cielo y de la luz cambian poco a poco (cada 2 s, como mucho 3 de 255)', peorColor <= 3, `${peorColor}`);
comprobar('la fuerza de las luces, poco a poco (cada 2 s, menos de 0,03)', peorI < 0.03, peorI.toFixed(3));
comprobar('la luz gira poco a poco (cada 2 s, menos de 0,15°)', peorDir < 0.15, `${peorDir.toFixed(3)}°`);
comprobar('del sol a la luna y de vuelta, con las dos casi apagadas (cada día, dos veces)', cambios === 4 && enCambio > 0.95, `${cambios} cambios; la más fuerte, ${(1 - enCambio).toFixed(3)}`);
comprobar('la sombra nunca rasante (la luz, a 8° o más)', muestras.every(c => c.luz.direccion[1] >= Math.sin(8 * Math.PI / 180) - 1e-9));

console.log('La luna y las estrellas');
const llena = cieloDe(0, { hora: 0, dias: 0, fase: 0.5 }), nueva = cieloDe(0, { hora: 12, dias: 0, fase: 0 });
comprobar('la luna llena está alta a medianoche, al sur', llena.altoLuna > 45 && llena.luna[2] > 0.6, `${llena.altoLuna.toFixed(1)}°`);
comprobar('la luna nueva va junto al sol', nueva.luna.every((v, k) => Math.abs(v - nueva.sol[k]) < 1e-9));
const f0 = faseLuna(6, 0).fase, f8 = faseLuna(6, LUNA_DIAS).fase, f4 = faseLuna(6, LUNA_DIAS / 2);
comprobar(`una vuelta de fases cada ${LUNA_DIAS} días del mundo`, Math.abs(f0) < 1e-9 && Math.abs(f8) < 1e-9 && Math.abs(f4.fase - 0.5) < 1e-9 && Math.abs(f4.luz - 1) < 1e-9);
comprobar('la fase avanza seguida al pasar la medianoche', Math.abs(faseLuna(23.999, 0).fase - faseLuna(0, 1).fase) < 1e-4);
comprobar('las estrellas, solo de noche', muestras.every(c => c.altoSol > -3 ? c.estrellas === 0 : true) && llena.estrellas === 1);

console.log('La luz de cada momento');
const noche = (f) => cieloDe(0, { hora: 0, dias: 0, fase: f });
// lo que alumbra un suelo llano: la luz del cielo y la del sol o la luna, cada una por lo clara que es su color (luz lineal)
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const claro = (c) => { const [r, g, b] = canales(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const luzTotal = (c) => c.hemi.intensidad * claro(c.hemi.arriba) + c.luz.intensidad * claro(c.luz.color) * Math.max(0, c.luz.direccion[1]);
const dia = luzTotal(a12), oscura = luzTotal(noche(0)), conLuna = luzTotal(noche(0.5));
comprobar('de noche, oscuro pero jugable: la luz del cielo nunca se apaga', noche(0).hemi.intensidad >= 1.5, noche(0).hemi.intensidad.toFixed(2));
comprobar('de noche, menos luz que de día (con luna nueva, menos de un tercio; con llena, menos de la mitad)', oscura < dia / 3 && conLuna < dia / 2, `${oscura.toFixed(2)} y ${conLuna.toFixed(2)} contra ${dia.toFixed(2)}`);
comprobar('la luna llena alumbra más que la nueva y su luz es la que hace sombra', conLuna > oscura * 1.3 && noche(0.5).luz.deLuna && noche(0).luz.intensidad === 0);
const v5 = LUCES.manana, m40 = momentoDe(48);
comprobar('a mediodía, la luz «mañana» del estilo v5', m40.arriba === v5.fondo[1] && m40.horizonte === v5.fondo[0] && m40.sol[0] === v5.sol[0] && m40.sol[1] === v5.sol[1] && m40.hemi[2] === v5.hemi[2]);
comprobar('los momentos van de la noche al día, en orden', MOMENTOS.every((m, i) => i === 0 || m.alto > MOMENTOS[i - 1].alto));
comprobar('la misma hora del servidor, el mismo cielo', JSON.stringify(cieloDe(T0 + 777)) === JSON.stringify(cieloDe(T0 + 777)));

console.log('El reloj del servidor');
{
  const { crearServidor } = await import('../servidor/servidor.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'kinhold-cielo-'));
  const srv = crearServidor({ puerto: 0, archivo: join(dir, 'mundo.jsonl'), altas: { origen: 1e6, total: 1e6, espera: 0 }, limiteMovimiento: false });
  try {
    const puerto = await srv.listo;
    const b = await new Promise((listo, fallo) => {
      const ws = new WebSocket(`ws://127.0.0.1:${puerto}`);
      ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') { ws.close(); listo(m); } });
      ws.on('error', fallo);
    });
    const ahora = process.env.MUTAR === '3' ? undefined : b.ahora;
    comprobar('la bienvenida lleva el reloj del servidor (la hora del cielo)', Number.isFinite(ahora) && Math.abs(ahora - Date.now()) < 5000, String(ahora));
  } finally { await srv.cerrar(); rmSync(dir, { recursive: true, force: true }); }
}

console.log(`\n${ok} correctas, ${mal} fallan`);
process.exit(mal ? 1 : 0);
