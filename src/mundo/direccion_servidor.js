// La dirección del servidor del juego. El juego es siempre en línea (valravnx, 30 oct): todos entran al mismo mundo,
// el del servidor de prueba en Hetzner (servidor/nube/LEEME.md), también desde la web de GitHub. Es el único sitio
// del código con la dirección. Con ?servidor= en la dirección se usa otro (un servidor en casa o el de las pruebas).
// Antes se podía poner otra en las Opciones del menú y se guardaba en el navegador: ya no se lee (si alguien tenía
// guardada la de casa, ws://localhost:8080, se quedaría fuera del mundo de todos).
export const SERVIDOR = 'wss://2-31-141-224.sslip.io';

export function direccionServidor() {
  const p = new URLSearchParams(location.search).get('servidor');
  return p || SERVIDOR;
}
