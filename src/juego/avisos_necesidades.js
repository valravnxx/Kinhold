// Kinhold — los avisos de las necesidades (P4; GDD, apartado 6: «con avisos en círculos a la derecha; al pulsarlos,
// efecto e información»). Las necesidades las lleva el servidor (src/logica/necesidades.js); aquí solo se dibujan:
//   - un círculo por necesidad, solo cuando hace falta (desde AVISO), con su color (documento de sistemas, apartado
//     10: hambre naranja, sed azul, frío celeste, cansancio gris), su dibujo y un anillo de lo lleno que está; en
//     fuerte (desde FUERTE) late;
//   - al pulsarlo, su ficha: cómo estás, qué te pasa y cómo se quita. Se cierra al pulsar fuera o el mismo círculo.
// Van en una columna a la derecha, a la izquierda de los botones de modo (Mover, Construir…); en el móvil, en fila
// justo debajo de ellos (arriba están los botones del menú). No tapan ningún botón.
import { NECESIDADES, AVISO, FUERTE, MAXIMO, avisos, efectos } from '../logica/necesidades.js';
import { tr } from '../idioma.js';

const COLOR = { hambre: '#d9822b', sed: '#3f7fd0', frio: '#7cc6e0', cansancio: '#9a958c' };
// dibujos sencillos (24 × 24): un cuenco con vaho, una gota, un copo y una luna menguante
const DIBUJO = {
  hambre: '<path d="M3 12h18a9 8 0 0 1-18 0z" fill="currentColor"/><path d="M9 4c-1 1.5 1 2.5 0 4M13 3c-1 1.5 1 2.5 0 4M17 4c-1 1.5 1 2.5 0 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  sed: '<path d="M12 2.5C12 2.5 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 2.5 12 2.5z" fill="currentColor"/>',
  frio: '<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/><path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2"/></g>',
  cansancio: '<path d="M15.5 3a9 9 0 1 0 5.5 14.6A7.4 7.4 0 0 1 15.5 3z" fill="currentColor"/>',
};
const NOMBRE = { hambre: 'Hambre', sed: 'Sed', frio: 'Frío', cansancio: 'Cansancio' };
const COMO = {
  hambre: 'Come: bayas y setas del bosque, o carne de caza (asada sacia más).',
  sed: 'Bebe agua de un río o de un lago: «Usar» en la orilla.',
  frio: 'Acércate al fuego, ponte bajo techo o abrígate.',
  cansancio: 'Descansa: quédate quieto, siéntate o duerme.',
};
// qué te pasa ahora, por cómo está
function queTePasa(que, n) {
  const v = n[que], e = efectos(n);
  if (que === 'cansancio') return v >= MAXIMO ? tr('Rendido: no puedes correr ni golpear fuerte.') : tr('Te cansas: si llega al máximo, no podrás correr ni golpear fuerte.');
  if (que === 'frio') return v >= MAXIMO ? tr('Helado: te mueves torpe, te cansas el doble y las heridas se curan despacio.') : tr('Tienes frío: si llega al máximo, te moverás torpe.');
  const muere = que === 'sed' ? tr('si sigues sin beber, al rato mueres') : tr('si sigues sin comer, al rato mueres');
  if (v >= MAXIMO) return tr('Al máximo: te cansas el doble, las heridas se curan despacio y {m}.', { m: muere });
  return e.cansancioRapido ? tr('Te cansas el doble (otra necesidad está al máximo).') : tr('Aún aguantas; al máximo te cansarás el doble y {m}.', { m: muere });
}

// op.sentarse(): sentarse o levantarse (P4, 8 nov); op.sentado(): si está sentado. La ficha del cansancio lleva su botón.
export function montarAvisos(op = {}) {
  const estilo = document.createElement('style');
  estilo.textContent = `
#avisosNec{position:fixed;right:calc(118px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-88px);display:flex;flex-direction:column;gap:8px;z-index:6}
#avisosNec .aviso-nec{position:relative;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;background:rgba(36,30,24,.82);box-shadow:0 2px 8px #0005;display:grid;place-items:center}
#avisosNec .aviso-nec::before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p) * 1%), rgba(241,232,216,.12) 0);
  -webkit-mask:radial-gradient(circle,transparent 62%,#000 64%);mask:radial-gradient(circle,transparent 62%,#000 64%)}
#avisosNec .aviso-nec svg{width:22px;height:22px;color:#e8dcc0}
#avisosNec .aviso-nec.fuerte svg{color:var(--c)}
#avisosNec .aviso-nec.fuerte{animation:latidoNec .7s ease-in-out infinite alternate}
@keyframes latidoNec{from{transform:scale(1)}to{transform:scale(1.12)}}
#fichaNec{position:fixed;right:calc(166px + env(safe-area-inset-right,0px));width:min(260px,calc(100vw - 190px));z-index:31;background:rgba(36,30,24,.94);border:1px solid rgba(241,232,216,.15);
  border-radius:10px;padding:10px 12px;color:#f1e8d8;font:13.5px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px #0006}
#fichaNec b{display:block;font-size:15px;margin-bottom:3px}
#fichaNec .nivel{height:5px;border-radius:3px;background:rgba(241,232,216,.12);margin:4px 0 7px;overflow:hidden}
#fichaNec .nivel i{display:block;height:100%}
#fichaNec p{margin:0 0 5px}
#fichaNec .como{color:#d9a441}
#fichaNec .sentarse{display:block;width:100%;margin-top:6px;padding:7px 10px;border-radius:7px;border:1px solid rgba(217,164,65,.55);background:rgba(217,164,65,.16);color:#f1e8d8;font:600 13.5px/1.2 system-ui,sans-serif;cursor:pointer}
#fichaNec .sentarse kbd{font:11px system-ui,sans-serif;border:1px solid rgba(241,232,216,.4);border-radius:3px;padding:0 4px;margin-left:6px;opacity:.8}
@media (max-width:640px){
  #avisosNec{flex-direction:row;transform:none;gap:6px}
  #avisosNec .aviso-nec{width:30px;height:30px}   /* (más pequeños en el móvil: valravnx, 9 nov) */
  #avisosNec .aviso-nec svg{width:17px;height:17px}
  #fichaNec{right:calc(10px + env(safe-area-inset-right,0px));width:min(260px,calc(100vw - 20px))}
}`;
  document.head.appendChild(estilo);
  const col = document.createElement('div'); col.id = 'avisosNec';
  document.body.appendChild(col);
  const ficha = document.createElement('div'); ficha.id = 'fichaNec'; ficha.hidden = true;
  document.body.appendChild(ficha);
  const botones = {};
  for (const k of NECESIDADES) {
    const b = document.createElement('button');
    b.className = 'aviso-nec'; b.dataset.que = k; b.hidden = true;
    b.style.setProperty('--c', COLOR[k]);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${DIBUJO[k]}</svg>`;
    b.onclick = (ev) => { ev.stopPropagation(); abierta === k ? cerrar() : abrir(k); };
    col.appendChild(b); botones[k] = b;
  }
  let actual = null, abierta = null;
  function pintarFicha() {
    if (!abierta || !actual) return;
    const k = abierta, v = Math.round(actual[k]);
    ficha.innerHTML = `<b>${tr(NOMBRE[k])} · ${v}%</b><div class="nivel"><i style="width:${v}%;background:${COLOR[k]}"></i></div>` +
      `<p>${queTePasa(k, actual)}</p><p class="como">${tr(COMO[k])}</p>` +
      (k === 'cansancio' && op.sentarse ? `<button class="sentarse">${op.sentado && op.sentado() ? tr('Levantarte') : tr('Sentarte a descansar')}${movil() ? '' : '<kbd>Z</kbd>'}</button>` : '');
    const bs = ficha.querySelector('.sentarse');
    if (bs) bs.onclick = (ev) => { ev.stopPropagation(); op.sentarse(); };
    const r = botones[k].getBoundingClientRect();
    // en el PC, a la izquierda del círculo; en el móvil, debajo de la fila
    const top = movil() ? r.bottom + 8 : r.top - 6;
    ficha.style.top = `${Math.max(8, Math.min(innerHeight - ficha.offsetHeight - 8, top))}px`;
  }
  function abrir(k) { abierta = k; ficha.hidden = false; ficha.dataset.que = k; pintarFicha(); pintarFicha(); }
  function cerrar() { abierta = null; ficha.hidden = true; }
  document.addEventListener('pointerdown', (e) => { if (abierta && !ficha.contains(e.target) && !col.contains(e.target)) cerrar(); });

  const movil = () => matchMedia('(max-width:640px)').matches;
  // en el móvil, la fila va justo debajo de los botones de modo, alineada con ellos por la derecha
  function colocar() {
    const m = document.getElementById('modos');
    if (!movil() || !m) { col.style.top = ''; col.style.right = ''; return; }
    const r = m.getBoundingClientRect();
    col.style.top = `${Math.round(r.bottom + 10)}px`; col.style.right = `${Math.round(innerWidth - r.right)}px`;
  }
  addEventListener('resize', colocar);
  // n: las necesidades como llegan del servidor (o null: sin ellas, nada)
  function pintar(n) {
    actual = n;
    colocar();
    const salen = new Map((n ? avisos(n) : []).map(a => [a.que, a]));
    for (const k of NECESIDADES) {
      const b = botones[k], a = salen.get(k);
      b.hidden = !a;
      if (!a) { if (abierta === k) cerrar(); continue; }
      b.style.setProperty('--p', String(Math.round(n[k])));
      b.classList.toggle('fuerte', a.fuerte);
      b.title = `${tr(NOMBRE[k])} · ${Math.round(n[k])}%`;
    }
    pintarFicha();
  }
  return {
    pintar, abrir, cerrar,
    get abierta() { return abierta; },
    // para las pruebas: los que se ven ahora
    get visibles() { return NECESIDADES.filter(k => !botones[k].hidden); },
  };
}
export { AVISO, FUERTE };
