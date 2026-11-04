// La conexión con el servidor del juego (hito 1f), la que usan la construcción y el duelo en línea.
// - Guarda la ficha que da el servidor en la bienvenida y la manda al volver a conectar (?ficha=…): así se vuelve con
//   el mismo personaje y el mismo luchador. Se guarda en el navegador (localStorage), así que dura aunque se cierre la
//   pestaña (valravnx, 31 oct: al volver a entrar no salía donde lo había dejado); antes iba en sessionStorage, una
//   por pestaña: la de antes se pasa sola. Dos pestañas del mismo navegador son el mismo jugador: entrar en la
//   segunda cierra la primera (como con una cuenta).
// - Si se corta una conexión que estaba hecha, vuelve a conectar sola, esperando cada vez un poco más (1, 2, 4,
//   8 s y luego cada 10 s). No lo hace si el servidor la ha cerrado a propósito: otra conexión con la misma
//   ficha (código 4001), demasiados mensajes (1008) o la sesión cerrada en todos los aparatos (4002: la ficha se olvida).
import { SERVIDOR, SERVIDORES_ANTES } from './direccion_servidor.js';

const CLAVE_FICHA = 'kinhold_ficha:';
const ESPERAS = [1000, 2000, 4000, 8000, 10000];

const leerFicha = (d) => {
  try {
    const f = localStorage.getItem(CLAVE_FICHA + d);
    if (f) return f;
    // la del mismo servidor con su dirección de antes (1 nov: de sslip.io a playkinhold.com), con su cuenta
    if (d === SERVIDOR) for (const a of SERVIDORES_ANTES) {
      const v = localStorage.getItem(CLAVE_FICHA + a);
      if (!v) continue;
      localStorage.setItem(CLAVE_FICHA + d, v); localStorage.removeItem(CLAVE_FICHA + a);
      const u = localStorage.getItem('kinhold_cuenta:' + a);
      if (u) { localStorage.setItem('kinhold_cuenta:' + d, u); localStorage.removeItem('kinhold_cuenta:' + a); }
      return v;
    }
    const vieja = sessionStorage.getItem(CLAVE_FICHA + d);   // la de antes del 31 oct, en la pestaña
    if (vieja) { localStorage.setItem(CLAVE_FICHA + d, vieja); sessionStorage.removeItem(CLAVE_FICHA + d); }
    return vieja;
  } catch (e) { return null; }
};
export const fichaGuardada = (d) => leerFicha(d);
// también la pone la pantalla de la cuenta (src/mundo/pantalla_cuenta.js) al entrar: la de tu personaje
export const guardarFicha = (d, f) => { try { if (f) localStorage.setItem(CLAVE_FICHA + d, f); else localStorage.removeItem(CLAVE_FICHA + d); } catch (e) { /* sin almacenamiento */ } };

export function conDireccionFicha(direccion, ficha) {
  if (!ficha) return direccion;
  return direccion + (direccion.includes('?') ? '&' : '?') + 'ficha=' + encodeURIComponent(ficha);
}

// alAbrir(): conectado (también al volver); alMensaje(msg): cada mensaje (ya leído); alCortar({ motivo, vuelve }):
// se ha cortado; motivo: 'no_conecta' | 'cortada' | 'otra' | 'inunda' | 'sesion'; vuelve: si va a intentar conectar otra vez.
export function abrirConexion(direccion, { alAbrir, alMensaje, alCortar }) {
  let ws = null, hecha = false, cerrada = false, intentos = 0, espera = null;
  const enviar = (m) => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; };

  function abrir() {
    espera = null;
    try { ws = new WebSocket(conDireccionFicha(direccion, leerFicha(direccion))); } catch (e) {
      ws = null; alCortar({ motivo: 'no_conecta', vuelve: false }); return;
    }
    const este = ws;
    este.onopen = () => alAbrir();
    este.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.tipo === 'bienvenida') { hecha = true; intentos = 0; if (msg.ficha) guardarFicha(direccion, msg.ficha); }
      alMensaje(msg);
    };
    este.onclose = (ev) => {
      if (este !== ws) return;
      ws = null;
      if (cerrada) return;
      // otra pestaña o aparato ha entrado con la misma ficha: la ficha sigue (es de las dos), esta se queda fuera
      if (ev.code === 4001) return alCortar({ motivo: 'otra', vuelve: false });
      if (ev.code === 1008) return alCortar({ motivo: 'inunda', vuelve: false });
      // se ha cerrado la sesión en todos los aparatos: la ficha ya no vale, se olvida aquí
      if (ev.code === 4002) { guardarFicha(direccion, null); try { localStorage.removeItem('kinhold_cuenta:' + direccion); } catch (e) { /* sin almacenamiento */ } return alCortar({ motivo: 'sesion', vuelve: false }); }
      if (!hecha) return alCortar({ motivo: 'no_conecta', vuelve: false });
      espera = setTimeout(abrir, ESPERAS[Math.min(intentos++, ESPERAS.length - 1)]);
      alCortar({ motivo: 'cortada', vuelve: true });
    };
  }
  abrir();

  return {
    enviar,
    get abierta() { return !!ws && ws.readyState === 1; },
    // corta la conexión como si se hubiera caído (vuelve a conectar sola): para las pruebas
    cortar() { if (ws) ws.close(); },
    cerrar() { cerrada = true; if (espera) clearTimeout(espera); if (ws) ws.close(); },
  };
}
