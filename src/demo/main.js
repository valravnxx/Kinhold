// Kinhold — demo única: una sola página con menú (Construir, Duelo, Personaje).
// Cada parte es el prototipo de siempre; se elige con ?modo= y la página se recarga al cambiar, para que cada
// parte empiece limpia (sin dos escenas ni dos WebGL a la vez). three.js va una sola vez en el archivo: las
// partes se cargan con import() y solo se ejecuta la elegida.
// El personaje que se elige en «Personaje» (cuerpo y ropa) es el que sale en la construcción y en el duelo
// (src/mundo/eleccion.js). Junto a «Menú», los fotogramas por segundo y el detalle del rendimiento.
import PLANTILLAS from 'plantillas-demo';
import { tr, traducirPagina, botonesIdioma, idioma } from '../idioma.js';
import { personajeElegido } from '../mundo/eleccion.js';
import { direccionServidor, CLAVE_SERVIDOR } from '../mundo/direccion_servidor.js';
import { VERSION_DEMO, REGISTRO_DEMO } from './registro.js';
import { CAPAS } from '../personaje/textos.js';
import { ponerRendimiento } from './rendimiento.js';
import { medidaRendimiento, genteDePrueba } from '../mundo/rendimiento.js';
import { generar, SEMILLA_MUNDO, LADO_MUNDO } from '../logica/mapa.js';

const MODOS = {
  construir: { carga: () => import('../juego/main.js'), menu: '#menu', nombre: 'Construir' },
  duelo: { carga: () => import('../combate/main.js'), menu: '#menu', nombre: 'Duelo' },
  personaje: { carga: () => import('../personaje/main.js'), menu: '#estilos', nombre: 'Personaje' },
};
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const modo = params.get('modo');

// enlace a otra parte de la demo, conservando el resto de parámetros (idioma, carpetas de recursos)
function enlace(m, enLinea = false) {
  const p = new URLSearchParams(location.search);
  if (m) p.set('modo', m); else p.delete('modo');
  if (enLinea) p.set('enlinea', '1'); else p.delete('enlinea');
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

if (MODOS[modo]) {
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
  if (caja) caja.prepend(b); else { b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9'; document.body.appendChild(b); }
  window.__demo = { modo, listo: false };
  window.__rendimiento = { medida: medidaRendimiento, gente: (n) => genteDePrueba() && genteDePrueba().poner(n),
    detalle: (si) => genteDePrueba()?.detalle?.(si), niveles: () => genteDePrueba()?.niveles?.() };
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
  $('demoEnLinea').href = enlace('construir', true);
  $('demoDueloEnLinea').href = enlace('duelo', true);
  // Opciones: la dirección del servidor para «Jugar en línea» (se guarda en el navegador)
  $('demoServidor').value = direccionServidor();
  $('btnDemoOpciones').onclick = () => { $('demoOpciones').hidden = !$('demoOpciones').hidden; $('demoNotas').hidden = true; };
  $('btnDemoGuardar').onclick = () => {
    const v = $('demoServidor').value.trim();
    if (!/^wss?:\/\/[^\s]+$/.test(v)) { $('demoServidorNota').textContent = tr('Tiene que empezar por ws:// o wss://'); return; }
    try { localStorage.setItem(CLAVE_SERVIDOR, v); $('demoServidorNota').textContent = tr('Guardada.'); }
    catch (e) { $('demoServidorNota').textContent = tr('Este navegador no deja guardarla.'); }
  };
  $('demoPersonaje').textContent = resumenPersonaje();
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
