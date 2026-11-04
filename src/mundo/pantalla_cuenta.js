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
// - El correo (valravnx, 2 nov): obligatorio al crear la cuenta. Al crearla llega un código de 6 cifras a ese correo y
//   la pantalla pasa a «Confirma tu correo»: hasta escribirlo no se entra en el mundo (lo decide el servidor). Desde ahí
//   se puede pedir otro código o cambiar el correo. Una cuenta de antes, sin correo, ve esa misma pantalla para añadirlo.
// - Recuperar la contraseña (valravnx, 2 nov): desde «Entrar», «¿Has olvidado la contraseña?». Con el usuario o el
//   correo llega un código al correo confirmado; con él y la contraseña nueva se entra como al entrar (la ficha nueva y
//   a recargar). En los demás aparatos se cierra la sesión.
// El usuario se guarda en el navegador para que el menú lo enseñe y deje salir de la cuenta (src/demo/main.js).
import { motivoUsuario, motivoClave, USUARIO_MAX, CLAVE_MAX } from '../logica/cuentas.js';
import { motivoCorreo, codigoValido, CORREO_MAX, CODIGO_CIFRAS } from '../logica/correo.js';
import { guardarFicha } from './conexion.js';
import { tr, idioma } from '../idioma.js';

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
  r = m.match(/^Demasiadas cuentas nuevas ahora mismo; prueba dentro de (\d+) min\.$/);
  if (r) return tr('Demasiadas cuentas nuevas ahora mismo; prueba dentro de {m} min.', { m: r[1] });
  r = m.match(/^Espera (\d+) s para pedir otro código\.$/);
  if (r) return tr('Espera {s} s para pedir otro código.', { s: r[1] });
  r = m.match(/^Demasiados códigos; prueba dentro de (\d+) min\.$/);
  if (r) return tr('Demasiados códigos; prueba dentro de {m} min.', { m: r[1] });
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
#pantallaCuenta .pc-enlaces{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px}
#pantallaCuenta .pc-enlace{font:inherit;font-size:13px;color:#d9a441;background:none;border:0;padding:2px 0;cursor:pointer;text-decoration:underline}
#pantallaCuenta .pc-enlace:disabled{opacity:.5;cursor:default}
#pantallaCuenta #pcCodigo{font-size:22px;letter-spacing:.35em;text-align:center;font-variant-numeric:tabular-nums}
#pantallaCuenta [hidden]{display:none!important}`;

// enviar(m): manda un mensaje al servidor (false si no hay conexión); direccion: la del servidor (para guardar la ficha);
// alCrear(usuario): la cuenta se ha creado (falta confirmar el correo); alConfirmar(msg): correo confirmado (se sigue
// jugando); verificar: { correo (enmascarado) | null } para abrir directamente en «Confirma tu correo» (una cuenta con el
// correo sin confirmar). Devuelve { recibir(msg), quitar(), get abierta, get modo }.
export function pantallaCuenta({ enviar, direccion, alCrear, alConfirmar, verificar = null }) {
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
    <div data-para="crear"><label for="pcCorreo">${tr('Correo')}</label>
    <input id="pcCorreo" name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="${CORREO_MAX}"></div>
    <label for="pcClave">${tr('Contraseña')}</label>
    <input id="pcClave" name="password" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}">
    <div data-para="crear"><label for="pcClave2">${tr('Repite la contraseña')}</label>
    <input id="pcClave2" name="password2" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}"></div>
    <div class="pc-motivo" id="pcMotivo" role="status"></div>
    <div class="pc-botones"><button type="submit" class="pc-ir" id="pcIr">${tr('Crear cuenta')}</button><button type="button" class="pc-menu" id="pcMenu">${tr('Menú')}</button></div>
    <div class="pc-enlaces" data-para="entrar" hidden><button type="button" class="pc-enlace" id="pcOlvido">${tr('¿Has olvidado la contraseña?')}</button></div>
  </form>
  <form class="pc-caja" id="pcFormRecuperar" novalidate autocomplete="on" hidden>
    <h2>${tr('Recuperar la contraseña')}</h2>
    <p class="pc-texto" id="pcTextoRecuperar"></p>
    <div id="pcPaso1"><label for="pcQuien">${tr('Usuario o correo')}</label>
    <input id="pcQuien" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="${CORREO_MAX}"></div>
    <div id="pcPaso2" hidden><label for="pcCodigoR">${tr('Código')}</label>
    <input id="pcCodigoR" name="one-time-code" inputmode="numeric" autocomplete="one-time-code" maxlength="${CODIGO_CIFRAS}" pattern="[0-9]*">
    <label for="pcClaveN">${tr('Contraseña nueva')}</label>
    <input id="pcClaveN" name="password" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}">
    <label for="pcClaveN2">${tr('Repite la contraseña')}</label>
    <input id="pcClaveN2" name="password2" type="password" autocomplete="new-password" maxlength="${CLAVE_MAX}"></div>
    <div class="pc-motivo" id="pcMotivoR" role="status"></div>
    <div class="pc-botones"><button type="submit" class="pc-ir" id="pcIrR">${tr('Mandar código')}</button><button type="button" class="pc-menu" id="pcVolver">${tr('Volver')}</button></div>
    <div class="pc-enlaces"><button type="button" class="pc-enlace" id="pcOtroR" hidden>${tr('Mandar otro código')}</button></div>
  </form>
  <form class="pc-caja" id="pcFormCorreo" novalidate autocomplete="off" hidden>
    <h2>${tr('Confirma tu correo')}</h2>
    <p class="pc-texto" id="pcTextoCorreo"></p>
    <div id="pcConCodigo"><label for="pcCodigo">${tr('Código')}</label>
    <input id="pcCodigo" name="one-time-code" inputmode="numeric" autocomplete="one-time-code" maxlength="${CODIGO_CIFRAS}" pattern="[0-9]*"></div>
    <div id="pcNuevoCorreo" hidden><label for="pcCorreo2">${tr('Correo')}</label>
    <input id="pcCorreo2" name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="${CORREO_MAX}"></div>
    <div class="pc-motivo" id="pcMotivoCorreo" role="status"></div>
    <div class="pc-botones"><button type="submit" class="pc-ir" id="pcIrCorreo">${tr('Confirmar')}</button><button type="button" class="pc-menu" id="pcMenu2">${tr('Menú')}</button></div>
    <div class="pc-enlaces"><button type="button" class="pc-enlace" id="pcReenviar">${tr('Mandar otro código')}</button><button type="button" class="pc-enlace" id="pcCambiar">${tr('Cambiar el correo')}</button></div>
  </form>`;
  document.body.appendChild(caja);
  const $ = (s) => caja.querySelector(s);
  const usuario = $('#pcUsuario'), clave = $('#pcClave'), clave2 = $('#pcClave2'), motivo = $('#pcMotivo'), ir = $('#pcIr');
  const correo = $('#pcCorreo'), formCorreo = $('#pcFormCorreo'), codigo = $('#pcCodigo'), correo2 = $('#pcCorreo2'), motivoC = $('#pcMotivoCorreo'), irC = $('#pcIrCorreo');
  let que = 'crear', esperando = null, n = 0, modo = 'cuenta', cambiando = false, correoVisto = null;

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
  const irAlMenu = () => { const p = new URLSearchParams(location.search); p.delete('modo'); p.delete('enlinea'); const q = p.toString(); location.href = location.pathname + (q ? '?' + q : ''); };
  $('#pcMenu').onclick = irAlMenu; $('#pcMenu2').onclick = irAlMenu;
  $('form').onsubmit = (ev) => {
    ev.preventDefault();
    if (esperando) return;
    const u = usuario.value.trim(), c = clave.value;
    const co = correo.value.trim();
    const m = motivoUsuario(u) || (que === 'crear' ? motivoCorreo(co) || motivoClave(c, u) || (c !== clave2.value ? 'Las dos contraseñas no son iguales.' : null) : (c ? null : 'Falta la contraseña.'));
    if (m) return decir(tr(m));
    const id = ++n;   // el servidor solo devuelve ids enteros
    if (!enviar({ tipo: 'cuenta', id, que, usuario: u, clave: c, ...(que === 'crear' ? { correo: co, idioma } : {}) })) return decir(tr('No hay conexión con el servidor.'));
    esperando = { id, que, usuario: u, correo: co };
    ir.disabled = true; decir(tr('Un momento…'), true);
  };

  // --- «Recuperar la contraseña»
  const formR = $('#pcFormRecuperar'), quien = $('#pcQuien'), motivoR = $('#pcMotivoR'), irR = $('#pcIrR');
  let paso = 1, quienVisto = '';
  const decirR = (t, bien = false) => { motivoR.textContent = t || ''; motivoR.classList.toggle('bien', !!bien); };
  function verRecuperar(p) {
    modo = 'recuperar'; paso = p;
    $('form').hidden = true; formCorreo.hidden = true; formR.hidden = false;
    $('#pcPaso1').hidden = p !== 1; $('#pcPaso2').hidden = p !== 2; $('#pcOtroR').hidden = p !== 2;
    $('#pcTextoRecuperar').textContent = p === 1
      ? tr('Escribe tu usuario o tu correo. Si tu cuenta tiene el correo confirmado, te llegará un código para poner otra contraseña.')
      : tr('Escribe el código que te ha llegado (caduca en 15 minutos) y tu contraseña nueva. Se cerrará la sesión en tus demás aparatos.');
    irR.textContent = p === 1 ? tr('Mandar código') : tr('Cambiar la contraseña');
    setTimeout(() => { try { (p === 1 ? quien : $('#pcCodigoR')).focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }, 0);
  }
  const pedirR = (m) => {
    if (esperando) return;
    const id = ++n;
    if (!enviar({ tipo: 'cuenta', id, idioma, ...m })) return decirR(tr('No hay conexión con el servidor.'));
    esperando = { id, que: m.que };
    irR.disabled = true; decirR(tr('Un momento…'), true);
  };
  $('#pcOlvido').onclick = () => { if (esperando) return; if (usuario.value.trim()) quien.value = usuario.value.trim(); decirR(''); verRecuperar(1); };
  $('#pcVolver').onclick = () => { if (esperando) return; modo = 'cuenta'; formR.hidden = true; $('form').hidden = false; elegir('entrar'); };
  $('#pcOtroR').onclick = () => pedirR({ que: 'recuperar', quien: quienVisto });
  formR.onsubmit = (ev) => {
    ev.preventDefault();
    if (esperando) return;
    if (paso === 1) {
      const q = quien.value.trim();
      if (!q) return decirR(tr('Escribe tu usuario o tu correo.'));
      quienVisto = q;
      return pedirR({ que: 'recuperar', quien: q });
    }
    const c = $('#pcCodigoR').value.trim(), k = $('#pcClaveN').value;
    const m = !codigoValido(c) ? tr('El código son {n} cifras.', { n: CODIGO_CIFRAS })
      : motivoClave(k, quienVisto.includes('@') ? null : quienVisto) ? tr(motivoClave(k, quienVisto.includes('@') ? null : quienVisto))
      : k !== $('#pcClaveN2').value ? tr('Las dos contraseñas no son iguales.') : null;
    if (m) return decirR(m);
    pedirR({ que: 'restablecer', quien: quienVisto, codigo: c, clave: k });
  };

  // --- «Confirma tu correo»
  const decirC = (t, bien = false) => { motivoC.textContent = t || ''; motivoC.classList.toggle('bien', !!bien); };
  function verCorreo(c, aviso) {
    modo = 'correo';
    $('form').hidden = true; formCorreo.hidden = false;
    if (typeof c === 'string') correoVisto = c;
    cambiando = !correoVisto;   // sin correo (cuenta de antes): hay que poner uno
    $('#pcConCodigo').hidden = cambiando; $('#pcNuevoCorreo').hidden = !cambiando;
    $('#pcReenviar').hidden = cambiando; $('#pcCambiar').hidden = cambiando;
    $('#pcTextoCorreo').textContent = cambiando
      ? tr('Tu cuenta aún no tiene correo. Añádelo y confírmalo con el código que te llegará para entrar en el mundo.')
      : tr('Te hemos mandado un código de {n} cifras a {c}. Escríbelo aquí para entrar en el mundo. Caduca en 15 minutos.', { n: CODIGO_CIFRAS, c: correoVisto });
    irC.textContent = cambiando ? tr('Mandar código') : tr('Confirmar');
    decirC(aviso ? traducirMotivo(aviso) : '');
    setTimeout(() => { try { (cambiando ? correo2 : codigo).focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }, 0);
  }
  const pedirC = (m) => {
    if (esperando) return false;
    const id = ++n;
    if (!enviar({ tipo: 'cuenta', id, idioma, ...m })) { decirC(tr('No hay conexión con el servidor.')); return false; }
    esperando = { id, que: m.que, correo: m.correo };
    irC.disabled = true; decirC(tr('Un momento…'), true);
    return true;
  };
  formCorreo.onsubmit = (ev) => {
    ev.preventDefault();
    if (esperando) return;
    if (cambiando) {
      const c = correo2.value.trim(), m = motivoCorreo(c);
      if (m) return decirC(tr(m));
      pedirC({ que: 'correo', correo: c });
    } else {
      const c = codigo.value.trim();
      if (!codigoValido(c)) return decirC(tr('El código son {n} cifras.', { n: CODIGO_CIFRAS }));
      pedirC({ que: 'verificar', codigo: c });
    }
  };
  $('#pcReenviar').onclick = () => pedirC({ que: 'reenviar' });
  $('#pcCambiar').onclick = () => { if (esperando) return; correoVisto = null; verCorreo(null); };
  if (verificar) verCorreo(verificar.correo || null);
  else setTimeout(() => { try { usuario.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }, 0);

  const pantalla = {
    get abierta() { return caja.isConnected; },
    get modo() { return modo; },
    quitar() { caja.remove(); },
    // la respuesta del servidor a lo que se pidió
    recibir(msg) {
      if (!msg || msg.tipo !== 'cuenta' || !esperando || msg.id !== esperando.id) return;
      const e = esperando; esperando = null; ir.disabled = false; irC.disabled = false; irR.disabled = false;
      if (e.que === 'recuperar' || e.que === 'restablecer') {
        if (!msg.ok) { decirR(traducirMotivo(msg.motivo)); return; }
        if (e.que === 'recuperar') { verRecuperar(2); decirR(tr(msg.motivo || 'Código mandado. Mira tu correo (también en la carpeta de correo no deseado).'), true); return; }
        if (!msg.ficha) { decirR(tr('Error del servidor.')); return; }
        guardarUsuario(direccion, msg.usuario);
        guardarFicha(direccion, msg.ficha);
        irR.disabled = true; decirR(tr('Contraseña cambiada. Entrando con tu personaje…'), true);
        location.reload();
        return;
      }
      if (e.que === 'verificar' || e.que === 'reenviar' || e.que === 'correo') {
        if (!msg.ok) { decirC(traducirMotivo(msg.motivo)); return; }
        if (e.que === 'verificar') { pantalla.quitar(); if (alConfirmar) alConfirmar(msg); return; }
        codigo.value = '';
        verCorreo(e.que === 'correo' ? e.correo : correoVisto);
        decirC(tr('Código mandado. Mira tu correo (también en la carpeta de correo no deseado).'), true);
        return;
      }
      if (!msg.ok) { decir(traducirMotivo(msg.motivo)); return; }
      guardarUsuario(direccion, msg.usuario || e.usuario);
      if (e.que === 'crear') {
        if (alCrear) alCrear(msg.usuario || e.usuario, msg);
        // falta confirmar el correo (un servidor de antes del correo no lo pide: se sigue jugando)
        if (msg.correo && !msg.correo.verificado) verCorreo(e.correo, msg.aviso);
        else pantalla.quitar();
        return;
      }
      // entrar: la ficha de tu personaje, y a volver a entrar con ella
      if (!msg.ficha) { decir(tr('Error del servidor.')); return; }
      guardarFicha(direccion, msg.ficha);
      ir.disabled = true; decir(tr('Entrando con tu personaje…'), true);
      location.reload();
    },
  };
  return pantalla;
}
