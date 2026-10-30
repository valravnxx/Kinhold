// Kinhold — el cliente en línea común: lo que hacen igual la construcción (src/juego/en_linea.js) y el duelo
// (src/combate/en_linea.js) al hablar con el servidor. Abre la conexión (src/mundo/conexion.js, que vuelve a conectar
// sola), lleva el estado (conectando, conectado, volviendo, cortado), la presencia de los demás, sus aspectos, si el
// servidor es antiguo, la línea de estado y los avisos de bienvenida y de corte. Cada parte añade solo lo suyo.
import { PresenciaCliente } from '../logica/presencia.js';
import { servidorAntiguo } from '../logica/protocolo.js';
import { direccionServidor } from './direccion_servidor.js';
import { abrirConexion } from './conexion.js';
import { tr } from '../idioma.js';

// alAbrir(enviar): conectado (también al volver); alMensaje(msg, ahora): cada mensaje, ya apuntado aquí;
// alCortar(): se ha cortado (ya sin presencia); conectado(): la línea de estado cuando se está conectado (y el
// servidor no es antiguo); bienvenida(direccion): el aviso al conectar; avisar(texto, mal); alEstado(texto).
// lo que se guarda del aspecto de otro: cuerpo, ropa, personalización y, si vienen, los tintes y la hechura de su ropa
const deAspecto = (a) => ({ sexo: a.sexo, capas: a.capas, aspecto: a.aspecto, ...(a.tintes ? { tintes: a.tintes } : {}), ...(a.hechuras ? { hechuras: a.hechuras } : {}) });

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
        estado = 'conectado'; yo = msg.autor; antiguo = servidorAntiguo(msg);
        for (const a of msg.aspectos || []) aspectos.set(a.autor, deAspecto(a));
      } else if (msg.tipo === 'aspecto') aspectos.set(msg.autor, deAspecto(msg));
      else if (msg.tipo === 'sale') aspectos.delete(msg.autor);
      else if (msg.tipo === 'error') console.warn('Servidor:', msg.motivo);
      alMensaje(msg, ahora);
      if (msg.tipo === 'bienvenida') {
        avisar(volvia ? tr('Conexión recuperada: sigues con el mismo personaje.') : bienvenida(direccion), false);
        if (antiguo && !volvia) avisar(tr('El servidor es de una versión anterior al juego y no funciona del todo: quien lo tiene encendido tiene que actualizarlo (cerrar sus ventanas y volver a abrir jugar_en_casa.bat, que baja la última versión).'), true);
      }
      ponerEstado();
    },
    alCortar: ({ motivo, vuelve }) => {
      const antes = estado; estado = vuelve ? 'volviendo' : 'cortado'; yo = null;
      presencia.remotos.clear();
      alCortar();
      ponerEstado();
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
