// Kinhold — cámara táctil del combate (lógica pura, sin three.js, para poder probarla en node)
// GDD, combate: arrastrar un dedo por zona libre gira la cámara, tocar sin arrastrar golpea;
// con el arco, la cámara sigue a donde apuntas.

export const UMBRAL_ARRASTRE = 10;   // px que tiene que moverse un dedo para contar como arrastre y no como toque
export const GIRO_POR_PX = 0.006;    // radianes de giro por píxel arrastrado (igual que el ratón y los dos dedos)
export const BORDE_ARCO = 0.35;      // con el arco, la cámara empieza a seguir cuando apuntas más allá del 35% desde el centro
export const GIRO_ARCO_MAX = 1.4;    // radianes por segundo con el dedo pegado al borde de la pantalla

// Qué hace un dedo que empieza a tocar el lienzo:
//  'arco'  → tensa y apunta (arma a distancia)
//  'rosa'  → golpea esa zona de la rosa
//  'libre' → nada todavía: si se arrastra, gira la cámara
export function tipoToque({ distancia, rosaVisible, x, y, rosa }) {
  if (distancia) return 'arco';
  if (rosaVisible && Math.hypot(x - rosa.x, y - rosa.y) < rosa.r * 1.5) return 'rosa';
  return 'libre';
}

// Un dedo en zona libre: cuánto gira la cámara con este movimiento. Devuelve el cambio de yaw y si ya es arrastre.
// Hasta pasar el umbral no gira (un toque con temblor no mueve la cámara); al pasarlo gira todo lo movido desde el inicio.
export function arrastrarLibre(q, x, y) {
  let giro = 0;
  if (!q.arrastre && Math.hypot(x - q.x0, y - q.y0) >= UMBRAL_ARRASTRE) { q.arrastre = true; giro = -(x - q.x0) * GIRO_POR_PX; }
  else if (q.arrastre) giro = -(x - q.x) * GIRO_POR_PX;
  q.x = x; q.y = y;
  return giro;
}

// Con el arco tenso: la cámara gira hacia el lado al que apuntas si el dedo está cerca del borde.
// Devuelve el cambio de yaw en este paso, con el mismo signo que arrastrar el dedo hacia ese lado (yaw menor = mira más a la derecha).
export function seguirApuntado(x, ancho, dt) {
  const off = (x - ancho / 2) / (ancho / 2);           // -1 borde izquierdo, 1 borde derecho
  const fuera = Math.abs(off) - BORDE_ARCO;
  if (fuera <= 0) return 0;
  const k = Math.min(1, fuera / (1 - BORDE_ARCO));
  return -Math.sign(off) * k * GIRO_ARCO_MAX * dt;     // mismo signo que arrastrar hacia ese lado
}
