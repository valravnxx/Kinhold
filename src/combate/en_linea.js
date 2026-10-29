// Kinhold — «Duelo en línea» (hito 1f): la conexión del duelo con el servidor.
// El servidor resuelve los golpes, las heridas y las flechas (src/logica/combate_servidor.js); aquí solo se
// mandan las intenciones del jugador y su posición, y se reciben las fotos de los luchadores y los eventos.
// Cómo se ponen al día las copias: src/logica/combate_cliente.js. Lo dibuja src/combate/main.js.
import { abrirCliente } from '../mundo/cliente.js';
import { tr } from '../idioma.js';

// aspecto(): { sexo, capas, aspecto } propio; equipo(): { arma, armadura } propio
// alMensaje(msg, ahora): cada mensaje del servidor; alEstado(texto): línea de estado; avisar(texto, tipo)
// La conexión, el estado, la presencia y los avisos comunes: src/mundo/cliente.js.
export function conectarDuelo({ aspecto, equipo, alMensaje, alEstado, avisar }) {
  let nRivales = 0;
  const cli = abrirCliente({
    alAbrir: (enviar) => {
      const a = aspecto(); enviar({ tipo: 'aspecto', sexo: a.sexo, capas: a.capas, aspecto: a.aspecto });
      enviar({ tipo: 'combate', que: 'liza' });
      const e = equipo(); enviar({ tipo: 'combate', que: 'equipar', arma: e.arma, armadura: e.armadura });
    },
    alMensaje,
    alCortar: () => alMensaje({ tipo: 'cortado' }, performance.now()),
    conectado: () => nRivales ? tr('En línea · {n} en la liza', { n: nRivales }) : tr('En línea · esperando rival'),
    bienvenida: (d) => tr('En línea: duelo en el servidor ({d}).', { d }),
    avisar: (texto, mal) => avisar(texto, mal ? 'mal' : 'aviso'),
    alEstado,
  });
  const { enviar } = cli;

  return {
    direccion: cli.direccion, presencia: cli.presencia, aspectos: cli.aspectos,
    get yo() { return cli.yo; },
    get estado() { return cli.estado; },
    get antiguo() { return cli.antiguo; },
    set rivales(n) { if (n !== nRivales) { nRivales = n; cli.ponerEstado(); } },
    // una intención de combate ({ que, … }); devuelve si se ha mandado
    intencion(m) { return cli.estado === 'conectado' && enviar({ tipo: 'combate', ...m }); },
    mandarAspecto() { const a = aspecto(); enviar({ tipo: 'aspecto', sexo: a.sexo, capas: a.capas, aspecto: a.aspecto }); },
    mandarEquipo() { const e = equipo(); enviar({ tipo: 'combate', que: 'equipar', arma: e.arma, armadura: e.armadura }); },
    // cada fotograma: la posición propia (como mucho 10 veces por segundo)
    paso(propio) { if (cli.estado === 'conectado') cli.presencia.actualizar(performance.now(), propio); },
    ver() { return cli.presencia.ver(performance.now()); },
    cortar() { cli.cortar(); },   // para las pruebas: como si se cayera la conexión
    cerrar() { cli.cerrar(); },
  };
}
