// Kinhold — demo única: una sola página con menú (Jugar, Duelo, Personaje). Siempre en línea (valravnx, 30 oct).
// Cada parte es el prototipo de siempre; se elige con ?modo= y la página se recarga al cambiar, para que cada
// parte empiece limpia (sin dos escenas ni dos WebGL a la vez). three.js va una sola vez en el archivo: las
// partes se cargan con import() y solo se ejecuta la elegida.
// El personaje que se elige en «Personaje» (cuerpo y ropa) es el que sale en la construcción y en el duelo
// (src/mundo/eleccion.js). Junto a «Menú», los fotogramas por segundo y el detalle del rendimiento.
import PLANTILLAS from 'plantillas-demo';
import { tr, traducirPagina, botonesIdioma, idioma } from '../idioma.js';
import { personajeElegido } from '../mundo/eleccion.js';
import { VERSION_DEMO, REGISTRO_DEMO } from './registro.js';
import { CAPAS } from '../personaje/textos.js';
import { ponerRendimiento } from './rendimiento.js';
import { medidaRendimiento, genteDePrueba, tomarMedida, datosAparato } from '../mundo/rendimiento.js';
import { generar, SEMILLA_MUNDO, LADO_MUNDO } from '../logica/mapa.js';
import { usuarioGuardado, guardarUsuario } from '../mundo/pantalla_cuenta.js';
import { motivoClave } from '../logica/cuentas.js';
import { motivoCorreo, codigoValido, CODIGO_CIFRAS } from '../logica/correo.js';
import { guardarFicha, fichaGuardada, conDireccionFicha } from '../mundo/conexion.js';
import { direccionServidor } from '../mundo/direccion_servidor.js';
import { cargarNaturaleza, carpetaNaturaleza } from '../mundo/naturaleza_meshy.js';
import { cargarTexturasSuelo, carpetaSuelo } from '../mapa/suelo.js';
import { recursosTaller } from '../mundo/eleccion.js';

const MODOS = {
  // (la naturaleza de Meshy se carga antes de entrar: el mundo la pone al empezar; si no llega, la de código)
  construir: { carga: () => Promise.all([cargarNaturaleza(carpetaNaturaleza(recursosTaller())), cargarTexturasSuelo(carpetaSuelo(recursosTaller()))]).then(() => import('../juego/main.js')), menu: '#menu', nombre: 'Jugar' },
  personaje: { carga: () => import('../personaje/main.js'), menu: '#estilos', nombre: 'Personaje' },
};
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.get('modo') === 'duelo') { params.set('modo', 'construir'); history.replaceState(null, '', location.pathname + '?' + params); }
const modo = params.get('modo');

// «Duelo» ya no está (valravnx, 31 oct: «ya está integrado en jugar […] está todo 100 % online en solo jugar»): se lucha
// en el mundo; un enlace de antes a ?modo=duelo lleva a «Jugar».
// Siempre en línea (valravnx, 30 oct): «Jugar» va siempre al servidor (src/mundo/direccion_servidor.js); ya no
// hay modo en solitario en el menú. Solo para las pruebas automáticas, ?sinservidor=1 deja entrar sin servidor (como antes
// del 30 oct), para probar el juego sin levantar uno; no sale en ningún botón.
const SIN_SERVIDOR = params.get('sinservidor') === '1';
const VAN_EN_LINEA = new Set(['construir']);
const redirige = VAN_EN_LINEA.has(modo) && !SIN_SERVIDOR && params.get('enlinea') !== '1';   // un enlace de antes, sin enlinea
if (redirige) location.replace(enlace(modo));

// enlace a otra parte de la demo, conservando el resto de parámetros (idioma, carpetas de recursos)
function enlace(m) {
  const p = new URLSearchParams(location.search);
  if (m) p.set('modo', m); else p.delete('modo');
  if (m && VAN_EN_LINEA.has(m) && !SIN_SERVIDOR) p.set('enlinea', '1'); else p.delete('enlinea');
  const q = p.toString();
  return location.pathname + (q ? '?' + q : '');
}

function resumenPersonaje() {
  const e = personajeElegido();
  if (!e) return tr('Aún no has elegido personaje: hombre con camisa y calzas de lino.');
  const lista = e.capas.map(c => tr(CAPAS[c] || c));
  let ropa = tr('camisa y calzas');
  try { if (lista.length) ropa = new Intl.ListFormat(idioma, { type: 'conjunction' }).format(lista); } catch (err) { ropa = lista.join(', '); }
  return tr('Tu personaje: {s}, con {r}.', { s: tr(e.sexo === 'mujer' ? 'mujer' : 'hombre'), r: ropa.toLowerCase() });
}

if (redirige) {
  // se va a la misma parte, en línea
} else if (MODOS[modo]) {
  // una parte: su estilo y su página, un botón «Menú» con sus otros botones, y su código
  const pl = PLANTILLAS[modo];
  $('demoMenu').remove();
  const st = document.createElement('style'); st.textContent = pl.estilo; document.head.appendChild(st);
  document.body.insertAdjacentHTML('afterbegin', pl.cuerpo);
  document.title = 'Kinhold · ' + MODOS[modo].nombre;
  const caja = document.querySelector(MODOS[modo].menu);
  const b = document.createElement('button');
  b.id = 'btnDemoMenu'; b.textContent = 'Menú';
  b.onclick = () => { location.href = enlace(null); };
  // en el juego, el menú con pestañas (src/juego/menu_juego.js) lo lleva al pie, el último, como «Salir»
  const pieJuego = caja && caja.closest('#hubPie');
  if (pieJuego) { b.textContent = tr('Salir'); caja.append(b); }
  else if (caja) caja.prepend(b); else { b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9'; document.body.appendChild(b); }
  window.__demo = { modo, listo: false };
  window.__rendimiento = { medida: medidaRendimiento, gente: (n) => genteDePrueba() && genteDePrueba().poner(n),
    detalle: (si) => genteDePrueba()?.detalle?.(si), niveles: () => genteDePrueba()?.niveles?.(),
    tomar: (s) => tomarMedida(s), aparato: () => datosAparato() };   // (pruebas: la medida para el servidor)
  // los números de rendimiento junto a «Menú» (src/demo/rendimiento.js), cuando la parte ya ha puesto sus botones.
  // Construir va en el mundo de verdad (Whitholm, la isla de los playtests): antes se genera el mapa del mundo, a pasos y
  // con su barra (tarda unos segundos); con ?llano=1, el llano de antes.
  const antes = modo === 'construir' && params.get('llano') !== '1' ? generarMundo() : Promise.resolve();
  antes.then(() => MODOS[modo].carga()).then(() => { ponerRendimiento(b); window.__demo.listo = true; }).catch(e => { window.__demo.error = e.message; console.error(e); });
} else {
  // el menú
  document.title = 'Kinhold';
  traducirPagina();
  botonesIdioma($('demoIdioma'));
  for (const a of document.querySelectorAll('[data-ir]')) a.href = enlace(a.dataset.ir);
  $('demoPersonaje').textContent = resumenPersonaje();
  // la cuenta con la que se entra desde este navegador (src/mundo/pantalla_cuenta.js): salir de ella olvida la ficha de
  // su personaje aquí; al volver a «Jugar» se pide otra vez entrar o crear cuenta (el personaje sigue en la cuenta)
  const dirServidor = direccionServidor(), usuario = usuarioGuardado(dirServidor);
  if (usuario) {
    $('demoCuenta').hidden = false;
    $('demoCuentaTexto').textContent = tr('Cuenta: {u}', { u: usuario });
    const aviso = $('demoCuentaAviso');
    $('btnDemoSalirCuenta').onclick = () => { guardarFicha(dirServidor, null); guardarUsuario(dirServidor, null); $('demoCuenta').hidden = true; };
    // salir en todos los aparatos (cuentas más seguras, 2 nov): se conecta un momento con la ficha de aquí y el servidor
    // deja sin valer todas las fichas de tu personaje (las de los demás aparatos también); luego, como salir de la cuenta
    $('btnDemoSalirTodos').onclick = () => {
      const ficha = fichaGuardada(dirServidor);
      if (!ficha) { guardarUsuario(dirServidor, null); $('demoCuenta').hidden = true; return; }
      aviso.textContent = tr('Un momento…');
      let ws; try { ws = new WebSocket(conDireccionFicha(dirServidor, ficha)); } catch (e) { aviso.textContent = tr('No hay conexión con el servidor.'); return; }
      const fin = setTimeout(() => { aviso.textContent = tr('No hay conexión con el servidor.'); try { ws.close(); } catch (e) { /* nada */ } }, 10000);
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.tipo === 'bienvenida') {
          if (!m.cuenta) { clearTimeout(fin); ws.close(); guardarFicha(dirServidor, null); guardarUsuario(dirServidor, null); $('demoCuenta').hidden = true; return; }
          ws.send(JSON.stringify({ tipo: 'cuenta', id: 1, que: 'salir_todos' }));
        } else if (m.tipo === 'cuenta' && m.id === 1) {
          clearTimeout(fin);
          if (!m.ok) { aviso.textContent = tr(m.motivo || 'Error del servidor.'); return; }
          guardarFicha(dirServidor, null); guardarUsuario(dirServidor, null);
          $('demoCuentaTexto').textContent = tr('Sesión cerrada en todos los aparatos.');
          $('btnDemoSalirCuenta').hidden = $('btnDemoSalirTodos').hidden = $('btnDemoCambiarClave').hidden = $('btnDemoCambiarCorreo').hidden = true; aviso.textContent = ''; form.hidden = true;
        }
      };
      ws.onerror = () => { clearTimeout(fin); aviso.textContent = tr('No hay conexión con el servidor.'); };
    };
    // cambiar la contraseña o el correo (valravnx, 2 nov): pidiendo la actual. Cada vez se conecta un momento con la ficha
    // de aquí y pide el cambio. La contraseña: el servidor cierra la sesión en los demás aparatos y da una ficha nueva
    // para este. El correo: llega un código al nuevo y, al escribirlo, cambia (al de antes le llega un aviso).
    const form = $('demoCambio'), motivoCambio = $('demoCambioMotivo');
    let cambio = null, esperando = false;
    const decirCambio = (t, bien = false) => { motivoCambio.textContent = t || ''; motivoCambio.classList.toggle('bien', !!bien); };
    const verCambio = (q) => {
      cambio = q; form.hidden = !q; decirCambio('');
      for (const e of form.querySelectorAll('[data-cambio]')) e.hidden = !q || !e.dataset.cambio.split(' ').includes(q);
      $('btnDemoCambio').textContent = q === 'correo' ? tr('Mandar código') : q === 'codigo' ? tr('Confirmar') : tr('Cambiar');
      if (q !== 'codigo') for (const i of form.querySelectorAll('input')) i.value = '';
      const primero = form.querySelector('[data-cambio]:not([hidden]) input'); if (primero) setTimeout(() => { try { primero.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }, 0);
    };
    const pedirCuenta = (m) => new Promise((listo) => {
      const ficha = fichaGuardada(dirServidor);
      if (!ficha) return listo({ ok: false, motivo: 'Vuelve a entrar con tu cuenta.' });
      let ws; try { ws = new WebSocket(conDireccionFicha(dirServidor, ficha)); } catch (e) { return listo({ ok: false, motivo: 'No hay conexión con el servidor.' }); }
      const fin = setTimeout(() => { try { ws.close(); } catch (e) { /* nada */ } listo({ ok: false, motivo: 'No hay conexión con el servidor.' }); }, 20000);
      ws.onmessage = (ev) => {
        let r; try { r = JSON.parse(ev.data); } catch (e) { return; }
        if (r.tipo === 'bienvenida') {
          if (!r.cuenta) { clearTimeout(fin); ws.close(); return listo({ ok: false, motivo: 'Vuelve a entrar con tu cuenta.' }); }
          ws.send(JSON.stringify({ tipo: 'cuenta', id: 1, idioma, ...m }));
        } else if (r.tipo === 'cuenta' && r.id === 1) { clearTimeout(fin); ws.close(); listo(r); }
      };
      ws.onerror = () => { clearTimeout(fin); listo({ ok: false, motivo: 'No hay conexión con el servidor.' }); };
    });
    $('btnDemoCambiarClave').onclick = () => { if (!esperando) verCambio(cambio === 'clave' ? null : 'clave'); };
    $('btnDemoCambiarCorreo').onclick = () => { if (!esperando) verCambio(cambio === 'correo' || cambio === 'codigo' ? null : 'correo'); };
    $('btnDemoCambioNo').onclick = () => { if (!esperando) verCambio(null); };
    const motivoDe = (m) => { const r = typeof m === 'string' && m.match(/^(Espera (\d+) s para pedir otro código\.|Demasiados (intentos|códigos); prueba dentro de (\d+) min\.)$/);
      if (r && r[2]) return tr('Espera {s} s para pedir otro código.', { s: r[2] });
      if (r && r[4]) return tr(r[3] === 'intentos' ? 'Demasiados intentos; prueba dentro de {m} min.' : 'Demasiados códigos; prueba dentro de {m} min.', { m: r[4] });
      return tr(m || 'Error del servidor.'); };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (esperando || !cambio) return;
      const actual = $('demoActual').value;
      let m = null, pedido = null;
      if (cambio === 'clave') {
        const k = $('demoNueva').value;
        m = !actual ? 'Falta la contraseña.' : motivoClave(k, usuario) || (k !== $('demoNueva2').value ? 'Las dos contraseñas no son iguales.' : null);
        pedido = { que: 'cambiar_clave', actual, clave: k };
      } else if (cambio === 'correo') {
        const c = $('demoCorreoNuevo').value.trim();
        m = !actual ? 'Falta la contraseña.' : motivoCorreo(c);
        pedido = { que: 'cambiar_correo', actual, correo: c };
      } else {
        const c = $('demoCodigo').value.trim();
        m = codigoValido(c) ? null : tr('El código son {n} cifras.', { n: CODIGO_CIFRAS });
        pedido = { que: 'verificar', codigo: c };
      }
      if (m) return decirCambio(tr(m));
      esperando = true; $('btnDemoCambio').disabled = true; decirCambio(tr('Un momento…'), true);
      const r = await pedirCuenta(pedido);
      esperando = false; $('btnDemoCambio').disabled = false;
      if (!r.ok) return decirCambio(motivoDe(r.motivo));
      if (cambio === 'clave') {
        if (r.ficha) guardarFicha(dirServidor, r.ficha);
        verCambio(null); aviso.textContent = tr('Contraseña cambiada. Se ha cerrado la sesión en tus demás aparatos.');
      } else if (cambio === 'correo') {
        verCambio('codigo'); decirCambio(tr('Te hemos mandado un código de {n} cifras a {c}. Caduca en 15 minutos.', { n: CODIGO_CIFRAS, c: r.pendiente || '' }), true);
      } else { verCambio(null); aviso.textContent = tr('Correo cambiado.'); }
    };
  }
  $('demoNotas').innerHTML = `<b>${tr(VERSION_DEMO)}</b><ul>${REGISTRO_DEMO.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;
  $('btnDemoNotas').onclick = () => { $('demoNotas').hidden = !$('demoNotas').hidden; $('demoOpciones').hidden = true; };
  window.__demo = { modo: null, listo: true };
}

// Genera el mapa del mundo a pasos (el juego no se queda colgado y se ve cuánto falta) y lo deja en window.__mundoDemo.
function generarMundo() {
  const caja = document.createElement('div');
  caja.id = 'demoGenerando';
  caja.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#2a2620;color:#f2e8d0;font:16px system-ui,sans-serif;z-index:50';
  caja.innerHTML = `<div>${tr('Preparando Whitholm…')}</div><div id="demoGenerandoFase" style="font-size:13px;opacity:.75"></div>` +
    '<div style="width:min(320px,80vw);height:6px;background:#4a4236;border-radius:3px"><div id="demoGenerandoBarra" style="height:100%;width:0;background:#c9a96a;border-radius:3px"></div></div>';
  document.body.appendChild(caja);
  const t0 = performance.now();
  const g = generar(SEMILLA_MUNDO, { lado: LADO_MUNDO });
  return new Promise((bien, mal) => {
    const seguir = () => {
      try {
        const t = performance.now();
        let r;
        do r = g.next(); while (!r.done && performance.now() - t < 40);
        if (r.done) {
          window.__mundoDemo = { mapa: r.value, msGenerar: Math.round(performance.now() - t0) };
          caja.remove(); bien(); return;
        }
        $('demoGenerandoFase').textContent = tr(r.value.fase);
        $('demoGenerandoBarra').style.width = `${Math.round(r.value.avance * 100)}%`;
        setTimeout(seguir, 0);
      } catch (e) { mal(e); }
    };
    setTimeout(seguir, 30);
  });
}
