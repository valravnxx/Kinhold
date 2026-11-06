// Kinhold — panel de depuración del admin (valravnx, 30 oct). Se abre con F9 o con el botón «Admin».
//
// Desde el 6 nov (valravnx: «al clicar en admin en vez de salir el mapa solo, saldrá más información, y el poder
// activar modo autoconstruir (construir de una sin materiales), el poder abrir el arcón de admin para invocarse lo que
// sea, poder multiplicar la velocidad de carrera y poder ir a freecam volando en 3 dimensiones») tiene cuatro pestañas:
//  - Info: lo del servidor (conectados, cuentas, obras, lo del suelo, estaciones…) y dónde estás (zona, de quién es).
//  - Mapa: el mapa del rey con todos los jugadores conectados y, al lado, su lista; un clic en el mapa te lleva ahí,
//    «Ir» te pone junto a ese jugador y «Traer» lo pone a él junto a ti (valravnx, 5 nov: «poder tpearlos a mi»).
//  - Modos: autoconstruir, la velocidad multiplicada y la cámara libre (volar en 3D; solo en este navegador).
//  - Arcón: invocarse cualquier objeto del catálogo, con su cantidad.
//
// El admin, por la cuenta (revisión del 1 nov, P1): sin clave aparte. Solo sale con la cuenta de admin (su correo confirmado en KINHOLD_ADMIN_CORREO):
// lo dice el servidor al conectar (enLinea.admin) y es él quien acepta o no cada petición (src/logica/admin.js), con la
// cuenta de la conexión; lo apunta y contesta, y solo entonces se mueve al jugador o cambia un modo. Con otra cuenta no
// hay botón y F9 no hace nada.
import { tr } from '../idioma.js';
import { CATALOGO } from '../logica/inventario.js';
import { VELOCIDADES, INVOCAR_MAX } from '../logica/admin.js';

const CADA_VER = 1000;   // ms entre listas pedidas al servidor con el panel abierto
// la clave que se guardaba antes en este navegador (hasta la v92) ya no sirve: se borra
try { localStorage.removeItem('kinhold_admin_clave'); } catch (e) { /* sin almacenamiento */ }
const corto = (autor) => autor.replace(/^jugador:/, '');
const nombre = (j) => j.cuenta || corto(j.autor);
const PESTANAS = ['info', 'mapa', 'modos', 'arcon'];

const CSS = `
#panelAdmin{position:fixed;z-index:41;top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));width:min(300px,calc(100vw - 20px));
  max-height:calc(100vh - 70px);overflow:auto;background:rgba(36,30,24,.94);color:#f1e8d8;border:1px solid rgba(241,232,216,.18);border-radius:12px;padding:10px 12px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px #0006}
#panelAdmin h3{margin:0 0 6px;font-size:14px;color:#d9a441}
#panelAdmin .pa-pest{display:flex;gap:4px;margin:0 0 8px}
#panelAdmin .pa-pest button{flex:1;padding:5px 4px}
#panelAdmin .pa-pest button.activa{color:#241b10;background:#d9a441;border-color:#d9a441;font-weight:600}
#panelAdmin .pa-estado{font-size:12px;color:#bfb19a;margin-bottom:6px;min-height:1em}
#panelAdmin .pa-estado.mal{color:#e0866f}
#panelAdmin ul{list-style:none;margin:0 0 8px;padding:0}
#panelAdmin li{display:flex;align-items:center;gap:6px;padding:4px 0;border-top:1px solid rgba(241,232,216,.1)}
#panelAdmin li .pa-nombre{flex:1;font-family:ui-monospace,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#panelAdmin li .pa-donde{font-size:11px;color:#bfb19a}
#panelAdmin button{font:inherit;font-size:12px;padding:4px 9px;color:#f1e8d8;background:rgba(58,48,38,.95);border:1px solid rgba(241,232,216,.2);border-radius:8px;cursor:pointer}
#panelAdmin button.pa-si{color:#241b10;background:#d9a441;border:0;font-weight:600}
#panelAdmin .pa-pie{display:flex;gap:6px;flex-wrap:wrap}
#panelAdmin .pa-ayuda{font-size:11.5px;color:#bfb19a;margin:0 0 8px}
#panelAdmin dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0 0 8px;font-size:12px}
#panelAdmin dt{color:#bfb19a}
#panelAdmin dd{margin:0;font-family:ui-monospace,monospace;text-align:right}
#panelAdmin .pa-fila{display:flex;align-items:center;gap:8px;margin:0 0 8px;flex-wrap:wrap}
#panelAdmin .pa-fila label{flex:1}
#panelAdmin .pa-vel button{padding:4px 7px}
#panelAdmin .pa-vel button.activa,#panelAdmin button.pa-on{color:#241b10;background:#d9a441;border-color:#d9a441;font-weight:600}
#panelAdmin input{font:inherit;font-size:12px;padding:4px 6px;background:rgba(20,16,12,.7);color:#f1e8d8;border:1px solid rgba(241,232,216,.25);border-radius:6px}
#panelAdmin .pa-buscar{width:100%;box-sizing:border-box;margin-bottom:6px}
#panelAdmin .pa-cant{width:56px}
#panelAdmin .pa-objetos{max-height:240px;overflow:auto;margin-bottom:6px}
#panelAdmin .pa-objetos li .pa-nombre{font-family:inherit}
@media (max-width:600px){#panelAdmin{top:auto;bottom:calc(44px + env(safe-area-inset-bottom,0px));max-height:46vh}#panelAdmin .pa-objetos{max-height:24vh}}
`;

// mapaRey: el mapa (src/juego/mapa_rey.js); enLinea: la conexión (src/juego/en_linea.js); salida: el sitio de salida
// (m del mundo; las posiciones de la red van relativas a él); irA(x, y, z, giro): pone ahí al jugador (y o giro null:
// los que ya tiene o el suelo); avisar(texto, mal).
// libre(si): la cuenta de admin puede ir por todo el continente (valravnx, 5 nov: «quiero poder explorar libre»)
// camaraLibre: { activa, alternar(si?), donde() → { x, z } } (la cámara libre del juego, src/juego/main.js)
export function montarPanelAdmin({ mapaRey, enLinea, salida, irA, avisar, libre = () => {}, camaraLibre = null }) {
  const est = document.createElement('style'); est.textContent = CSS; document.head.appendChild(est);
  const raiz = document.createElement('div'); raiz.id = 'panelAdmin'; raiz.hidden = true;
  document.body.appendChild(raiz);

  const esAdmin = () => !!(enLinea && enLinea.admin);
  let huellaLista = '', jugadores = [], yo = null, ultimo = null, id = 0, reloj = null, estadoTxt = '', estadoMal = false;
  let avisoHasta = 0;   // hasta cuándo se deja a la vista lo último que ha pasado (ms)
  let pestana = 'info', info = null, huellaInfo = '', buscar = '', cantidad = 1;
  const pendientes = new Map();   // id → 'ver' | 'ir' | 'traer' | 'modo' | 'invocar'
  const red = () => (enLinea && enLinea.red) || null;
  const modos = () => (red() && red().modosAdmin) || { autoconstruir: false, velocidad: 1 };

  function mandar(m) {
    if (!enLinea || enLinea.estado !== 'conectado') { ponerEstado(tr('Sin conexión con el servidor.'), true); return false; }
    id++; pendientes.set(id, m.que);
    enLinea.enviar({ tipo: 'admin', id, ...m });
    return true;
  }
  const ver = () => { if (esAdmin()) mandar({ que: 'ver' }); };
  function ponerEstado(t, mal = false) { estadoTxt = t; estadoMal = mal; const e = raiz.querySelector('.pa-estado'); if (e) { e.textContent = t; e.classList.toggle('mal', mal); } }
  const avisoQueSeLea = () => { avisoHasta = Date.now() + 4000; };   // la lista de cada segundo no lo pisa enseguida
  const ponerModos = (m) => { if (red() && m) red().modosAdmin = { autoconstruir: !!m.autoconstruir, velocidad: Number.isFinite(m.velocidad) ? m.velocidad : 1 }; };

  // lo que contesta el servidor
  if (enLinea) enLinea.escuchar((m) => {
    // te ha traído el admin (para cualquier jugador, no solo el admin): el servidor ya te ha puesto ahí
    if (m.que === 'traido' && m.id === undefined && !window.__mutarTraido) {   // (la prueba lo rompe a propósito)
      if ([m.x, m.y, m.z].every(Number.isFinite)) { irA(m.x, m.y, m.z, Number.isFinite(m.giro) ? m.giro : null); avisar(tr('El admin te ha llevado junto a él.')); }
      return;
    }
    if (!pendientes.has(m.id)) return;
    pendientes.delete(m.id);
    if (!m.ok) {
      if (m.motivo === 'Solo la cuenta de admin puede usar el panel.') jugadores = [];
      ponerEstado(tr(m.motivo || 'El servidor no lo ha aceptado.'), true); avisoQueSeLea();
      pintarPanel(); if (mapaRey && mapaRey.abierto) mapaRey.pintar();
      return;
    }
    if (m.que === 'ver') {
      yo = m.yo; jugadores = (m.jugadores || []).filter(j => j.autor !== yo); ultimo = Date.now();
      if (m.modos) ponerModos(m.modos);
      if (m.info) info = m.info;
      if (Date.now() > avisoHasta) ponerEstado(tr('Conectados además de ti: {n}', { n: jugadores.length }));
      // se rehace solo si ha cambiado (así un botón no se cambia por otro mientras se pulsa)
      const h = JSON.stringify(jugadores.map(j => [j.autor, Math.round(j.x), Math.round(j.z)]));
      const hi = JSON.stringify(info && { ...info, ahora: Math.floor(info.ahora / 1000) });
      if ((pestana === 'mapa' && h !== huellaLista) || (pestana === 'info' && hi !== huellaInfo) || !raiz.querySelector('.pa-cuerpo')) { huellaLista = h; huellaInfo = hi; pintarPanel(); }
      if (mapaRey && mapaRey.abierto) mapaRey.pintar();
    } else if (m.que === 'traer') {
      const j = jugadores.find(e => e.autor === m.quien);
      ponerEstado(tr('Traído: {n}', { n: j ? nombre(j) : corto(m.quien || '') })); avisoQueSeLea();
    } else if (m.que === 'ir') {
      irA(m.x, Number.isFinite(m.y) ? m.y : null, m.z, Number.isFinite(m.giro) ? m.giro : null);
      avisar(tr('Teletransportado (admin).'));
      cerrar();
    } else if (m.que === 'modo') {
      ponerModos(m.modos);
      ponerEstado(tr('Modos: autoconstruir {a}, velocidad ×{v}', { a: m.modos.autoconstruir ? tr('sí') : tr('no'), v: m.modos.velocidad })); avisoQueSeLea();
      pintarPanel();
    } else if (m.que === 'invocar') {
      const n = CATALOGO[m.objeto] ? tr(CATALOGO[m.objeto].nombre) : m.objeto;
      ponerEstado(m.alSuelo ? tr('{c} de {n}: no te cabía, a tus pies.', { c: m.cantidad, n }) : tr('{c} de {n}: en lo que llevas.', { c: m.cantidad, n })); avisoQueSeLea();
    }
  });

  // la capa del mapa: los demás jugadores, y el clic para ir
  const capa = {
    continente: true,   // el mapa del continente entero, no solo el de la isla (valravnx, 5 nov)
    pintar(ctx, { kmAPant, s, etiqueta }) {
      const R = Math.max(5, Math.min(9, s * 0.35));
      for (const j of jugadores) {
        const [x, y] = kmAPant((salida.x + j.x) / 1000, (salida.z + j.z) / 1000);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = '#2d5878'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f4e6c2'; ctx.stroke();
        etiqueta(nombre(j), x, y - R - 9, 12, '700', '#2d5878');
      }
    },
    clic(x, z) {
      if (!esAdmin()) return;
      if (mandar({ que: 'ir', x: x - salida.x, z: z - salida.z })) ponerEstado(tr('Pidiendo al servidor…'));
    },
    alCerrar() { cerrar(); },
  };

  const el = (etiqueta, props = {}, hijos = []) => { const e = document.createElement(etiqueta); Object.assign(e, props); for (const h of hijos) e.appendChild(h); return e; };
  const boton = (texto, clase, onclick) => el('button', { textContent: texto, className: clase || '', onclick });

  function cuerpoInfo(c) {
    if (!info) { c.appendChild(el('p', { className: 'pa-ayuda', textContent: tr('Pidiendo al servidor…') })); return; }
    const min = Math.max(0, Math.round((info.ahora - info.arranque) / 60000));
    const filas = [
      [tr('Servidor en marcha'), min < 120 ? tr('{n} min', { n: min }) : tr('{n} h', { n: Math.round(min / 60) })],
      [tr('Conectados'), info.conectados], [tr('Cuentas'), info.cuentas],
      [tr('Construcciones'), info.construcciones], [tr('Piezas (a medias)'), `${info.piezas} (${info.obrasAMedias})`],
      [tr('Muebles'), info.muebles], [tr('Mojones'), info.mojones], [tr('Cosas en el suelo'), info.enElSuelo],
      [tr('Estaciones de fabricar'), info.estaciones], [tr('Acciones del mundo'), info.entradas],
    ];
    const dl = el('dl'); for (const [k, v] of filas) { dl.appendChild(el('dt', { textContent: k })); dl.appendChild(el('dd', { textContent: String(v) })); }
    c.appendChild(dl);
    c.appendChild(el('h3', { textContent: tr('Donde estás') }));
    const s = info.sitio;
    const tierra = info.zonaRey ? tr('del rey') : info.tierraDe ? (info.tierraDe === yo ? tr('tuya') : corto(info.tierraDe)) : tr('libre');
    const dl2 = el('dl');
    for (const [k, v] of [[tr('Posición'), s ? `${s.x}, ${s.z}` : '—'], [tr('Altura'), s && s.y !== null ? `${s.y} m` : '—'], [tr('Zona'), info.zona ?? '—'], [tr('Tierra'), tierra]]) {
      dl2.appendChild(el('dt', { textContent: k })); dl2.appendChild(el('dd', { textContent: String(v) }));
    }
    c.appendChild(dl2);
  }

  function cuerpoMapa(c) {
    c.appendChild(el('p', { className: 'pa-ayuda', textContent: tr('Clic en el mapa para ir ahí.') }));
    const ul = el('ul');
    for (const j of jugadores) {
      const li = el('li');
      li.appendChild(el('span', { className: 'pa-nombre', textContent: nombre(j), title: j.autor }));
      li.appendChild(el('span', { className: 'pa-donde', textContent: `${Math.round(j.x)}, ${Math.round(j.z)}` }));
      li.appendChild(boton(tr('Ir'), 'pa-ir', () => { if (mandar({ que: 'ir', junto: j.autor })) ponerEstado(tr('Pidiendo al servidor…')); }));
      const b = boton(tr('Traer'), 'pa-traer', () => { if (mandar({ que: 'traer', quien: j.autor })) ponerEstado(tr('Pidiendo al servidor…')); });
      b.title = tr('Traerlo junto a ti'); li.appendChild(b);
      ul.appendChild(li);
    }
    c.appendChild(ul);
  }

  function cuerpoModos(c) {
    const m = modos();
    const fa = el('div', { className: 'pa-fila' });
    fa.appendChild(el('label', { textContent: tr('Autoconstruir (al momento y sin materiales)') }));
    fa.appendChild(boton(m.autoconstruir ? tr('Activado') : tr('Apagado'), 'pa-auto' + (m.autoconstruir ? ' pa-on' : ''), () => {
      if (mandar({ que: 'modo', autoconstruir: !m.autoconstruir })) ponerEstado(tr('Pidiendo al servidor…'));
    }));
    c.appendChild(fa);
    c.appendChild(el('div', { className: 'pa-fila' }, [el('label', { textContent: tr('Velocidad al andar y correr') })]));
    const fv = el('div', { className: 'pa-fila pa-vel' });
    for (const v of VELOCIDADES) fv.appendChild(boton(`×${v}`, 'pa-v' + v + (m.velocidad === v ? ' activa' : ''), () => { if (mandar({ que: 'modo', velocidad: v })) ponerEstado(tr('Pidiendo al servidor…')); }));
    c.appendChild(fv);
    if (camaraLibre) {
      const fc = el('div', { className: 'pa-fila' });
      fc.appendChild(el('label', { textContent: tr('Cámara libre (volar)') }));
      fc.appendChild(boton(camaraLibre.activa ? tr('Activada') : tr('Apagada'), 'pa-camara' + (camaraLibre.activa ? ' pa-on' : ''), () => {
        camaraLibre.alternar(); cerrar();
      }));
      c.appendChild(fc);
      c.appendChild(el('p', { className: 'pa-ayuda', textContent: tr('Con la cámara libre: W A S D para moverte, Espacio para subir, C para bajar, Mayúsculas para ir más deprisa y arrastrar para mirar. En el móvil, el joystick y los botones de subir y bajar. F10 o el botón «Cámara» la quita; «Ir aquí» pone allí a tu personaje.') }));
      if (camaraLibre.activa) c.appendChild(el('div', { className: 'pa-pie' }, [boton(tr('Ir aquí'), 'pa-irAqui', irAqui)]));
    }
  }
  // lleva al personaje a donde está la cámara libre (lo pide al servidor, como un clic en el mapa)
  function irAqui() {
    if (!camaraLibre || !camaraLibre.activa) return;
    const d = camaraLibre.donde();
    if (mandar({ que: 'ir', x: d.x, z: d.z })) { camaraLibre.alternar(false); ponerEstado(tr('Pidiendo al servidor…')); }
  }

  function cuerpoArcon(c) {
    const inp = el('input', { className: 'pa-buscar', placeholder: tr('Buscar objeto…'), value: buscar });
    const fc = el('div', { className: 'pa-fila' });
    fc.appendChild(el('label', { textContent: tr('Cantidad') }));
    const cant = el('input', { className: 'pa-cant', type: 'number', min: 1, max: INVOCAR_MAX, value: cantidad });
    cant.oninput = () => { const v = Math.round(Number(cant.value)); cantidad = Number.isFinite(v) ? Math.min(INVOCAR_MAX, Math.max(1, v)) : 1; };
    fc.appendChild(cant);
    const ul = el('ul', { className: 'pa-objetos' });
    const llenar = () => {
      ul.textContent = '';
      const q = buscar.trim().toLowerCase();
      const tipos = Object.keys(CATALOGO).filter(t => !q || tr(CATALOGO[t].nombre).toLowerCase().includes(q) || t.includes(q))
        .sort((a, b) => tr(CATALOGO[a].nombre).localeCompare(tr(CATALOGO[b].nombre)));
      for (const t of tipos) {
        const li = el('li');
        li.appendChild(el('span', { className: 'pa-nombre', textContent: tr(CATALOGO[t].nombre), title: t }));
        li.appendChild(boton(tr('Invocar'), 'pa-invocar', () => { if (mandar({ que: 'invocar', objeto: t, cantidad })) ponerEstado(tr('Pidiendo al servidor…')); }));
        li.dataset.tipo = t;
        ul.appendChild(li);
      }
    };
    inp.oninput = () => { buscar = inp.value; llenar(); };
    c.appendChild(inp); c.appendChild(fc); c.appendChild(ul);
    llenar();
  }

  function pintarPanel() {
    if (raiz.hidden) return;
    raiz.textContent = '';
    raiz.appendChild(el('h3', { textContent: tr('Depuración (admin)') }));
    const pest = el('div', { className: 'pa-pest' });
    const nombres = { info: tr('Info'), mapa: tr('Mapa'), modos: tr('Modos'), arcon: tr('Arcón') };
    for (const p of PESTANAS) pest.appendChild(boton(nombres[p], 'pa-p-' + p + (p === pestana ? ' activa' : ''), () => irPestana(p)));
    raiz.appendChild(pest);
    raiz.appendChild(el('div', { className: 'pa-estado' }));
    const c = el('div', { className: 'pa-cuerpo' });
    ({ info: cuerpoInfo, mapa: cuerpoMapa, modos: cuerpoModos, arcon: cuerpoArcon })[pestana](c);
    raiz.appendChild(c);
    raiz.appendChild(el('div', { className: 'pa-pie' }, [boton(tr('Cerrar'), 'pa-cerrar', cerrar)]));
    ponerEstado(estadoTxt, estadoMal);
  }

  // el mapa solo en su pestaña: en las demás se ve el mundo
  function irPestana(p) {
    if (!PESTANAS.includes(p)) return;
    pestana = p;
    if (p === 'mapa') { mapaRey.ponerCapa(capa); if (!mapaRey.abierto) mapaRey.abrir(); }
    else if (mapaRey.abierto) { mapaRey.ponerCapa(null); mapaRey.cerrar(); }
    huellaLista = ''; pintarPanel(); ver();
  }

  function abrir(p = 'info') {
    if (!raiz.hidden || !esAdmin()) return;
    if (!mapaRey) { avisar(tr('El panel de admin solo está en el mundo de verdad.'), true); return; }
    raiz.hidden = false; estadoTxt = ''; estadoMal = false;
    irPestana(p);
    clearInterval(reloj); reloj = setInterval(ver, CADA_VER);
  }
  function cerrar() {
    if (raiz.hidden) return;
    raiz.hidden = true; clearInterval(reloj); reloj = null;
    mapaRey.ponerCapa(null);
    if (mapaRey.abierto) mapaRey.cerrar();
  }

  // el botón «Admin» (también para el móvil, sin teclado): solo con la cuenta de admin. El servidor lo dice al conectar (o
  // al confirmar el correo), así que se mira cada poco; si deja de serlo (se corta, entra otro), se quita y se cierra el panel.
  const menu = document.getElementById('menu');
  let botonAdmin = null;
  // (se suelta una vez y no se vuelve a cerrar: si la conexión se corta fuera de la isla, no te quedas encallado; lo que
  // vale lo dice el servidor, que solo acepta fuera de la isla a la cuenta de admin)
  let suelto = false;
  function mirarBoton() {
    const si = esAdmin();
    if (si && !suelto && !window.__mutarAdminLibre) { suelto = true; libre(true); }   // (la prueba lo rompe a propósito)
    if (si && !botonAdmin && menu && mapaRey) {
      botonAdmin = document.createElement('button'); botonAdmin.id = 'btnAdmin'; botonAdmin.textContent = tr('Admin');
      botonAdmin.onclick = () => (raiz.hidden ? abrir() : cerrar());
      menu.appendChild(botonAdmin);
    } else if (!si && botonAdmin) { botonAdmin.remove(); botonAdmin = null; }
    if (!si && !raiz.hidden && enLinea && enLinea.estado !== 'volviendo') cerrar();
    // sin la cuenta de admin (o al cortarse), la cámara libre se quita
    if (!si && camaraLibre && camaraLibre.activa && enLinea && enLinea.estado !== 'volviendo') camaraLibre.alternar(false);
  }
  mirarBoton(); setInterval(mirarBoton, 500);

  return {
    abrir, cerrar, alternar: () => (raiz.hidden ? abrir() : cerrar()), irPestana, irAqui,
    get abierto() { return !raiz.hidden; }, get pestana() { return pestana; }, get jugadores() { return jugadores; }, get info() { return info; },
    get modos() { return modos(); }, get admin() { return esAdmin(); }, get ultimo() { return ultimo; },
  };
}
