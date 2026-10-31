// Kinhold — lo que llevas y lo del suelo cuando se juega en línea (hito «Equipo y carga»): el inventario, los objetos
// del suelo, lo talado y lo recogido son los del servidor (src/logica/objetos_red.js y servidor/servidor.mjs).
//
// - Lo que llega del servidor manda: la bienvenida trae todo; luego llegan lo que llevas tal como queda (después de
//   cada acción tuya, salga bien o mal), el suelo, lo talado y lo recogido cuando cambian (para todos).
// - Las acciones se mandan con { tipo: 'objeto', id, accion } (el autor lo pone el servidor). Las del panel de
//   inventario (mover, ponerse, quitarse y el arcón de pruebas) se adelantan aquí para que el panel no espere a la red;
//   si el servidor no las acepta, lo que llevas vuelve a ser el suyo. Talar, trocear, recoger y soltar o coger del
//   suelo no se adelantan: se espera su respuesta (alResultado), porque lo que cae y lo que queda lo decide él.
// - Un árbol que cae: el servidor avisa a todos con hacia dónde cae y lo que deja; si está a la vista, se ve caer
//   (lo que deja sale cuando llega al suelo, como al talarlo uno mismo).
import { Inventario } from '../logica/inventario.js';

// inventarios: los de main.js; autor: la clave del propio en ellos. sueloObjetos, talaV, recoleccion: lo que los
// dibuja (src/juego/suelo.js, tala.js y recoleccion.js). alCambiar(que): ha cambiado 'inventario', 'suelo', 'tala' o
// 'recoleccion' (para volver a pintar).
export function crearObjetosEnLinea({ inventarios, autor, sueloObjetos, talaV, recoleccion, alCambiar = () => {} }) {
  let enviar = null, id = 0;
  const esperan = new Map();   // id → alResultado
  let deServidor = false;      // si ya ha llegado lo que llevas en el servidor

  function ponerInventario(datos) {
    if (!datos) return;
    const nuevo = Inventario.importarJugador(datos), inv = inventarios.de(autor);
    inv.lugares = nuevo.lugares; inv.apartado = nuevo.apartado;   // el mismo objeto: quien lo tenga a mano lo ve igual
    deServidor = true;
    alCambiar('inventario');
  }
  function ponerSuelo(lista) {
    if (!Array.isArray(lista)) return;
    const s = sueloObjetos.suelo;
    s.objetos = lista.map(o => JSON.parse(JSON.stringify(o)));
    s.siguiente = 1e9;   // lo que se dejara aquí (no se hace en línea) no se confundiría con lo del servidor
    sueloObjetos.refrescar();
    alCambiar('suelo');
  }
  function ponerTala(datos) {
    if (!datos) return;
    talaV.tala.importar(datos); talaV.refrescar();
    alCambiar('tala');
  }
  function ponerRecoleccion(datos) {
    if (!datos) return;
    recoleccion.rec.importar(datos); recoleccion.refrescar();
    alCambiar('recoleccion');
  }
  function talaDeRed(msg) {
    const c = msg.cae || {};
    const o = c.arbol && talaV.porId.get(c.arbol);
    const verCaer = !!(o && o.malla && talaV.enPie(o));
    const deja = Array.isArray(c.objetos) ? c.objetos : [];
    if (verCaer) sueloObjetos.esconder(deja);   // el suelo llega justo detrás: lo que deja, cuando el árbol esté en el suelo
    ponerTala(msg.estado);
    if (verCaer) talaV.caer(o, c.dir || 0, deja);
  }

  return {
    get deServidor() { return deServidor; },
    conectar(f) { enviar = f; },
    desconectar() { enviar = null; for (const f of esperan.values()) f({ ok: false, motivo: 'Sin conexión con el servidor.' }); esperan.clear(); },
    // Manda una acción; alResultado(r) con { ok, motivo? , …lo que ha pasado } cuando conteste.
    mandar(accion, alResultado = null) {
      if (!enviar) { if (alResultado) alResultado({ ok: false, motivo: 'Sin conexión con el servidor.' }); return false; }
      const n = ++id;
      if (alResultado) esperan.set(n, alResultado);
      enviar({ tipo: 'objeto', id: n, accion });
      return true;
    },
    // Un mensaje del servidor. Devuelve true si era de los suyos.
    recibir(msg) {
      switch (msg.tipo) {
        case 'bienvenida':
          for (const f of esperan.values()) f({ ok: false, motivo: 'Sin conexión con el servidor.' });
          esperan.clear();
          ponerInventario(msg.inventario); ponerSuelo(msg.suelo); ponerTala(msg.tala); ponerRecoleccion(msg.recoleccion);
          return true;
        case 'inventario': ponerInventario(msg.inventario); return true;
        case 'suelo': ponerSuelo(msg.objetos); return true;
        case 'tala': talaDeRed(msg); return true;
        case 'recoleccion': ponerRecoleccion(msg.estado); return true;
        case 'resultado_objeto': {
          const f = esperan.get(msg.id); esperan.delete(msg.id);
          if (f) f(msg.ok ? { ...(msg.datos || {}), ok: true } : { ok: false, motivo: msg.motivo || 'El servidor no lo ha aceptado.' });
          return true;
        }
      }
      return false;
    },
  };
}
