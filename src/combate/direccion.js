// Lee la dirección de un golpe o de una parada a partir del movimiento del ratón (o del dedo), sin three.js.
// valravnx, 30 oct: «mueves el ratón en una dirección y clicas»: vale el movimiento de justo antes del clic (arriba,
// abajo, izquierda, derecha); si no te has movido, estocada (o parar la estocada). Con el botón pulsado, un
// movimiento claro hacia otro lado cambia la dirección sin soltar; un temblor no la cambia.
//   const d = new LectorDireccion();
//   d.mover(dx, dy, t)   en cada movimiento (píxeles; t en s)
//   d.alPulsar(t)        al pulsar: la línea con la que empieza
//   d.cambio(t)          con el botón pulsado: la línea nueva si se ha movido claramente hacia otro lado, o null
export const VENTANA = 0.15;        // s: el movimiento que cuenta al pulsar
export const UMBRAL = 10;           // px en esa ventana para que cuente como dirección (si no, estocada)
export const UMBRAL_CAMBIO = 28;    // px seguidos hacia un lado, con el botón pulsado, para cambiar de dirección
export const VENTANA_CAMBIO = 0.25;

export function lineaDe(dx, dy) {
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'alto' : 'bajo';
  return dx < 0 ? 'izquierda' : 'derecha';
}

export class LectorDireccion {
  constructor() { this.mov = []; this.linea = null; }
  mover(dx, dy, t) {
    this.mov.push({ dx, dy, t });
    const lim = t - Math.max(VENTANA, VENTANA_CAMBIO);
    while (this.mov.length && this.mov[0].t < lim) this.mov.shift();
  }
  suma(t, ventana) {
    let x = 0, y = 0;
    for (const m of this.mov) if (m.t >= t - ventana) { x += m.dx; y += m.dy; }
    return [x, y];
  }
  alPulsar(t) {
    const [x, y] = this.suma(t, VENTANA);
    this.linea = Math.hypot(x, y) >= UMBRAL ? lineaDe(x, y) : 'estocada';
    this.mov = [];
    return this.linea;
  }
  cambio(t) {
    const [x, y] = this.suma(t, VENTANA_CAMBIO);
    if (Math.hypot(x, y) < UMBRAL_CAMBIO) return null;
    const l = lineaDe(x, y);
    this.mov = [];
    if (l === this.linea) return null;
    this.linea = l;
    return l;
  }
}
