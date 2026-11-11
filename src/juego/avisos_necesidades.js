// Kinhold — las necesidades en pantalla (P4; GDD, apartado 6). Las lleva el servidor (src/logica/necesidades.js); aquí
// solo se dibujan, con los medallones de latón del estudio de la interfaz (diseno/estudios/interfaz.html, 2.7; el kit
// renderizado, recursos/interfaz-v1/medallon.webp y sus iconos repujados):
//   - los cuatro medallones arriba a la derecha (hambre, sed, frío y cansancio), siempre que haya necesidades. El aro
//     dice lo que te queda (lleno, bien; vacío, al máximo) y su color, cómo vas: verde si va bien (y entonces el
//     medallón, medio transparente), ámbar en aviso (desde AVISO), rojo la que va mal (desde FUERTE); el frío, azul,
//     y cuando no hay frío, el medallón del calor;
//   - la que va mal, más grande, con su flecha (▼ empeora, ▲ mejora) y su nombre debajo; las de aviso, con su flecha;
//   - al pulsarlo, su ficha en un tablero de roble: qué te pasa y cómo se quita, en dos líneas. Se cierra al pulsar
//     fuera o el mismo medallón. La del cansancio lleva el botón de sentarse;
//   - el frío escarcha los bordes de la pantalla, más cuanto más frío (desde AVISO).
import { NECESIDADES, AVISO, FUERTE, MAXIMO, efectos } from '../logica/necesidades.js';
import { tr } from '../idioma.js';

import { CARPETA_INTERFAZ } from '../logica/iconos.js';

const KIT = '../../' + CARPETA_INTERFAZ;
// los colores del estudio (maqueta_v8): bien, aviso, mal y, para el frío, el azul (y el calor cuando no hay frío)
const TONO = { bien: '#7fb383', aviso: '#e2aa4c', mal: '#d9583a', frio: '#86b4e6', calor: '#d39a55' };
const NOMBRE = { hambre: 'Hambre', sed: 'Sed', frio: 'Frío', cansancio: 'Cansancio' };   // (con tr al enseñarlos)
// la segunda línea de la ficha: el verbo y cómo se quita
const COMO = {
  hambre: () => [tr('Come:'), tr('bayas, setas o carne de caza (asada sacia más).')],
  sed: () => [tr('Bebe:'), tr('en la orilla de un río o de un lago.')],
  frio: () => [tr('Caliéntate:'), tr('junto al fuego, bajo techo o con más ropa.')],
  cansancio: () => [tr('Descansa:'), tr('siéntate o duerme.')],
};
// cómo va cada una: 'bien' (por debajo de AVISO), 'aviso' o 'mal' (desde FUERTE)
const estadoDe = (v) => v >= FUERTE ? 'mal' : v >= AVISO ? 'aviso' : 'bien';
const tonoDe = (k, est) => k === 'frio' ? (est === 'bien' ? TONO.calor : TONO.frio) : TONO[est];
const iconoDe = (k, est) => k === 'frio' && est === 'bien' ? 'g_calor' : 'g_' + k;
// la primera línea de la ficha: qué te pasa ahora, por cómo está
function queTePasa(que, n) {
  const v = n[que], e = efectos(n);
  if (que === 'cansancio') return v >= MAXIMO ? tr('Rendido: no puedes correr ni golpear fuerte.') : tr('Al máximo no podrás correr ni golpear fuerte.');
  if (que === 'frio') return v >= MAXIMO ? tr('Helado: te mueves torpe y te cansas el doble.') : v >= AVISO ? tr('Al máximo te moverás torpe.') : tr('Vas templado.');
  if (v >= MAXIMO) return que === 'sed' ? tr('Te cansas el doble y, si no bebes, al rato mueres.') : tr('Te cansas el doble y, si no comes, al rato mueres.');
  if (e.cansancioRapido) return tr('Te cansas el doble (otra necesidad está al máximo).');
  return v >= AVISO ? tr('Al máximo te cansarás el doble.') : tr('Vas bien.');
}

// op.sentarse(): sentarse o levantarse (P4, 8 nov); op.sentado(): si está sentado. La ficha del cansancio lleva su botón.
export function montarAvisos(op = {}) {
  const estilo = document.createElement('style');
  estilo.textContent = `
#avisosNec{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));top:calc(14px + env(safe-area-inset-top,0px));display:flex;gap:10px;align-items:flex-start;z-index:6}
#avisosNec .med{position:relative;width:var(--t);height:var(--t);border:0;padding:0;min-width:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;
  background:url(${KIT}medallon.webp) center/contain no-repeat;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6));transition:width .25s,height .25s,opacity .25s}
#avisosNec .med svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);pointer-events:none}
#avisosNec .med>img{width:44%;height:44%;position:relative;pointer-events:none}
#avisosNec .med.quieto{opacity:.55}
#avisosNec .med .fl{position:absolute;right:-3px;top:-5px;font:700 14px 'EB Garamond',Georgia,serif;text-shadow:0 1px 2px #000;pointer-events:none}
#avisosNec .med:last-child .nom{left:auto;right:0;transform:none}
#avisosNec .med .nom{position:absolute;top:100%;margin-top:1px;left:50%;transform:translateX(-50%);font:16px 'Alegreya SC',Georgia,serif;white-space:nowrap;pointer-events:none;
  text-shadow:0 1px 1px #000,0 0 3px #000,0 0 10px rgba(0,0,0,.75)}
#fichaNec{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));width:310px;z-index:31;padding:22px 24px 20px;border-radius:4px;isolation:isolate;
  color:#f1e6cf;font:16px/1.3 'EB Garamond',Georgia,serif;text-shadow:0 1px 1px #000;box-shadow:0 12px 30px rgba(0,0,0,.55);
  background:linear-gradient(rgba(18,11,5,.35),rgba(18,11,5,.35)),radial-gradient(ellipse at 50% 40%,rgba(30,18,9,.15),rgba(14,8,4,.55)),url(${KIT}tablero.webp) top center/1024px auto repeat-y #24170c}
#fichaNec::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border:20px solid transparent;border-image:url(${KIT}marco.webp) 52 / 20px stretch}
#fichaNec h3{margin:0 0 4px;display:flex;gap:8px;align-items:center;font:21px 'Alegreya SC',Georgia,serif}
#fichaNec h3 img{width:24px;height:24px}
#fichaNec p{margin:3px 0}
#fichaNec .como b{color:#e9c27a;font-weight:600}
#fichaNec .sentarse{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:9px;padding:7px 14px;min-width:0;border:0;border-radius:5px;cursor:pointer;position:relative;z-index:3;
  font:17px 'Alegreya SC',Georgia,serif;color:#fff5df;background:linear-gradient(#b48a45,#6e4f22);box-shadow:inset 0 0 0 1px rgba(255,230,170,.8),inset 0 1px 0 rgba(255,240,200,.5),0 3px 8px rgba(0,0,0,.5)}
#fichaNec .sentarse kbd{font:600 12px 'EB Garamond',serif;border:1px solid rgba(255,240,200,.55);border-radius:3px;padding:0 4px;opacity:.85}
body.hub-abierto #fichaNec{display:none}
#escarchaNec{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity 1.2s;
  background:radial-gradient(ellipse 75% 70% at 50% 50%,transparent 60%,rgba(190,215,240,.2) 76%,rgba(225,238,252,.6) 100%)}
@media (max-width:640px){
  #avisosNec{right:calc(12px + env(safe-area-inset-right,0px));top:calc(16px + env(safe-area-inset-top,0px));gap:7px}
  #fichaNec{left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px));width:auto}
}`;
  document.head.appendChild(estilo);
  const escarcha = document.createElement('div'); escarcha.id = 'escarchaNec';
  document.body.appendChild(escarcha);
  const col = document.createElement('div'); col.id = 'avisosNec'; col.hidden = true;
  document.body.appendChild(col);
  const ficha = document.createElement('div'); ficha.id = 'fichaNec'; ficha.hidden = true;
  document.body.appendChild(ficha);
  const R = 36.5, L = 2 * Math.PI * R;
  const botones = {};
  for (const k of NECESIDADES) {
    const b = document.createElement('button');
    b.className = 'med aviso-nec quieto'; b.dataset.que = k;
    b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" fill="none" stroke-width="9" stroke-linecap="round" opacity=".92"/></svg><img alt=""><span class="fl"></span><span class="nom"></span>`;
    b.onclick = (ev) => { ev.stopPropagation(); abierta === k ? cerrar() : abrir(k); };
    col.appendChild(b); botones[k] = b;
  }
  let actual = null, abierta = null;
  // la flecha: cómo iba hace unos segundos (para saber si empeora o mejora)
  const antes = {}; let tAntes = 0;
  const movil = () => matchMedia('(max-width:640px)').matches;
  function pintarFicha() {
    if (!abierta || !actual) return;
    const k = abierta, est = estadoDe(actual[k]), c = tonoDe(k, est);
    const [verbo, como] = COMO[k]();
    ficha.innerHTML = `<h3 style="color:${c}"><img src="${KIT}${iconoDe(k, est)}.webp" alt="">${tr(NOMBRE[k])}</h3>` +
      `<p>${queTePasa(k, actual)}</p><p class="como"><b>${verbo}</b> ${como}</p>` +
      (k === 'cansancio' && op.sentarse ? `<button class="sentarse">${op.sentado && op.sentado() ? tr('Levantarte') : tr('Sentarte a descansar')}${movil() ? '' : '<kbd>Z</kbd>'}</button>` : '');
    const bs = ficha.querySelector('.sentarse');
    if (bs) bs.onclick = (ev) => { ev.stopPropagation(); op.sentarse(); };
    // debajo de los medallones y de su nombre (con la medida del grande: el tamaño cambia con una transición)
    const r = col.getBoundingClientRect();
    ficha.style.top = `${Math.round(r.top + (movil() ? 52 : 58) + 24)}px`;
  }
  function abrir(k) { abierta = k; ficha.hidden = false; ficha.dataset.que = k; pintarFicha(); }
  function cerrar() { abierta = null; ficha.hidden = true; }
  document.addEventListener('pointerdown', (e) => { if (abierta && !ficha.contains(e.target) && !col.contains(e.target)) cerrar(); });

  // n: las necesidades como llegan del servidor (o null: sin ellas, nada)
  function pintar(n) {
    actual = n;
    col.hidden = !n;
    escarcha.style.opacity = n ? String(Math.max(0, Math.min(1, (n.frio - AVISO) / (MAXIMO - AVISO)))) : '0';
    if (!n) { cerrar(); return; }
    const ahora = performance.now();
    if (ahora - tAntes > 3000) { for (const k of NECESIDADES) antes[k] = antes.ultimo ? antes.ultimo[k] : n[k]; antes.ultimo = { ...n }; tAntes = ahora; }
    const base = movil() ? 40 : 44, grande = movil() ? 52 : 58;
    const peor = NECESIDADES.reduce((a, k) => n[k] > n[a] ? k : a, NECESIDADES[0]);
    for (const k of NECESIDADES) {
      const b = botones[k], v = Math.max(0, Math.min(MAXIMO, n[k])), est = estadoDe(v), c = tonoDe(k, est);
      const circ = b.querySelector('circle');
      circ.setAttribute('stroke', c);
      circ.setAttribute('stroke-dasharray', `${L * Math.max(0.02, 1 - v / MAXIMO)} ${L}`);
      circ.style.filter = `drop-shadow(0 0 2.5px ${c})`;
      const img = b.querySelector('img'), src = `${KIT}${iconoDe(k, est)}.webp`;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      b.style.setProperty('--t', `${est === 'mal' ? grande : base}px`);
      b.style.setProperty('--c', c);
      b.classList.toggle('quieto', est === 'bien');
      b.classList.toggle('fuerte', est === 'mal');
      b.dataset.estado = est;
      // la flecha: ▼ si va a peor, ▲ si mejora (solo en aviso o mal); el nombre, en la que peor va (si va mal)
      const d = v - (antes[k] ?? v);
      const fl = est === 'bien' ? '' : d > 0.05 ? '▼' : d < -0.05 ? '▲' : '';
      const sf = b.querySelector('.fl'); sf.textContent = fl; sf.style.color = c;
      const sn = b.querySelector('.nom'); sn.textContent = est === 'mal' && k === peor ? tr(NOMBRE[k]) : ''; sn.style.color = c;
      b.title = tr(NOMBRE[k]);
      b.setAttribute('aria-label', `${tr(NOMBRE[k])} · ${Math.round(v)}%`);
    }
    pintarFicha();
  }
  return {
    pintar, abrir, cerrar,
    get abierta() { return abierta; },
    // para las pruebas: los que van en aviso o mal (los que no están medio transparentes)
    get visibles() { return actual ? NECESIDADES.filter(k => actual[k] >= AVISO) : []; },
  };
}
export { AVISO, FUERTE };
