// Presencia: los jugadores que se ven unos a otros (hito 1f). Lógica pura (sin three.js), para el
// navegador y para el servidor.
//
// Cada cliente manda su estado (posición, giro y animación) unas 10 veces por segundo. El servidor lo
// comprueba, le pone el autor de la conexión y la hora a la que le llega (sus milisegundos), y lo
// reparte a los demás. Cada cliente dibuja a los demás un poco en el pasado (RETRASO) y mezcla entre
// los dos estados que tiene a los lados de ese momento (interpolación): así se mueven suaves aunque
// los mensajes lleguen a trompicones. Moverse no cambia el mundo, así que no va al registro de acciones.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'estado', x, y, z, giro, anim, tc }      tc: su reloj (ms), solo para quitar el vaivén
//   servidor → cliente   { tipo: 'bienvenida', autor, t, presentes: [...] }                        al conectar: quién está y dónde
//   servidor → clientes  { tipo: 'estados', t, jugadores: [{ autor, t, x, y, z, giro, anim }] }   cada tic (100 ms)
//                        { tipo: 'sale', autor }                                                  cuando alguien se va

import { normalizarAspecto } from './aspecto.js';
import { normalizarTintes } from './tintes.js';
import { normalizarHechuras } from './hechura.js';
import { SALIDA, dentroDePermitido } from './whitholm.js';

export const CADA = 100;        // ms entre estados que manda cada cliente (10 por segundo)
export const RETRASO = 200;     // ms en el pasado a los que se dibuja a los demás: un tic del servidor y el vaivén de la red
export const PREDICCION = 250;  // ms que se sigue la última dirección si no llega nada; luego se queda quieto
const LIMITE = 300000;          // m: nadie está más lejos que esto del origen (dato roto si lo está; el continente mide 256 km)

// Movimiento sin trampas (auditoría del 4 nov): el servidor no se cree un estado que esté más lejos del anterior de lo
// que se puede andar en ese tiempo. Lo más deprisa que va un jugador es corriendo, 6 m/s (src/juego/main.js); nadando con
// la corriente a favor, 1,5 + 0,8 × 3 = 3,9 m/s (src/logica/nado.js y paisaje.js). Cada jugador tiene un «crédito» de
// metros que crece a VEL_MAX por segundo (de reloj del servidor) hasta CREDITO_MAX y que gasta al moverse: así los
// estados que llegan juntos tras un tirón de la red pasan (el crédito se ha ido llenando mientras), y quien se salta
// metros que no tiene se queda donde le llega el crédito (se recorta, en la misma dirección) y se anota.
// Solo cuenta lo horizontal: la altura ya la comprueba el terreno (cerca del suelo, src/logica/terreno_servidor.js).
export const VEL_MAX = 8;        // m/s: los 6 de correr y holgura
export const CREDITO_MAX = 16;   // m: lo que se puede juntar (2 s a VEL_MAX)
export const RADIO_SALIDA = 12;  // m: volver al sitio de salida (al ahogarse) es libre (decisión provisional, 5 nov)

const numero = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMITE;

// Comprueba un estado que manda un cliente. Devuelve el estado limpio (solo lo que se reparte) o null.
// admin: la cuenta de admin puede estar en todo el continente (valravnx, 5 nov: «quiero poder explorar libre»)
export function validarEstado(m, { admin = false } = {}) {
  if (!m || typeof m !== 'object') return null;
  const { x, y, z, giro, anim } = m;
  if (![x, y, z, giro].every(numero)) return null;
  // el mundo, de momento, es solo Whitholm (valravnx, 29 oct): las posiciones van relativas al sitio de salida y nadie
  // puede estar fuera del cuadro de la isla (src/logica/whitholm.js), salvo la cuenta de admin
  if (!dentroDePermitido(SALIDA.x + x, SALIDA.z + z, admin)) return null;
  if (typeof anim !== 'string' || !/^[a-z_]{1,24}$/.test(anim)) return null;
  const e = { x, y, z, giro: normalizarAngulo(giro), anim };
  if (m.tc !== undefined) { if (!(typeof m.tc === 'number' && Number.isFinite(m.tc))) return null; e.tc = m.tc; }
  return e;
}

// Aspecto de un jugador (cuerpo y ropa del taller, y su personalización: forma, colores, peinado y barba), para
// que los demás lo vean como se eligió. Se manda una vez al conectar: { tipo: 'aspecto', sexo, capas, aspecto }.
// La personalización (`aspecto`) se comprueba con la misma lógica que el visor (src/logica/aspecto.js): lo que no
// exista se pone por defecto y los números se recortan. Si no viene, sale la de por defecto (clientes de antes).
// Con la ropa puesta van su tinte y su hechura (`tintes`: { prendas, blason }; `hechuras`: { pieza: hechura }), los de
// las prendas que lleva en el inventario; se comprueban igual (src/logica/tintes.js y hechura.js) y, si no vienen, no
// se mandan (los demás lo ven con los de siempre). Se vuelve a mandar cada vez que cambia lo que lleva puesto.
// Devuelve el aspecto limpio o null.
export function validarAspecto(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.sexo !== 'hombre' && m.sexo !== 'mujer') return null;
  if (!Array.isArray(m.capas) || m.capas.length > 12) return null;
  if (!m.capas.every(c => typeof c === 'string' && /^[a-z_0-9]{1,24}$/.test(c))) return null;
  if (m.aspecto !== undefined && m.aspecto !== null && (typeof m.aspecto !== 'object' || Array.isArray(m.aspecto))) return null;
  for (const k of ['tintes', 'hechuras'])
    if (m[k] !== undefined && m[k] !== null && (typeof m[k] !== 'object' || Array.isArray(m[k]))) return null;
  return { sexo: m.sexo, capas: [...m.capas], aspecto: normalizarAspecto(m.aspecto, m.sexo),
    ...(m.tintes ? { tintes: normalizarTintes(m.tintes, m.sexo) } : {}), ...(m.hechuras ? { hechuras: normalizarHechuras(m.hechuras) } : {}) };
}

export function normalizarAngulo(a) {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

// Giro entre a y b por el camino corto (de 170° a -170° pasa por 180°, no da la vuelta entera).
export function mezclarAngulo(a, b, f) {
  return normalizarAngulo(a + normalizarAngulo(b - a) * f);
}

// Lo que el servidor guarda de cada conexión y reparte en cada tic.
export class PresenciaServidor {
  // limitar: false solo en las pruebas que ponen a un jugador en un sitio de golpe para preparar otra cosa
  constructor({ limitar = true } = {}) { this.limitar = limitar; this.ultimo = new Map(); this.cambiados = new Set(); this.desfases = new Map(); this.anclas = new Map(); }
  // Dónde está de verdad cada uno en el mundo (para el límite de velocidad): { x, z, r (hora del servidor a la que
  // llegó), credito }. La pone el servidor al conectar (donde lo dejó o la salida) y cuando él mismo lo mueve (el admin
  // que va junto a alguien); con el crédito lleno, para que el primer paso no se recorte.
  anclar(autor, p, ahora) { this.anclas.set(autor, { x: p.x, z: p.z, r: ahora, credito: CREDITO_MAX }); }
  // Estado de un cliente: el autor y la hora los pone el servidor, nunca el cliente.
  // La hora: con la del reloj del cliente (tc) pasada al del servidor, se quita el vaivén de la subida
  // (si no, los estados llegan a trompicones y la velocidad que se ve cambia). El desfase entre los dos
  // relojes es el del mensaje que llegó más deprisa. Nunca puede ser una hora futura ni de hace más de 1 s.
  // `admin`: puede estar fuera de la isla (validarEstado).
  // Devuelve null si no vale; si vale, { estado, recortado } (recortado: los metros que se ha querido saltar de más).
  // `vel`: multiplica lo que se puede andar (la cuenta de admin con su velocidad multiplicada, src/logica/admin.js; y
  // menos de 1 si está rendido o helado: factorVelocidad de src/logica/necesidades.js).
  recibir(autor, m, ahora, { admin = false, vel = 1 } = {}) {
    const e = validarEstado(m, { admin });
    if (!e) return null;
    let t = ahora;
    if (e.tc !== undefined) {
      const d = Math.min(this.desfases.get(autor) ?? Infinity, ahora - e.tc);
      this.desfases.set(autor, d);
      t = Math.min(ahora, Math.max(ahora - 1000, e.tc + d));
      delete e.tc;
    }
    let recortado = 0;
    const a = !this.limitar ? null : this.anclas.get(autor);
    if (a) {
      const fv = Number.isFinite(vel) && vel > 0 ? vel : 1;   // (menos de 1: rendido o helado, src/logica/necesidades.js)
      a.credito = Math.min(CREDITO_MAX * fv, a.credito + VEL_MAX * fv * Math.max(0, ahora - a.r) / 1000);
      a.r = ahora;
      const dx = e.x - a.x, dz = e.z - a.z, d = Math.hypot(dx, dz);
      if (Math.hypot(e.x, e.z) <= RADIO_SALIDA) a.credito = CREDITO_MAX;   // vuelta a la salida: libre
      else if (d > a.credito) {
        const f = a.credito / d, previo = this.ultimo.get(autor);
        recortado = d - a.credito;
        e.x = a.x + dx * f; e.z = a.z + dz * f;
        if (previo) e.y = previo.y + (e.y - previo.y) * f;
        a.credito = 0;
      } else a.credito -= d;
      a.x = e.x; a.z = e.z;
    } else if (this.limitar) this.anclar(autor, e, ahora);   // sin ancla (el primero de todos): desde aquí
    const previo = this.ultimo.get(autor);
    if (previo) t = Math.max(t, previo.t + 1);   // la hora de cada jugador nunca va hacia atrás
    const estado = { autor, t, ...e };
    this.ultimo.set(autor, estado);
    this.cambiados.add(autor);
    return { estado, recortado };
  }
  quitar(autor) { this.ultimo.delete(autor); this.cambiados.delete(autor); this.desfases.delete(autor); this.anclas.delete(autor); }
  // los que han cambiado desde el tic anterior (cada uno una vez, el último estado que llegó)
  tic() {
    const lista = [...this.cambiados].map(a => this.ultimo.get(a)).filter(Boolean);
    this.cambiados.clear();
    return lista;
  }
  todos() { return [...this.ultimo.values()]; }
}

// Un jugador remoto: los estados que han llegado, por hora del servidor, y la mezcla en un momento dado.
export class Interpolador {
  constructor() { this.estados = []; }
  meter(e) {
    const ult = this.estados[this.estados.length - 1];
    if (ult && e.t <= ult.t) return;   // repetido o desordenado: no sirve
    this.estados.push(e);
    if (this.estados.length > 30) this.estados.shift();   // 3 s de sobra
  }
  // Estado en la hora t del servidor: mezcla de los dos que la rodean; si aún no ha llegado el siguiente,
  // sigue un poco la última dirección (PREDICCION) y luego se queda quieto.
  muestra(t) {
    const L = this.estados;
    if (!L.length) return null;
    if (t <= L[0].t) return { ...L[0] };
    for (let i = L.length - 1; i > 0; i--) {
      const a = L[i - 1], b = L[i];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t);
        return { autor: b.autor, t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f,
          giro: mezclarAngulo(a.giro, b.giro, f), anim: f < 0.5 ? a.anim : b.anim };
      }
    }
    const b = L[L.length - 1], a = L[L.length - 2];
    if (!a) return { ...b };
    const extra = Math.min(t - b.t, PREDICCION) / (b.t - a.t);
    return { autor: b.autor, t, x: b.x + (b.x - a.x) * extra, y: b.y + (b.y - a.y) * extra, z: b.z + (b.z - a.z) * extra,
      giro: b.giro, anim: b.anim };
  }
}

// Lo que lleva cada cliente: cuándo mandar su estado y dónde dibujar a los demás.
// `enviar(msg)` lo pone quien la usa (el websocket en el navegador, o la prueba). Las horas son las del
// reloj de cada uno (performance.now() en el navegador); la del servidor se estima con lo que llega.
export class PresenciaCliente {
  constructor(enviar, { cada = CADA, retraso = RETRASO } = {}) {
    this.enviar = enviar; this.cada = cada; this.retraso = retraso;
    this.ultimoEnvio = -Infinity; this.remotos = new Map();
    this.desfase = null;   // hora del servidor menos hora local, en el mensaje que llegó más deprisa
    this.yo = null;        // mi autor (de la bienvenida), para no dibujarme a mí mismo
  }
  // llamar en cada fotograma con el estado propio; manda como mucho uno cada `cada` ms
  actualizar(ahora, propio) {
    if (ahora - this.ultimoEnvio < this.cada) return false;
    this.ultimoEnvio = ahora;
    this.enviar({ tipo: 'estado', x: propio.x, y: propio.y, z: propio.z, giro: propio.giro, anim: propio.anim, tc: Math.round(ahora) });
    return true;
  }
  recibir(msg, ahora) {
    if (msg.tipo === 'bienvenida') {
      this.yo = msg.autor;
      if (msg.presentes) this.recibir({ tipo: 'estados', t: msg.t, jugadores: msg.presentes }, ahora);
    } else if (msg.tipo === 'estados') {
      // lo que tarda en llegar varía: el mensaje más rápido es el que mejor dice la hora del servidor
      const d = msg.t - ahora;
      if (this.desfase === null || d > this.desfase) this.desfase = d;
      for (const e of msg.jugadores) {
        if (e.autor === this.yo) continue;
        if (!this.remotos.has(e.autor)) this.remotos.set(e.autor, new Interpolador());
        this.remotos.get(e.autor).meter(e);
      }
    } else if (msg.tipo === 'sale') this.remotos.delete(msg.autor);
  }
  // los demás jugadores, como se dibujan ahora
  ver(ahora) {
    if (this.desfase === null) return [];
    const t = ahora + this.desfase - this.retraso;
    const lista = [];
    for (const [autor, it] of this.remotos) { const m = it.muestra(t); if (m) lista.push({ ...m, autor }); }
    return lista;
  }
}
