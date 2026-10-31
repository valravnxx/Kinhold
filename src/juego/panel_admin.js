// Kinhold — panel de depuración del admin (valravnx, 30 oct). Se abre con F9 (o el botón «Admin», que sale con ?admin en
// la dirección o si ya se ha puesto la clave en este navegador). Abre el mapa del rey con todos los jugadores conectados
// y, al lado, su lista; un clic en el mapa te lleva ahí, y «Ir» te pone junto a ese jugador.
//
// Todo lo pide al servidor con la clave de admin (src/logica/admin.js): el servidor mira la clave, pone el autor de la
// conexión, lo apunta y contesta; solo entonces se mueve al jugador. Sin la clave buena, el panel no enseña nada.
// La clave se guarda en este navegador (localStorage) hasta que se pulsa «Olvidar la clave» o el servidor la rechaza.
import { tr } from '../idioma.js';

const CLAVE = 'kinhold_admin_clave';
const CADA_VER = 1000;   // ms entre listas pedidas al servidor con el panel abierto
const leer = () => { try { return localStorage.getItem(CLAVE) || ''; } catch (e) { return ''; } };
const guardar = (c) => { try { if (c) localStorage.setItem(CLAVE, c); else localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } };
const corto = (autor) => autor.replace(/^jugador:/, '');

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
#panelAdmin input{font:inherit;width:100%;box-sizing:border-box;margin:4px 0 6px;padding:6px 8px;border-radius:8px;border:1px solid rgba(241,232,216,.25);background:#1e1914;color:#f1e8d8}
#panelAdmin .pa-pie{display:flex;gap:6px;flex-wrap:wrap}
#panelAdmin .pa-ayuda{font-size:11.5px;color:#bfb19a;margin:0 0 8px}
`;

// mapaRey: el mapa (src/juego/mapa_rey.js); enLinea: la conexión (src/juego/en_linea.js); salida: el sitio de salida
// (m del mundo; las posiciones de la red van relativas a él); irA(x, y, z, giro): pone ahí al jugador (y o giro null:
// los que ya tiene o el suelo); avisar(texto, mal).
export function montarPanelAdmin({ mapaRey, enLinea, salida, irA, avisar }) {
  const est = document.createElement('style'); est.textContent = CSS; document.head.appendChild(est);
  const raiz = document.createElement('div'); raiz.id = 'panelAdmin'; raiz.hidden = true;
  document.body.appendChild(raiz);

  let huellaLista = '', clave = leer(), jugadores = [], yo = null, ultimo = null, id = 0, reloj = null, estadoTxt = '', estadoMal = false;
  const pendientes = new Map();   // id → 'ver' | 'ir'

  function mandar(m) {
    if (!enLinea || enLinea.estado !== 'conectado') { ponerEstado(tr('Sin conexión con el servidor.'), true); return false; }
    id++; pendientes.set(id, m.que);
    enLinea.enviar({ tipo: 'admin', id, clave, ...m });
    return true;
  }
  const ver = () => { if (clave) mandar({ que: 'ver' }); };
  function ponerEstado(t, mal = false) { estadoTxt = t; estadoMal = mal; const e = raiz.querySelector('.pa-estado'); if (e) { e.textContent = t; e.classList.toggle('mal', mal); } }

  // lo que contesta el servidor
  if (enLinea) enLinea.escuchar((m) => {
    if (!pendientes.has(m.id)) return;
    pendientes.delete(m.id);
    if (!m.ok) {
      if (m.motivo === 'Clave de admin incorrecta.') { clave = ''; guardar(''); jugadores = []; }
      ponerEstado(tr(m.motivo || 'El servidor no lo ha aceptado.'), true);
      pintarPanel(); if (mapaRey) mapaRey.pintar();
      return;
    }
    if (m.que === 'ver') {
      guardar(clave);
      yo = m.yo; jugadores = (m.jugadores || []).filter(j => j.autor !== yo); ultimo = Date.now();
      ponerEstado(tr('{n} conectados además de ti', { n: jugadores.length }));
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
    pintar(ctx, { kmAPant, s, etiqueta }) {
      const R = Math.max(5, Math.min(9, s * 0.35));
      for (const j of jugadores) {
        const [x, y] = kmAPant((salida.x + j.x) / 1000, (salida.z + j.z) / 1000);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fillStyle = '#2d5878'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#f4e6c2'; ctx.stroke();
        etiqueta(corto(j.autor), x, y - R - 9, 12, '700', '#2d5878');
      }
    },
    clic(x, z) {
      if (!clave) return;
      if (mandar({ que: 'ir', x: x - salida.x, z: z - salida.z })) ponerEstado(tr('Pidiendo al servidor…'));
    },
    alCerrar() { cerrar(); },
  };

  function pintarPanel() {
    if (raiz.hidden) return;
    if (!clave) {
      raiz.innerHTML = `<h3></h3><div class="pa-estado"></div><label class="pa-ayuda"></label><input type="password" autocomplete="off">
        <div class="pa-pie"><button class="pa-si"></button><button class="pa-cerrar"></button></div>`;
      raiz.querySelector('label').textContent = tr('Clave de admin (la que está puesta en el servidor)');
      raiz.querySelector('.pa-si').textContent = tr('Entrar');
      const entrar = () => { const v = raiz.querySelector('input').value.trim(); if (!v) return; clave = v; ponerEstado(tr('Comprobando la clave…')); ver(); };
      raiz.querySelector('.pa-si').onclick = entrar;
      raiz.querySelector('input').onkeydown = (e) => { if (e.key === 'Enter') entrar(); if (e.key === 'Escape') cerrar(); };
      setTimeout(() => { const i = raiz.querySelector('input'); if (i) i.focus(); }, 0);
    } else {
      raiz.innerHTML = `<h3></h3><div class="pa-estado"></div><ul></ul><p class="pa-ayuda"></p>
        <div class="pa-pie"><button class="pa-olvidar"></button><button class="pa-cerrar"></button></div>`;
      raiz.querySelector('.pa-ayuda').textContent = tr('Clic en el mapa para ir ahí.');
      raiz.querySelector('.pa-olvidar').textContent = tr('Olvidar la clave');
      raiz.querySelector('.pa-olvidar').onclick = () => { clave = ''; guardar(''); jugadores = []; ponerEstado(''); pintarPanel(); if (mapaRey) mapaRey.pintar(); };
      const ul = raiz.querySelector('ul');
      for (const j of jugadores) {
        const li = document.createElement('li');
        li.innerHTML = '<span class="pa-nombre"></span><span class="pa-donde"></span><button></button>';
        li.querySelector('.pa-nombre').textContent = corto(j.autor);
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
    if (!raiz.hidden) return;
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

  // el botón «Admin», para el móvil (sin teclado): solo con ?admin en la dirección o con la clave ya puesta aquí
  const menu = document.getElementById('menu');
  if (menu && mapaRey && (clave || new URLSearchParams(location.search).has('admin'))) {
    const b = document.createElement('button'); b.id = 'btnAdmin'; b.textContent = tr('Admin');
    b.onclick = () => (raiz.hidden ? abrir() : cerrar());
    menu.appendChild(b);
  }

  return {
    abrir, cerrar, alternar: () => (raiz.hidden ? abrir() : cerrar()),
    get abierto() { return !raiz.hidden; }, get jugadores() { return jugadores; }, get clave() { return !!clave; }, get ultimo() { return ultimo; },
  };
}
