// Pruebas del aguante y el nado (src/logica/nado.js) y del peso de lo que llevas (Inventario.kilos), en node.
// Uso: node pruebas/prueba_nado.mjs     MUTAR=1 → el peso no cuenta al nadar: tiene que fallar.
import * as N from '../src/logica/nado.js';
import { Inventario } from '../src/logica/inventario.js';

const MUTAR = !!process.env.MUTAR;
let bien = 0, mal = 0;
const comprobar = (n, c, d = '') => { console.log((c ? '  OK   ' : '  FALLA ') + n + (d ? ` — ${d}` : '')); c ? bien++ : mal++; };
const factor = MUTAR ? () => 1 : N.factorPeso;

// segundos nadando (moviéndose) hasta quedarse sin aguante y hasta ahogarse, con `kg` encima
function nadar(kg) {
  let e = N.nuevoAguante(), t = 0, vacio = null; const dt = 0.05;
  while (!e.muerto && t < 600) {
    e = N.pasoAguante(e, dt, { modo: 'nadar', moviendo: true, kg: MUTAR ? 0 : kg }); t += dt;
    if (vacio === null && e.aguante <= 0) vacio = t;
  }
  return { vacio, muerte: e.muerto ? t : null };
}

// lo que pesa lo puesto y lo que se lleva
const inv = (cosas) => { const i = new Inventario(); for (const [tipo, ruta] of cosas) { const r = i.coger(tipo, 1, ruta); if (r && r.error) throw new Error(tipo + ': ' + r.error); } return i; };
const lino = inv([['camisa_lino', 'ropa:interior'], ['pantalon_lino', 'ropa:piernas']]);
const armado = inv([['camisa_lino', 'ropa:interior'], ['pantalon_lino', 'ropa:piernas'], ['gambeson', 'ropa:abrigo'], ['cota_malla', 'ropa:exterior']]);
const conTronco = inv([['camisa_lino', 'ropa:interior'], ['pantalon_lino', 'ropa:piernas'], ['tronco_delgado', 'mano:der']]);
comprobar('lo que pesa lo puesto: camisa y pantalón de lino, 0,6 kg', lino.kilos() === 0.6, `${lino.kilos()} kg`);
comprobar('con gambesón y cota de malla, unos 14 kg', Math.abs(armado.kilos() - 14.1) < 0.01, `${armado.kilos()} kg`);
comprobar('cargando un tronco delgado, 15 kg más', Math.abs(conTronco.kilos() - 15.6) < 0.01, `${conTronco.kilos()} kg`);

const l = nadar(lino.kilos()), a = nadar(armado.kilos()), tr = nadar(conTronco.kilos());
comprobar('ligero de ropa, se nada más de un minuto antes de quedarse sin aguante', l.vacio > 60 && l.vacio < 100, `${l.vacio?.toFixed(1)} s`);
comprobar('sin aguante, en unos segundos te ahogas y mueres', l.muerte !== null && l.muerte - l.vacio > 5 && l.muerte - l.vacio < 12, `${(l.muerte - l.vacio).toFixed(1)} s después`);
comprobar('con gambesón y cota de malla, el aguante se acaba enseguida (menos de 15 s)', a.vacio < 15, `${a.vacio?.toFixed(1)} s`);
comprobar('cargando un tronco, aún antes (menos de 12 s)', tr.vacio < 12, `${tr.vacio?.toFixed(1)} s`);
comprobar('cuanto más peso, menos se aguanta', l.vacio > a.vacio && a.vacio > tr.vacio);

// en tierra: correr gasta, andar recupera, sin aguante no se corre
let e = N.nuevoAguante(), t = 0;
while (N.puedeCorrer(e) && t < 300) { e = N.pasoAguante(e, 0.1, { modo: 'tierra', moviendo: true, rapido: true }); t += 0.1; }
comprobar('corriendo con el aguante lleno, unos 40 s', t > 35 && t < 45, `${t.toFixed(1)} s`);
comprobar('sin aguante no se corre', !N.puedeCorrer(e));
for (let k = 0; k < 100; k++) e = N.pasoAguante(e, 0.1, { modo: 'tierra', moviendo: true });
comprobar('andando se recupera (10 s, la mitad)', Math.abs(e.aguante - 0.5) < 0.02, e.aguante.toFixed(2));
comprobar('en tierra nadie se ahoga', !e.muerto && e.ahogo === 0);
// saliendo del agua a tiempo, el ahogo se pasa
let s = { aguante: 0, ahogo: 0.6, muerto: false };
for (let k = 0; k < 20; k++) s = N.pasoAguante(s, 0.1, { modo: 'vadear', moviendo: true });
comprobar('si llegas a donde haces pie, el ahogo se pasa', s.ahogo < 0.6 && !s.muerto, s.ahogo.toFixed(2));

// lo hondo del agua
comprobar('en seco o con el agua por el tobillo, a pie', N.modoAgua(null) === 'tierra' && N.modoAgua(0.2) === 'tierra');
comprobar('por la cintura, vadeando; por el pecho o más, nadando', N.modoAgua(0.7) === 'vadear' && N.modoAgua(1.3) === 'nadar' && N.modoAgua(3) === 'nadar');
comprobar('vadear frena más cuanto más hondo', N.factorVadeo(0.4) > N.factorVadeo(0.8) && N.factorVadeo(0.8) > N.factorVadeo(1.2) && N.factorVadeo(1.2) >= 0.5);
comprobar('el peso hace que el aguante baje más deprisa al nadar (factor)', factor(14) > 4 * factor(0));

console.log(`\nResultado: ${bien} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
