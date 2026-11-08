// Kinhold — «Jugar en línea» en la construcción (hito 1f): la conexión con el servidor, el mundo compartido
// (src/logica/en_linea.js) y los demás jugadores, dibujados con su personaje del taller (cuerpo y ropa que eligieron).
// La dirección del servidor: src/mundo/direccion_servidor.js (la de Hetzner, o la de ?servidor=).
import * as THREE from 'three';
import { MundoEnLinea } from '../logica/en_linea.js';
import { DESCONECTADO } from '../logica/dormidos.js';
import { normalizarAspecto } from '../logica/aspecto.js';
import { crearJugador } from './personaje.js';
import { tr } from '../idioma.js';
import { MOTIVO_VACIO, MOTIVO_DESPACIO } from '../logica/charla.js';
import { abrirCliente } from '../mundo/cliente.js';
import { Luchador } from '../combate/logica.js';
import { crearCombatiente, ponerArma, animarCombatiente, pintarHeridas, Rastro } from '../combate/modelos.js';
import { aplicarFoto, avanzarCopia } from '../logica/combate_cliente.js';
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
  // Pelear en el mundo (valravnx, 31 oct): la foto de cada luchador que reparte el servidor. Con el arma sacada, el otro
  // se dibuja con su modelo de combate (espada en mano) y se mueve como dice su luchador (cargar, golpear, parar, caer)
  const fotos = new Map();      // autor → foto de su luchador (src/logica/combate_servidor.js)
  const escuchas = new Set();   // lo que quiere ver los mensajes del panel del admin (src/juego/panel_admin.js)
  const escuchasSalida = new Set();   // y la respuesta a la salida que elige un personaje nuevo (src/juego/main.js)
  const escuchasDicho = new Set();    // y lo que dice alguien en el chat de texto (src/juego/charla.js)

  cli = abrirCliente({
    alAbrir: (enviar) => {
      if (alAbrir) alAbrir(enviar);
      mandarAspecto();
    },
    alMensaje: (msg) => {
      if (msg.tipo === 'admin') { for (const f of escuchas) f(msg); return; }
      if (msg.tipo === 'salida') { for (const f of escuchasSalida) f(msg); return; }
      if (msg.tipo === 'dicho') { for (const f of escuchasDicho) f(msg); return; }
      // (si no vale lo dicho, el motivo, para que lo vea quien habla)
      if (msg.tipo === 'error' && (msg.motivo === MOTIVO_VACIO || msg.motivo === MOTIVO_DESPACIO)) for (const f of escuchasDicho) f({ tipo: 'dicho_error', motivo: msg.motivo });
      for (const l of msg.tipo === 'luchadores' ? msg.lista : msg.tipo === 'bienvenida' ? msg.luchadores || [] : []) {
        fotos.set(l.autor, l);
      }
      if (msg.tipo === 'sale') { quitar(msg.autor); fotos.delete(msg.autor); }
      const info = red.recibir(msg);
      alCambiar(info, msg);
      if (info.rechazo) avisar(tr('El servidor no lo ha aceptado: {m}', { m: tr(info.rechazo) }), true);
    },
    alCortar: () => { red.yo = null; for (const a of [...remotos.keys()]) quitar(a); fotos.clear(); if (alCortarse) alCortarse(); },
    conectado: () => tr('En línea · {n} más', { n: cli.presencia.remotos.size }),
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
    if (r) { escena.remove(r.j.raiz); if (r.simbolo) escena.remove(r.simbolo); quitarCombate(r); remotos.delete(autor); }
  }
  // el símbolo de desconectado (GDD, apartado 6): una luna menguante sobre quien duerme desconectado (src/logica/dormidos.js)
  let texturaSimbolo = null;
  function simboloDesconectado(autor) {
    if (!texturaSimbolo) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(36,30,24,0.82)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(241,232,216,0.35)'; g.lineWidth = 4; g.stroke();
      // la luna: un círculo claro al que se le quita otro desplazado
      g.fillStyle = '#e3cf9f'; g.beginPath(); g.arc(58, 66, 32, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(76, 54, 28, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(241,232,216,0.85)'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('z', 88, 50);
      texturaSimbolo = new THREE.CanvasTexture(c); texturaSimbolo.colorSpace = THREE.SRGBColorSpace;
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaSimbolo, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(0.42, 0.42, 1); sp.renderOrder = 5;
    sp.userData.simboloDe = autor;   // (no «autor»: eso busca a su personaje)
    return sp;
  }
  function quitarCombate(r) {
    if (!r.comb) return;
    escena.remove(r.comb.m); escena.remove(r.comb.rastro.malla); r.comb.rastro.geo.dispose();
    r.comb = null; r.j.raiz.visible = true;
  }
  // con el arma sacada: su modelo de combate, con su cuerpo y su ropa, y una copia de su luchador
  function dibujarCombate(r, e, f, asp, dt) {
    if (!r.comb) {
      const m = crearCombatiente({ armadura: f.armadura, colorCinta: 0xb3923f, recursos, sexo: asp.sexo, capas: asp.capas, aspecto: asp.aspecto });
      ponerArma(m, f.arma); m.userData.autor = e.autor;
      escena.add(m);
      r.comb = { m, L: new Luchador({ arma: f.arma, armadura: f.armadura }), foto: null, arma: f.arma, rastro: new Rastro(escena) };
      r.j.raiz.visible = false;
    }
    const c = r.comb, L = c.L;
    if (c.foto !== f) { c.foto = f; aplicarFoto(L, f); if (c.arma !== f.arma) { c.arma = f.arma; ponerArma(c.m, f.arma); } }
    L.x = e.x; L.z = e.z; if (!L.fuera) L.rot = e.giro;
    avanzarCopia(L, dt);
    c.m.position.set(e.x, e.y, e.z); c.m.rotation.y = L.rot;
    pintarHeridas(c.m, L.heridas);
    animarCombatiente(c.m, L, dt, r.vel > 0.3 ? r.vel : 0, L.factorPiernas() < 0.9);
    c.rastro.actualizar(c.m, L.accion === 'golpeando' || L.accion === 'lanzando');
  }

  // cada fotograma: mandar lo propio (como mucho 10 veces por segundo) y dibujar a los demás
  function paso(dt, propio) {
    const ahora = performance.now();
    if (cli.estado === 'conectado') presencia.actualizar(ahora, propio);
    const vistos = presencia.ver(ahora);
    const siguen = new Set();
    for (const e of vistos) {
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
      const desconectado = e.anim === DESCONECTADO;   // dormido en el mundo al desconectarse: tumbado, con su símbolo
      r.j.durmiendo = e.anim === 'dormir' || desconectado;   // dormido en su cama (P4): tumbado
      if (desconectado && !r.simbolo && !window.__mutarDesconectado) { r.simbolo = simboloDesconectado(e.autor); escena.add(r.simbolo); }
      if (!desconectado && r.simbolo) { escena.remove(r.simbolo); r.simbolo = null; }
      if (r.simbolo) r.simbolo.position.set(e.x, e.y + 0.95, e.z);
      r.j.sentado = e.anim === 'sentado';    // sentado a descansar (P4, 8 nov)
      r.j.animar(r.vel > 0.3 ? r.vel : 0, dt, e.anim === 'talar');
      const f = fotos.get(e.autor);
      if (f && f.sacada) dibujarCombate(r, e, f, asp, dt); else quitarCombate(r);
    }
    for (const a of [...remotos.keys()]) if (!siguen.has(a)) quitar(a);
  }

  return {
    red, direccion: cli.direccion, paso, mandarAspecto,
    // mandar ya dónde estás, sin esperar al siguiente envío (los atajos de prueba que llevan al jugador junto a una obra)
    mandarEstado: (propio) => { if (cli.estado !== 'conectado') return false; presencia.ultimoEnvio = -Infinity; return presencia.actualizar(performance.now(), propio); },
    // para el panel del admin: mandar al servidor y escuchar sus respuestas ({ tipo: 'admin' })
    enviar: (m) => cli.enviar(m), escuchar: (f) => { escuchas.add(f); return () => escuchas.delete(f); },
    escucharSalida: (f) => { escuchasSalida.add(f); return () => escuchasSalida.delete(f); },
    // el chat de texto: decir algo (lo comprueba y lo reparte el servidor) y escuchar lo que se dice cerca
    decir: (texto) => cli.estado === 'conectado' && cli.enviar({ tipo: 'decir', texto }),
    escucharDicho: (f) => { escuchasDicho.add(f); return () => escuchasDicho.delete(f); },
    get yo() { return cli.yo; },
    get estado() { return cli.estado; },
    get antiguo() { return cli.antiguo; },
    get cuenta() { return cli.cuenta; },   // el usuario de tu cuenta (null si aún no tienes)
    get sinCorreo() { return cli.sinCorreo; },   // si a tu cuenta le falta confirmar el correo (no entras en el mundo)
    get admin() { return cli.admin; },     // si tu cuenta es la de admin (lo dice el servidor): el panel de depuración
    get remotos() { return remotos; },
    // el modelo con el que se ve a otro jugador ahora (el de combate si tiene el arma sacada): para las sacudidas
    modeloDe: (autor) => { const r = remotos.get(autor); return r ? (r.comb ? r.comb.m : r.j.raiz) : null; },
    fotos,
    cerrar() { cli.cerrar(); },
  };
}
