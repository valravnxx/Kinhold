// Versión del protocolo entre el juego y el servidor (hito 1f). El servidor la manda en la bienvenida; si es más
// antigua que la que necesita el juego, el juego avisa de que hay que actualizar el servidor, en vez de quedarse
// conectado sin funcionar (le pasó a valravnx el 28 oct: su servidor de casa era de antes del duelo en línea y los
// dos salían «esperando rival»). Lógica pura: la usan el servidor y el navegador.
//
// Se sube en uno cuando el juego necesite algo que un servidor anterior no tiene, y se apunta aquí qué:
//   1 (28 oct): combate en el servidor y duelo en línea (la liza), conexiones que vuelven con su ficha.
//   2 (28 oct): salir de la liza al volver a construir ({ tipo: 'combate', que: 'mundo' }); sin esto, quien venía
//               del duelo no se veía en la construcción.
//   3 (28 oct): la personalización (forma, colores, peinado y barba) va con el aspecto; un servidor anterior la quita
//               y los demás te veían con el aspecto por defecto.
//   4 (28 oct): curarse en el duelo ({ tipo: 'combate', que: 'curar', herida, metodo } y 'dejarCura'); la foto de
//               cada luchador lleva lo que se le ha hecho a cada herida y su botiquín.
export const PROTOCOLO = 4;

// La versión del servidor por su bienvenida. Los servidores de antes de este número no la mandan: los que ya
// llevaban el reloj del combate (tc) se cuentan como la 1, y los anteriores como la 0.
export function protocoloDe(bienvenida) {
  if (!bienvenida || typeof bienvenida !== 'object') return 0;
  if (Number.isInteger(bienvenida.protocolo)) return bienvenida.protocolo;
  return 'tc' in bienvenida ? 1 : 0;
}
export const servidorAntiguo = (bienvenida) => protocoloDe(bienvenida) < PROTOCOLO;
