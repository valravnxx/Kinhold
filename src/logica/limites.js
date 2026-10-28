// Límites por conexión del servidor (hito 1f): cuántos mensajes y cuántos bytes por segundo puede mandar cada
// cliente. Lógica pura (sin websocket): el reloj lo pasa quien la usa, en ms, para poder probarla sin esperar.
//
// Dos cubos que se llenan solos (uno de mensajes y otro de bytes): cada mensaje gasta 1 y sus bytes; si no
// queda, el mensaje no se atiende. Los que no se atienden se suman a «excesos», que también bajan con el
// tiempo al mismo ritmo; si se pasa de EXCESOS_ECHAR, el cliente está inundando el servidor y se le echa.
//
// Decisión provisional (anotada en el registro de la demo): 60 mensajes por segundo seguidos con ráfagas de
// hasta 300; 64 KiB por segundo con ráfagas de 256 KiB; cada mensaje, como mucho, 16 KiB. Un jugador normal
// manda unos 10 estados por segundo (de unos 100 bytes), alguna acción de obra y alguna intención de combate.
export const LIMITES = {
  mensajesSeg: 60, rafagaMensajes: 300,
  bytesSeg: 64 * 1024, rafagaBytes: 256 * 1024,
  maxMensaje: 16 * 1024,
  excesosEchar: 600,
};

export class Limitador {
  constructor(ahora = 0, limites = LIMITES) {
    this.l = limites;
    this.mensajes = limites.rafagaMensajes;
    this.bytes = limites.rafagaBytes;
    this.excesos = 0;
    this.antes = ahora;
  }
  // Un mensaje de `tam` bytes a la hora `ahora` (ms). Devuelve 'si' (se atiende), 'no' (se descarta) o 'echar'.
  admitir(ahora, tam) {
    const dt = Math.max(0, (ahora - this.antes) / 1000);
    this.antes = Math.max(this.antes, ahora);
    const l = this.l;
    this.mensajes = Math.min(l.rafagaMensajes, this.mensajes + dt * l.mensajesSeg);
    this.bytes = Math.min(l.rafagaBytes, this.bytes + dt * l.bytesSeg);
    this.excesos = Math.max(0, this.excesos - dt * l.mensajesSeg);
    if (!(tam <= l.maxMensaje)) return 'echar';
    if (this.mensajes >= 1 && this.bytes >= tam) { this.mensajes -= 1; this.bytes -= tam; return 'si'; }
    this.excesos += 1;
    return this.excesos > l.excesosEchar ? 'echar' : 'no';
  }
}
