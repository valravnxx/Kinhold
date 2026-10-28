// La dirección del servidor del juego para jugar en línea (la construcción y el duelo).
// Se pone en las Opciones del menú de la demo (se guarda en el navegador) o con ?servidor= en la dirección.
export const CLAVE_SERVIDOR = 'kinhold_servidor';
export const SERVIDOR_POR_DEFECTO = 'ws://localhost:8080';

export function direccionServidor() {
  const p = new URLSearchParams(location.search).get('servidor');
  if (p) return p;
  try { return localStorage.getItem(CLAVE_SERVIDOR) || SERVIDOR_POR_DEFECTO; } catch (e) { return SERVIDOR_POR_DEFECTO; }
}
