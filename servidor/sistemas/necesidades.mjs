// Las necesidades en el servidor (partido de servidor/servidor.mjs, 12 nov): hambre, sed, frío y cansancio de cada
// personaje, beber del río, lo que cansa cada cosa y su tic (con el sueño, el combate, la sangre que se pierde con la sed
// o el hambre al máximo y la ropa que se gasta con el uso). Todo lo comparte por S, el estado del servidor.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { nuevas as necesidadesNuevas, validarNecesidades, avanzar as avanzarNecesidades, esfuerzo as esfuerzoNecesidad, redondear as redondearNecesidades, saciar as saciarNecesidad, delCombate, alientoMinimo, hayAguaCerca, TRAGO, ESPERA_TRAGO, frioDelSitio, nocheDe } from '../../src/logica/necesidades.js';
import { puestasDe, abrigo as abrigoDe } from '../../src/logica/prendas.js';
import { horaDe } from '../../src/logica/cielo.js';
import { calorEn } from '../../src/logica/fuego.js';
import { sangrePerdida, motivoNecesidades } from '../../src/logica/muerte.js';
import { RECUPERAR_SANGRE } from '../../src/combate/logica.js';
import { reemplazar } from '../guardado.mjs';

export function instalarNecesidades(S) {
  const { terreno, registrar, archivoNecesidades, sedInicial } = S;
  // Las necesidades (P4; src/logica/necesidades.js): hambre, sed, frío y cansancio de cada personaje (autor → sus
  // cuatro números). Las lleva el servidor: suben con el tiempo mientras está conectado (decisión provisional: sin
  // conectar no cambian, hasta que el personaje se quede dormido en el mundo, en la tarea de desconectarse), con lo que
  // corre y carga (lo que mide el servidor, no lo que diga el navegador) y con lo que hace (sus acciones, con su
  // autor). Cada ticoNecesidades ms se avanzan y a cada uno le llegan las suyas, { tipo: 'necesidades', necesidades };
  // también en la bienvenida. Se guardan en necesidades.json en cada latido y al salir.
  const necesidades = new Map();
  if (existsSync(archivoNecesidades)) {
    try { for (const [a, n] of Object.entries(JSON.parse(readFileSync(archivoNecesidades, 'utf8')))) necesidades.set(a, validarNecesidades(n)); }
    catch (e) { registrar(`necesidades.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  S.necesidadesCambiadas = false;
  const necesidadesDe = (a) => { let n = necesidades.get(a); if (!n) { n = { ...necesidadesNuevas(), sed: sedInicial }; necesidades.set(a, n); } return n; };   // (sedInicial: solo pruebas)
  const guardarNecesidades = () => {
    if (!S.necesidadesCambiadas) return;
    S.necesidadesCambiadas = false;
    writeFileSync(archivoNecesidades + '.tmp', JSON.stringify(Object.fromEntries([...necesidades].map(([a, n]) => [a, redondearNecesidades(n)])))); reemplazar(archivoNecesidades + '.tmp', archivoNecesidades);
  };
  const cansar = (a, tipo) => { necesidades.set(a, esfuerzoNecesidad(necesidadesDe(a), tipo)); S.necesidadesCambiadas = true; };
  // Beber del río con las manos (P4): con agua a tu lado (donde el servidor te tiene), un trago baja la sed; uno cada
  // ESPERA_TRAGO ms. Devuelve { ok, motivo, sed }.
  const ultimoTrago = new Map();
  const beber = (a, ahora) => {
    const p = S.presencia && S.presencia.ultimo.get(a);
    if (!terreno || !p || !hayAguaCerca(terreno.aguaEn, p.x, p.z)) return { ok: false, motivo: 'Aquí no hay agua: busca un río, un lago o el mar.' };
    if (ahora - (ultimoTrago.get(a) || -Infinity) < ESPERA_TRAGO) return { ok: false, motivo: 'Despacio: trago a trago.' };
    ultimoTrago.set(a, ahora);
    const n = saciarNecesidad(necesidadesDe(a), 'sed', TRAGO);
    necesidades.set(a, n); S.necesidadesCambiadas = true;
    return { ok: true, sed: Math.round(n.sed * 100) / 100 };
  };
  // las necesidades de los conectados: el tiempo, lo que corren (la distancia que el servidor les ha visto andar desde
  // el tic anterior) y lo que cargan suelto
  const antesNec = new Map();   // autor → { x, z, t }
  // quién duerme en su cama ligada (P4; src/logica/fabricacion.js, dormir): autor → { x, z, t } de la cama. Se despierta
  // cuando su presencia deja de decir «dormir» (pasado 1,5 s, lo que tarda en llegar), al alejarse de la cama (más de
  // 2,5 m) o al irse; mientras duerme, el cansancio baja deprisa (src/logica/necesidades.js)
  const durmiendo = new Map();
  const alientoAntes = new Map();   // autor → el aliento (cansancio) de su luchador en el tic anterior de las necesidades
  const puestaDe = new Map();   // autor → ms que lleva la ropa puesta en el mundo desde el último uso contado
  // El frío que pide el sitio de cada uno (P4, 8 nov; src/logica/necesidades.js, frioDelSitio): la temperatura de su
  // bioma (la del paisaje, guardada mientras no se aleje 20 m), la noche (la hora del cielo: horaMundo, la real; las
  // pruebas la cambian), lo que lleva puesto, si está bajo techo y el calor de los fuegos encendidos a su lado. Sin
  // terreno (las pruebas sin mundo) no hay clima: no pide frío.
  const tempDe = new Map();   // autor → { x, z, T }
  const frioPedido = (a, e, inv) => {
    if (!terreno || !e) return 0;
    let c = tempDe.get(a);
    if (!c || Math.hypot(c.x - e.x, c.z - e.z) > 20) {
      const xm = e.x + terreno.origen.x, zm = e.z + terreno.origen.z, st = terreno.paisaje.sitio(xm, zm, terreno.alt(xm, zm));
      c = { x: e.x, z: e.z, T: st && Number.isFinite(st.T) ? st.T : 10 }; tempDe.set(a, c);
    }
    const ahora = Date.now(), cerca = Object.values(S.objetos.fab.estaciones).filter(s => s.fuego && Math.abs(s.x - e.x) < 5 && Math.abs(s.z - e.z) < 5);
    return frioDelSitio({ T: c.T, noche: nocheDe(horaDe(S.horaMundo()).hora), abrigo: abrigoDe(puestasDe(inv.lugares)), techo: S.mundo.bajoTecho(e.x, e.z), calor: calorEn(cerca, e.x, e.z, ahora) });
  };
  Object.assign(S, { necesidades, necesidadesDe, guardarNecesidades, cansar, ultimoTrago, beber, antesNec, durmiendo, alientoAntes, puestaDe, tempDe, frioPedido });
}

// el tic de las necesidades (cada ticoNecesidades ms)
export function arrancarNecesidades(S) {
  const { clientes, conexionDe, reloj, necesidades, necesidadesDe, antesNec, durmiendo, alientoAntes, puestaDe, frioPedido, terreno, posiciones, tiemposMuerte, usoRopa, enviar } = S;
  return setInterval(() => {
    const { presencia, objetos, combate, cuentas } = S;
    const t = reloj();
    for (const [ws, a] of clientes) {
      if (conexionDe.get(a) !== ws) continue;
      const e = presencia.ultimo.get(a), p = antesNec.get(a);
      const dt = p ? (t - p.t) / 1000 : 0;
      const velocidad = e && p && dt > 0 ? Math.hypot(e.x - p.x, e.z - p.z) / dt : 0;
      if (e) antesNec.set(a, { x: e.x, z: e.z, t }); else antesNec.set(a, { x: 0, z: 0, t });
      if (!(dt > 0)) continue;
      const inv = objetos.invs.de(a), d = durmiendo.get(a);
      if (d && (!e || Math.hypot(e.x - d.x, e.z - d.z) > 2.5 || (t - d.t > 1500 && e.anim !== 'dormir'))) durmiendo.delete(a);
      // sentado a descansar (8 nov): lo dice su presencia (anim «sentado») y no se mueve; descansa más deprisa que de pie
      const sentado = !!e && e.anim === 'sentado' && velocidad < 0.3;
      let n = avanzarNecesidades(necesidadesDe(a), Math.min(dt, 10), { velocidad, kilos: inv.kilosSueltos(), frioObjetivo: frioPedido(a, e, inv), durmiendo: durmiendo.has(a), sentado });
      // el combate (8 nov; src/logica/necesidades.js, delCombate y alientoMinimo): lo que ha subido el aliento de su
      // luchador desde el tic anterior cansa, y el aliento no baja de lo que pide este cansancio
      const L = combate.luchadores[a];
      if (L) {
        const antes = alientoAntes.get(a);
        if (Number.isFinite(antes) && L.cansancio > antes) n = delCombate(n, L.cansancio - antes);
        const min = alientoMinimo(n);
        L.alientoMinimo = min;   // al recuperarse en el combate, no baja de aquí (src/combate/logica.js)
        if (L.cansancio < min) L.cansancio = min;
        alientoAntes.set(a, L.cansancio);
        // con la sed o el hambre al máximo (P4; src/logica/muerte.js): pierde sangre y no la recupera; sin sangre, muere
        // (solo quien ya está en el mundo: con su presencia y, con el terreno, su salida elegida)
        const pierde = e && (!terreno || posiciones.has(a)) && !cuentas.sinConfirmar(a) ? sangrePerdida(n, tiemposMuerte) : 0;
        if (pierde > 0 && !L.fuera) {
          const sangra = L.heridas.reduce((s, h) => s + h.sangrado, 0) > 0.05;   // (si nada sangra, su luchador la recuperaría)
          L.sangre -= (pierde + (sangra ? 0 : RECUPERAR_SANGRE)) * Math.min(dt, 10);
          if (L.sangre <= 0) { L.sangre = 0; L.caer(motivoNecesidades(n)); }
        }
      }
      // la ropa puesta se gasta con el uso (10 nov): un uso cada usoRopa ms en el mundo (USO_ROPA_MS; las pruebas, menos) (solo quien ya está en él)
      if (e && (!terreno || posiciones.has(a))) {
        const p = (puestaDe.get(a) || 0) + Math.min(dt, 10) * 1000;
        if (p >= usoRopa) { puestaDe.set(a, p - usoRopa); S.gastarRopaDe(a, 1); } else puestaDe.set(a, p);
      }
      necesidades.set(a, n);
      S.necesidadesCambiadas = true;
      enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidades.get(a)) });
    }
    S.ponerAlDia();   // (quien se ha quedado sin sangre, muere ya)
    S.revisarCuerpos();
  }, S.ticoNecesidades);
}
