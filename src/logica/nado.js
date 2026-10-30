// Kinhold — el aguante, el agua y el nado (valravnx, 30 oct). Lógica pura (sin three.js), para que el servidor la
// pueda usar tal cual.
//
//  - Un solo aguante (0 a 1), el mismo al correr (con Mayúsculas) y al nadar. Andar o estar quieto en tierra lo
//    recupera. Sin aguante no se corre.
//  - Según lo hondo del agua donde estás: en seco o en lo somero, a pie; con el agua por la cintura, vadeando (más
//    despacio cuanto más hondo); más hondo, nadando (GDD: «en el agua honda se nada despacio y cansa mucho»).
//  - Al nadar, el aguante baja más deprisa cuanto más pesa lo que llevas (la ropa, la armadura y la carga): con lo
//    puesto de lino se aguanta más de un minuto; con gambesón y cota de malla, o cargando un tronco, unos 10 s.
//  - Sin aguante, nadando, te ahogas: unos segundos después, mueres. Si llegas a donde haces pie, se recupera.
//  - En el río, la corriente te lleva río abajo (en los ríos grandes, fuerte).
//
// Decisiones provisionales (el GDD no da cifras; anotadas en el registro y en el diario):
export const NADO = {
  hondoVadear: 0.35,   // m de agua: desde aquí se vadea (más despacio)
  hondoNadar: 1.25,    // m de agua: desde aquí ya no se hace pie (por el pecho de una persona de 1,75 m) y se nada
  correrS: 40,         // s de carrera seguida con el aguante lleno
  recuperaS: 20,       // s para recuperarlo entero andando (quieto, la mitad)
  nadarS: 80,          // s nadando sin peso hasta quedarse sin aguante
  ahogoS: 8,           // s sin aguante en el agua honda hasta morir ahogado
  velNadar: 0.9,       // m/s nadando (1,5 apretando, que cansa el doble)
  velNadarRapido: 1.5,
  arrastre: 0.8,       // parte de la velocidad de la corriente que te lleva
};

// Cuánto más deprisa baja el aguante al nadar con `kg` encima: 1 + kg/5 + (kg/8)². Con 0,6 kg (camisa y pantalón de
// lino) 1,1 (unos 70 s); con 4 kg (y un gambesón), 2,1 (unos 38 s); con 14 kg (gambesón y cota de malla), 6,9 (unos
// 12 s); cargando un tronco delgado (15 kg más), 7,9 (unos 10 s).
export const factorPeso = (kg) => 1 + Math.max(0, kg) / 5 + (Math.max(0, kg) / 8) ** 2;

// en tierra, vadeando o nadando, según lo hondo del agua (null: no hay agua)
export function modoAgua(hondo) {
  if (hondo === null || hondo === undefined || hondo < NADO.hondoVadear) return 'tierra';
  return hondo < NADO.hondoNadar ? 'vadear' : 'nadar';
}

// lo que se multiplica la velocidad al vadear (de 1 en lo somero a 0,5 con el agua por el pecho)
export function factorVadeo(hondo) {
  const t = Math.min(1, Math.max(0, (hondo - NADO.hondoVadear) / (NADO.hondoNadar - NADO.hondoVadear)));
  return 1 - 0.5 * t * t * (3 - 2 * t);
}

export const nuevoAguante = () => ({ aguante: 1, ahogo: 0, muerto: false });

// ¿se puede correr? (en tierra o vadeando, con algo de aguante)
export const puedeCorrer = (e) => e.aguante > 0.02;

// Un paso de tiempo. modo: 'tierra' | 'vadear' | 'nadar'; moviendo: si se mueve; rapido: con Mayúsculas; kg: lo que
// lleva encima. Devuelve el estado nuevo (no cambia el de entrada).
export function pasoAguante(e, dt, { modo = 'tierra', moviendo = false, rapido = false, kg = 0 } = {}) {
  let { aguante, ahogo, muerto } = e;
  if (muerto) return { aguante, ahogo, muerto };
  if (modo === 'nadar') {
    const gasto = (1 / NADO.nadarS) * factorPeso(kg) * (moviendo ? (rapido ? 2 : 1) : 0.6);
    aguante = Math.max(0, aguante - gasto * dt);
    if (aguante <= 0) ahogo = Math.min(1, ahogo + dt / NADO.ahogoS);
    if (ahogo >= 1) muerto = true;
  } else {
    if (moviendo && rapido && aguante > 0) aguante = Math.max(0, aguante - dt / NADO.correrS);
    else aguante = Math.min(1, aguante + dt / NADO.recuperaS * (moviendo ? 1 : 2));
    ahogo = Math.max(0, ahogo - dt / 2);
  }
  return { aguante, ahogo, muerto };
}
