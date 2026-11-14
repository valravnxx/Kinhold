// Kinhold — el tiempo del mundo, a la vista (P11b, «La lluvia y el riego»). Lo que hace en cada sitio y a cada hora lo
// dice la lógica (src/logica/tiempo.js, igual para todos y por la hora del servidor); aquí se lleva a la escena:
//   - el cielo gris y la luz más apagada al nublarse (src/mundo/cielo.js, nublar);
//   - la lluvia: gotas alrededor de la cámara (src/mundo/lluvia.js), menos en el móvil;
//   - sin saltos: lo que se ve va hacia lo que toca poco a poco (las nubes en unos SUAVE_NUBES s, la lluvia en
//     SUAVE_LLUVIA s), así que el cielo se cierra antes de llover (la lógica lo pone nublado antes) y la lluvia empieza
//     y para de a poco;
//   - bajo techo, sin gotas (el tejado se quita para ver dentro; que suene más bajo es la tarea siguiente).
// Para las pruebas y las capturas: ?tiempo=despejado|nublado|lluvia lo deja quieto (y llega enseguida); las pruebas
// automáticas (navigator.webdriver) sin ?tiempo lo ven despejado, quieto (ninguna otra prueba depende del tiempo que
// haga). La niebla se ve en su tarea (aquí, aún no).
import { tiempoEn } from '../logica/tiempo.js';
import { crearLluvia } from './lluvia.js';

export const SUAVE_NUBES = 25;    // s: lo que tarda en ir casi entero (63 %) hacia el cielo que toca
export const SUAVE_LLUVIA = 8;    // s: lo mismo, la lluvia
export const FIJOS = { despejado: { nubes: 0, lluvia: 0 }, nublado: { nubes: 1, lluvia: 0 }, lluvia: { nubes: 1, lluvia: 1 } };

// cielo: el de src/mundo/cielo.js; reloj(): la hora del servidor (ms); donde(): { x, z } del jugador
export function crearTiempoVista({ escena, camara, cielo, reloj, donde, movil = false }) {
  const q = new URLSearchParams(location.search).get('tiempo');
  let fijo = FIJOS[q] ? q : (navigator.webdriver ? 'despejado' : null);
  const lluvia = crearLluvia(escena, movil ? { cuantas: 2400, caja: [22, 16, 22] } : { cuantas: 4500 });
  const ahora = { nubes: 0, lluvia: 0 };
  let objetivo = { nubes: 0, lluvia: 0, tiempo: 'despejado' };
  let primero = true;

  let fuera = 1;   // 1 al raso, 0 bajo techo (sin gotas dentro de casa: el tejado se quita para ver dentro)
  // techo: si el jugador está bajo techo
  function paso(dt = 1 / 60, techo = false) {
    if (fijo) objetivo = { ...FIJOS[fijo], tiempo: fijo };
    else { const p = donde(); objetivo = tiempoEn(p.x, p.z, reloj()); }
    if (primero) { ahora.nubes = objetivo.nubes; ahora.lluvia = objetivo.lluvia; primero = false; }   // al entrar, ya como está
    else {
      ahora.nubes += (objetivo.nubes - ahora.nubes) * (1 - Math.exp(-dt / SUAVE_NUBES));
      ahora.lluvia += (objetivo.lluvia - ahora.lluvia) * (1 - Math.exp(-dt / SUAVE_LLUVIA));
    }
    // (la lluvia, solo con el cielo ya cerrado: no llueve con el cielo azul aunque se cruce el paso)
    fuera += ((techo ? 0 : 1) - fuera) * (1 - Math.exp(-dt / 0.4));
    const llueve = Math.min(ahora.lluvia, ahora.nubes) * fuera;
    cielo.nublar(ahora.nubes);
    const c = cielo.actual, luz = c ? Math.min(1, Math.max(0.08, c.hemi.intensidad / 1.6)) : 1;
    const p = donde();
    lluvia.paso(camara, llueve, luz, dt, Number.isFinite(p.y) ? p.y : -1e4);
  }

  return {
    paso, lluvia,
    get ahora() { return { ...ahora, tiempo: objetivo.tiempo }; },
    get fijo() { return fijo; },
    // para las pruebas y el admin: 'despejado', 'nublado' o 'lluvia' quieto (llega enseguida; con suave, poco a poco,
    // como en el juego), o null (el del mundo)
    poner(t, suave = false) { fijo = FIJOS[t] ? t : null; if (!suave) primero = true; paso(0); return this.ahora; },
  };
}
