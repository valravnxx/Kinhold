// Panel de inventario (hito 2): la silueta del personaje con un cuadro por cada lugar del cuerpo (manos, espalda,
// cintura, hombro y las capas de ropa), los huecos del contenedor que se toca y un arcón de pruebas para coger
// equipo mientras no haya fabricación (hito 3), como el botón de rellenar materiales.
// Todo lo que cambia pasa por accion(), que manda la acción con autor a la lógica pura (src/logica/inventario.js).
// En PC se arrastra (o se toca lo que se quiere y luego dónde); en el móvil se toca y el panel va a pantalla completa.
import { CATALOGO, pila } from '../logica/inventario.js';
import { tr } from '../idioma.js';

// Los cuadros de la silueta: lugar, nombre y posición (en % de la caja de la silueta, el centro del cuadro).
// La mano derecha sale a la izquierda de la pantalla: el personaje te mira.
const CUADROS = [
  ['ropa:cabeza', 'Cabeza', 50, 5],
  ['hombro', 'Hombro', 16, 16], ['espalda', 'Espalda', 84, 16],
  ['ropa:sobre', 'Sobre', 34, 28], ['ropa:exterior', 'Exterior', 66, 28],
  ['ropa:abrigo', 'Abrigo', 34, 41], ['ropa:interior', 'Camisa', 66, 41],
  ['mano:der', 'Mano derecha', 10, 50], ['mano:izq', 'Mano izquierda', 90, 50],
  ['cintura', 'Cintura', 50, 54],
  ['ropa:guantes', 'Guantes', 12, 70], ['ropa:piernas', 'Piernas', 50, 80],
  ['ropa:pies', 'Pies', 50, 93],
];

// Grupos del arcón de pruebas, sacados del catálogo.
const GRUPOS = [
  ['Ropa', d => d.capa],
  ['Cinturones', d => d.lugar === 'cintura'],
  ['A la espalda', d => d.lugar === 'espalda'],
  ['Al hombro', d => d.lugar === 'hombro'],
  ['Herramientas y armas', d => !d.recurso && !d.lugar && !d.capa],
  ['Recursos', d => d.recurso && d.tam !== 'E'],
];

const NOMBRE_TAM = { P: 'pequeño', M: 'mediano', G: 'grande', E: 'enorme' };

// Silueta sencilla de una persona de frente (viewBox 100 × 130), solo de fondo para los cuadros.
const SILUETA = `<svg viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true"><path d="M50 3c6 0 10 5 10 11s-4 12-10 12-10-6-10-12 4-11 10-11z
M37 28c4-2 9-3 13-3s9 1 13 3l9 4c3 1 5 4 6 8l6 30c1 3-3 4-4 1l-8-27-1 26c0 4 1 6 1 9l-2 44c0 3-6 3-6 0l-3-40h-2l-3 40c0 3-6 3-6 0l-2-44c0-3 1-5 1-9l-1-26-8 27c-1 3-5 2-4-1l6-30c1-4 3-7 6-8z"/></svg>`;

export function montarPanelInventario({ panel, boton, inventario, accion, alCambiar = () => {} }) {
  let sel = null;          // { de: 'arcon', tipo } o { de: 'inv', ruta }
  let vista = null;        // ruta del contenedor cuyos huecos se ven
  let aviso = { txt: '', error: false };

  panel.innerHTML = `<button class="cerrar inv-cerrar">✕</button><h2>${tr('Inventario')}</h2>
    <div class="inv-cuerpo">
      <div class="inv-silueta">${SILUETA}<div class="inv-cuadros"></div></div>
      <div class="inv-lado">
        <div class="inv-huecos"></div>
        <div class="inv-sel"></div>
        <div class="inv-aviso"></div>
        <div class="inv-carga"></div>
      </div>
    <div class="inv-arcon"><h3>${tr('Arcón de pruebas')}</h3><p class="inv-nota">${tr('Mientras no haya fabricación, el equipo se coge de aquí. Toca algo y luego dónde lo quieres; suéltalo aquí para devolverlo.')}</p><div class="inv-grupos"></div></div>
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
    if (r.ok) { avisar(''); alCambiar(); } else avisar(motivo(r.motivo), true);
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
    if (sel.de === 'arcon') hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, ruta), a: ruta });
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
    if (inv().lugares[lugar]) { avisar(tr('Ya llevas algo ahí: quítatelo antes.'), true); return; }
    hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: 1, a: lugar });
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
    pintar();
  }

  // ---- dibujo ----
  function textoCosa(c) {
    const d = def(c);
    return `<span class="inv-nom">${tr(d.nombre)}</span>${c.n > 1 ? `<b class="inv-n">${c.n}</b>` : ''}`;
  }
  function cuadro(ruta, etiqueta, extra = '', estilo = '') {
    const b = inv().buscar(ruta), c = b.cosa;
    const elegido = sel && sel.de === 'inv' && sel.ruta === ruta;
    const bloqueada = ruta.startsWith('mano:') && !c && inv().manoBloqueada(ruta);
    const clase = ['inv-c', c ? 'lleno' : 'vacio', elegido ? 'sel' : '', vista === ruta ? 'abierto' : '', c && def(c).huecos ? 'contenedor' : '', bloqueada ? 'bloqueada' : '', extra].join(' ');
    const dentro = c ? textoCosa(c) : `<span class="inv-et">${bloqueada ? tr('ocupada') : etiqueta}</span>`;
    const tit = c ? `${tr(def(c).nombre)} (${tr(NOMBRE_TAM[def(c).tam])})` : etiqueta;
    return `<button class="${clase}" data-ruta="${ruta}" draggable="${!!c}" title="${tit}" style="${estilo}">${dentro}</button>`;
  }

  function pintarSilueta() {
    let h = CUADROS.map(([ruta, et, x, y]) => `<div class="inv-sitio" style="left:${x}%;top:${y}%">${cuadro(ruta, tr(et))}<small>${tr(et)}</small></div>`).join('');
    // los huecos del cinturón, en fila bajo la cintura (sin cinturón, ninguno)
    const hc = inv().huecosCintura();
    if (hc.length) h += `<div class="inv-cinto" style="top:63%">${hc.map(x => cuadro(x.ruta, x.tam, 'mini')).join('')}</div>`;
    q('.inv-cuadros').innerHTML = h;
  }

  function pintarHuecos() {
    const caja = q('.inv-huecos');
    if (vista) { const c = inv().buscar(vista).cosa; if (!c || !def(c).huecos) vista = null; }
    if (!vista) { caja.innerHTML = `<h3>${tr('Huecos')}</h3><p class="inv-nota">${tr('Toca un contenedor (cinturón, mochila, saco) para ver sus huecos.')}</p>`; return; }
    const c = inv().buscar(vista).cosa, d = def(c);
    const partes = vista.split('/');
    const atras = partes.length > 1 ? `<button class="inv-atras" data-vista="${partes.slice(0, -1).join('/')}">←</button>` : '';
    const admite = d.admite ? `<p class="inv-nota">${tr('Solo admite: {l}.', { l: d.admite.map(nombre).join(', ').toLowerCase() })}</p>` : '';
    caja.innerHTML = `<h3>${atras}${tr(d.nombre)}</h3>${admite}<div class="inv-rejilla">${d.huecos.map((hh, i) => cuadro(vista + '/' + i, hh.tam)).join('')}</div>`;
  }

  function pintarSel() {
    const caja = q('.inv-sel');
    if (!sel) { caja.innerHTML = ''; return; }
    const tipo = sel.de === 'arcon' ? sel.tipo : inv().buscar(sel.ruta).cosa.tipo;
    const d = CATALOGO[tipo];
    const puesto = sel.de === 'inv' && !sel.ruta.includes('/') && !sel.ruta.startsWith('mano:');
    const ponible = (d.capa || d.lugar) && !puesto;
    caja.innerHTML = `<p><b>${tr(d.nombre)}</b> · ${tr(NOMBRE_TAM[d.tam])}${d.huecos ? ' · ' + tr('{n} huecos', { n: d.huecos.length }) : ''}</p>
      <p class="inv-nota">${tr('Ahora toca dónde lo quieres.')}</p>
      <div class="inv-botones">${ponible ? `<button class="inv-ponerse">${tr('Ponérselo')}</button>` : ''}${sel.de === 'inv' ? `<button class="inv-devolver">${tr('Al arcón')}</button>` : ''}<button class="inv-dejar">${tr('Cancelar')}</button></div>`;
  }

  function pintarCarga() {
    const l = inv().lleno();
    q('.inv-carga').innerHTML = tr('Carga: {c}% · velocidad al andar: {v}%', { c: Math.round(l.fraccion * 100), v: Math.round(inv().velocidad() * 100) });
    const a = q('.inv-aviso');
    a.textContent = aviso.txt; a.className = 'inv-aviso' + (aviso.error ? ' error' : '');
  }

  function pintarArcon() {
    if (q('.inv-grupos').childElementCount) {
      for (const b of panel.querySelectorAll('.inv-objeto')) b.classList.toggle('sel', !!sel && sel.de === 'arcon' && sel.tipo === b.dataset.tipo);
      return;
    }
    const ks = Object.keys(CATALOGO);
    q('.inv-grupos').innerHTML = GRUPOS.map(([t, f]) => `<div class="inv-grupo"><h4>${tr(t)}</h4><div>${ks.filter(k => f(CATALOGO[k])).map(k =>
      `<button class="inv-objeto" data-tipo="${k}" draggable="true" title="${tr(NOMBRE_TAM[CATALOGO[k].tam])}">${nombre(k)}</button>`).join('')}</div></div>`).join('');
  }

  function pintar() {
    if (panel.hidden) return;
    pintarSilueta(); pintarHuecos(); pintarSel(); pintarCarga(); pintarArcon();
  }

  // ---- eventos: clic, arrastrar y soltar ----
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) { if (e.target.closest('.inv-arcon') && sel && sel.de === 'inv') { alArcon(); pintar(); } return; }
    if (t.classList.contains('inv-cerrar')) { cerrar(); return; }
    if (t.dataset.ruta) { tocar(t.dataset.ruta); return; }
    if (t.dataset.vista !== undefined) { vista = t.dataset.vista; pintar(); return; }
    if (t.dataset.tipo) {
      if (sel && sel.de === 'inv') alArcon();
      else sel = sel && sel.tipo === t.dataset.tipo ? null : { de: 'arcon', tipo: t.dataset.tipo };
      avisar(''); pintar(); return;
    }
    if (t.classList.contains('inv-ponerse')) ponerse();
    else if (t.classList.contains('inv-devolver')) alArcon();
    else if (t.classList.contains('inv-dejar')) sel = null;
    pintar();
  });
  panel.addEventListener('dragstart', (e) => {
    const t = e.target.closest('[data-ruta],[data-tipo]');
    if (!t) return;
    sel = t.dataset.tipo ? { de: 'arcon', tipo: t.dataset.tipo } : { de: 'inv', ruta: t.dataset.ruta };
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
  function cerrar() { panel.hidden = true; sel = null; boton && boton.classList.remove('sel'); }
  function alternar() { if (panel.hidden) abrir(); else cerrar(); }
  if (boton) boton.onclick = alternar;
  return { abrir, cerrar, alternar, pintar, get abierto() { return !panel.hidden; }, get sel() { return sel; }, get vista() { return vista; } };
}
