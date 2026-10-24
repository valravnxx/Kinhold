// Idioma de los prototipos jugables. La clave de cada texto es el propio texto en español;
// los diccionarios (src/idiomas/<idioma>.json) dan la traducción. Si falta una, sale el español
// y se apunta en window.__idioma.faltan (las pruebas fallan si queda alguna).
// Para añadir un idioma (ruso): llenar src/idiomas/ru.json y ponerlo en DISPONIBLES.
import EN from './idiomas/en.json';
import RU from './idiomas/ru.json';

const DICC = { en: EN, ru: RU };
// Solo se ofrecen los idiomas con diccionario lleno. El ruso está preparado pero vacío.
export const DISPONIBLES = ['es', ...Object.keys(DICC).filter(k => Object.keys(DICC[k]).length)];
const NOMBRE = { es: 'ES', en: 'EN', ru: 'RU' };
// Misma clave que la web de progreso: elegir idioma en la web vale también para el juego.
const CLAVE = 'kinhold_web_idioma';

function detectar() {
  const q = new URLSearchParams(location.search).get('lang');
  if (DISPONIBLES.includes(q)) return q;
  try { const g = localStorage.getItem(CLAVE); if (DISPONIBLES.includes(g)) return g; } catch (e) { /* sin almacenamiento */ }
  const n = (navigator.language || 'es').slice(0, 2);
  return DISPONIBLES.includes(n) ? n : (n === 'es' || n === 'ca' ? 'es' : DISPONIBLES.includes('en') ? 'en' : 'es');
}

export const idioma = typeof location === 'undefined' ? 'es' : detectar();
const faltan = new Set();
// textos ya traducidos (para no volver a traducirlos ni contarlos como que faltan)
const YA = new Set(idioma === 'es' ? [] : Object.values(DICC[idioma]));
if (typeof window !== 'undefined') window.__idioma = { idioma, faltan, DISPONIBLES };

// tr('Diana a {d} m', { d: 20 }) → 'Target at 20 m'
export function tr(s, vars) {
  let r = s;
  if (idioma !== 'es' && s) {
    const d = DICC[idioma];
    if (d[s] !== undefined) r = d[s];
    else if (!YA.has(s)) faltan.add(s);
  }
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return r;
}

// Traduce la página: los elementos con data-tr cambian su HTML entero (clave: el HTML en español,
// con los espacios normalizados); el resto, cada texto suelto y los title/placeholder.
const norm = (s) => s.replace(/\s+/g, ' ').trim();
export function traducirPagina(raiz = document.body) {
  document.documentElement.lang = idioma;
  if (idioma === 'es') return;
  for (const el of raiz.querySelectorAll('[data-tr]')) el.innerHTML = tr(norm(el.innerHTML));
  const recorrer = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nodos = [];
  while (recorrer.nextNode()) nodos.push(recorrer.currentNode);
  for (const n of nodos) {
    if (n.parentElement.closest('[data-tr], script, style')) continue;
    const s = norm(n.nodeValue);
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/.test(s)) continue;
    n.nodeValue = n.nodeValue.replace(s, tr(s));
  }
  for (const el of raiz.querySelectorAll('[title],[placeholder]')) {
    for (const a of ['title', 'placeholder']) if (el.hasAttribute(a)) el.setAttribute(a, tr(el.getAttribute(a)));
  }
  if (document.title) document.title = tr(document.title);
}

// Botones de idioma (ES · EN). Al cambiar se guarda y se recarga: la partida guardada no se pierde.
export function botonesIdioma(contenedor) {
  if (DISPONIBLES.length < 2) return;
  for (const l of DISPONIBLES) {
    const b = document.createElement('button');
    b.textContent = NOMBRE[l];
    b.className = 'idioma' + (l === idioma ? ' sel' : '');
    b.dataset.idioma = l;
    b.onclick = () => {
      if (l === idioma) return;
      try { localStorage.setItem(CLAVE, l); } catch (e) { /* sin almacenamiento */ }
      const u = new URL(location.href); u.searchParams.delete('lang');
      location.href = u.toString();
    };
    contenedor.appendChild(b);
  }
}
