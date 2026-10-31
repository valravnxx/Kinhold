// Kinhold — «Jugar en línea» en la construcción (hito 1f): la conexión con el servidor, el mundo compartido
// (src/logica/en_linea.js) y los demás jugadores, dibujados con su personaje del taller (cuerpo y ropa que eligieron).
// La dirección del servidor: src/mundo/direccion_servidor.js (la de Hetzner, o la de ?servidor=).
import { MundoEnLinea } from '../logica/en_linea.js';
import { normalizarAspecto } from '../logica/aspecto.js';
import { crearJugador } from './personaje.js';
import { tr } from '../idioma.js';
import { abrirCliente } from '../mundo/cliente.js';
export { SERVIDOR, direccionServidor } from '../mundo/direccion_servidor.js';

// escena: donde se ponen los demás; recursos: carpeta del taller; aspecto: { sexo, capas, aspecto } propio;
// alCambiar(info): el mundo o lo que pasa ha cambiado (info = lo que devuelve MundoEnLinea.recibir);
// avisar(texto, error): un aviso para el jugador; alEstado(texto): la línea de estado de la conexión.
// La conexión, el estado, la presencia y los avisos comunes: src/mundo/cliente.js.
// alAbrir(enviar) y alCortarse(): para lo que también va por esta conexión (lo que llevas y el suelo).
export function conectarEnLinea({ escena, recursos, aspecto, alCambiar, avisar, alEstado, alAbrir = null, alCortarse = null }) {
  let cli = null;
  const red = new MundoEnLinea((m) => { if (cli) cli.enviar(m); });
  const remotos = new Map();    // autor → { j, clave, x, z, vel }
  const enLiza = new Set();     // los que están en el «Duelo en línea»: no están en este mundo y no se dibujan
  const escuchas = new Set();   // lo que quiere ver los mensajes del panel del admin (src/juego/panel_admin.js)

  cli = abrirCliente({
    alAbrir: (enviar) => {
      if (alAbrir) alAbrir(enviar);
      mandarAspecto();
      // fuera de la liza: quien viene del duelo en línea en la misma pestaña es el mismo jugador para el servidor,
      // y seguía en la liza, así que los demás no le dibujaban (valravnx, 28 oct)
      enviar({ tipo: 'combate', que: 'mundo' });
    },
    alMensaje: (msg) => {
      if (msg.tipo === 'admin') { for (const f of escuchas) f(msg); return; }
      for (const l of msg.tipo === 'luchadores' ? msg.lista : msg.tipo === 'bienvenida' ? msg.luchadores || [] : [])
        if (l.liza) enLiza.add(l.autor); else enLiza.delete(l.autor);
      if (msg.tipo === 'sale') { quitar(msg.autor); enLiza.delete(msg.autor); }
      const info = red.recibir(msg);
      alCambiar(info, msg);
      if (info.rechazo) avisar(tr('El servidor no lo ha aceptado: {m}', { m: tr(info.rechazo) }), true);
    },
    alCortar: () => { red.yo = null; for (const a of [...remotos.keys()]) quitar(a); if (alCortarse) alCortarse(); },
    conectado: () => tr('En línea · {n} más', { n: [...cli.presencia.remotos.keys()].filter(a => !enLiza.has(a)).length }),
    bienvenida: (d) => tr('En línea: el mundo es el del servidor ({d}).', { d }),
    avisar: (texto, mal) => { if (mal) avisar(texto, true); else avisar(texto); },
    alEstado,
  });
  const { presencia, aspectos } = cli;
  // lo propio: cuerpo, ropa puesta (capas), personalización y los tintes y la hechura de la ropa. `aspecto` puede ser
  // una función (lo que se lleva puesto cambia con el inventario): se vuelve a mandar con mandarAspecto()
  function mandarAspecto() {
    const a = typeof aspecto === 'function' ? aspecto() : aspecto;
    if (a) cli.enviar({ tipo: 'aspecto', sexo: a.sexo, capas: a.capas, aspecto: a.aspecto, ...(a.tintes ? { tintes: a.tintes } : {}), ...(a.hechuras ? { hechuras: a.hechuras } : {}) });
  }

  function quitar(autor) {
    const r = remotos.get(autor);
    if (r) { escena.remove(r.j.raiz); remotos.delete(autor); }
  }

  // cada fotograma: mandar lo propio (como mucho 10 veces por segundo) y dibujar a los demás
  function paso(dt, propio) {
    const ahora = performance.now();
    if (cli.estado === 'conectado') presencia.actualizar(ahora, propio);
    const vistos = presencia.ver(ahora);
    const siguen = new Set();
    for (const e of vistos) {
      if (enLiza.has(e.autor)) continue;
      siguen.add(e.autor);
      const asp = aspectos.get(e.autor) || { sexo: 'hombre', capas: [] };
      // sin personalización, la de por defecto (como la pone el servidor): así no se viste dos veces al llegar
      const clave = asp.sexo + ':' + asp.capas.join(',') + ':' + JSON.stringify(normalizarAspecto(asp.aspecto, asp.sexo)) + ':' + JSON.stringify([asp.tintes || null, asp.hechuras || null]);
      let r = remotos.get(e.autor);
      if (r && r.clave !== clave) { quitar(e.autor); r = null; }   // ha llegado su aspecto: se viste de nuevo
      if (!r) {
        r = { j: crearJugador(recursos, asp.sexo, asp.capas, asp.aspecto, { tintes: asp.tintes, hechuras: asp.hechuras }), clave, x: e.x, z: e.z, vel: 0 };
        r.j.raiz.userData.autor = e.autor;
        escena.add(r.j.raiz); remotos.set(e.autor, r);
      }
      // la velocidad, de lo que se ha movido (suavizada): así anda o corre al ritmo que se ve
      const v = dt > 0 ? Math.hypot(e.x - r.x, e.z - r.z) / dt : 0;
      r.vel += (Math.min(v, 8) - r.vel) * Math.min(1, dt * 8);
      r.x = e.x; r.z = e.z;
      r.j.raiz.position.set(e.x, e.y, e.z);
      r.j.raiz.rotation.y = e.giro;
      // lo que lleva (no hace falta vestirlo de nuevo: solo se rehace lo que se ve encima)
      if (r.j.ponerLlevado && r.llevado !== asp.llevado) { r.llevado = asp.llevado; r.j.ponerLlevado(asp.llevado || null); }
      r.j.animar(r.vel > 0.3 ? r.vel : 0, dt, e.anim === 'talar');
    }
    for (const a of [...remotos.keys()]) if (!siguen.has(a)) quitar(a);
  }

  return {
    red, direccion: cli.direccion, paso, mandarAspecto,
    // para el panel del admin: mandar al servidor y escuchar sus respuestas ({ tipo: 'admin' })
    enviar: (m) => cli.enviar(m), escuchar: (f) => { escuchas.add(f); return () => escuchas.delete(f); },
    get estado() { return cli.estado; },
    get antiguo() { return cli.antiguo; },
    get remotos() { return remotos; },
    cerrar() { cli.cerrar(); },
  };
}
