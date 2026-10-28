// Kinhold — «Duelo en línea» (hito 1f): la conexión del duelo con el servidor.
// El servidor resuelve los golpes, las heridas y las flechas (src/logica/combate_servidor.js); aquí solo se
// mandan las intenciones del jugador y su posición, y se reciben las fotos de los luchadores y los eventos.
// Cómo se ponen al día las copias: src/logica/combate_cliente.js. Lo dibuja src/combate/main.js.
import { PresenciaCliente } from '../logica/presencia.js';
import { direccionServidor } from '../mundo/direccion_servidor.js';
import { tr } from '../idioma.js';
import { abrirConexion } from '../mundo/conexion.js';

// aspecto(): { sexo, capas } propio; equipo(): { arma, armadura } propio
// alMensaje(msg, ahora): cada mensaje del servidor; alEstado(texto): línea de estado; avisar(texto, tipo)
export function conectarDuelo({ aspecto, equipo, alMensaje, alEstado, avisar }) {
  const direccion = direccionServidor();
  let con = null, estado = 'conectando';
  const enviar = (m) => !!con && con.enviar(m);
  const presencia = new PresenciaCliente(enviar);
  const aspectos = new Map();   // autor → { sexo, capas }
  let yo = null, nRivales = 0;

  const ponerEstado = () => alEstado(estado === 'conectado'
    ? (nRivales ? tr('En línea · {n} en la liza', { n: nRivales }) : tr('En línea · esperando rival'))
    : estado === 'conectando' ? tr('Conectando con el servidor…')
    : estado === 'volviendo' ? tr('Volviendo a conectar…') : tr('Sin conexión'));
  ponerEstado();

  con = abrirConexion(direccion, {
    alAbrir: () => {
      const a = aspecto(); enviar({ tipo: 'aspecto', sexo: a.sexo, capas: a.capas });
      enviar({ tipo: 'combate', que: 'liza' });
      const e = equipo(); enviar({ tipo: 'combate', que: 'equipar', arma: e.arma, armadura: e.armadura });
    },
    alMensaje: (msg) => {
      const ahora = performance.now();
      const volvia = estado === 'volviendo';
      presencia.recibir(msg, ahora);
      if (msg.tipo === 'bienvenida') {
        estado = 'conectado'; yo = msg.autor;
        for (const a of msg.aspectos || []) aspectos.set(a.autor, { sexo: a.sexo, capas: a.capas });
        avisar(volvia ? tr('Conexión recuperada: sigues con el mismo personaje.') : tr('En línea: duelo en el servidor ({d}).', { d: direccion }), 'aviso');
      } else if (msg.tipo === 'aspecto') aspectos.set(msg.autor, { sexo: msg.sexo, capas: msg.capas });
      else if (msg.tipo === 'sale') aspectos.delete(msg.autor);
      else if (msg.tipo === 'error') console.warn('Servidor:', msg.motivo);
      alMensaje(msg, ahora);
      ponerEstado();
    },
    alCortar: ({ motivo, vuelve }) => {
      const antes = estado; estado = vuelve ? 'volviendo' : 'cortado'; yo = null;
      presencia.remotos.clear();
      alMensaje({ tipo: 'cortado' }, performance.now());
      ponerEstado();
      if (antes === 'volviendo' && vuelve) return;
      avisar(motivo === 'otra' ? tr('Has entrado con este personaje desde otra pestaña o aparato.')
        : motivo === 'inunda' ? tr('El servidor ha cerrado la conexión: demasiados mensajes.')
        : vuelve ? tr('Se ha cortado la conexión con el servidor: volviendo a conectar…')
        : antes === 'conectado' ? tr('Se ha perdido la conexión con el servidor.') : tr('No se puede conectar con el servidor: {d}', { d: direccion }), 'mal');
    },
  });

  return {
    direccion, presencia, aspectos,
    get yo() { return yo; },
    get estado() { return estado; },
    set rivales(n) { if (n !== nRivales) { nRivales = n; ponerEstado(); } },
    // una intención de combate ({ que, … }); devuelve si se ha mandado
    intencion(m) { return estado === 'conectado' && enviar({ tipo: 'combate', ...m }); },
    mandarAspecto() { const a = aspecto(); enviar({ tipo: 'aspecto', sexo: a.sexo, capas: a.capas }); },
    mandarEquipo() { const e = equipo(); enviar({ tipo: 'combate', que: 'equipar', arma: e.arma, armadura: e.armadura }); },
    // cada fotograma: la posición propia (como mucho 10 veces por segundo)
    paso(propio) { if (estado === 'conectado') presencia.actualizar(performance.now(), propio); },
    ver() { return presencia.ver(performance.now()); },
    cortar() { if (con) con.cortar(); },   // para las pruebas: como si se cayera la conexión
    cerrar() { if (con) con.cerrar(); },
  };
}
