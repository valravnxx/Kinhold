// Kinhold — la pantalla de entrar y de crear cuenta (P1 «Cuentas», revisión del 1 nov con valravnx: «cuentas antes que
// nada»; usuario y contraseña). La pone el cliente común (src/mundo/cliente.js) al llegar la bienvenida del servidor
// cuando el personaje de esta conexión aún no tiene cuenta ({ cuenta: null }); tapa el juego hasta que se crea o se entra.
// - Crear cuenta: el personaje que ya llevas en este navegador (el de su ficha) pasa a la cuenta; no se pierde nada y
//   se sigue jugando sin recargar.
// - Entrar: el servidor da la ficha de tu personaje; se guarda en el navegador (en lugar de la de antes) y la página se
//   recarga para volver a entrar con ella, ya siendo tu personaje. Desde ahí se entra solo, sin volver a pedirla, como
//   hasta ahora con la ficha. Así se entra con tu personaje desde otro aparato.
// - Lo que se puede comprobar aquí (largo del usuario, letras, contraseña) se dice al momento, con las mismas reglas
//   que el servidor (src/logica/cuentas.js); lo demás lo dice el servidor.
// El usuario se guarda en el navegador para que el menú lo enseñe y deje salir de la cuenta (src/demo/main.js).
import { motivoUsuario, motivoClave, USUARIO_MAX, CLAVE_MAX } from '../logica/cuentas.js';
import { guardarFicha } from './conexion.js';
import { tr } from '../idioma.js';

export const CLAVE_CUENTA = 'kinhold_cuenta:';
export const guardarUsuario = (direccion, u) => { try { if (u) localStorage.setItem(CLAVE_CUENTA + direccion, u); else localStorage.removeItem(CLAVE_CUENTA + direccion); } catch (e) { /* sin almacenamiento */ } };
export const usuarioGuardado = (direccion) => { try { return localStorage.getItem(CLAVE_CUENTA + direccion) || null; } catch (e) { return null; } };

// Los motivos del servidor llegan en español: los que llevan minutos se traducen con su número.
function traducirMotivo(m) {
  if (typeof m !== 'string') return tr('Error del servidor.');
  let r = m.match(/^Demasiados intentos; prueba dentro de (\d+) min\.$/);
  if (r) return tr('Demasiados intentos; prueba dentro de {m} min.', { m: r[1] });
  r = m.match(/^Demasiadas cuentas nuevas desde aquí; prueba dentro de (\d+) min\.$/);
  if (r) return tr('Demasiadas cuentas nuevas desde aquí; prueba dentro de {m} min.', { m: r[1] });
  return tr(m);
}

const ESTILO = `
#pantallaCuenta{position:fixed;inset:0;z-index:58;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
  background:#1a1612d9;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f1e8d8;overflow:auto}
#pantallaCuenta *{box-sizing:border-box}
#pantallaCuenta .pc-caja{background:rgba(36,30,24,.96);border-radius:14px;padding:18px 20px 16px;width:min(380px,100%);box-shadow:0 10px 40px #0006}
#pantallaCuenta h2{margin:0 0 2px;font:600 22px/1.15 Georgia,"Times New Roman",serif;letter-spacing:.04em}
#pantallaCuenta .pc-pestanas{display:flex;gap:6px;margin:12px 0 10px}
#pantallaCuenta .pc-pestanas button{flex:1;font:inherit;font-size:14px;color:#f1e8d8;background:rgba(58,48,38,.92);border:1px solid #f1e8d826;border-radius:9px;padding:8px;cursor:pointer}
#pantallaCuenta .pc-pestanas button.sel{background:#d9a441;color:#241b10;border-color:transparent;font-weight:600}
#pantallaCuenta .pc-texto{font-size:13px;color:#bfb19a;margin:0 0 10px}
#pantallaCuenta label{display:block;font-size:13px;color:#bfb19a;margin:8px 0 3px}
#pantallaCuenta input{display:block;width:100%;font:inherit;font-size:16px;color:#f1e8d8;background:#0003;border:1px solid #f1e8d833;border-radius:8px;padding:9px 10px}
#pantallaCuenta input:focus{outline:none;border-color:#d9a441}
#pantallaCuenta .pc-motivo{min-height:1.4em;font-size:13px;color:#f0a58a;margin:8px 0 0}
#pantallaCuenta .pc-motivo.bien{color:#b9d39a}
#pantallaCuenta .pc-botones{display:flex;gap:8px;margin-top:10px}
#pantallaCuenta .pc-botones button{font:inherit;border-radius:9px;padding:9px 14px;cursor:pointer}
#pantallaCuenta .pc-ir{flex:1;font-weight:600;color:#241b10;background:#d9a441;border:0}
#pantallaCuenta .pc-ir:disabled{opacity:.6;cursor:default}
#pantallaCuenta .pc-menu{color:#f1e8d8;background:transparent;border:1px solid #f1e8d833}
#pantallaCuenta [hidden]{display:none!important}`;

// enviar(m): manda un mensaje al servidor (false si no hay conexión); direccion: la del servidor (para guardar la ficha);
// alCrear(usuario): la cuenta se ha creado (se sigue jugando). Devuelve { recibir(msg), quitar(), get abierta }.
export function pantallaCuenta({ enviar, direccion, alCrear }) {
  let caja = document.getElementById('pantallaCuenta');
  if (caja) caja.remove();
  if (!document.getElementById('pantallaCuentaEstilo')) {
    const st = document.createElement('style'); st.id = 'pantallaCuentaEstilo'; st.textContent = ESTILO; document.head.appendChild(st);
  }
  caja = document.createElement('div');
  caja.id = 'pantallaCuenta';
  caja.innerHTML = `<form class="pc-caja" novalidate autocomplete="on">
    <h2>${tr('Tu cuenta')}</h2>
    <div class="pc-pestanas"><button type="button" data-que="crear" class="sel">${tr('Crear cuenta')}</button><button type="button" data-que="entrar">${tr('Entrar')}</button></div>
    <p class="pc-texto" data-para="crear">${tr('Crea tu cuenta para guardar tu personaje y entrar con él desde cualquier aparato. El personaje que ya llevas en este navegador pasa a tu cuenta, con todo lo suyo.')}</p>
    <p class="pc-texto" data-para="entrar" hidden>${tr('Si ya tienes cuenta, entra con ella para seguir con tu personaje, también desde otro aparato.')}</p>
    <label for="pcUsuario">${tr('Usuario')}</label>
    <input id="pcUsuario" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="${USUARIO_MAX}">
    <label for="pcClave">${tr('Contraseña')}</label>
    <input id="pcClave" name="password" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}">
    <div data-para="crear"><label for="pcClave2">${tr('Repite la contraseña')}</label>
    <input id="pcClave2" name="password2" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}"></div>
    <div class="pc-motivo" id="pcMotivo" role="status"></div>
    <div class="pc-botones"><button type="submit" class="pc-ir" id="pcIr">${tr('Crear cuenta')}</button><button type="button" class="pc-menu" id="pcMenu">${tr('Menú')}</button></div>
  </form>`;
  document.body.appendChild(caja);
  const $ = (s) => caja.querySelector(s);
  const usuario = $('#pcUsuario'), clave = $('#pcClave'), clave2 = $('#pcClave2'), motivo = $('#pcMotivo'), ir = $('#pcIr');
  let que = 'crear', esperando = null, n = 0;

  const decir = (t, bien = false) => { motivo.textContent = t || ''; motivo.classList.toggle('bien', !!bien); };
  function elegir(q) {
    que = q;
    for (const b of caja.querySelectorAll('.pc-pestanas button')) b.classList.toggle('sel', b.dataset.que === q);
    for (const e of caja.querySelectorAll('[data-para]')) e.hidden = e.dataset.para !== q;
    clave.autocomplete = q === 'crear' ? 'new-password' : 'current-password';
    ir.textContent = q === 'crear' ? tr('Crear cuenta') : tr('Entrar');
    decir('');
  }
  for (const b of caja.querySelectorAll('.pc-pestanas button')) b.onclick = () => { if (!esperando) elegir(b.dataset.que); };
  $('#pcMenu').onclick = () => { const p = new URLSearchParams(location.search); p.delete('modo'); p.delete('enlinea'); const q = p.toString(); location.href = location.pathname + (q ? '?' + q : ''); };
  $('form').onsubmit = (ev) => {
    ev.preventDefault();
    if (esperando) return;
    const u = usuario.value.trim(), c = clave.value;
    const m = motivoUsuario(u) || (que === 'crear' ? motivoClave(c, u) || (c !== clave2.value ? 'Las dos contraseñas no son iguales.' : null) : (c ? null : 'Falta la contraseña.'));
    if (m) return decir(tr(m));
    const id = ++n;   // el servidor solo devuelve ids enteros
    if (!enviar({ tipo: 'cuenta', id, que, usuario: u, clave: c })) return decir(tr('No hay conexión con el servidor.'));
    esperando = { id, que, usuario: u };
    ir.disabled = true; decir(tr('Un momento…'), true);
  };
  setTimeout(() => { try { usuario.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }, 0);

  const pantalla = {
    get abierta() { return caja.isConnected; },
    quitar() { caja.remove(); },
    // la respuesta del servidor a lo que se pidió
    recibir(msg) {
      if (!msg || msg.tipo !== 'cuenta' || !esperando || msg.id !== esperando.id) return;
      const e = esperando; esperando = null; ir.disabled = false;
      if (!msg.ok) { decir(traducirMotivo(msg.motivo)); return; }
      guardarUsuario(direccion, msg.usuario || e.usuario);
      if (e.que === 'crear') { pantalla.quitar(); if (alCrear) alCrear(msg.usuario || e.usuario); return; }
      // entrar: la ficha de tu personaje, y a volver a entrar con ella
      if (!msg.ficha) { decir(tr('Error del servidor.')); return; }
      guardarFicha(direccion, msg.ficha);
      ir.disabled = true; decir(tr('Entrando con tu personaje…'), true);
      location.reload();
    },
  };
  return pantalla;
}
