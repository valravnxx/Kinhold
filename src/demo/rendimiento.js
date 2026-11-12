// Kinhold — los números de rendimiento a la vista en la demo única.
// Junto al botón «Menú» sale un botón con los fotogramas por segundo; al pulsarlo se abre el detalle: tiempo de
// cada fotograma, triángulos, llamadas de dibujo, memoria y personajes en escena. En «Construir» se pueden añadir
// personajes de prueba para medir con gente. Las medidas salen de src/mundo/rendimiento.js.
import { tr } from '../idioma.js';
import { medidaRendimiento, genteDePrueba } from '../mundo/rendimiento.js';

const CSS = `
#btnDemoFps{min-width:62px;font-variant-numeric:tabular-nums}
#btnDemoFps.lento:not(.sel){color:#f0b8a8}
#btnDemoFps.suelto{position:fixed;z-index:9;left:calc(10px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%)}
#demoRend{position:fixed;z-index:20;left:calc(10px + env(safe-area-inset-left,0px));width:min(340px,calc(100vw - 20px));background:rgba(36,30,24,.97);color:#f1e8d8;overflow:auto;
  border:1px solid rgba(241,232,216,.15);border-radius:12px;padding:10px 12px;font:12.5px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#demoRend b{color:#d9a441}
#demoRend table{border-collapse:collapse;width:100%;margin:6px 0;font-variant-numeric:tabular-nums}
#demoRend td{padding:2px 0;vertical-align:top} #demoRend td:first-child{color:#bfb19a;padding-right:10px;white-space:nowrap}
#demoRend .gente{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
#demoRend button{font:inherit;color:#f1e8d8;background:rgba(58,48,38,.92);border:1px solid rgba(241,232,216,.15);border-radius:8px;padding:4px 9px;cursor:pointer}
#demoRend button.sel{background:#d9a441;color:#241b10;border-color:transparent;font-weight:600}
#demoRend p{margin:6px 0 0;color:#bfb19a}
#demoRend .perfiles button{margin:2px 0}
#demoRend[hidden]{display:none!important}
`;
const GENTE = [0, 4, 8, 16, 20];
const miles = (n) => (n / 1000).toFixed(n < 10000 ? 1 : 0);

// pone el botón detrás de `boton` (el de «Menú») y el panel; devuelve la función que refresca los números
export function ponerRendimiento(boton) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const b = document.createElement('button');
  b.id = 'btnDemoFps'; b.textContent = '… fps'; b.title = tr('Rendimiento');
  const panel = document.createElement('div');
  panel.id = 'demoRend'; panel.hidden = true;
  // en el juego, en Ajustes (el menú con pestañas: estudio de la interfaz, 7 nov), con su detalle debajo
  const ajustes = document.getElementById('ajustesRend');
  if (ajustes) {
    const fila = document.createElement('div'); fila.className = 'tierra-fila';
    fila.innerHTML = `<span>${tr('Rendimiento y calidad gráfica')}<br><small class="tierra-sub">${tr('Púlsalo para ver el detalle y elegir la calidad.')}</small></span>`;
    b.classList.add('boton-t'); fila.appendChild(b); ajustes.append(fila, panel);
  } else {
    // junto a «Menú»; si ahí la fila de botones crece (móvil estrecho) y taparía otras cosas, va suelto a la izquierda
    const caja = boton.parentElement, alto = caja.getBoundingClientRect().height;
    boton.after(b);
    if (caja !== document.body && caja.getBoundingClientRect().height > alto + 4) { b.classList.add('suelto'); document.body.appendChild(b); }
    document.body.appendChild(panel);
  }
  const colocar = () => { if (ajustes) return; const r = b.getBoundingClientRect(); panel.style.top = Math.round(r.bottom + 8) + 'px'; panel.style.maxHeight = Math.max(160, innerHeight - r.bottom - 18) + 'px'; };
  b.onclick = () => { panel.hidden = !panel.hidden; b.classList.toggle('sel', !panel.hidden); colocar(); refrescar(); };
  addEventListener('resize', colocar);

  function refrescar() {
    const m = medidaRendimiento();
    // aún sin medida (ms 0); con fotogramas de más de 2 s los fps redondean a 0, y el panel tiene que salir igual
    if (!m || !m.ms) return;
    b.textContent = tr('{f} fps', { f: m.fps });
    b.classList.toggle('lento', m.fps < 30);
    if (panel.hidden) return;
    const g = genteDePrueba();
    const G = window.__graficos || null;   // el perfil gráfico del juego (src/juego/graficos.js), si esta parte lo tiene
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
      ...(window.__graficos ? [[tr('Perfil gráfico'), tr('{p}, {n} pasadas', { p: tr(window.__graficos.PERFILES.find(p => p.id === window.__graficos.perfil).nombre), n: window.__graficos.pasadas })]] : []),
    ];
    // niveles de detalle de los personajes (src/logica/detalle.js): cuántos hay en cada uno
    if (g && g.niveles) { const n = g.niveles(); filas.push([tr('Niveles de detalle'), tr('cerca {a}, medio {b}, lejos {c}, sin dibujar {d}', { a: n[0], b: n[1], c: n[2], d: n[3] })]); }
    panel.innerHTML = `<b>${tr('Rendimiento en este aparato')}</b><table>${filas.map(f => `<tr><td>${f[0]}</td><td>${f[1]}</td></tr>`).join('')}</table>` +
      (g ? `<div class="gente">${tr('Personajes de prueba:')} ${GENTE.map(n => `<button data-gente="${n}" class="${g.cuantos() === n ? 'sel' : ''}">${n}</button>`).join('')}</div>` : '') +
      (g && g.detalle ? `<div class="gente">${tr('Niveles de detalle:')} <button data-detalle="1" class="${g.detalle() ? 'sel' : ''}">${tr('sí')}</button><button data-detalle="0" class="${g.detalle() ? '' : 'sel'}">${tr('no (todos enteros)')}</button></div>` : '') +
      (G ? `<div class="gente perfiles">${tr('Calidad gráfica:')} ${G.PERFILES.map(p => `<button data-perfil="${p.id}" class="${G.perfil === p.id ? 'sel' : ''}">${tr(p.nombre)}${p.id === G.sugerido ? ' ★' : ''}</button>`).join('')}</div>` +
        `<p>${tr('★ el que sugiere este aparato. El que elijas se queda guardado en este navegador.')}</p>` +
        (G.ponerMaqueta ? `<div class="gente">${tr('Desenfoque de maqueta:')} <button data-maqueta="1" class="${G.maqueta ? 'sel' : ''}">${tr('sí')}</button><button data-maqueta="0" class="${G.maqueta ? '' : 'sel'}">${tr('no')}</button>${G.puedeMaqueta ? '' : ` <small>${tr('(esta calidad no lo lleva)')}</small>`}</div>` : '') : '');
    for (const x of panel.querySelectorAll('[data-gente]')) x.onclick = () => { g.poner(+x.dataset.gente); refrescar(); };
    for (const x of panel.querySelectorAll('[data-perfil]')) x.onclick = () => { G.poner(x.dataset.perfil); refrescar(); };
    for (const x of panel.querySelectorAll('[data-maqueta]')) x.onclick = () => { G.ponerMaqueta(x.dataset.maqueta === '1'); refrescar(); };
    for (const x of panel.querySelectorAll('[data-detalle]')) x.onclick = () => { g.detalle(x.dataset.detalle === '1'); refrescar(); };
  }
  setInterval(refrescar, 1000);
  return refrescar;
}
