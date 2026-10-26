// Kinhold — los números de rendimiento a la vista en la demo única.
// Junto al botón «Menú» sale un botón con los fotogramas por segundo; al pulsarlo se abre el detalle: tiempo de
// cada fotograma, triángulos, llamadas de dibujo, memoria y personajes en escena. En «Construir» se pueden añadir
// personajes de prueba para medir con gente. Las medidas salen de src/mundo/rendimiento.js.
import { tr } from '../idioma.js';
import { medidaRendimiento, genteDePrueba } from '../mundo/rendimiento.js';

const CSS = `
#btnDemoFps{min-width:62px;font-variant-numeric:tabular-nums}
#btnDemoFps.lento{color:#f0b8a8}
#demoRend{position:fixed;z-index:20;left:calc(10px + env(safe-area-inset-left,0px));width:min(340px,calc(100vw - 20px));background:rgba(36,30,24,.92);color:#f1e8d8;
  border:1px solid rgba(241,232,216,.15);border-radius:12px;padding:10px 12px;font:12.5px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#demoRend b{color:#d9a441}
#demoRend table{border-collapse:collapse;width:100%;margin:6px 0;font-variant-numeric:tabular-nums}
#demoRend td{padding:2px 0;vertical-align:top} #demoRend td:first-child{color:#bfb19a;padding-right:10px;white-space:nowrap}
#demoRend .gente{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
#demoRend button{font:inherit;color:#f1e8d8;background:rgba(58,48,38,.92);border:1px solid rgba(241,232,216,.15);border-radius:8px;padding:4px 9px;cursor:pointer}
#demoRend button.sel{background:#d9a441;color:#241b10;border-color:transparent;font-weight:600}
#demoRend p{margin:6px 0 0;color:#bfb19a}
#demoRend[hidden]{display:none!important}
`;
const GENTE = [0, 4, 8, 16];
const miles = (n) => (n / 1000).toFixed(n < 10000 ? 1 : 0);

// pone el botón detrás de `boton` (el de «Menú») y el panel; devuelve la función que refresca los números
export function ponerRendimiento(boton) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const b = document.createElement('button');
  b.id = 'btnDemoFps'; b.textContent = '… fps'; b.title = tr('Rendimiento');
  boton.after(b);
  const panel = document.createElement('div');
  panel.id = 'demoRend'; panel.hidden = true;
  document.body.appendChild(panel);
  const colocar = () => { const r = b.getBoundingClientRect(); panel.style.top = Math.round(r.bottom + 8) + 'px'; };
  b.onclick = () => { panel.hidden = !panel.hidden; b.classList.toggle('sel', !panel.hidden); colocar(); refrescar(); };
  addEventListener('resize', colocar);

  function refrescar() {
    const m = medidaRendimiento();
    if (!m || !m.fps) return;
    b.textContent = tr('{f} fps', { f: m.fps });
    b.classList.toggle('lento', m.fps < 30);
    if (panel.hidden) return;
    const g = genteDePrueba();
    const mem = m.memoriaJS === null ? tr('este navegador no la dice') : tr('{n} MB', { n: m.memoriaJS });
    const filas = [
      [tr('Fotogramas'), tr('{f} por segundo', { f: m.fps })],
      [tr('Cada fotograma'), tr('{m} ms de media; el más lento, {p} ms', { m: m.ms, p: m.peor })],
      [tr('Resolución'), `${m.ancho}×${m.alto} (${m.resolucion}×)`],
      [tr('Triángulos'), tr('{t} mil por fotograma', { t: miles(m.triangulos) })],
      [tr('Llamadas de dibujo'), String(m.dibujados)],
      [tr('Memoria gráfica'), tr('{g} geometrías y {x} texturas', { g: m.geometrias, x: m.texturas })],
      [tr('Memoria de JavaScript'), mem],
      [tr('Personajes en escena'), String(m.personajes)],
    ];
    panel.innerHTML = `<b>${tr('Rendimiento en este aparato')}</b><table>${filas.map(f => `<tr><td>${f[0]}</td><td>${f[1]}</td></tr>`).join('')}</table>` +
      (g ? `<div class="gente">${tr('Personajes de prueba:')} ${GENTE.map(n => `<button data-gente="${n}" class="${g.cuantos() === n ? 'sel' : ''}">${n}</button>`).join('')}</div>` : '') +
      `<p>${tr('Pedro: dime los fps que ves en tu móvil (y qué móvil es), en «Construir» y en «Duelo». Con eso se decide cuánto detalle aguanta.')}</p>`;
    for (const x of panel.querySelectorAll('[data-gente]')) x.onclick = () => { g.poner(+x.dataset.gente); refrescar(); };
  }
  setInterval(refrescar, 1000);
  return refrescar;
}
