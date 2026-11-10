// El panel de equipo (valravnx, 7 nov: «cambiamos inventario por equipo, con las imágenes y estilo del menú de crafteo,
// y sobre todo, poder desequipar, poner en manos o en el suelo lo que tengas puesto»). El inventario es el equipo
// (valravnx, 29 oct): tu personaje de verdad en el centro y, a los lados, un cuadro por cada lugar donde se lleva algo
// (la ropa por capas, la cintura y la espalda); debajo, las manos y el hombro, los huecos del cinturón y los de lo que
// abras (la mochila, el saco…). Cada cosa con su imagen (la de su modelo del juego, docs/recursos/iconos-vN/; la ropa,
// dibujada con su tinte, src/juego/iconos_ropa.js).
// Al tocar algo, su ficha (a la derecha en PC; abajo en el móvil) dice qué es y dónde está, y lo que se puede hacer con
// ello: quitártelo a las manos, ponértelo, dejarlo en el suelo a tus pies (con lo que lleve dentro) o guardarlo en otro
// sitio (tocando ese sitio). En PC también se arrastra.
// Todo lo que cambia pasa por accion() (la acción con autor a la lógica pura, src/logica/inventario.js; en línea, al
// servidor) y soltarSuelo(ruta) (al suelo del mundo). El arcón de pruebas, donde aún lo hay (no en el juego de
// verdad), hace de mundo: de él se coge y en él se deja.
import { CATALOGO, pila, MATERIAL_DE_OBJETO, OBJETO_DE_MATERIAL } from '../logica/inventario.js';
import { nombrePrenda, rasgosPrenda } from '../logica/hechura.js';
import { desgasteDe, reparacionDe } from '../logica/desgaste.js';
import { PRENDAS } from '../logica/prendas.js';
import { RECETAS, PARA } from '../logica/fabricacion.js';
import { svgPrenda } from './iconos_ropa.js';
import { carpetaIconos } from './panel_fabricar.js';
import { tr } from '../idioma.js';

// Los cuadros del equipo, a los dos lados del personaje, de arriba abajo más o menos a la altura de lo que visten.
const IZQUIERDA = [['ropa:cabeza', 'Cabeza'], ['ropa:sobre', 'Sobre todo'], ['ropa:abrigo', 'Abrigo'], ['ropa:guantes', 'Guantes'], ['ropa:piernas', 'Piernas']];
const DERECHA = [['espalda', 'Espalda'], ['ropa:exterior', 'Exterior'], ['ropa:interior', 'Camisa'], ['cintura', 'Cintura'], ['ropa:pies', 'Pies']];
const MANOS_HOMBRO = [['mano:der', 'Mano derecha'], ['mano:izq', 'Mano izquierda'], ['hombro', 'Al hombro']];
export const CUADROS_EQUIPO = [...IZQUIERDA, ...DERECHA].map(([r]) => r);
const NOMBRE_SITIO = Object.fromEntries([...IZQUIERDA, ...DERECHA, ...MANOS_HOMBRO]);

// Grupos del arcón de pruebas, sacados del catálogo. Los materiales de obra van aparte, contados (el arcón de pruebas
// tiene lo que antes era el montón común de la construcción).
const GRUPOS = [
  ['Ropa', d => d.capa],
  ['Cinturones', d => d.lugar === 'cintura'],
  ['A la espalda', d => d.lugar === 'espalda'],
  ['Al hombro', d => d.lugar === 'hombro'],
  ['Herramientas y armas', d => !d.recurso && !d.lugar && !d.capa && d.tam !== 'E'],
  ['Para arrastrar o empujar', d => !d.recurso && d.tam === 'E'],
  ['Recursos', (d, k) => d.recurso && d.tam !== 'E' && !(k in MATERIAL_DE_OBJETO)],
];

// Ropa cosida de muestra en el arcón (mientras no se cosa en el banco): cada una con su hechura y su tinte.
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
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// lo que se lleva puesto (no en una mano ni en un hueco)
const esPuesto = r => !r.includes('/') && !r.startsWith('mano:');
// para qué sirve: lo de la receta que lo da
const PARA_TIPO = {};
for (const [k, r] of Object.entries(RECETAS)) if (PARA[k] && !PARA_TIPO[r.da]) PARA_TIPO[r.da] = PARA[k];

// accionArcon y materialesArcon (opcionales): la acción de construcción con autor (sacar_arcon, dejar_arcon) y lo que
// hay en el arcón de materiales. alSuelo(tipo) (opcional): lo enorme del arcón (la rastra) va al suelo, delante de ti.
// soltarSuelo(ruta) (opcional): deja en el suelo, a tus pies, lo que hay en esa ruta (con lo que lleve dentro).
// comer(tipo) (opcional, P4): come una unidad de eso (bayas, setas…: los que dice comestible)
// cómo se repara lo que se gasta (10 nov): en qué puesto y con qué, dejado en él
const PUESTO_REPARAR = { tallar: 'en la piedra de tallar', banco: 'en el banco de tronco' };
function comoSeRepara(tipo) {
  const rp = reparacionDe(tipo), ropa = Object.hasOwn(PRENDAS, tipo);
  if (!rp) return ropa ? `<p class="inv-nota">${esc(tr('Aún no se puede reparar: al acabarse, se rompe.'))}</p>` : '';
  const con = Object.entries(rp.gasta).map(([t, n]) => `${n} ${tr(CATALOGO[t].nombre).toLowerCase()}`).join(', ');
  // (la ropa se repara puesta o en la mano; las herramientas, en la mano)
  return `<p class="inv-nota">${esc(tr(ropa ? 'Se repara {p}, con {c} dejado en el puesto: puesta o en la mano, Usar junto a él.' : 'Se repara {p}, con {c} dejado en el puesto: con la herramienta en la mano, Usar junto a él.', { p: tr(PUESTO_REPARAR[rp.uso]), c: con }))}</p>`;
}
export function montarPanelInventario({ panel, boton, inventario, accion, alCambiar = () => {}, retrato = null, accionArcon = null, materialesArcon = null, alSuelo = null, soltarSuelo = null, hayArcon = () => true, comer = null, comestible = () => false }) {
  let sel = null;          // { de: 'arcon', tipo } o { de: 'inv', ruta }
  let vista = null;        // ruta del contenedor cuyos huecos se ven
  let aviso = { txt: '', error: false };
  const base = carpetaIconos();
  let indice = {}, pedido = false;   // las imágenes: cuáles aún no tienen su modelo (se piden al abrir)
  const cargarIndice = () => { if (pedido || typeof fetch !== 'function') return; pedido = true; fetch(base + 'indice.json').then(r => r.ok ? r.json() : null).then(j => { if (j && j.iconos) { indice = j.iconos; arconHecho = false; pintar(); } }).catch(() => {}); };

  panel.classList.add('eq-panel');
  panel.innerHTML = `<div class="eq-cab"><div><h2>${tr('Equipo')}</h2><small>${tr('Lo que llevas puesto, en las manos y guardado. Toca algo para ver qué puedes hacer con ello.')}</small></div><button class="cerrar inv-cerrar" aria-label="✕">✕</button></div>
    <div class="eq-centro">
      <div class="eq-tuyo"><div class="inv-figura"><div class="inv-col inv-izq"></div><canvas class="inv-retrato"></canvas><div class="inv-col inv-der"></div></div>
      <div class="eq-filas"><div class="eq-manos"></div><div class="inv-cinto"></div></div>
      <div class="inv-huecos"></div></div>
      <div class="inv-arcon"><h3>${tr('Arcón de pruebas')}</h3><p class="inv-nota">${tr('Mientras no haya objetos en el suelo ni fabricación, el arcón hace de mundo: toca algo y luego dónde lo quieres, o cógelo con las manos; suéltalo aquí para dejarlo.')}</p><div class="inv-materiales"></div><div class="inv-grupos"></div></div>
    </div>
    <aside class="inv-sel"></aside>
    <div class="eq-pie"><div class="inv-aviso"></div><div class="inv-carga"></div></div>`;
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

  // los materiales de obra, con su arcón: se cogen y se dejan con las acciones del arcón (cuentan lo que hay)
  const conArcon = () => !!(accionArcon && materialesArcon && materialesArcon());
  function deArcon(a) {
    if (!conArcon()) return null;
    if (a.tipo === 'coger' && a.objeto in MATERIAL_DE_OBJETO) {
      const m = MATERIAL_DE_OBJETO[a.objeto], hay = materialesArcon()[m] || 0;
      if (hay < 1) return { ok: false, motivo: 'En el arcón no queda: rellénalo.' };
      return accionArcon({ tipo: 'sacar_arcon', material: m, cantidad: Math.min(a.cantidad, hay), a: a.a });
    }
    if (a.tipo === 'soltar') {
      const c = inv().buscar(a.de).cosa;
      if (c && c.tipo in MATERIAL_DE_OBJETO) return accionArcon({ tipo: 'dejar_arcon', de: a.de, cantidad: a.cantidad ?? c.n });
    }
    return null;
  }
  function hacer(a) {
    const r = deArcon(a) || accion(a);
    if (r.ok) { avisar(''); alCambiar(); retratoHecho = false; } else avisar(motivo(r.motivo), true);   // con otra ropa, otro retrato
    return r;
  }
  // si lo elegido se ha ido (o el contenedor abierto), se deja de ver
  const seFue = (ruta) => { if (vista && (vista === ruta || vista.startsWith(ruta + '/'))) vista = null; };

  // cuántas unidades se cogen del arcón para la ruta: la pila entera, o lo que quepa si ya hay de lo mismo
  function cantidadPara(tipo, ruta) {
    const b = inv().buscar(ruta);
    const hay = b.cosa && b.cosa.tipo === tipo ? b.cosa.n : 0;
    return Math.max(1, pila(tipo) - hay);
  }
  const manoLibre = () => ['mano:der', 'mano:izq'].find(m => !inv().lugares[m] && !inv().manoBloqueada(m));

  // Lo que pasa al soltar lo elegido en la ruta (por clic o al arrastrar).
  function aRuta(ruta) {
    if (!sel) return;
    if (sel.de === 'arcon') hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, ruta), a: ruta, ...(sel.rasgos || {}) });
    else if (sel.ruta !== ruta) {
      const r = esPuesto(sel.ruta) && !ruta.startsWith(sel.ruta) ? hacer({ tipo: 'quitarse', lugar: sel.ruta, a: ruta }) : hacer({ tipo: 'mover', de: sel.ruta, a: ruta });
      if (r.ok && vista && (vista === sel.ruta || vista.startsWith(sel.ruta + '/'))) vista = ruta; // el contenedor se mudó
    }
    sel = null;
  }
  function alArcon() {
    if (!sel || sel.de !== 'inv') return;
    const r = hacer({ tipo: 'soltar', de: sel.ruta });
    if (r.ok) { seFue(sel.ruta); avisar(tr('Devuelto al arcón.')); }
    sel = null;
  }
  function ponerse() {
    if (!sel) return;
    if (sel.de === 'inv') { const r = hacer({ tipo: 'ponerse', de: sel.ruta }); if (r.ok) avisar(tr('Te lo pones.')); sel = null; return; }
    const d = CATALOGO[sel.tipo];
    const lugar = d.capa ? 'ropa:' + d.capa : d.lugar;
    if (inv().lugares[lugar]) { avisar(tr(lugar === 'hombro' ? 'Ya llevas algo al hombro: suéltalo antes.' : 'Ya llevas algo ahí: quítatelo antes.'), true); return; }
    const r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: 1, a: lugar, ...(sel.rasgos || {}) });
    if (r.ok && lugar === 'hombro') avisar(tr('Lo llevas al hombro.'));
    sel = null;
  }
  // a las manos: del arcón (como si se cogiera del suelo), de un hueco o quitándotelo (lo puesto)
  function aLasManos() {
    if (!sel) return;
    const libre = manoLibre();
    if (!libre) { avisar(tr('Llevas las manos ocupadas: suelta lo que llevas.'), true); return; }
    let r;
    if (sel.de === 'arcon') r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, libre), a: libre });
    else if (esPuesto(sel.ruta)) r = hacer({ tipo: 'quitarse', lugar: sel.ruta, a: libre });
    else r = hacer({ tipo: 'mover', de: sel.ruta, a: libre });
    if (r.ok) { if (sel.de === 'inv') seFue(sel.ruta); avisar(tr('Lo llevas en las manos.')); }
    sel = null;
  }
  // al suelo, a tus pies, con lo que lleve dentro (en línea lo deja el servidor y lo ven todos)
  function alSueloDe() {
    if (!sel || sel.de !== 'inv' || !soltarSuelo) return;
    const ruta = sel.ruta;
    const r = soltarSuelo(ruta);
    if (r && r.ok) { seFue(ruta); avisar(r.enviado ? '' : tr('Lo dejas en el suelo.')); alCambiar(); retratoHecho = false; }
    else if (r && r.motivo) avisar(motivo(r.motivo), true);
    sel = null;
  }

  // Clic en un cuadro (lugar del cuerpo, mano, hombro o hueco).
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
  // la imagen de una cosa: la ropa, dibujada con su tinte; lo demás, la de su modelo (o «sin modelo aún»)
  function imagen(tipo, c = null, grande = false) {
    const ropa = PRENDAS[tipo] ? svgPrenda(tipo, c) : '';
    const sin = !ropa && indice[tipo] && indice[tipo].propio === false;
    return `<span class="fab-ic eq-ic${grande ? ' eq-grande' : ''}">${ropa || `<img class="fab-img" src="${esc(base + tipo + '.webp')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`}${sin ? `<em class="fab-pend">${esc(tr('sin modelo aún'))}</em>` : ''}</span>`;
  }
  // el nombre de una cosa; la ropa, con su hechura y su tinte («Túnica de lana · Corto, Sarga · Azul de glasto»)
  const nombreDe = (c) => def(c).capa ? nombrePrenda(c.tipo, c, tr) : tr(def(c).nombre);
  function cuadro(ruta, etiqueta, extra = '') {
    const b = inv().buscar(ruta), c = b.cosa;
    const elegido = sel && sel.de === 'inv' && sel.ruta === ruta;
    const bloqueada = ruta.startsWith('mano:') && !c && inv().manoBloqueada(ruta);
    const clase = ['inv-c', c ? 'lleno' : 'vacio', elegido ? 'sel' : '', vista === ruta ? 'abierto' : '', c && def(c).huecos ? 'contenedor' : '', bloqueada ? 'bloqueada' : '', extra].join(' ');
    const dentro = c ? `${imagen(c.tipo, c)}<span class="inv-nom">${esc(nombreDe(c))}</span>${c.n > 1 ? `<b class="inv-n">${c.n}</b>` : ''}` : `<span class="inv-et">${esc(etiqueta)}</span>`;
    const tit = c ? `${nombreDe(c)} (${tr(NOMBRE_TAM[def(c).tam])})` : etiqueta;
    return `<button class="${clase}" data-ruta="${ruta}" draggable="${!!c}" title="${esc(tit)}">${dentro}</button>`;
  }
  // cada cuadro con el nombre de su lugar encima; dentro, lo que llevas o vacío
  function pintarFigura() {
    const col = (lista) => lista.map(([ruta, et]) => `<div class="inv-sitio"><small>${tr(et)}</small>${cuadro(ruta, '—')}</div>`).join('');
    q('.inv-izq').innerHTML = col(IZQUIERDA);
    q('.inv-der').innerHTML = col(DERECHA);
    q('.eq-manos').innerHTML = `<small>${tr('Manos y hombro')}</small><div>${MANOS_HOMBRO.map(([ruta, et]) => `<div class="inv-mano"><small>${tr(et)}</small>${cuadro(ruta, '—')}</div>`).join('')}</div>`;
    // los huecos del cinturón, en fila (sin cinturón, ninguno)
    const hc = inv().huecosCintura();
    q('.inv-cinto').innerHTML = hc.length ? `<small>${tr('Huecos del cinturón')}</small><div>${hc.map(x => cuadro(x.ruta, tr(NOMBRE_TAM[x.tam]), 'mini')).join('')}</div>` : '';
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
    caja.innerHTML = `<h3>${atras}${tr('Huecos de {c}', { c: nombreDe(c).toLowerCase() })}</h3>${admite}<div class="inv-rejilla">${d.huecos.map((hh, i) => cuadro(vista + '/' + i, tr(NOMBRE_TAM[hh.tam]))).join('')}</div>`;
  }

  // dónde está lo elegido, en palabras
  function dondeEsta(ruta) {
    if (NOMBRE_SITIO[ruta]) return ruta.startsWith('mano:') ? tr(ruta === 'mano:der' ? 'En la mano derecha.' : 'En la mano izquierda.') : ruta === 'hombro' ? tr('Lo llevas al hombro.') : tr('Lo llevas puesto ({l}).', { l: tr(NOMBRE_SITIO[ruta]).toLowerCase() });
    const p = ruta.split('/'), cont = inv().buscar(p.slice(0, -1).join('/')).cosa;
    return tr('Guardado en {c}.', { c: cont ? nombreDe(cont).toLowerCase() : '' });
  }
  function pintarSel() {
    const caja = q('.inv-sel');
    panel.classList.toggle('eq-con-sel', !!sel);
    if (!sel) { caja.innerHTML = `<p class="inv-nota eq-vacia">${tr('Toca algo de tu equipo o del arcón para ver qué es y qué puedes hacer con ello.')}</p>`; return; }
    const c = sel.de === 'arcon' ? { tipo: sel.tipo, n: 1, ...(sel.rasgos || {}) } : inv().buscar(sel.ruta).cosa;
    if (!c) { sel = null; pintarSel(); return; }
    const d = CATALOGO[c.tipo];
    const enInv = sel.de === 'inv', puesto = enInv && esPuesto(sel.ruta);
    const alHombro = d.lugar === 'hombro';
    const ponible = (d.capa || d.lugar) && !puesto;
    const aManos = d.tam !== 'E' && (sel.de === 'arcon' ? !d.capa && !d.lugar : !sel.ruta.startsWith('mano:'));
    const aSuelo = sel.de === 'arcon' && d.tam === 'E' && !d.recurso && !!alSuelo;
    const chips = [tr(NOMBRE_TAM[d.tam]), ...(c.n > 1 ? [`× ${c.n}`] : []), ...(d.huecos ? [tr('{n} huecos', { n: d.huecos.length })] : []),
      ...(PRENDAS[c.tipo] ? [tr('{p} kg', { p: PRENDAS[c.tipo].peso })] : [])].map(t => `<span class="fab-chip">${esc(t)}</span>`).join('');
    const dentro = enInv && c.dentro && c.dentro.some(Boolean) ? `<p class="inv-nota">${tr('Lleva cosas dentro: van con él.')}</p>` : '';
    // lo que le queda a lo que se gasta (herramientas y armas, 10 nov; src/logica/desgaste.js): al acabarse, se rompe
    const dg = desgasteDe(c);
    const gasto = dg ? `<p class="eq-desgaste"><span>${esc(tr('Le quedan {q} usos de {v}', { q: dg.queda, v: dg.vida }))}</span><span class="fab-barra eq-barra${dg.fraccion <= 0.2 ? ' eq-poco' : ''}"><i style="width:${Math.round(dg.fraccion * 100)}%"></i></span></p>${comoSeRepara(c.tipo)}` : '';
    const para = PARA_TIPO[c.tipo] ? `<p class="fab-para">${esc(tr(PARA_TIPO[c.tipo]))}</p>` : '';
    const btn = (cls, txt, prim = false) => `<button class="${cls} ${prim ? 'fab-btn' : 'fab-btn2'}">${esc(txt)}</button>`;
    const botones = [
      aManos ? btn('inv-manos', puesto ? tr('Quitártelo a las manos') : tr('Cogerlo con las manos'), puesto) : '',
      enInv && comer && comestible(c.tipo) ? btn('inv-comer', c.n > 1 ? tr('Comer uno') : tr('Comértelo'), true) : '',
      ponible ? btn('inv-ponerse', alHombro ? tr('Al hombro') : tr('Ponértelo'), !puesto) : '',
      enInv && soltarSuelo ? btn('inv-suelo', tr('Dejarlo en el suelo')) : '',
      aSuelo ? btn('inv-alsuelo', tr('Dejarlo en el suelo')) : '',
      enInv && hayArcon() ? btn('inv-devolver', tr('Al arcón')) : '',
      btn('inv-dejar', tr('Cancelar')),
    ].join('');
    const pista = aSuelo ? tr('Es enorme: no se lleva encima. Déjalo en el suelo y arrástralo.') : enInv ? tr('O toca otro sitio de tu equipo para llevarlo allí.') : tr('Cógelo con las manos o toca un hueco donde guardarlo.');
    caja.innerHTML = `<button class="eq-sel-cerrar" aria-label="✕"></button>${imagen(c.tipo, c, true)}<h3 class="fab-titulo">${esc(nombreDe(c))}</h3>
      <p class="eq-donde">${esc(enInv ? dondeEsta(sel.ruta) : tr('En el arcón de pruebas.'))}</p>${para}<div class="fab-chips">${chips}</div>${gasto}${dentro}
      <div class="fab-acciones inv-botones">${botones}</div><p class="inv-nota">${esc(pista)}</p>`;
  }

  function pintarCarga() {
    const l = inv().lleno();
    const pc = Math.round(l.fraccion * 100);
    q('.inv-carga').innerHTML = `<span>${tr('Carga: {c}% · velocidad al andar: {v}%', { c: pc, v: Math.round(inv().velocidad() * 100) })}</span><span class="fab-barra eq-barra"><i style="width:${Math.min(100, pc)}%"></i></span>`;
    const a = q('.inv-aviso');
    a.textContent = aviso.txt; a.className = 'inv-aviso' + (aviso.error ? ' error' : '');
  }

  function pintarMateriales() {
    const caja = q('.inv-materiales');
    if (!conArcon()) { caja.innerHTML = ''; return; }
    const hay = materialesArcon();
    caja.innerHTML = `<div class="inv-grupo"><h4>${tr('Materiales de obra')}</h4><div>${Object.entries(OBJETO_DE_MATERIAL).map(([m, k]) =>
      `<button class="inv-objeto${sel && sel.de === 'arcon' && sel.tipo === k ? ' sel' : ''}" data-tipo="${k}" data-arcon="${m}" draggable="true" title="${tr(NOMBRE_TAM[CATALOGO[k].tam])}">${imagen(k)}<span>${nombre(k)} <b>${hay[m] || 0}</b></span></button>`).join('')}</div></div>`;
  }
  let arconHecho = false;
  function pintarArcon() {
    // sin arcón (el juego de verdad, valravnx 1 nov), no se ve: lo que llevas se coge del mundo
    q('.inv-arcon').hidden = !hayArcon();
    panel.classList.toggle('eq-sin-arcon', !hayArcon());
    if (!hayArcon()) return;
    pintarMateriales();
    if (arconHecho && q('.inv-grupos').childElementCount) {
      for (const b of panel.querySelectorAll('.inv-grupos .inv-objeto')) b.classList.toggle('sel', !!sel && sel.de === 'arcon' && sel.tipo === b.dataset.tipo && String(sel.muestra ?? '') === (b.dataset.muestra ?? ''));
      return;
    }
    arconHecho = true;
    const ks = Object.keys(CATALOGO);
    const boton = (k, txt, extra = '', c = null) => `<button class="inv-objeto" data-tipo="${k}"${extra} draggable="true" title="${tr(NOMBRE_TAM[CATALOGO[k].tam])}">${imagen(k, c)}<span>${esc(txt)}</span></button>`;
    const cosidas = `<div class="inv-grupo"><h4>${tr('Ropa cosida (muestras)')}</h4><div>${MUESTRAS.map((m, i) => boton(m.tipo, nombrePrenda(m.tipo, m.rasgos, tr), ` data-muestra="${i}"`, m.rasgos)).join('')}</div></div>`;
    q('.inv-grupos').innerHTML = GRUPOS.map(([t, f]) => `<div class="inv-grupo"><h4>${tr(t)}</h4><div>${ks.filter(k => f(CATALOGO[k], k) || (t === 'Recursos' && !conArcon() && CATALOGO[k].tam !== 'E' && k in MATERIAL_DE_OBJETO)).map(k =>
      boton(k, nombre(k))).join('')}</div></div>`).join('') + cosidas;
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
    if (!t) { if (hayArcon() && e.target.closest('.inv-arcon') && sel && sel.de === 'inv') { alArcon(); pintar(); } return; }
    if (t.classList.contains('inv-cerrar')) { cerrar(); return; }
    if (t.dataset.ruta) { tocar(t.dataset.ruta); return; }
    if (t.dataset.vista !== undefined) { vista = t.dataset.vista; pintar(); return; }
    if (t.dataset.tipo) {
      if (sel && sel.de === 'inv') alArcon();
      else sel = sel && sel.de === 'arcon' && sel.tipo === t.dataset.tipo && String(sel.muestra ?? '') === (t.dataset.muestra ?? '') ? null : delArcon(t);
      avisar(''); pintar(); return;
    }
    if (t.classList.contains('inv-comer')) { comer(inv().buscar(sel.ruta).cosa.tipo); if (!inv().buscar(sel.ruta).cosa) sel = null; }
    else if (t.classList.contains('inv-ponerse')) ponerse();
    else if (t.classList.contains('inv-manos')) aLasManos();
    else if (t.classList.contains('inv-suelo')) alSueloDe();
    else if (t.classList.contains('inv-alsuelo')) { const r = alSuelo(sel.tipo); if (r && r.ok) sel = null; }
    else if (t.classList.contains('inv-devolver')) alArcon();
    else if (t.classList.contains('inv-dejar') || t.classList.contains('eq-sel-cerrar')) sel = null;
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

  function abrir() { panel.hidden = false; boton && boton.classList.add('sel'); cargarIndice(); pintar(); }
  function cerrar() { panel.hidden = true; sel = null; retratoHecho = false; boton && boton.classList.remove('sel'); }
  function alternar() { if (panel.hidden) abrir(); else cerrar(); }
  if (boton) boton.onclick = alternar;
  return { abrir, cerrar, alternar, pintar, get abierto() { return !panel.hidden; }, get sel() { return sel; }, get vista() { return vista; } };
}
