// Kinhold — «Jugar en línea» en la construcción (hito 1f): la conexión con el servidor, el mundo compartido
// (src/logica/en_linea.js) y los demás jugadores, dibujados con su personaje del taller (cuerpo y ropa que eligieron).
// La dirección del servidor se pone en las Opciones del menú de la demo (se guarda en el navegador) o con ?servidor=.
import { MundoEnLinea } from '../logica/en_linea.js';
import { PresenciaCliente } from '../logica/presencia.js';
import { crearJugador } from './personaje.js';
import { tr } from '../idioma.js';

export const CLAVE_SERVIDOR = 'kinhold_servidor';
export const SERVIDOR_POR_DEFECTO = 'ws://localhost:8080';

export function direccionServidor() {
  const p = new URLSearchParams(location.search).get('servidor');
  if (p) return p;
  try { return localStorage.getItem(CLAVE_SERVIDOR) || SERVIDOR_POR_DEFECTO; } catch (e) { return SERVIDOR_POR_DEFECTO; }
}

// escena: donde se ponen los demás; recursos: carpeta del taller; aspecto: { sexo, capas } propio;
// alCambiar(info): el mundo o lo que pasa ha cambiado (info = lo que devuelve MundoEnLinea.recibir);
// avisar(texto, error): un aviso para el jugador; alEstado(texto): la línea de estado de la conexión.
export function conectarEnLinea({ escena, recursos, aspecto, alCambiar, avisar, alEstado }) {
  const direccion = direccionServidor();
  let ws = null, estado = 'conectando';
  const enviar = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const red = new MundoEnLinea(enviar);
  const presencia = new PresenciaCliente(enviar);
  const aspectos = new Map();   // autor → { sexo, capas }
  const remotos = new Map();    // autor → { j, clave, x, z, vel }

  const ponerEstado = () => {
    const n = presencia.remotos.size;
    alEstado(estado === 'conectado' ? tr('En línea · {n} más', { n })
      : estado === 'conectando' ? tr('Conectando con el servidor…') : tr('Sin conexión'));
  };
  ponerEstado();

  try { ws = new WebSocket(direccion); } catch (e) {
    estado = 'cortado'; ponerEstado(); avisar(tr('No se puede conectar con el servidor: {d}', { d: direccion }), true);
  }
  if (ws) {
    ws.onopen = () => { if (aspecto) enviar({ tipo: 'aspecto', sexo: aspecto.sexo, capas: aspecto.capas }); };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const ahora = performance.now();
      presencia.recibir(msg, ahora);
      if (msg.tipo === 'bienvenida') {
        estado = 'conectado';
        for (const a of msg.aspectos || []) aspectos.set(a.autor, { sexo: a.sexo, capas: a.capas });
      } else if (msg.tipo === 'aspecto') aspectos.set(msg.autor, { sexo: msg.sexo, capas: msg.capas });
      else if (msg.tipo === 'sale') { quitar(msg.autor); aspectos.delete(msg.autor); }
      else if (msg.tipo === 'error') console.warn('Servidor:', msg.motivo);
      const info = red.recibir(msg);
      alCambiar(info, msg);
      if (msg.tipo === 'bienvenida') avisar(tr('En línea: el mundo es el del servidor ({d}).', { d: direccion }));
      if (info.rechazo) avisar(tr('El servidor no lo ha aceptado: {m}', { m: tr(info.rechazo) }), true);
      ponerEstado();
    };
    ws.onclose = () => {
      const antes = estado; estado = 'cortado'; red.yo = null;
      for (const a of [...remotos.keys()]) quitar(a);
      presencia.remotos.clear();
      ponerEstado();
      avisar(antes === 'conectado' ? tr('Se ha perdido la conexión con el servidor.') : tr('No se puede conectar con el servidor: {d}', { d: direccion }), true);
    };
  }

  function quitar(autor) {
    const r = remotos.get(autor);
    if (r) { escena.remove(r.j.raiz); remotos.delete(autor); }
  }

  // cada fotograma: mandar lo propio (como mucho 10 veces por segundo) y dibujar a los demás
  function paso(dt, propio) {
    const ahora = performance.now();
    if (estado === 'conectado') presencia.actualizar(ahora, propio);
    const vistos = presencia.ver(ahora);
    const siguen = new Set();
    for (const e of vistos) {
      siguen.add(e.autor);
      const asp = aspectos.get(e.autor) || { sexo: 'hombre', capas: [] };
      const clave = asp.sexo + ':' + asp.capas.join(',');
      let r = remotos.get(e.autor);
      if (r && r.clave !== clave) { quitar(e.autor); r = null; }   // ha llegado su aspecto: se viste de nuevo
      if (!r) {
        r = { j: crearJugador(recursos, asp.sexo, asp.capas), clave, x: e.x, z: e.z, vel: 0 };
        r.j.raiz.userData.autor = e.autor;
        escena.add(r.j.raiz); remotos.set(e.autor, r);
      }
      // la velocidad, de lo que se ha movido (suavizada): así anda o corre al ritmo que se ve
      const v = dt > 0 ? Math.hypot(e.x - r.x, e.z - r.z) / dt : 0;
      r.vel += (Math.min(v, 8) - r.vel) * Math.min(1, dt * 8);
      r.x = e.x; r.z = e.z;
      r.j.raiz.position.set(e.x, e.y, e.z);
      r.j.raiz.rotation.y = e.giro;
      r.j.animar(r.vel > 0.3 ? r.vel : 0, dt, e.anim === 'talar');
    }
    for (const a of [...remotos.keys()]) if (!siguen.has(a)) quitar(a);
  }

  return {
    red, direccion, paso,
    get estado() { return estado; },
    get remotos() { return remotos; },
    cerrar() { if (ws) ws.close(); },
  };
}
