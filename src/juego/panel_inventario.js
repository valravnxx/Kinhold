// El panel de equipo, en tres columnas (valravnx, 7 nov, estudio de la interfaz aprobado: «Ropa | Lo que llevas | A tus
// pies»; antes, 29 oct y 7 nov, el personaje en el centro con un cuadro por cada lugar). Ropa: lo que vistes por capas,
// a los lados de tu personaje de verdad. Lo que llevas: las dos manos, el hombro y cada bolsa (el cinturón, lo de la
// espalda y lo que vaya dentro) abierta a la vez, con sus huecos. A tus pies: lo que hay en el suelo a dos pasos (tocar
// para cogerlo; soltar ahí lo que llevas para dejarlo). En el móvil, dos pestañas: «Lo que llevas» (con lo de tus pies)
// y «Ropa». Los huecos vacíos enseñan, apagada, la silueta de lo que va en ellos.
// Al tocar algo, su ficha (abajo) dice qué es y dónde está, con lo principal que se puede hacer y «Mover…» (luego se
// toca dónde). Clic derecho, o mantener el dedo: a la mano (o, si ya está en la mano, al suelo). En PC también se
// arrastra. Cada cosa con su imagen (la de su modelo del juego, docs/recursos/iconos-vN/; la ropa, dibujada con su
// tinte, src/juego/iconos_ropa.js).
// Todo lo que cambia pasa por accion() (la acción con autor a la lógica pura, src/logica/inventario.js; en línea, al
// servidor), soltarSuelo(ruta) (al suelo del mundo) y cogerSuelo(id, a) (del suelo, a la ruta a o donde quepa). El
// arcón de pruebas, donde aún lo hay (no en el juego de verdad), va debajo de lo de tus pies: de él se coge y en él se
// deja.
import { CATALOGO, pila, MATERIAL_DE_OBJETO, OBJETO_DE_MATERIAL } from '../logica/inventario.js';
import { nombrePrenda, rasgosPrenda } from '../logica/hechura.js';
import { desgasteDe, reparacionDe } from '../logica/desgaste.js';
import { PRENDAS } from '../logica/prendas.js';
import { RECETAS, PARA } from '../logica/fabricacion.js';
import { svgPrenda } from './iconos_ropa.js';
import { carpetaIconos } from './panel_fabricar.js';
import { tr } from '../idioma.js';

// Los cuadros del equipo, a los dos lados del personaje, de arriba abajo más o menos a la altura de lo que visten.
// (Ropa: a los dos lados del personaje, de arriba abajo más o menos a la altura de lo que visten)
const IZQUIERDA = [['ropa:cabeza', 'Cabeza'], ['ropa:sobre', 'Sobre todo'], ['ropa:abrigo', 'Abrigo'], ['ropa:guantes', 'Guantes']];
const DERECHA = [['ropa:exterior', 'Exterior'], ['ropa:interior', 'Camisa'], ['ropa:piernas', 'Piernas'], ['ropa:pies', 'Pies']];
const MANOS_HOMBRO = [['mano:der', 'Mano derecha'], ['mano:izq', 'Mano izquierda'], ['hombro', 'Al hombro']];
// las bolsas que se llevan puestas: cada una, abierta con sus huecos en «Lo que llevas»
const BOLSAS = [['cintura', 'Cintura'], ['espalda', 'Espalda']];
export const CUADROS_EQUIPO = [...IZQUIERDA, ...DERECHA, ...BOLSAS].map(([r]) => r);
const NOMBRE_SITIO = Object.fromEntries([...IZQUIERDA, ...DERECHA, ...MANOS_HOMBRO, ...BOLSAS]);
// La silueta de lo que va en cada hueco vacío: una prenda de ese sitio (dibujada) o la imagen de una cosa que va ahí,
// apagadas; las manos, una mano abierta.
const SILUETA = { 'ropa:cabeza': 'capucha_lana', 'ropa:sobre': 'manto_lana', 'ropa:abrigo': 'tunica_lana', 'ropa:exterior': 'cota_malla',
  'ropa:interior': 'camisa_lino', 'ropa:piernas': 'calzas_lana', 'ropa:pies': 'botas_cuero', cintura: 'cinto_cuero', espalda: 'zurron', hombro: 'saco' };
// las manos (y los guantes): una mano abierta, dibujada aquí (no hay cosa que vaya en ellas siempre)
const MANO_SVG = '<svg viewBox="0 0 100 100" class="ic-prenda"><path fill="#d8cbb4" d="M38 96 L34 64 L19 50 C14 45 19 37 26 42 L36 51 L36 21 C36 14 45 14 45 21 L46 45 L47 14 C47 7 56 7 56 14 L57 45 L59 19 C59 12 67 12 67 19 L66 49 L69 31 C69 24 77 25 76 31 L73 62 C71 78 67 86 65 96 Z"/></svg>';
const SILUETA_MANO = new Set(['mano:der', 'mano:izq', 'ropa:guantes']);

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
// suelo() (opcional): lo que hay en el suelo a dos pasos ([{ id, cosa }]); cogerSuelo(id, a) lo coge (a la ruta a, o
// donde quepa). comer(tipo) (opcional, P4): come una unidad de eso (bayas, setas…: los que dice comestible)
// cómo se repara lo que se gasta (10 nov): en qué puesto y con qué, dejado en él
const PUESTO_REPARAR = { tallar: 'en la piedra de tallar', banco: 'en el banco de tronco' };
function comoSeRepara(tipo) {
  const rp = reparacionDe(tipo), ropa = Object.hasOwn(PRENDAS, tipo);
  if (!rp) return ropa ? `<p class="inv-nota">${esc(tr('Aún no se puede reparar: al acabarse, se rompe.'))}</p>` : '';
  const con = Object.entries(rp.gasta).map(([t, n]) => `${n} ${tr(CATALOGO[t].nombre).toLowerCase()}`).join(', ');
  // (la ropa se repara puesta o en la mano; las herramientas, en la mano)
  return `<p class="inv-nota">${esc(tr(ropa ? 'Se repara {p}, dejando en el puesto {c}: puesta o en la mano, Usar junto a él.' : 'Se repara {p}, con {c} dejado en el puesto: con la herramienta en la mano, Usar junto a él.', { p: tr(PUESTO_REPARAR[rp.uso]), c: con }))}</p>`;
}
const MANTENER_MS = 500;   // mantener el dedo encima: como el clic derecho
export function montarPanelInventario({ panel, boton, inventario, accion, alCambiar = () => {}, retrato = null, accionArcon = null, materialesArcon = null, alSuelo = null, soltarSuelo = null, suelo = null, cogerSuelo = null, hayArcon = () => true, comer = null, comestible = () => false }) {
  let sel = null;          // { de: 'arcon', tipo }, { de: 'inv', ruta } o { de: 'suelo', id }
  let moviendo = false;    // tras «Mover…»: el siguiente toque dice adónde
  let pestana = 'llevas';  // en el móvil: «Lo que llevas» o «Ropa»
  let aviso = { txt: '', error: false };
  const base = carpetaIconos();
  let indice = {}, pedido = false;   // las imágenes: cuáles aún no tienen su modelo (se piden al abrir)
  const cargarIndice = () => { if (pedido || typeof fetch !== 'function') return; pedido = true; fetch(base + 'indice.json').then(r => r.ok ? r.json() : null).then(j => { if (j && j.iconos) { indice = j.iconos; arconHecho = false; pintar(); } }).catch(() => {}); };

  panel.classList.add('eq-panel', 'eq-tab-llevas');
  panel.innerHTML = `<div class="eq-cab"><div><h2>${tr('Equipo')}</h2><small>${tr('Toca algo para ver qué es; clic derecho o mantener: a la mano o al suelo.')}</small></div>
      <div class="eq-pestanas" role="tablist"><button class="eq-pest sel" data-pest="llevas">${tr('Lo que llevas')}</button><button class="eq-pest" data-pest="ropa">${tr('Ropa')}</button></div>
      <button class="cerrar inv-cerrar" aria-label="✕">✕</button></div>
    <div class="eq-centro">
      <section class="eq-col eq-ropa"><h3>${tr('Ropa')}</h3><div class="inv-figura"><div class="inv-col inv-izq"></div><canvas class="inv-retrato"></canvas><div class="inv-col inv-der"></div></div></section>
      <section class="eq-col eq-llevas"><h3>${tr('Lo que llevas')}</h3><div class="eq-manos"></div><div class="eq-bolsas"></div></section>
      <section class="eq-col eq-pies"><h3>${tr('A tus pies')}</h3><div class="eq-suelo"></div>
        <div class="inv-arcon"><h3>${tr('Arcón de pruebas')}</h3><p class="inv-nota">${tr('Solo en las pruebas: hace de mundo. Toca algo y luego dónde lo quieres, o cógelo con las manos; suéltalo aquí para dejarlo.')}</p><div class="inv-materiales"></div><div class="inv-grupos"></div></div></section>
    </div>
    <aside class="inv-sel"></aside>
    <div class="eq-pie"><div class="inv-aviso"></div><div class="inv-carga"></div></div>`;
  const q = s => panel.querySelector(s);
  const inv = () => inventario();
  const def = c => c && CATALOGO[c.tipo];
  const nombre = tipo => tr(CATALOGO[tipo].nombre);
  const enSuelo = () => (suelo ? suelo() : []);
  const delSuelo = id => enSuelo().find(o => String(o.id) === String(id)) || null;

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
  const dejar = () => { sel = null; moviendo = false; };

  // cuántas unidades se cogen del arcón para la ruta: la pila entera, o lo que quepa si ya hay de lo mismo
  function cantidadPara(tipo, ruta) {
    const b = inv().buscar(ruta);
    const hay = b.cosa && b.cosa.tipo === tipo ? b.cosa.n : 0;
    return Math.max(1, pila(tipo) - hay);
  }
  const manoLibre = () => ['mano:der', 'mano:izq'].find(m => !inv().lugares[m] && !inv().manoBloqueada(m));

  // del suelo a lo que llevas (a la ruta, o donde quepa); en línea lo coge el servidor
  function delSueloA(id, ruta) {
    if (!cogerSuelo) return;
    const r = cogerSuelo(id, ruta);
    if (r && r.ok) { avisar(r.enviado ? '' : tr('Lo coges del suelo.')); alCambiar(); retratoHecho = false; }
    else if (r && r.motivo) avisar(motivo(r.motivo), true);
  }
  // Lo que pasa al soltar lo elegido en la ruta (al tocar con «Mover…», en un hueco vacío o al arrastrar).
  function aRuta(ruta) {
    if (!sel) return;
    if (sel.de === 'arcon') hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, ruta), a: ruta, ...(sel.rasgos || {}) });
    else if (sel.de === 'suelo') delSueloA(sel.id, ruta);
    else if (sel.ruta !== ruta) {
      if (esPuesto(sel.ruta) && !ruta.startsWith(sel.ruta)) hacer({ tipo: 'quitarse', lugar: sel.ruta, a: ruta });
      else hacer({ tipo: 'mover', de: sel.ruta, a: ruta });
    }
    dejar();
  }
  function alArcon() {
    if (!sel || sel.de !== 'inv') return;
    const r = hacer({ tipo: 'soltar', de: sel.ruta });
    if (r.ok) avisar(tr('Devuelto al arcón.'));
    dejar();
  }
  function ponerse() {
    if (!sel) return;
    if (sel.de === 'inv') { const r = hacer({ tipo: 'ponerse', de: sel.ruta }); if (r.ok) avisar(tr('Te lo pones.')); dejar(); return; }
    const d = sel.de === 'suelo' ? def((delSuelo(sel.id) || {}).cosa) : CATALOGO[sel.tipo];
    if (!d) { dejar(); return; }
    const lugar = d.capa ? 'ropa:' + d.capa : d.lugar;
    if (inv().lugares[lugar]) { avisar(tr(lugar === 'hombro' ? 'Ya llevas algo al hombro: suéltalo antes.' : 'Ya llevas algo ahí: quítatelo antes.'), true); return; }
    if (sel.de === 'suelo') { delSueloA(sel.id, lugar); dejar(); return; }
    const r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: 1, a: lugar, ...(sel.rasgos || {}) });
    if (r.ok && lugar === 'hombro') avisar(tr('Lo llevas al hombro.'));
    dejar();
  }
  // a las manos: del arcón o del suelo, de un hueco o quitándotelo (lo puesto)
  function aLasManos() {
    if (!sel) return;
    const libre = manoLibre();
    if (!libre) { avisar(tr('Llevas las manos ocupadas: suelta lo que llevas.'), true); return; }
    if (sel.de === 'suelo') { delSueloA(sel.id, libre); dejar(); return; }
    let r;
    if (sel.de === 'arcon') r = hacer({ tipo: 'coger', objeto: sel.tipo, cantidad: cantidadPara(sel.tipo, libre), a: libre });
    else if (esPuesto(sel.ruta)) r = hacer({ tipo: 'quitarse', lugar: sel.ruta, a: libre });
    else r = hacer({ tipo: 'mover', de: sel.ruta, a: libre });
    if (r.ok) avisar(tr('Lo llevas en las manos.'));
    dejar();
  }
  // al suelo, a tus pies, con lo que lleve dentro (en línea lo deja el servidor y lo ven todos)
  function alSueloDe() {
    if (!sel || sel.de !== 'inv' || !soltarSuelo) return;
    const r = soltarSuelo(sel.ruta);
    if (r && r.ok) { avisar(r.enviado ? '' : tr('Lo dejas en el suelo.')); alCambiar(); retratoHecho = false; }
    else if (r && r.motivo) avisar(motivo(r.motivo), true);
    dejar();
  }
  // clic derecho o mantener: a la mano; si ya está en la mano (o es del suelo y no hay mano libre), al suelo / a la mano
  function rapido(t) {
    if (t.dataset.ruta) {
      if (!inv().buscar(t.dataset.ruta).cosa) return;
      sel = { de: 'inv', ruta: t.dataset.ruta };
      if (t.dataset.ruta.startsWith('mano:') || t.dataset.ruta === 'hombro') { if (soltarSuelo) alSueloDe(); else if (hayArcon()) alArcon(); }
      else aLasManos();
    } else if (t.dataset.suelo) { sel = { de: 'suelo', id: t.dataset.suelo }; aLasManos(); }
    else if (t.dataset.tipo) { sel = delArcon(t); aLasManos(); }
    dejar(); pintar();
  }

  // Toque en un cuadro de lo tuyo (lugar del cuerpo, mano, hombro o hueco).
  function tocar(ruta) {
    const c = inv().buscar(ruta).cosa;
    const mismo = sel && sel.de === 'inv' && sel.ruta === ruta;
    // con «Mover…», o en un hueco vacío con algo elegido, lo elegido va ahí
    if (sel && !mismo && (moviendo || !c || sel.de !== 'inv')) { aRuta(ruta); pintar(); return; }
    if (mismo) { dejar(); pintar(); return; }   // tocar otra vez lo elegido lo deja
    avisar(''); moviendo = false;
    if (c) sel = { de: 'inv', ruta };
    else { sel = null; if (ruta === 'cintura') avisar(tr('Sin cinturón no hay huecos en la cintura.')); else if (ruta === 'espalda') avisar(tr('Sin nada a la espalda no llevas huecos ahí.')); }
    pintar();
  }

  // ---- dibujo ----
  // la imagen de una cosa: la ropa, dibujada con su tinte; lo demás, la de su modelo (o «sin modelo aún»)
  function imagen(tipo, c = null, grande = false) {
    const ropa = PRENDAS[tipo] ? svgPrenda(tipo, c) : '';
    const sin = !ropa && indice[tipo] && indice[tipo].propio === false;
    return `<span class="fab-ic eq-ic${grande ? ' eq-grande' : ''}">${ropa || `<img class="fab-img" src="${esc(base + tipo + '.webp')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`}${sin ? `<em class="fab-pend">${esc(tr('sin modelo aún'))}</em>` : ''}</span>`;
  }
  // la silueta apagada de lo que va en un sitio vacío
  function silueta(ruta) {
    if (SILUETA_MANO.has(ruta)) return `<span class="eq-sil">${ruta === 'mano:izq' ? MANO_SVG.replace('<path', '<path transform="matrix(-1 0 0 1 100 0)"') : MANO_SVG}</span>`;
    const t = SILUETA[ruta];
    if (!t) return '';
    return `<span class="eq-sil">${PRENDAS[t] ? svgPrenda(t) : `<img src="${esc(base + t + '.webp')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`}</span>`;
  }
  // el nombre de una cosa; la ropa, con su hechura y su tinte («Túnica de lana · Corto, Sarga · Azul de glasto»)
  const nombreDe = (c) => def(c).capa ? nombrePrenda(c.tipo, c, tr) : tr(def(c).nombre);
  function cuadro(ruta, etiqueta, extra = '') {
    const b = inv().buscar(ruta), c = b.cosa;
    const elegido = sel && sel.de === 'inv' && sel.ruta === ruta;
    const bloqueada = ruta.startsWith('mano:') && !c && inv().manoBloqueada(ruta);
    const destino = sel && moviendo && !elegido && !bloqueada;   // (tras «Mover…»: dónde se puede tocar)
    const clase = ['inv-c', c ? 'lleno' : 'vacio', elegido ? 'sel' : '', destino ? 'destino' : '', c && def(c).huecos ? 'contenedor' : '', bloqueada ? 'bloqueada' : '', extra].join(' ');
    const dentro = c ? `${imagen(c.tipo, c)}<span class="inv-nom">${esc(nombreDe(c))}</span>${c.n > 1 ? `<b class="inv-n">${c.n}</b>` : ''}` : `${silueta(ruta)}<span class="inv-et">${esc(etiqueta)}</span>`;
    const tit = c ? `${nombreDe(c)} (${tr(NOMBRE_TAM[def(c).tam])})` : etiqueta;
    return `<button class="${clase}" data-ruta="${ruta}" draggable="${!!c}" title="${esc(tit)}">${dentro}</button>`;
  }
  // Ropa: cada cuadro con el nombre de su sitio encima, a los lados del personaje
  function pintarRopa() {
    const col = (lista) => lista.map(([ruta, et]) => `<div class="inv-sitio"><small>${tr(et)}</small>${cuadro(ruta, '')}</div>`).join('');
    q('.inv-izq').innerHTML = col(IZQUIERDA);
    q('.inv-der').innerHTML = col(DERECHA);
  }
  // Lo que llevas: las manos y el hombro, y cada bolsa abierta con sus huecos (y lo que vaya dentro de ellos, también)
  function pintarLlevas() {
    q('.eq-manos').innerHTML = MANOS_HOMBRO.map(([ruta, et]) => `<div class="inv-mano"><small>${tr(et)}</small>${cuadro(ruta, '')}</div>`).join('');
    const bolsas = [];
    const abrir = (ruta, nivel) => {
      const c = inv().buscar(ruta).cosa, d = def(c);
      if (!d || !d.huecos) return;
      const admite = d.admite ? `<small class="eq-admite">${esc(tr('Solo admite: {l}.', { l: d.admite.map(nombre).join(', ').toLowerCase() }))}</small>` : '';
      bolsas.push(`<div class="eq-bolsa${nivel ? ' eq-dentro' : ''}" data-bolsa="${ruta}"><div class="eq-bolsa-cab"><b>${esc(nombreDe(c))}</b>${admite}</div><div class="eq-bolsa-huecos">${d.huecos.map((h, i) => cuadro(ruta + '/' + i, tr(NOMBRE_TAM[h.tam]), 'mini')).join('')}</div></div>`);
      d.huecos.forEach((h, i) => abrir(ruta + '/' + i, nivel + 1));
    };
    // el cinturón y lo de la espalda: su cuadro (para ponérselo o quitárselo) y, al lado, sus huecos
    const puestas = BOLSAS.map(([ruta, et]) => `<div class="inv-sitio eq-bolsa-sitio"><small>${tr(et)}</small>${cuadro(ruta, '')}</div>`).join('');
    for (const [ruta] of BOLSAS) abrir(ruta, 0);
    for (const [ruta] of MANOS_HOMBRO) abrir(ruta, 1);   // un saco en la mano también se abre
    q('.eq-bolsas').innerHTML = `<div class="eq-puestas">${puestas}</div>${bolsas.join('') || `<p class="inv-nota">${esc(tr('Sin cinturón ni nada a la espalda, solo llevas lo de las manos y el hombro.'))}</p>`}`;
  }
  // A tus pies: lo del suelo a dos pasos; con algo tuyo elegido, todo el recuadro es «dejarlo aquí»
  function pintarPies() {
    const lista = enSuelo();
    const soltando = sel && sel.de === 'inv' && !!soltarSuelo;
    q('.eq-pies').classList.toggle('destino', soltando);
    const cosas = lista.map(o => { const c = o.cosa, elegido = sel && sel.de === 'suelo' && String(sel.id) === String(o.id);
      return `<button class="inv-c lleno${elegido ? ' sel' : ''}${c.huecos || (def(c) && def(c).huecos) ? ' contenedor' : ''}" data-suelo="${esc(o.id)}" draggable="true" title="${esc(nombreDe(c))}">${imagen(c.tipo, c)}<span class="inv-nom">${esc(nombreDe(c))}</span>${c.n > 1 ? `<b class="inv-n">${c.n}</b>` : ''}</button>`; }).join('');
    const nota = soltando ? tr('Toca aquí para dejarlo en el suelo.') : lista.length ? '' : tr('No hay nada en el suelo a dos pasos.');
    q('.eq-suelo').innerHTML = `${cosas ? `<div class="eq-suelo-cosas">${cosas}</div>` : ''}${nota ? `<p class="inv-nota eq-suelo-nota">${esc(nota)}</p>` : ''}`;
    firmaSuelo = firma();
  }
  let retratoHecho = false;
  function pintarRetrato() {
    if (retratoHecho || !retrato) return;
    if (getComputedStyle(q('.eq-ropa')).display === 'none') return;   // (móvil, en la otra pestaña)
    retratoHecho = !!retrato(q('.inv-retrato'));
    if (!retratoHecho) setTimeout(() => { if (!panel.hidden) pintarRetrato(); }, 500);   // el personaje aún se está cargando
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
    if (!sel) { caja.innerHTML = `<p class="inv-nota eq-vacia">${tr('Toca algo para ver qué es y qué puedes hacer con ello.')}</p>`; return; }
    const os = sel.de === 'suelo' ? delSuelo(sel.id) : null;
    const c = sel.de === 'arcon' ? { tipo: sel.tipo, n: 1, ...(sel.rasgos || {}) } : sel.de === 'suelo' ? os && os.cosa : inv().buscar(sel.ruta).cosa;
    if (!c) { dejar(); pintarSel(); return; }
    const d = CATALOGO[c.tipo];
    const enInv = sel.de === 'inv', puesto = enInv && esPuesto(sel.ruta);
    const alHombro = d.lugar === 'hombro';
    const ponible = (d.capa || d.lugar) && !puesto;
    const aManos = d.tam !== 'E' && (sel.de === 'arcon' ? !d.capa && !d.lugar : sel.de === 'suelo' ? true : !sel.ruta.startsWith('mano:'));
    const aSuelo = sel.de === 'arcon' && d.tam === 'E' && !d.recurso && !!alSuelo;
    const chips = [tr(NOMBRE_TAM[d.tam]), ...(c.n > 1 ? [`× ${c.n}`] : []), ...(d.huecos ? [tr('{n} huecos', { n: d.huecos.length })] : []),
      ...(PRENDAS[c.tipo] ? [tr('{p} kg', { p: PRENDAS[c.tipo].peso })] : [])].map(t => `<span class="fab-chip">${esc(t)}</span>`).join('');
    const dentro = c.dentro && c.dentro.some(Boolean) ? `<p class="inv-nota">${tr('Lleva cosas dentro: van con él.')}</p>` : '';
    // lo que le queda a lo que se gasta (herramientas y armas, 10 nov; src/logica/desgaste.js): al acabarse, se rompe
    const dg = desgasteDe(c);
    const gasto = dg ? `<p class="eq-desgaste"><span>${esc(tr('Le quedan {q} usos de {v}', { q: dg.queda, v: dg.vida }))}</span><span class="fab-barra eq-barra${dg.fraccion <= 0.2 ? ' eq-poco' : ''}"><i style="width:${Math.round(dg.fraccion * 100)}%"></i></span></p>${comoSeRepara(c.tipo)}` : '';
    const para = PARA_TIPO[c.tipo] ? `<p class="fab-para">${esc(tr(PARA_TIPO[c.tipo]))}</p>` : '';
    const btn = (cls, txt, prim = false) => `<button class="${cls} ${prim ? 'fab-btn' : 'fab-btn2'}">${esc(txt)}</button>`;
    // lo principal primero (una sola acción destacada), luego «Mover…» y el suelo
    const comible = enInv && comer && comestible(c.tipo);
    const principal = comible ? 'comer' : ponible ? 'ponerse' : aManos ? 'manos' : '';
    const botones = [
      comible ? btn('inv-comer', c.n > 1 ? tr('Comer uno') : tr('Comértelo'), principal === 'comer') : '',
      ponible ? btn('inv-ponerse', alHombro ? tr('Al hombro') : tr('Ponértelo'), principal === 'ponerse') : '',
      aManos ? btn('inv-manos', puesto ? tr('Quitártelo a las manos') : tr('Cogerlo con las manos'), principal === 'manos') : '',
      sel.de !== 'arcon' && d.tam !== 'E' ? btn('inv-mover' + (moviendo ? ' sel' : ''), tr('Mover…')) : '',
      enInv && soltarSuelo ? btn('inv-suelo', tr('Dejarlo en el suelo')) : '',
      aSuelo ? btn('inv-alsuelo', tr('Dejarlo en el suelo')) : '',
      enInv && hayArcon() ? btn('inv-devolver', tr('Al arcón')) : '',
    ].join('');
    const pista = moviendo ? tr('Toca dónde lo quieres: una mano, el hombro o un hueco.') : aSuelo ? tr('Es enorme: no se lleva encima. Déjalo en el suelo y arrástralo.') : '';
    const donde = enInv ? dondeEsta(sel.ruta) : sel.de === 'suelo' ? tr('En el suelo, a tus pies.') : tr('En el arcón de pruebas.');
    caja.innerHTML = `<button class="eq-sel-cerrar inv-dejar" aria-label="✕"></button>${imagen(c.tipo, c, true)}<div class="eq-sel-txt"><h3 class="fab-titulo">${esc(nombreDe(c))}</h3>
      <p class="eq-donde">${esc(donde)}</p>${para}<div class="fab-chips">${chips}</div>${gasto}${dentro}</div>
      <div class="eq-sel-acc"><div class="fab-acciones inv-botones">${botones}</div>${pista ? `<p class="inv-nota eq-pista">${esc(pista)}</p>` : ''}</div>`;
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
    pintarRopa(); pintarLlevas(); pintarPies(); pintarSel(); pintarCarga(); pintarArcon(); pintarRetrato();
  }
  // lo del suelo cambia sin tocar el panel (andas, otro lo coge, el servidor contesta): se mira cada poco
  let firmaSuelo = '';
  const firma = () => enSuelo().map(o => o.id + ':' + o.cosa.tipo + ':' + o.cosa.n).join(',');
  setInterval(() => { if (!panel.hidden && suelo && firma() !== firmaSuelo) { if (sel && sel.de === 'suelo' && !delSuelo(sel.id)) dejar(); pintar(); } }, 600);

  // lo elegido en el arcón: el tipo y, si es una muestra de ropa cosida, su hechura y su tinte
  const delArcon = (t) => { const m = t.dataset.muestra !== undefined ? MUESTRAS[+t.dataset.muestra] : null;
    return { de: 'arcon', tipo: t.dataset.tipo, ...(m ? { muestra: +t.dataset.muestra, rasgos: m.rasgos } : {}) }; };
  // ---- eventos: clic, clic derecho, mantener, arrastrar y soltar ----
  let trasMantener = false;
  panel.addEventListener('click', (e) => {
    if (trasMantener) { trasMantener = false; return; }   // (el clic que sigue a mantener el dedo)
    const t = e.target.closest('button');
    if (!t) {
      // un toque en «A tus pies» (o en el arcón) con algo tuyo elegido: se deja ahí
      if (sel && sel.de === 'inv' && e.target.closest('.eq-pies')) { if (e.target.closest('.inv-arcon') && hayArcon()) alArcon(); else if (soltarSuelo) alSueloDe(); pintar(); }
      return;
    }
    if (t.classList.contains('inv-cerrar')) { cerrar(); return; }
    if (t.dataset.pest) { pestana = t.dataset.pest; panel.classList.toggle('eq-tab-ropa', pestana === 'ropa'); panel.classList.toggle('eq-tab-llevas', pestana === 'llevas');
      for (const b of panel.querySelectorAll('.eq-pest')) b.classList.toggle('sel', b.dataset.pest === pestana); retratoHecho = false; pintar(); return; }
    if (t.dataset.ruta) { tocar(t.dataset.ruta); return; }
    if (t.dataset.suelo) {
      if (sel && sel.de === 'inv') { if (soltarSuelo) alSueloDe(); }   // lo tuyo, encima de lo del suelo: al suelo
      else { const mismo = sel && sel.de === 'suelo' && String(sel.id) === t.dataset.suelo; moviendo = false; sel = mismo ? null : { de: 'suelo', id: t.dataset.suelo }; avisar(''); }
      pintar(); return;
    }
    if (t.dataset.tipo) {
      if (sel && sel.de === 'inv') alArcon();
      else { moviendo = false; sel = sel && sel.de === 'arcon' && sel.tipo === t.dataset.tipo && String(sel.muestra ?? '') === (t.dataset.muestra ?? '') ? null : delArcon(t); }
      avisar(''); pintar(); return;
    }
    if (t.classList.contains('inv-comer')) { comer(inv().buscar(sel.ruta).cosa.tipo); if (!inv().buscar(sel.ruta).cosa) dejar(); }
    else if (t.classList.contains('inv-ponerse')) ponerse();
    else if (t.classList.contains('inv-manos')) aLasManos();
    else if (t.classList.contains('inv-mover')) moviendo = !moviendo;
    else if (t.classList.contains('inv-suelo')) alSueloDe();
    else if (t.classList.contains('inv-alsuelo')) { const r = alSuelo(sel.tipo); if (r && r.ok) dejar(); }
    else if (t.classList.contains('inv-devolver')) alArcon();
    else if (t.classList.contains('inv-dejar')) dejar();
    pintar();
  });
  const rapidoDe = (e) => e.target.closest('button[data-ruta],button[data-suelo],button[data-tipo]');
  panel.addEventListener('contextmenu', (e) => { const t = rapidoDe(e); if (!t) return; e.preventDefault(); rapido(t); });
  let reloj = null;
  panel.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const t = rapidoDe(e); if (!t) return;
    clearTimeout(reloj); reloj = setTimeout(() => { reloj = null; trasMantener = true; rapido(t); if (navigator.vibrate) navigator.vibrate(15); }, MANTENER_MS);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) panel.addEventListener(ev, () => { clearTimeout(reloj); reloj = null; });
  panel.addEventListener('dragstart', (e) => {
    const t = e.target.closest('[data-ruta],[data-tipo],[data-suelo]');
    if (!t) return;
    sel = t.dataset.tipo ? delArcon(t) : t.dataset.suelo ? { de: 'suelo', id: t.dataset.suelo } : { de: 'inv', ruta: t.dataset.ruta };
    e.dataTransfer.setData('text/plain', t.dataset.tipo || t.dataset.suelo || t.dataset.ruta);
    e.dataTransfer.effectAllowed = 'move';
  });
  panel.addEventListener('dragover', (e) => { if (sel && (e.target.closest('[data-ruta]') || (sel.de === 'inv' && e.target.closest('.eq-pies')))) e.preventDefault(); });
  panel.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = e.target.closest('[data-ruta]');
    if (t) aRuta(t.dataset.ruta);
    else if (sel && sel.de === 'inv' && e.target.closest('.inv-arcon') && hayArcon()) alArcon();
    else if (sel && sel.de === 'inv' && e.target.closest('.eq-pies')) alSueloDe();
    pintar();
  });
  panel.addEventListener('dragend', () => { if (sel) { dejar(); pintar(); } });

  function abrir() { panel.hidden = false; boton && boton.classList.add('sel'); cargarIndice(); pintar(); }
  function cerrar() { panel.hidden = true; dejar(); retratoHecho = false; boton && boton.classList.remove('sel'); }
  function alternar() { if (panel.hidden) abrir(); else cerrar(); }
  if (boton) boton.onclick = alternar;
  return { abrir, cerrar, alternar, pintar, get abierto() { return !panel.hidden; }, get sel() { return sel; }, get pestana() { return pestana; } };
}
