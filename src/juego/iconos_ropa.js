// La imagen de cada prenda en el panel de equipo (valravnx, 7 nov: «con las imágenes y estilo del menú de crafteo»).
// La ropa no tiene un modelo suelto que fotografiar (se dibuja puesta en el personaje, src/personajes/makehuman.js),
// así que su imagen es la prenda doblada y extendida, dibujada aquí en SVG con su color de verdad: el de su tinte
// (src/logica/tintes.js) o el de la tela sin teñir, con un sombreado suave, sus costuras y lo que la distingue (el
// acolchado del gambesón, las anillas de la cota, la paja del sombrero). Mismo encuadre que las de los modelos.
import { PRENDAS } from '../logica/prendas.js';
import { PRENDAS_TENIBLES, paletaDe } from '../logica/tintes.js';

const rgb = (c, f = 1) => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * f)))).join(',')})`;
// el color de la prenda: su tinte o su color sin teñir; lo que no se tiñe, el suyo
const PROPIO = { cota: [128, 130, 132], sombrero: [178, 150, 92] };
function colorDe(tipo, cosa) {
  const dib = PRENDAS[tipo] ? PRENDAS[tipo].dibujo : tipo;
  if (PROPIO[dib]) return PROPIO[dib];
  const t = PRENDAS_TENIBLES[dib];
  const tinte = cosa && cosa.tinte && paletaDe(dib)[cosa.tinte];
  return (tinte && tinte[1]) || (t && t.natural) || [128, 112, 90];
}

// Las siluetas, en un cuadro de 100 × 100 (la prenda extendida, vista de frente).
const FORMAS = {
  camisa: 'M36 14 L64 14 L84 22 L96 50 L86 54 L76 34 L74 86 L26 86 L24 34 L14 54 L4 50 L16 22 Z',
  tunica: 'M37 12 L63 12 L84 20 L95 46 L85 50 L74 32 L78 90 L22 90 L26 32 L15 50 L5 46 L16 20 Z',
  vestido: 'M38 8 L62 8 L82 16 L93 42 L84 46 L72 28 L84 95 L16 95 L28 28 L16 46 L7 42 L18 16 Z',
  gambeson: 'M36 12 L64 12 L84 20 L95 48 L85 52 L74 33 L76 88 L24 88 L26 33 L15 52 L5 48 L16 20 Z',
  cota: 'M36 12 L64 12 L83 20 L94 46 L84 50 L73 32 L76 88 L24 88 L27 32 L16 50 L6 46 L17 20 Z',
  sobreveste: 'M35 8 L65 8 L72 16 L70 30 L80 94 L20 94 L30 30 L28 16 Z',
  manto: 'M44 10 L56 10 L60 14 C80 26 92 60 96 92 L4 92 C8 60 20 26 40 14 Z',
  calzas: 'M28 8 L72 8 L74 30 L70 94 L54 94 L51 38 L49 38 L46 94 L30 94 L26 30 Z',
  capucha: 'M50 8 C70 8 80 24 80 40 L80 52 C90 58 96 70 96 80 L4 80 C4 70 10 58 20 52 L20 40 C20 24 30 8 50 8 Z',
  toca: 'M50 10 C70 10 82 26 82 46 L88 88 L12 88 L18 46 C18 26 30 10 50 10 Z',
  sombrero: 'M8 66 C8 56 30 52 50 52 C70 52 92 56 92 66 C92 76 70 80 50 80 C30 80 8 76 8 66 Z M32 56 C32 34 40 24 50 24 C60 24 68 34 68 56 Z',
  zapatos: 'M10 60 L12 46 L30 44 L36 52 L46 56 L48 66 L10 66 Z M54 70 L56 56 L74 54 L80 62 L92 66 L92 76 L54 76 Z',
  botas: 'M14 20 L32 20 L33 54 L46 60 L48 72 L12 72 Z M56 24 L74 24 L75 58 L88 64 L90 76 L54 76 Z',
};
// lo de dentro: costuras, el hueco del cuello, el acolchado, las anillas, la paja…
function detalles(dib, oscuro, claro) {
  const linea = (d, c = oscuro, w = 1.2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
  switch (dib) {
    case 'camisa': return linea('M42 14 L50 26 L58 14') + linea('M50 26 L50 40') + linea('M24 34 L26 84', claro, 0.8) + linea('M76 34 L74 84', claro, 0.8);
    case 'tunica': case 'vestido': return linea('M42 13 Q50 22 58 13') + linea(`M30 ${dib === 'vestido' ? 60 : 56} L70 ${dib === 'vestido' ? 60 : 56}`, oscuro, 0.8);
    case 'gambeson': return [30, 38, 46, 54, 62, 70].map(x => linea(`M${x} 30 L${x} 86`, oscuro, 0.9)).join('') + linea('M42 12 L50 24 L58 12') + linea('M50 24 L50 88', oscuro, 1.4);
    case 'cota': {
      let s = '';
      for (let y = 22; y < 88; y += 5) for (let x = 20 + (y % 10 ? 2.5 : 0); x < 82; x += 5) s += `<circle cx="${x}" cy="${y}" r="1.7" fill="none" stroke="${oscuro}" stroke-width=".7"/>`;
      return `<g clip-path="url(#IDc)">${s}</g>` + linea('M42 12 Q50 20 58 12', claro, 1.4);
    }
    case 'sobreveste': return linea('M40 8 Q50 18 60 8') + linea('M50 60 L50 94', oscuro, 0.9);
    case 'manto': return `<circle cx="50" cy="16" r="4" fill="#8c7a52" stroke="${oscuro}" stroke-width=".8"/>` + linea('M50 20 L50 92', oscuro, 0.7) + linea('M36 30 Q30 60 24 92', claro, 0.8) + linea('M64 30 Q70 60 76 92', claro, 0.8);
    case 'calzas': return linea('M30 16 L70 16', oscuro, 0.9) + linea('M50 16 L50 36', oscuro, 0.9);
    case 'capucha': return `<path d="M50 20 C62 20 68 30 68 42 C68 50 60 56 50 56 C40 56 32 50 32 42 C32 30 38 20 50 20 Z" fill="${oscuro}" opacity=".55"/>`;
    case 'toca': return `<path d="M50 22 C62 22 70 32 70 46 L68 60 L32 60 L30 46 C30 32 38 22 50 22 Z" fill="${oscuro}" opacity=".25"/>` + linea('M18 70 Q50 78 82 70', oscuro, 0.8);
    case 'sombrero': return [36, 42, 48, 54, 60, 66].map(x => linea(`M${x} 30 L${x - 2} 56`, oscuro, 0.6)).join('') + linea('M14 66 Q50 74 86 66', oscuro, 0.7) + `<path d="M33 50 L67 50 L68 56 L32 56 Z" fill="${oscuro}" opacity=".6"/>`;
    case 'zapatos': return linea('M14 52 L28 50', oscuro, 0.8) + linea('M58 62 L72 60', oscuro, 0.8) + `<path d="M10 66 L48 66" stroke="${oscuro}" stroke-width="2"/><path d="M54 76 L92 76" stroke="${oscuro}" stroke-width="2"/>`;
    case 'botas': return linea('M14 30 L32 30', oscuro, 0.9) + linea('M56 34 L74 34', oscuro, 0.9) + `<path d="M12 72 L48 72" stroke="${oscuro}" stroke-width="2"/><path d="M54 76 L90 76" stroke="${oscuro}" stroke-width="2"/>`;
  }
  return '';
}

let n = 0;
// La imagen de una prenda del catálogo (tipo), con el tinte de esa prenda (cosa.tinte): un SVG para meter en el panel.
export function svgPrenda(tipo, cosa = null) {
  const dib = PRENDAS[tipo] ? PRENDAS[tipo].dibujo : null;
  const forma = dib && FORMAS[dib];
  if (!forma) return '';
  const c = colorDe(tipo, cosa), id = 'pr' + (++n);
  const oscuro = rgb(c, 0.62), claro = rgb(c, 1.25);
  const det = detalles(dib, oscuro, claro).replaceAll('IDc', id + 'c');
  return `<svg class="ic-prenda" viewBox="0 0 100 100" aria-hidden="true"><defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${rgb(c, 1.12)}"/><stop offset="1" stop-color="${rgb(c, 0.8)}"/></linearGradient>
    <clipPath id="${id}c"><path d="${forma}"/></clipPath></defs>
    <path d="${forma}" fill="url(#${id}g)" stroke="${oscuro}" stroke-width="1.6" stroke-linejoin="round"/>${det}</svg>`;
}
