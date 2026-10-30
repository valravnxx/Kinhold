// Panel de inventario (hito 2): el inventario es el equipo (valravnx, 29 oct). Tu personaje de verdad en el centro y,
// a los lados, un cuadro por cada lugar de equipo: la ropa por capas, la cintura (el cinturón y sus huecos) y la
// espalda (la mochila y sus huecos). Lo que se lleva en las manos o al hombro NO sale aquí: se coge del mundo y se ve
// en el personaje. Mientras no haya objetos en el suelo ni fabricación (hito 3), el arcón de pruebas hace de mundo:
// de él se coge con las manos, al hombro o a un hueco, y en él se deja lo que sobra.
// Todo lo que cambia pasa por accion(), que manda la acción con autor a la lógica pura (src/logica/inventario.js).
// En PC se arrastra (o se toca lo que se quiere y luego dónde); en el móvil se toca y el panel va a pantalla completa.
import { CATALOGO, pila } from '../logica/inventario.js';
import { nombrePrenda, rasgosPrenda } from '../logica/hechura.js';
import { tr } from '../idioma.js';

// Los cuadros del equipo, a los dos lados del personaje, de arriba abajo más o menos a la altura de lo que visten.
const IZQUIERDA = [['ropa:cabeza', 'Cabeza'], ['ropa:sobre', 'Sobre todo'], ['ropa:abrigo', 'Abrigo'], ['ropa:guantes', 'Guantes'], ['ropa:piernas', 'Piernas']];
const DERECHA = [['espalda', 'Espalda'], ['ropa:exterior', 'Exterior'], ['ropa:interior', 'Camisa'], ['cintura', 'Cintura'], ['ropa:pies', 'Pies']];
export const CUADROS_EQUIPO = [...IZQUIERDA, ...DERECHA].map(([r]) => r);

// Grupos del arcón de pruebas, sacados del catálogo.
const GRUPOS = [
  ['Ropa', d => d.capa],
  ['Cinturones', d => d.lugar === 'cintura'],
  ['A la espalda', d => d.lugar === 'espalda'],
  ['Al hombro', d => d.lugar === 'hombro'],
  ['Herramientas y armas', d => !d.recurso && !d.lugar && !d.capa],
  ['Recursos', d => d.recurso && d.tam !== 'E'],
];

// Ropa cosida de muestra en el arcón (mientras no se cosa en el banco): cada una con su hechura y su tinte, que van con
// ella al inventario y se ven puestos. Dos prendas del mismo tipo con distinta hechura son cosas distintas.
export const MUESTRAS = [
  ['tunica_lana', { hechura: { corte: 'corto', tejido: 'sarga' }, tinte: 'glasto' }],
  ['tunica_lana', { hechura: { tejido: 'cuadros' }, tinte: 'verde' }],
  ['camisa_lino', { hechura: { corte: 'corto' }, tinte: 'blanco' }],
  ['gambeson', { hechura: { material: 'lana', corte: 'corto' }, tinte: 'pardo' }],
  ['cota_malla', { hechura: { corte: 'corto' } }],
  ['sobreveste_lino', { hechura: { corte: 'medio', tejido: 'espiguilla' }, tinte: 'gualda' }],
  ['manto_lana', { hechura: { tejido: 'rayas' }, tinte: 'morado' }],
  ['zapatos_cuero', { tinte: 'rojizo' }],
].map(([tipo, o]) => ({ tipo, rasgos: rasgosPrenda(tipo, o) }));

const NOMBRE_TAM = { P: 'pequeño', M: 'mediano', G: 'grande', E: 'enorme' };

export function montarPanelInventario({ panel, boton, inventario, accion, alCambiar = () => {}, retrato = null }) {
  let sel = null;          // { de: 'arcon', tipo } o { de: 'inv', ruta }
  let vista = null;        // ruta del contenedor cuyos huecos se ven
  let aviso = { txt: '', error: false };

  panel.innerHTML = `<button class="cerrar inv-cerrar">✕</button><h2>${tr('Inventario')}</h2>
    <div class="inv-cuerpo">
      <div class="inv-figura"><div class="inv-col inv-izq"></div><canvas class="inv-retrato"></canvas><div class="inv-col inv-der"></div><div class="inv-cinto"></div></div>
      <div class="inv-lado">
        <div class="inv-huecos"></div>
        <div class="inv-sel"></div>
        <div class="inv-aviso"></div>
        <div class="inv-carga"></div>
      </div>
    <div class="inv-arcon"><h3>${tr('Arcón de pruebas')}</h3><p class="inv-nota">${tr('Mientras no haya objetos en el suelo ni fabricación, el arcón hace de mundo: toca algo y luego dónde lo quieres, o cógelo con las manos; suéltalo aquí para dejarlo.')}</p><div class="inv-grupos"></div></div>
    </div>`;
  const q = s => panel.querySelector(s);
  const inv = () => inventario();
  const def = c => c && CATALOGO[c.tipo];
  const nombre = tipo => tr(CATALOGO[tipo].nombre);

  // un motivo de la lógica, traducido (los que llevan número se traducen con su plantilla)
  function motivo(m) {
    const n = /caben (\d+)\./.exec(m || '');
    return n ? tr('No cabe tanto: caben {n}.', { n: n[1] }) : tr(m || '');
  }
  function avisar(txt, error = false) { aviso = { txt, error }; }

  function hacer(a) {
    const r = accion(a);
    if (r.ok) { avisar(''); alCambiar(); retratoHecho = false; } else avisar(motivo(r.motivo), true);   // con otra ropa, otro retrato
    return r;
  }

  // cuántas unidades se cogen del arcón para la ruta: la pila entera, o lo que quepa si ya hay de lo mismo
  function cantidadPara(tipo, ruta) {
    const b = inv().buscar(ruta);
    const hay = b.cosa && b.cosa.tipo === tipo ? b.cosa.n : 0;
    return Math.max(1, pila(tipo) - hay);
  }

  // Lo que pasa al soltar lo elegido en la ruta (por clic o al arrastrar).
  function aRuta(ruta) {
    if (!sel) return;
    if (sel.de === 'arcon') hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, ruta), a: ruta, ...(sel.rasgos || {}) });
    else if (sel.ruta !== ruta) {
      const r = hacer({ tipo: 'mover', de: sel.ruta, a: ruta });
      if (r.ok && vista && (vista === sel.ruta || vista.startsWith(sel.ruta + '/'))) vista = ruta; // el contenedor se mudó
    }
    sel = null;
  }
  function alArcon() {
    if (!sel || sel.de !== 'inv') return;
    const r = hacer({ tipo: 'soltar', de: sel.ruta });
    if (r.ok) { if (vista && (vista === sel.ruta || vista.startsWith(sel.ruta + '/'))) vista = null; avisar(tr('Devuelto al arcón.')); }
    sel = null;
  }
  function ponerse() {
    if (!sel) return;
    if (sel.de === 'inv') { hacer({ tipo: 'ponerse', de: sel.ruta }); sel = null; return; }
    const d = CATALOGO[sel.tipo];
    const lugar = d.capa ? 'ropa:' + d.capa : d.lugar;
    if (inv().lugares[lugar]) { avisar(tr(lugar === 'hombro' ? 'Ya llevas algo al hombro: suéltalo antes.' : 'Ya llevas algo ahí: quítatelo antes.'), true); return; }
    const r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: 1, a: lugar, ...(sel.rasgos || {}) });
    if (r.ok && lugar === 'hombro') avisar(tr('Lo llevas al hombro.'));
    sel = null;
  }
  // coger del arcón con las manos (como si se cogiera del suelo): en la derecha, o en la izquierda si la derecha está ocupada
  function aLasManos() {
    if (!sel || sel.de !== 'arcon') return;
    const libre = ['mano:der', 'mano:izq'].find(m => !inv().lugares[m] && !inv().manoBloqueada(m));
    if (!libre) { avisar(tr('Llevas las manos ocupadas: suelta lo que llevas.'), true); return; }
    const r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, libre), a: libre });
    if (r.ok) avisar(tr('Lo llevas en las manos.'));
    sel = null;
  }

  // Clic en un cuadro (lugar del cuerpo o hueco).
  function tocar(ruta) {
    const c = inv().buscar(ruta).cosa;
    if (sel && !(sel.de === 'inv' && sel.ruta === ruta)) { aRuta(ruta); pintar(); return; }
    if (sel) { sel = null; pintar(); return; } // tocar otra vez lo elegido lo deja
    avisar('');
    if (c) { sel = { de: 'inv', ruta }; if (def(c).huecos) vista = ruta; }
    else if (ruta === 'cintura') avisar(tr('Sin cinturón no hay huecos en la cintura: coge uno del arcón.'));
    else if (ruta === 'espalda') avisar(tr('Sin mochila no llevas nada a la espalda: coge una del arcón.'));
    pintar();
  }

  // ---- dibujo ----
  // el nombre de una cosa; la ropa, con su hechura y su tinte («Túnica de lana · Corto, Sarga · Azul de glasto»)
  const nombreDe = (c) => def(c).capa ? nombrePrenda(c.tipo, c, tr) : tr(def(c).nombre);
  function textoCosa(c) {
    return `<span class="inv-nom">${nombreDe(c)}</span>${c.n > 1 ? `<b class="inv-n">${c.n}</b>` : ''}`;
  }
  function cuadro(ruta, etiqueta, extra = '', estilo = '') {
    const b = inv().buscar(ruta), c = b.cosa;
    const elegido = sel && sel.de === 'inv' && sel.ruta === ruta;
    const clase = ['inv-c', c ? 'lleno' : 'vacio', elegido ? 'sel' : '', vista === ruta ? 'abierto' : '', c && def(c).huecos ? 'contenedor' : '', extra].join(' ');
    const dentro = c ? textoCosa(c) : `<span class="inv-et">${etiqueta}</span>`;
    const tit = c ? `${nombreDe(c)} (${tr(NOMBRE_TAM[def(c).tam])})` : etiqueta;
    return `<button class="${clase}" data-ruta="${ruta}" draggable="${!!c}" title="${tit}" style="${estilo}">${dentro}</button>`;
  }

  // cada cuadro con el nombre de su lugar encima (una sola vez); dentro, lo que llevas puesto o vacío
  function pintarFigura() {
    const col = (lista) => lista.map(([ruta, et]) => `<div class="inv-sitio"><small>${tr(et)}</small>${cuadro(ruta, '—')}</div>`).join('');
    q('.inv-izq').innerHTML = col(IZQUIERDA);
    q('.inv-der').innerHTML = col(DERECHA);
    // los huecos del cinturón, en fila bajo el personaje (sin cinturón, ninguno)
    const hc = inv().huecosCintura();
    q('.inv-cinto').innerHTML = hc.length ? `<small>${tr('Huecos del cinturón')}</small><div>${hc.map(x => cuadro(x.ruta, x.tam, 'mini')).join('')}</div>` : '';
  }
  let retratoHecho = false;
  function pintarRetrato() {
    if (retratoHecho || !retrato) return;
    retratoHecho = !!retrato(q('.inv-retrato'));
    if (!retratoHecho) setTimeout(() => { if (!panel.hidden) pintarRetrato(); }, 500);   // el personaje aún se está cargando
  }

  function pintarHuecos() {
    const caja = q('.inv-huecos');
    if (vista) { const c = inv().buscar(vista).cosa; if (!c || !def(c).huecos) vista = null; }
    if (!vista) { caja.innerHTML = `<h3>${tr('Huecos')}</h3><p class="inv-nota">${tr('Toca el cinturón o la mochila para ver sus huecos.')}</p>`; return; }
    const c = inv().buscar(vista).cosa, d = def(c);
    const partes = vista.split('/');
    const atras = partes.length > 1 ? `<button class="inv-atras" data-vista="${partes.slice(0, -1).join('/')}">←</button>` : '';
    const admite = d.admite ? `<p class="inv-nota">${tr('Solo admite: {l}.', { l: d.admite.map(nombre).join(', ').toLowerCase() })}</p>` : '';
    caja.innerHTML = `<h3>${atras}${tr(d.nombre)}</h3>${admite}<div class="inv-rejilla">${d.huecos.map((hh, i) => cuadro(vista + '/' + i, hh.tam)).join('')}</div>`;
  }

  function pintarSel() {
    const caja = q('.inv-sel');
    if (!sel) { caja.innerHTML = ''; return; }
    const c = sel.de === 'arcon' ? { tipo: sel.tipo, n: 1, ...(sel.rasgos || {}) } : inv().buscar(sel.ruta).cosa;
    const d = CATALOGO[c.tipo];
    const puesto = sel.de === 'inv' && !sel.ruta.includes('/');
    const alHombro = d.lugar === 'hombro';
    const ponible = (d.capa || d.lugar) && !puesto && !alHombro;
    const manos = sel.de === 'arcon' && !d.capa && !d.lugar && d.tam !== 'E';
    caja.innerHTML = `<p><b>${nombreDe(c)}</b> · ${tr(NOMBRE_TAM[d.tam])}${d.huecos ? ' · ' + tr('{n} huecos', { n: d.huecos.length }) : ''}</p>
      <p class="inv-nota">${tr(sel.de === 'arcon' && !ponible && !alHombro ? 'Cógelo con las manos o toca un hueco donde guardarlo.' : 'Ahora toca dónde lo quieres.')}</p>
      <div class="inv-botones">${ponible ? `<button class="inv-ponerse">${tr('Ponérselo')}</button>` : ''}${alHombro && sel.de === 'arcon' ? `<button class="inv-ponerse">${tr('Al hombro')}</button>` : ''}${manos ? `<button class="inv-manos">${tr('Cogerlo con las manos')}</button>` : ''}${sel.de === 'inv' ? `<button class="inv-devolver">${tr('Al arcón')}</button>` : ''}<button class="inv-dejar">${tr('Cancelar')}</button></div>`;
  }

  function pintarCarga() {
    const l = inv().lleno();
    q('.inv-carga').innerHTML = tr('Carga: {c}% · velocidad al andar: {v}%', { c: Math.round(l.fraccion * 100), v: Math.round(inv().velocidad() * 100) });
    const a = q('.inv-aviso');
    a.textContent = aviso.txt; a.className = 'inv-aviso' + (aviso.error ? ' error' : '');
  }

  function pintarArcon() {
    if (q('.inv-grupos').childElementCount) {
      for (const b of panel.querySelectorAll('.inv-objeto')) b.classList.toggle('sel', !!sel && sel.de === 'arcon' && sel.tipo === b.dataset.tipo && String(sel.muestra ?? '') === (b.dataset.muestra ?? ''));
      return;
    }
    const ks = Object.keys(CATALOGO);
    const cosidas = `<div class="inv-grupo"><h4>${tr('Ropa cosida (muestras)')}</h4><div>${MUESTRAS.map((m, i) =>
      `<button class="inv-objeto" data-tipo="${m.tipo}" data-muestra="${i}" draggable="true" title="${tr(NOMBRE_TAM[CATALOGO[m.tipo].tam])}">${nombrePrenda(m.tipo, m.rasgos, tr)}</button>`).join('')}</div></div>`;
    q('.inv-grupos').innerHTML = GRUPOS.map(([t, f]) => `<div class="inv-grupo"><h4>${tr(t)}</h4><div>${ks.filter(k => f(CATALOGO[k])).map(k =>
      `<button class="inv-objeto" data-tipo="${k}" draggable="true" title="${tr(NOMBRE_TAM[CATALOGO[k].tam])}">${nombre(k)}</button>`).join('')}</div></div>`).join('') + cosidas;
  }

  function pintar() {
    if (panel.hidden) return;
    pintarFigura(); pintarHuecos(); pintarSel(); pintarCarga(); pintarArcon(); pintarRetrato();
  }

  // lo elegido en el arcón: el tipo y, si es una muestra de ropa cosida, su hechura y su tinte
  const delArcon = (t) => { const m = t.dataset.muestra !== undefined ? MUESTRAS[+t.dataset.muestra] : null;
    return { de: 'arcon', tipo: t.dataset.tipo, ...(m ? { muestra: +t.dataset.muestra, rasgos: m.rasgos } : {}) }; };
  // ---- eventos: clic, arrastrar y soltar ----
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) { if (e.target.closest('.inv-arcon') && sel && sel.de === 'inv') { alArcon(); pintar(); } return; }
    if (t.classList.contains('inv-cerrar')) { cerrar(); return; }
    if (t.dataset.ruta) { tocar(t.dataset.ruta); return; }
    if (t.dataset.vista !== undefined) { vista = t.dataset.vista; pintar(); return; }
    if (t.dataset.tipo) {
      if (sel && sel.de === 'inv') alArcon();
      else sel = sel && sel.de === 'arcon' && sel.tipo === t.dataset.tipo && String(sel.muestra ?? '') === (t.dataset.muestra ?? '') ? null : delArcon(t);
      avisar(''); pintar(); return;
    }
    if (t.classList.contains('inv-ponerse')) ponerse();
    else if (t.classList.contains('inv-manos')) aLasManos();
    else if (t.classList.contains('inv-devolver')) alArcon();
    else if (t.classList.contains('inv-dejar')) sel = null;
    pintar();
  });
  panel.addEventListener('dragstart', (e) => {
    const t = e.target.closest('[data-ruta],[data-tipo]');
    if (!t) return;
    sel = t.dataset.tipo ? delArcon(t) : { de: 'inv', ruta: t.dataset.ruta };
    e.dataTransfer.setData('text/plain', t.dataset.tipo || t.dataset.ruta);
    e.dataTransfer.effectAllowed = 'move';
  });
  panel.addEventListener('dragover', (e) => { if (sel && (e.target.closest('[data-ruta]') || e.target.closest('.inv-arcon'))) e.preventDefault(); });
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = e.target.closest('[data-ruta]');
    if (t) aRuta(t.dataset.ruta);
    else if (e.target.closest('.inv-arcon')) alArcon();
    pintar();
  });
  panel.addEventListener('dragend', () => { if (sel) { sel = null; pintar(); } });

  function abrir() { panel.hidden = false; boton && boton.classList.add('sel'); pintar(); }
  function cerrar() { panel.hidden = true; sel = null; retratoHecho = false; boton && boton.classList.remove('sel'); }
  function alternar() { if (panel.hidden) abrir(); else cerrar(); }
  if (boton) boton.onclick = alternar;
  return { abrir, cerrar, alternar, pintar, get abierto() { return !panel.hidden; }, get sel() { return sel; }, get vista() { return vista; } };
}
