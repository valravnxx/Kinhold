// Kinhold — las necesidades del personaje (P4, «Un primer día con sentido»): hambre, sed, frío y cansancio. Lógica pura
// (sin three.js): la lleva el servidor (servidor/servidor.mjs), con su autor, y el navegador solo las enseña.
//
// GDD, apartado 6: «Necesidades: hambre, sed, frío, calor y cansancio, con avisos en círculos a la derecha». Documento
// de sistemas, apartado 10 (un día de juego son 3 horas reales):
//   hambre: hay que comer 2–3 veces por día de juego; al máximo, cansancio acelerado y luego heridas lentas.
//   sed: más rápida que el hambre; lo mismo, más rápido.
//   frío: según bioma, estación, noche, lluvia y ropa; al máximo, movimiento torpe, cansancio y heridas lentas.
//   cansancio: sube al trabajar, correr, cargar y combatir; al máximo, no puedes correr ni golpear fuerte; se
//   recupera descansando sentado y durmiendo del todo.
// Cada una va de 0 (nada) a 100 (al máximo).
//
// Decisiones provisionales (registro de la demo y diario; los números, para ajustar probando):
//   - el hambre llega al máximo en 90 minutos reales sin comer (medio día de juego: dos comidas por día como poco) y la
//     sed en 60;
//   - el frío va hacia lo que pide el sitio (frioObjetivo: 0 de día, más de noche, según la ropa y el fuego) y tarda
//     unos 10 minutos en llegar; quién lo pide lo trae la tarea del frío (hasta entonces, el servidor pide 0);
//   - el cansancio: correr (más de 4 m/s) 0,5 por segundo, con carga suelta en las manos o al hombro más; cada golpe de
//     hacha 1,5, cada rato de obra 2, fabricar 0,5, recoger 0,3, desbrozar 2 (los golpes de una vez), cada golpe de mazo a una roca 1,5; quieto baja 0,4 por segundo y andando 0,1;
//   - al máximo, las heridas se curan despacio (efectos.curacionLenta); y se muere de sed y de hambre (valravnx, 7 nov:
//     «no es survival si no hay que sobrevivir»; GDD, apartado 6): eso llega con la tarea de morir de P4;
//   - el calor (también en el GDD) queda para después del hito, como los cinco estados de más.

export const NECESIDADES = ['hambre', 'sed', 'frio', 'cansancio'];
export const AVISO = 40;      // desde aquí sale su círculo
export const FUERTE = 75;     // desde aquí, el círculo en fuerte
export const MAXIMO = 100;

export const RITMOS = {
  hambre: MAXIMO / (90 * 60),   // por segundo
  sed: MAXIMO / (60 * 60),
  frio: 1 / 150,                // fracción de lo que falta hasta su objetivo, por segundo (unos 10 min en llegar)
  correr: 0.5, velocidadCorrer: 4,
  carga: 0.03,                  // por segundo y kg sueltos, moviéndose
  quieto: 0.4, andando: 0.1,
};
export const ESFUERZOS = { talar: 1.5, trocear: 1.5, trabajar: 2, fabricar: 0.5, recoger: 0.3, desbrozar: 2, romper: 1.5 };

const recorta = (v) => Math.min(MAXIMO, Math.max(0, v));
export const nuevas = () => ({ hambre: 0, sed: 0, frio: 0, cansancio: 0 });

// lo que llega de fuera (lo guardado): solo los cuatro números, dentro de 0–100
export function validarNecesidades(o) {
  if (!o || typeof o !== 'object') return nuevas();
  const n = nuevas();
  for (const k of NECESIDADES) if (Number.isFinite(o[k])) n[k] = recorta(o[k]);
  return n;
}

const alMaximo = (n) => n.hambre >= MAXIMO || n.sed >= MAXIMO || n.frio >= MAXIMO;

// dt segundos con lo que está haciendo: velocidad (m/s, medida por el servidor), kilos (sueltos en las manos o al
// hombro) y frioObjetivo (0–100). Devuelve las necesidades nuevas (no toca las de entrada).
export function avanzar(n, dt, { velocidad = 0, kilos = 0, frioObjetivo = 0 } = {}) {
  if (!(dt > 0)) return { ...n };
  const m = { ...n };
  m.hambre = recorta(n.hambre + RITMOS.hambre * dt);
  m.sed = recorta(n.sed + RITMOS.sed * dt);
  const obj = recorta(frioObjetivo);
  m.frio = recorta(n.frio + (obj - n.frio) * Math.min(1, RITMOS.frio * dt));
  // al máximo de hambre, sed o frío: el cansancio sube el doble y baja la mitad
  const k = alMaximo(n) ? 2 : 1;
  let c = 0;
  if (velocidad > RITMOS.velocidadCorrer) c += RITMOS.correr * k;
  if (velocidad > 0.3 && kilos > 0) c += RITMOS.carga * kilos * k;
  if (c === 0) c = -(velocidad > 0.3 ? RITMOS.andando : RITMOS.quieto) / k;
  m.cansancio = recorta(n.cansancio + c * dt);
  return m;
}

// lo que cansa una acción hecha (con su autor, en el servidor)
export function esfuerzo(n, tipo) {
  const e = ESFUERZOS[tipo];
  if (!e) return { ...n };
  return { ...n, cansancio: recorta(n.cansancio + e * (alMaximo(n) ? 2 : 1)) };
}

// comer, beber, calentarse o descansar: baja «que» en «cuanto»
export function saciar(n, que, cuanto) {
  if (!NECESIDADES.includes(que) || !Number.isFinite(cuanto)) return { ...n };
  return { ...n, [que]: recorta(n[que] - cuanto) };
}

// lo que le pasa al personaje por cómo está (para el juego y los avisos)
export function efectos(n) {
  return {
    sinCorrer: n.cansancio >= MAXIMO,
    golpeFlojo: n.cansancio >= MAXIMO,
    torpe: n.frio >= MAXIMO,
    cansancioRapido: alMaximo(n),
    curacionLenta: alMaximo(n),
  };
}

// lo que se puede mover (multiplica la velocidad): rendido, sin correr (0,6: andar sí, correr no); helado, torpe (0,8).
// El servidor lo usa para su límite de lo que se puede andar (src/logica/presencia.js), y el navegador para su paso.
export function factorVelocidad(n) {
  const e = efectos(n);
  return (e.sinCorrer ? 0.6 : 1) * (e.torpe ? 0.8 : 1);
}

// Beber del río con las manos (P4; GDD: «El agua de río se bebe sin problema»): hay agua si en tu sitio o a tu alrededor
// (a 1,5 y a 2,5 m, en ocho direcciones) hay río o mar. aguaEn(x, z): lo hondo del agua ahí (null en seco), como el
// del navegador (src/mundo/mundo_juego.js) y el del servidor (src/logica/terreno_servidor.js). Cada trago baja la
// sed TRAGO puntos; entre trago y trago, ESPERA_TRAGO ms (decisión provisional: tres o cuatro tragos quitan la sed).
export const TRAGO = 30, ESPERA_TRAGO = 1500;
export function hayAguaCerca(aguaEn, x, z) {
  if (aguaEn(x, z)) return true;
  for (const r of [1.5, 2.5]) for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    if (aguaEn(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true;
  }
  return false;
}

// Comer (P4): lo que se come y cuánta hambre quita cada uno (decisión provisional; el documento solo dice que lo
// cocinado sacia más). Una mata de bayas da de 3 a 6: entre 15 y 30 puntos.
export const NUTRE = { bayas: 5, setas: 7 };
export const comestible = (tipo) => Object.prototype.hasOwnProperty.call(NUTRE, tipo);

// los círculos que salen ahora: [{ que, fuerte }]
export function avisos(n) {
  return NECESIDADES.filter(k => n[k] >= AVISO).map(k => ({ que: k, fuerte: n[k] >= FUERTE }));
}

// para mandarlo y guardarlo (con dos decimales: la sed sube 0,03 por segundo)
export function redondear(n) {
  const r = {};
  for (const k of NECESIDADES) r[k] = Math.round(n[k] * 100) / 100;
  return r;
}
