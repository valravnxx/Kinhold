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
//   - el frío va hacia lo que pide el sitio (frioObjetivo) y tarda unos 10 minutos en llegar; lo que pide el sitio,
//     frioDelSitio (más abajo, 8 nov);
//   - el cansancio: correr (más de 4 m/s) 0,5 por segundo, con carga suelta en las manos o al hombro más; cada golpe de
//     hacha 1,5, cada rato de obra 2, fabricar 0,5, recoger 0,3, desbrozar 2 (los golpes de una vez), cada golpe de mazo a una roca 1,5; quieto baja 0,4 por segundo y andando 0,1;
//     durmiendo en tu cama ligada (8 nov), 1,5 por segundo; sentado en el suelo a descansar (8 nov), 1 por segundo;
//   - el combate (8 nov: «el mismo cansancio que ya lleva el combate, no otro»): el aliento del combate
//     (src/combate/logica.js, cansancio del luchador) sube y baja deprisa, golpe a golpe; de lo que sube, una décima
//     parte pasa a este cansancio (COMBATE.paso), y el aliento no se recupera por debajo de 0,8 veces este cansancio
//     (COMBATE.suelo: quien llega rendido a una pelea empieza sin aliento; rendido del todo, con 80, sin golpe fuerte);
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
  dormir: 1.5,                  // durmiendo en tu cama ligada, por segundo: rendido del todo, unos 70 s (provisional)
  sentado: 1,                   // sentado a descansar, por segundo: rendido del todo, unos 100 s (provisional)
};
export const COMBATE = { paso: 0.1, suelo: 0.8 };
export const ESFUERZOS = { talar: 1.5, trocear: 1.5, trabajar: 2, fabricar: 0.5, recoger: 0.3, desbrozar: 2, romper: 1.5, descortezar: 0.5, sangrar: 0.3 };

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
export function avanzar(n, dt, { velocidad = 0, kilos = 0, frioObjetivo = 0, durmiendo = false, sentado = false } = {}) {
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
  if (c === 0) c = -(durmiendo ? RITMOS.dormir : velocidad > 0.3 ? RITMOS.andando : sentado ? RITMOS.sentado : RITMOS.quieto) / k;
  m.cansancio = recorta(n.cansancio + c * dt);
  return m;
}

// lo que cansa una acción hecha (con su autor, en el servidor)
export function esfuerzo(n, tipo) {
  const e = ESFUERZOS[tipo];
  if (!e) return { ...n };
  return { ...n, cansancio: recorta(n.cansancio + e * (alMaximo(n) ? 2 : 1)) };
}

// el combate (8 nov): lo que ha subido el aliento del luchador (subida, de 0 a 100) cansa una décima parte
export function delCombate(n, subida) {
  if (!(subida > 0)) return { ...n };
  return { ...n, cansancio: recorta(n.cansancio + COMBATE.paso * subida * (alMaximo(n) ? 2 : 1)) };
}
// lo menos que puede tener el aliento del combate con este cansancio (el cansancio del luchador no baja de aquí)
export const alientoMinimo = (n) => COMBATE.suelo * recorta(n.cansancio || 0);

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
// cocinado sacia más). Una mata de bayas da de 3 a 6: entre 15 y 30 puntos. La carne de una liebre (9 nov; src/logica/
// comida.js): cruda, 12; asada, 35 (una comida de verdad: algo más de un tercio del hambre).
export const NUTRE = { bayas: 5, setas: 7, carne_cruda: 12, carne_asada: 35 };
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

// El frío que pide el sitio (P4, 8 nov; GDD, apartado 6, y documento de sistemas, apartado 10: «según bioma, estación,
// noche, lluvia y ropa»). Decisiones provisionales (registro de la demo y diario; los números, para ajustar probando):
//   - el bioma, por la temperatura media del sitio a su altura (T, °C: la del paisaje, src/logica/paisaje.js, sitio):
//     4 puntos por cada grado bajo 16 °C, hasta 60 (en la salida, unos 9 °C: 28; en la taiga, unos 58);
//   - la noche suma 50 (de 20 a 4 entera; de 18 a 20 y de 4 a 6, poco a poco: nocheDe);
//   - la ropa quita 4 por cada punto de abrigo de lo puesto (src/logica/prendas.js, abrigo: la camisa y el pantalón de
//     lino del principio, 7, quitan 28): con lo del principio, de día no hay frío en la salida y de noche sí (50, sale
//     el aviso); con una túnica de lana encima, apenas;
//   - bajo techo (el de una construcción terminada), la mitad;
//   - el fuego (la hoguera y el hogar: src/logica/fuego.js, calorEn, de 1 junto al fuego a 0 a 4 m): a 2 m o menos no
//     hay frío, y de ahí a 4 m vuelve poco a poco;
//   - la estación y la lluvia aún no cuentan (no hay estaciones ni tiempo en el mundo: llegan con P11).
export const FRIO = { templado: 16, porGrado: 4, bioma: 60, noche: 50, abrigo: 4, techo: 0.5 };
export function nocheDe(hora) {
  const h = ((hora % 24) + 24) % 24;
  if (h >= 20 || h < 4) return 1;
  if (h >= 18) return (h - 18) / 2;
  if (h < 6) return (6 - h) / 2;
  return 0;
}
export function frioDelSitio({ T = FRIO.templado, noche = 0, abrigo = 0, techo = false, calor = 0 } = {}) {
  let f = Math.min(FRIO.bioma, Math.max(0, (FRIO.templado - T) * FRIO.porGrado)) + FRIO.noche * Math.min(1, Math.max(0, noche));
  f -= FRIO.abrigo * Math.max(0, abrigo);
  if (techo) f *= FRIO.techo;
  f *= 1 - Math.min(1, Math.max(0, 2 * calor));
  return recorta(f);
}
