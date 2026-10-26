// Kinhold — demo única: una sola página con menú (Construir, Duelo, Personaje).
// Cada parte es el prototipo de siempre; se elige con ?modo= y la página se recarga al cambiar, para que cada
// parte empiece limpia (sin dos escenas ni dos WebGL a la vez). three.js va una sola vez en el archivo: las
// partes se cargan con import() y solo se ejecuta la elegida.
// El personaje que se elige en «Personaje» (cuerpo y ropa) es el que sale en la construcción y en el duelo
// (src/demo/eleccion.js). Junto a «Menú», los fotogramas por segundo y el detalle del rendimiento.
import PLANTILLAS from 'plantillas-demo';
import { tr, traducirPagina, botonesIdioma, idioma } from '../idioma.js';
import { personajeElegido } from './eleccion.js';
import { VERSION_DEMO, REGISTRO_DEMO } from './registro.js';
import { CAPAS } from '../personaje/textos.js';
import { ponerRendimiento } from './rendimiento.js';
import { medidaRendimiento, genteDePrueba } from '../mundo/rendimiento.js';

const MODOS = {
  construir: { carga: () => import('../juego/main.js'), menu: '#menu', nombre: 'Construir' },
  duelo: { carga: () => import('../combate/main.js'), menu: '#menu', nombre: 'Duelo' },
  personaje: { carga: () => import('../personaje/main.js'), menu: '#estilos', nombre: 'Personaje' },
};
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const modo = params.get('modo');

// enlace a otra parte de la demo, conservando el resto de parámetros (idioma, carpetas de recursos)
function enlace(m) {
  const p = new URLSearchParams(location.search);
  if (m) p.set('modo', m); else p.delete('modo');
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
  window.__rendimiento = { medida: medidaRendimiento, gente: (n) => genteDePrueba() && genteDePrueba().poner(n) };
  // los números de rendimiento junto a «Menú» (src/demo/rendimiento.js), cuando la parte ya ha puesto sus botones
  MODOS[modo].carga().then(() => { ponerRendimiento(b); window.__demo.listo = true; }).catch(e => { window.__demo.error = e.message; console.error(e); });
} else {
  // el menú
  document.title = 'Kinhold';
  traducirPagina();
  botonesIdioma($('demoIdioma'));
  for (const a of document.querySelectorAll('[data-ir]')) a.href = enlace(a.dataset.ir);
  $('demoPersonaje').textContent = resumenPersonaje();
  $('demoNotas').innerHTML = `<b>${tr(VERSION_DEMO)}</b><ul>${REGISTRO_DEMO.map(t => `<li>${tr(t)}</li>`).join('')}</ul>`;
  $('btnDemoNotas').onclick = () => { $('demoNotas').hidden = !$('demoNotas').hidden; };
  window.__demo = { modo: null, listo: true };
}
