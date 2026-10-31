// Kinhold — el cliente en línea común: lo que hacen igual la construcción (src/juego/en_linea.js) y el duelo
// (src/combate/en_linea.js) al hablar con el servidor. Abre la conexión (src/mundo/conexion.js, que vuelve a conectar
// sola), lleva el estado (conectando, conectado, volviendo, cortado), la presencia de los demás, sus aspectos, si el
// servidor es antiguo, la línea de estado y los avisos de bienvenida y de corte. Cada parte añade solo lo suyo.
import { normalizarLlevado } from '../logica/llevado.js';
import { PresenciaCliente } from '../logica/presencia.js';
import { servidorAntiguo } from '../logica/protocolo.js';
import { direccionServidor } from './direccion_servidor.js';
import { abrirConexion } from './conexion.js';
import { tr } from '../idioma.js';

// alAbrir(enviar): conectado (también al volver); alMensaje(msg, ahora): cada mensaje, ya apuntado aquí;
// alCortar(): se ha cortado (ya sin presencia); conectado(): la línea de estado cuando se está conectado (y el
// servidor no es antiguo); bienvenida(direccion): el aviso al conectar; avisar(texto, mal); alEstado(texto).
// lo que se guarda del aspecto de otro: cuerpo, ropa, personalización y, si vienen, los tintes y la hechura de su ropa
// `llevado`: lo que se ve que lleva (src/logica/llevado.js), lo pone el servidor; se comprueba otra vez al llegar
const deAspecto = (a) => ({ sexo: a.sexo, capas: a.capas, aspecto: a.aspecto, ...(a.tintes ? { tintes: a.tintes } : {}), ...(a.hechuras ? { hechuras: a.hechuras } : {}),
  ...(a.llevado ? { llevado: normalizarLlevado(a.llevado) } : {}) });

// Siempre en línea (valravnx, 30 oct): sin servidor no se juega. Si no se puede conectar, o se corta y no vuelve a
// intentarlo, un cartel tapa el juego con el motivo y un botón para volver a intentarlo (recarga la página).
function sinConexion(texto) {
  quitarSinConexion();
  const c = document.createElement('div');
  c.id = 'sinConexion';
  c.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:#1a1612cc;font:15px/1.4 system-ui,sans-serif;color:#f1e8d8';
  c.innerHTML = '<div style="background:rgba(36,30,24,.95);border-radius:14px;padding:18px 20px;max-width:360px;text-align:center;box-shadow:0 10px 40px #0006">' +
    `<b style="display:block;font-size:17px;color:#d9a441;margin-bottom:6px">${tr('Sin conexión')}</b><div id="sinConexionTexto"></div>` +
    `<div style="font-size:13px;opacity:.75;margin:6px 0 12px">${tr('El juego es siempre en línea: sin servidor no se puede jugar.')}</div>` +
    `<button id="btnReintentar" style="font:inherit;font-weight:600;color:#241b10;background:#d9a441;border:0;border-radius:9px;padding:8px 14px;cursor:pointer">${tr('Volver a intentarlo')}</button>` +
    `<button id="btnSinConexionMenu" style="font:inherit;color:#f1e8d8;background:transparent;border:1px solid #f1e8d833;border-radius:9px;padding:8px 14px;margin-left:8px;cursor:pointer">${tr('Menú')}</button></div>`;
  c.querySelector('#sinConexionTexto').textContent = texto;
  c.querySelector('#btnReintentar').onclick = () => location.reload();
  // al menú de la demo (para elegir personaje mientras tanto): la misma página sin la parte
  c.querySelector('#btnSinConexionMenu').onclick = () => { const p = new URLSearchParams(location.search); p.delete('modo'); p.delete('enlinea'); const q = p.toString(); location.href = location.pathname + (q ? '?' + q : ''); };
  document.body.appendChild(c);
}
function quitarSinConexion() { const c = document.getElementById('sinConexion'); if (c) c.remove(); }

export function abrirCliente({ alAbrir, alMensaje, alCortar, conectado, bienvenida, avisar, alEstado }) {
  const direccion = direccionServidor();
  let con = null, estado = 'conectando', antiguo = false, yo = null;   // antiguo: el servidor es de una versión anterior al juego
  const enviar = (m) => !!con && con.enviar(m);
  const presencia = new PresenciaCliente(enviar);
  const aspectos = new Map();   // autor → { sexo, capas, aspecto }

  const ponerEstado = () => alEstado(estado === 'conectado' ? (antiguo ? tr('En línea · el servidor es antiguo: hay que actualizarlo') : conectado())
    : estado === 'conectando' ? tr('Conectando con el servidor…')
    : estado === 'volviendo' ? tr('Volviendo a conectar…') : tr('Sin conexión'));
  ponerEstado();

  con = abrirConexion(direccion, {
    alAbrir: () => alAbrir(enviar),
    alMensaje: (msg) => {
      const ahora = performance.now();
      const volvia = estado === 'volviendo';
      presencia.recibir(msg, ahora);
      if (msg.tipo === 'bienvenida') {
        quitarSinConexion();
        estado = 'conectado'; yo = msg.autor; antiguo = servidorAntiguo(msg);
        for (const a of msg.aspectos || []) aspectos.set(a.autor, deAspecto(a));
      } else if (msg.tipo === 'aspecto') aspectos.set(msg.autor, deAspecto(msg));
      else if (msg.tipo === 'sale') aspectos.delete(msg.autor);
      else if (msg.tipo === 'error') console.warn('Servidor:', msg.motivo);
      alMensaje(msg, ahora);
      if (msg.tipo === 'bienvenida') {
        avisar(volvia ? tr('Conexión recuperada: sigues con el mismo personaje.') : bienvenida(direccion), false);
        if (antiguo && !volvia) avisar(tr('El servidor es de una versión anterior al juego y no funciona del todo: quien lleva el servidor tiene que actualizarlo.'), true);
      }
      ponerEstado();
    },
    alCortar: ({ motivo, vuelve }) => {
      const antes = estado; estado = vuelve ? 'volviendo' : 'cortado'; yo = null;
      presencia.remotos.clear();
      alCortar();
      ponerEstado();
      if (!vuelve) sinConexion(motivo === 'otra' ? tr('Has entrado con este personaje desde otra pestaña o aparato.') : tr('No hay conexión con el servidor.'));
      if (antes === 'volviendo' && vuelve) return;   // sigue intentándolo: ya se ha avisado
      avisar(motivo === 'otra' ? tr('Has entrado con este personaje desde otra pestaña o aparato.')
        : motivo === 'inunda' ? tr('El servidor ha cerrado la conexión: demasiados mensajes.')
        : vuelve ? tr('Se ha cortado la conexión con el servidor: volviendo a conectar…')
        : antes === 'conectado' ? tr('Se ha perdido la conexión con el servidor.') : tr('No se puede conectar con el servidor: {d}', { d: direccion }), true);
    },
  });

  return {
    direccion, presencia, aspectos, enviar, ponerEstado,
    get yo() { return yo; },
    get estado() { return estado; },
    get antiguo() { return antiguo; },
    cortar() { if (con) con.cortar(); },   // para las pruebas: como si se cayera la conexión
    cerrar() { if (con) con.cerrar(); },
  };
}
