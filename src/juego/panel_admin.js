// Kinhold — panel de depuración del admin (valravnx, 30 oct). Se abre con F9 o con el botón «Admin». Abre el mapa del
// rey con todos los jugadores conectados y, al lado, su lista; un clic en el mapa te lleva ahí, e «Ir» te pone junto a
// ese jugador.
//
// El admin, por la cuenta (revisión del 1 nov, P1): sin clave aparte. Solo sale con la cuenta de admin (su correo confirmado en KINHOLD_ADMIN_CORREO):
// lo dice el servidor al conectar (enLinea.admin) y es él quien acepta o no cada petición (src/logica/admin.js), con la
// cuenta de la conexión; lo apunta y contesta, y solo entonces se mueve al jugador. Con otra cuenta no hay botón y F9
// no hace nada.
import { tr } from '../idioma.js';

const CADA_VER = 1000;   // ms entre listas pedidas al servidor con el panel abierto
// la clave que se guardaba antes en este navegador (hasta la v92) ya no sirve: se borra
try { localStorage.removeItem('kinhold_admin_clave'); } catch (e) { /* sin almacenamiento */ }
const corto = (autor) => autor.replace(/^jugador:/, '');
const nombre = (j) => j.cuenta || corto(j.autor);

const CSS = `
#panelAdmin{position:fixed;z-index:41;top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));width:min(270px,calc(100vw - 20px));
  max-height:calc(100vh - 70px);overflow:auto;background:rgba(36,30,24,.92);color:#f1e8d8;border:1px solid rgba(241,232,216,.18);border-radius:12px;padding:10px 12px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px #0006}
#panelAdmin h3{margin:0 0 6px;font-size:14px;color:#d9a441}
#panelAdmin .pa-estado{font-size:12px;color:#bfb19a;margin-bottom:6px}
#panelAdmin .pa-estado.mal{color:#e0866f}
#panelAdmin ul{list-style:none;margin:0 0 8px;padding:0}
#panelAdmin li{display:flex;align-items:center;gap:6px;padding:4px 0;border-top:1px solid rgba(241,232,216,.1)}
#panelAdmin li .pa-nombre{flex:1;font-family:ui-monospace,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#panelAdmin li .pa-donde{font-size:11px;color:#bfb19a}
#panelAdmin button{font:inherit;font-size:12px;padding:4px 9px;color:#f1e8d8;background:rgba(58,48,38,.95);border:1px solid rgba(241,232,216,.2);border-radius:8px;cursor:pointer}
#panelAdmin button.pa-si{color:#241b10;background:#d9a441;border:0;font-weight:600}
#panelAdmin .pa-pie{display:flex;gap:6px;flex-wrap:wrap}
#panelAdmin .pa-ayuda{font-size:11.5px;color:#bfb19a;margin:0 0 8px}
@media (max-width:600px){#panelAdmin{top:auto;bottom:calc(44px + env(safe-area-inset-bottom,0px));max-height:38vh}}
`;

// mapaRey: el mapa (src/juego/mapa_rey.js); enLinea: la conexión (src/juego/en_linea.js); salida: el sitio de salida
// (m del mundo; las posiciones de la red van relativas a él); irA(x, y, z, giro): pone ahí al jugador (y o giro null:
// los que ya tiene o el suelo); avisar(texto, mal).
// libre(si): la cuenta de admin puede ir por todo el continente (valravnx, 5 nov: «quiero poder explorar libre»)
export function montarPanelAdmin({ mapaRey, enLinea, salida, irA, avisar, libre = () => {} }) {
  const est = document.createElement('style'); est.textContent = CSS; document.head.appendChild(est);
  const raiz = document.createElement('div'); raiz.id = 'panelAdmin'; raiz.hidden = true;
  document.body.appendChild(raiz);

  const esAdmin = () => !!(enLinea && enLinea.admin);
  let huellaLista = '', jugadores = [], yo = null, ultimo = null, id = 0, reloj = null, estadoTxt = '', estadoMal = false;
  const pendientes = new Map();   // id → 'ver' | 'ir'

  function mandar(m) {
    if (!enLinea || enLinea.estado !== 'conectado') { ponerEstado(tr('Sin conexión con el servidor.'), true); return false; }
    id++; pendientes.set(id, m.que);
    enLinea.enviar({ tipo: 'admin', id, ...m });
    return true;
  }
  const ver = () => { if (esAdmin()) mandar({ que: 'ver' }); };
  function ponerEstado(t, mal = false) { estadoTxt = t; estadoMal = mal; const e = raiz.querySelector('.pa-estado'); if (e) { e.textContent = t; e.classList.toggle('mal', mal); } }

  // lo que contesta el servidor
  if (enLinea) enLinea.escuchar((m) => {
    if (!pendientes.has(m.id)) return;
    pendientes.delete(m.id);
    if (!m.ok) {
      if (m.motivo === 'Solo la cuenta de admin puede usar el panel.') jugadores = [];
      ponerEstado(tr(m.motivo || 'El servidor no lo ha aceptado.'), true);
      pintarPanel(); if (mapaRey) mapaRey.pintar();
      return;
    }
    if (m.que === 'ver') {
      yo = m.yo; jugadores = (m.jugadores || []).filter(j => j.autor !== yo); ultimo = Date.now();
      ponerEstado(tr('Conectados además de ti: {n}', { n: jugadores.length }));
      // la lista se rehace solo si ha cambiado (así un botón no se cambia por otro mientras se pulsa)
      const h = JSON.stringify(jugadores.map(j => [j.autor, Math.round(j.x), Math.round(j.z)]));
      if (h !== huellaLista || !raiz.querySelector('ul')) { huellaLista = h; pintarPanel(); }
      if (mapaRey) mapaRey.pintar();
    } else if (m.que === 'ir') {
      irA(m.x, Number.isFinite(m.y) ? m.y : null, m.z, Number.isFinite(m.giro) ? m.giro : null);
      avisar(tr('Teletransportado (admin).'));
      cerrar();
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

  function pintarPanel() {
    if (raiz.hidden) return;
    {
      raiz.innerHTML = `<h3></h3><div class="pa-estado"></div><ul></ul><p class="pa-ayuda"></p>
        <div class="pa-pie"><button class="pa-cerrar"></button></div>`;
      raiz.querySelector('.pa-ayuda').textContent = tr('Clic en el mapa para ir ahí.');
      const ul = raiz.querySelector('ul');
      for (const j of jugadores) {
        const li = document.createElement('li');
        li.innerHTML = '<span class="pa-nombre"></span><span class="pa-donde"></span><button></button>';
        li.querySelector('.pa-nombre').textContent = nombre(j);
        li.querySelector('.pa-nombre').title = j.autor;
        li.querySelector('.pa-donde').textContent = `${Math.round(j.x)}, ${Math.round(j.z)}`;
        li.querySelector('button').textContent = tr('Ir');
        li.querySelector('button').onclick = () => { if (mandar({ que: 'ir', junto: j.autor })) ponerEstado(tr('Pidiendo al servidor…')); };
        ul.appendChild(li);
      }
    }
    raiz.querySelector('h3').textContent = tr('Depuración (admin)');
    raiz.querySelector('.pa-cerrar').textContent = tr('Cerrar');
    raiz.querySelector('.pa-cerrar').onclick = cerrar;
    ponerEstado(estadoTxt, estadoMal);
  }

  function abrir() {
    if (!raiz.hidden || !esAdmin()) return;
    if (!mapaRey) { avisar(tr('El panel de admin solo está en el mundo de verdad.'), true); return; }
    raiz.hidden = false; estadoTxt = ''; estadoMal = false;
    mapaRey.ponerCapa(capa);
    mapaRey.abrir();
    pintarPanel();
    ver();
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
  let boton = null;
  // (se suelta una vez y no se vuelve a cerrar: si la conexión se corta fuera de la isla, no te quedas encallado; lo que
  // vale lo dice el servidor, que solo acepta fuera de la isla a la cuenta de admin)
  let suelto = false;
  function mirarBoton() {
    const si = esAdmin();
    if (si && !suelto && !window.__mutarAdminLibre) { suelto = true; libre(true); }   // (la prueba lo rompe a propósito)
    if (si && !boton && menu && mapaRey) {
      boton = document.createElement('button'); boton.id = 'btnAdmin'; boton.textContent = tr('Admin');
      boton.onclick = () => (raiz.hidden ? abrir() : cerrar());
      menu.appendChild(boton);
    } else if (!si && boton) { boton.remove(); boton = null; }
    if (!si && !raiz.hidden && enLinea && enLinea.estado !== 'volviendo') cerrar();
  }
  mirarBoton(); setInterval(mirarBoton, 500);

  return {
    abrir, cerrar, alternar: () => (raiz.hidden ? abrir() : cerrar()),
    get abierto() { return !raiz.hidden; }, get jugadores() { return jugadores; }, get admin() { return esAdmin(); }, get ultimo() { return ultimo; },
  };
}
