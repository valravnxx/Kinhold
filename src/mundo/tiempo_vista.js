// Kinhold — el tiempo del mundo, a la vista (P11b, «La lluvia y el riego»). Lo que hace en cada sitio y a cada hora lo
// dice la lógica (src/logica/tiempo.js, igual para todos y por la hora del servidor); aquí se lleva a la escena:
//   - el cielo gris y la luz más apagada al nublarse (src/mundo/cielo.js, nublar);
//   - la lluvia: gotas alrededor de la cámara (src/mundo/lluvia.js), menos en el móvil;
//   - sin saltos: lo que se ve va hacia lo que toca poco a poco (las nubes en unos SUAVE_NUBES s, la lluvia en
//     SUAVE_LLUVIA s), así que el cielo se cierra antes de llover (la lógica lo pone nublado antes) y la lluvia empieza
//     y para de a poco;
//   - bajo techo, sin gotas (el tejado se quita para ver dentro);
//   - la lluvia se oye (src/juego/sonidos.js, sonarLluvia): más fuerte cuanto más llueve, y bajo techo más bajo y apagado;
//   - y moja: el suelo y las piezas, más oscuros mientras llueve y un rato después (src/logica/mojado.js, igual para
//     todos; lo pinta la niebla del posprocesado, src/posprocesado/niebla.js); bajo techo, lo de dentro, menos.
//   - la niebla de algunas mañanas (la lógica dice cuánta: espesa al amanecer, se levanta a media mañana): la pinta la
//     niebla del posprocesado (src/mundo/cielo.js, nieblar, y src/posprocesado/niebla.js) desde NIEBLA_PC.cerca (lo de
//     cerca, el jugador y lo que tiene a mano, se ve) hasta NIEBLA_PC.lejos (de ahí en adelante, casi blanco); en el
//     móvil, algo menos espesa (NIEBLA_MOVIL: la pantalla es pequeña y no puede taparse el juego); el sol se apaga.
// Para las pruebas y las capturas: ?tiempo=despejado|nublado|lluvia|niebla lo deja quieto (y llega enseguida); las
// pruebas automáticas (navigator.webdriver) sin ?tiempo lo ven despejado, quieto (ninguna otra prueba depende del
// tiempo que haga).
import { tiempoEn } from '../logica/tiempo.js';
import { crearLluvia } from './lluvia.js';
import { mojado as mojadoEn, pasoMojado } from '../logica/mojado.js';
import { sonarLluvia, lluviaOida } from '../juego/sonidos.js';

export const MOJADO_DENTRO = 0.35;   // bajo techo, lo mojado que se ve (lo de dentro está seco; por la puerta se ve fuera)

export const SUAVE_NUBES = 25;    // s: lo que tarda en ir casi entero (63 %) hacia el cielo que toca
export const SUAVE_LLUVIA = 8;    // s: lo mismo, la lluvia
export const SUAVE_NIEBLA = 20;   // s: lo mismo, la niebla (la de la lógica ya se forma y se levanta despacio)
export const FIJOS = {
  despejado: { nubes: 0, lluvia: 0, niebla: 0 }, nublado: { nubes: 1, lluvia: 0, niebla: 0 },
  lluvia: { nubes: 1, lluvia: 1, niebla: 0 }, niebla: { nubes: 0, lluvia: 0, niebla: 1 },
};
// hasta dónde se ve con la niebla espesa (m, por el rayo desde la cámara; provisional): nada en «cerca», «max» en «lejos»
export const NIEBLA_PC = { cerca: 9, lejos: 60, max: 0.95 };
export const NIEBLA_MOVIL = { cerca: 12, lejos: 75, max: 0.88 };

// cielo: el de src/mundo/cielo.js; reloj(): la hora del servidor (ms); donde(): { x, z } del jugador
export function crearTiempoVista({ escena, camara, cielo, reloj, donde, movil = false }) {
  const q = new URLSearchParams(location.search).get('tiempo');
  let fijo = FIJOS[q] ? q : (navigator.webdriver ? 'despejado' : null);
  const lluvia = crearLluvia(escena, movil ? { cuantas: 2400, caja: [22, 16, 22] } : { cuantas: 4500 });
  const ahora = { nubes: 0, lluvia: 0, niebla: 0 };
  const alcance = movil ? NIEBLA_MOVIL : NIEBLA_PC;
  let objetivo = { nubes: 0, lluvia: 0, niebla: 0, tiempo: 'despejado' };
  let primero = true;
  let mojado = 0;   // lo mojado que está el suelo donde estás (0–1)

  let fuera = 1;   // 1 al raso, 0 bajo techo (sin gotas dentro de casa: el tejado se quita para ver dentro)
  // techo: si el jugador está bajo techo
  function paso(dt = 1 / 60, techo = false) {
    if (fijo) objetivo = { ...FIJOS[fijo], tiempo: fijo };
    else { const p = donde(); objetivo = tiempoEn(p.x, p.z, reloj()); }
    // lo mojado: el del mundo (sale de la hora); con el tiempo fijo, de a poco desde lo que había
    const pm = donde();
    if (fijo) mojado = primero ? FIJOS[fijo].lluvia : pasoMojado(mojado, FIJOS[fijo].lluvia > 0, dt * 1000);
    else mojado = mojadoEn(pm.x, pm.z, reloj());
    if (primero) { ahora.nubes = objetivo.nubes; ahora.lluvia = objetivo.lluvia; ahora.niebla = objetivo.niebla; primero = false; }   // al entrar, ya como está
    else {
      ahora.nubes += (objetivo.nubes - ahora.nubes) * (1 - Math.exp(-dt / SUAVE_NUBES));
      ahora.lluvia += (objetivo.lluvia - ahora.lluvia) * (1 - Math.exp(-dt / SUAVE_LLUVIA));
      ahora.niebla += (objetivo.niebla - ahora.niebla) * (1 - Math.exp(-dt / SUAVE_NIEBLA));
    }
    // (la lluvia, solo con el cielo ya cerrado: no llueve con el cielo azul aunque se cruce el paso)
    fuera += ((techo ? 0 : 1) - fuera) * (1 - Math.exp(-dt / 0.4));
    const cae = Math.min(ahora.lluvia, ahora.nubes), llueve = cae * fuera;
    cielo.nublar(ahora.nubes);
    cielo.nieblar(ahora.niebla < 0.001 ? 0 : ahora.niebla, alcance);
    cielo.mojar(mojado * (MOJADO_DENTRO + (1 - MOJADO_DENTRO) * fuera));
    sonarLluvia(cae, fuera);
    const c = cielo.actual, luz = c ? Math.min(1, Math.max(0.08, c.hemi.intensidad / 1.6)) : 1;
    const p = donde();
    lluvia.paso(camara, llueve, luz, dt, Number.isFinite(p.y) ? p.y : -1e4);
  }

  return {
    paso, lluvia,
    get ahora() { return { ...ahora, tiempo: objetivo.tiempo, mojado }; },
    get fijo() { return fijo; },
    get oido() { return { ...lluviaOida }; },   // lo que suena de la lluvia (las pruebas)
    get alcanceNiebla() { return { ...alcance }; },
    // para las pruebas y el admin: 'despejado', 'nublado', 'lluvia' o 'niebla' quieto (llega enseguida; con suave, poco a poco,
    // como en el juego), o null (el del mundo)
    poner(t, suave = false) { fijo = FIJOS[t] ? t : null; if (!suave) primero = true; paso(0); return this.ahora; },
  };
}
