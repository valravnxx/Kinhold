// Las liebres en el servidor (partido de servidor/servidor.mjs, 12 nov). Todo lo comparte por S, el estado del servidor.
import { Fauna, FaunaEnRed } from '../../src/logica/fauna.js';
import { MUERTO } from '../../src/logica/muerte.js';

// Las liebres (P4, 9 nov; src/logica/fauna.js): las mueve el servidor, para que todos vean la misma. Cada ticoFauna ms
// avanzan las de los trozos que tiene alguien cerca (huyen de quien se acerca) y a cada uno le llegan las de sus
// trozos: { tipo: 'fauna', liebres: [{ id, x, z, giro, anim }], fuera: [id] } (enteras las que le entran; luego, solo
// las que cambian). Sin terreno (las pruebas sin mundo), solo si la prueba da por dónde andan (fauna: { habitat, pisable }).
export function instalarFauna(S) {
  const { entornoFauna, terreno } = S;
  const fauna = entornoFauna ? new Fauna({ ...entornoFauna, semilla: terreno ? terreno.semilla : 1 }) : null, faunaRed = new FaunaEnRed();
  const antesFauna = new Map();   // autor → { x, z, t }: para ver si viene corriendo
  Object.assign(S, { fauna, faunaRed, antesFauna });
}

// su tic (cada ticoFauna ms), si hay fauna
export function arrancarFauna(S) {
  const { fauna, faunaRed, antesFauna, reloj, clientes, conexionDe, cuentas, terreno, posiciones, vista, enviar, registrar, ticoFauna } = S;
  return fauna ? setInterval(() => {
    try {
      const t = reloj(), jugadores = [], autores = [];
      for (const [ws, a] of clientes) {
        if (conexionDe.get(a) !== ws || cuentas.sinConfirmar(a) || (terreno && !posiciones.has(a))) continue;
        const e = S.presencia.ultimo.get(a); if (!e || e.anim === MUERTO) continue;
        const q = antesFauna.get(a), dt = q ? (t - q.t) / 1000 : 0;
        jugadores.push({ x: e.x, z: e.z, vel: dt > 0 ? Math.hypot(e.x - q.x, e.z - q.z) / dt : 0 });
        antesFauna.set(a, { x: e.x, z: e.z, t }); autores.push(a);
      }
      fauna.avanzar(ticoFauna / 1000, jugadores);
      for (const [a, m] of faunaRed.repartir(fauna, fauna.sacarCambios(), autores, (x) => vista.trozosDe(x))) enviar(conexionDe.get(a), { tipo: 'fauna', ...m });
    } catch (e) { registrar(`error en la fauna: ${e && e.message}`); }
  }, ticoFauna) : null;
}
