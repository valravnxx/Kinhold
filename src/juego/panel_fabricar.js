// Kinhold — el panel de fabricación (P3, «De nada a una casa»; revisión del 1 nov: las recetas siempre a la vista,
// nadie las aprende). Como en el estudio que aprobó valravnx el 6 nov (diseno/estudios/panel_fabricar.html):
//  - Pestañas por dónde se hace: Todo, Con las manos y una por cada uso de estación (piedra de tallar, fuego, banco de
//    tronco), cada una con el número de lo que puedes hacer ya. Con H o el botón «Fabricar» se abre en «Con las
//    manos»; con Usar delante de una estación (abrirEstacion), en la pestaña de esa estación.
//  - Cartas con la imagen de cada cosa (docs/recursos/iconos-vN/, sacadas de los modelos del juego), ordenadas: lo que
//    puedes hacer ya (dorado), lo que casi (con cuánto falta) y lo que pide una estación que no tienes al lado (en
//    gris, con la imagen de esa estación). Lo que aún no tiene modelo lo dice («sin modelo aún»).
//  - La ficha de la carta elegida (a la derecha en PC; en el móvil sube desde abajo): para qué sirve, dónde se hace y
//    cuánto tarda, y cada material con lo que hay, lo que pide y de dónde sale. «Hacer», o lo que falta. Y los dos
//    atajos (valravnx, 6 nov: «me gustan esas dos opciones, pero dilo más claro»): «Hacer antes» lo que falta si ya
//    se puede hacer, y «Poner en la estación lo que falta» de lo que llevas. Ninguno coge nada que no harías a mano.
//  - En la pestaña de una estación que tienes al lado: lo que tiene encima (tocar: coger) y lo que llevas que se puede
//    dejar (tocar: dejar), cada cosa con su imagen. Sus recetas gastan solo lo depositado (valravnx, 6 nov).
//  - En la de la hoguera, encima, su fuego (src/logica/fuego.js): cómo está y cuánto le queda, encenderla (con yesca y
//    el taladro de fuego) y echarle una rama o una leña de lo que llevas. Sus recetas lo piden encendido.
//  - Abajo, lo que está en marcha, con su barra; lo terminado, para recoger.
//  - Los puestos de trabajo ya no se ponen desde aquí: son obra y se levantan desde el menú de construcción, en su
//    pestaña «Puestos de trabajo» (valravnx, 6 nov). El panel solo usa los que están levantados.
// El panel no cambia nada por su cuenta: manda la acción con hacer(accion, alResultado) (en línea, al servidor, que
// pone el autor) y espera la respuesta. Es provisional hasta que se rehaga todo el HUD (GDD).
import { CATALOGO } from '../logica/inventario.js';
import { RECETAS, USOS, ESTACIONES, PARA, ALCANCE_ESTACION, DEPOSITO_MAX, totalDeposito, estacionesDeUso, conQue } from '../logica/fabricacion.js';
import { CARPETA_ICONOS } from '../logica/iconos.js';
import { estadoFuego, ARDE, YESCAS, HERRAMIENTA_FUEGO } from '../logica/fuego.js';
import { tr } from '../idioma.js';

const SITIOS = [['mano', 'de la mano'], ['cinturon', 'del cinturón'], ['mochila', 'de la mochila'], ['hombro', 'del hombro'], ['suelo', 'del suelo'], ['estacion', 'de la estación']];
const nombre = t => tr((CATALOGO[t] || {}).nombre || t);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const DELANTE = 1.2; // m: dónde se pone una estación, delante de ti
// las pestañas: todo, con las manos y una por cada uso con estación
const PESTANAS = ['todo', 'manos', ...Object.keys(USOS).filter(u => u !== 'manos')];
const NOMBRE_PESTANA = { todo: () => tr('Todo'), manos: () => tr('Con las manos'), tallar: () => tr('Piedra de tallar'), fuego: () => tr('Fuego'), banco: () => tr('Banco de tronco') };
// cómo se nombra cada estación en una frase («encima de la piedra de tallar»)
const LA_ESTACION = { piedra_tallar: () => tr('la piedra de tallar'), hoguera: () => tr('la hoguera'), banco_tronco: () => tr('el banco de trabajo de tronco') };
const laEstacion = t => LA_ESTACION[t] ? LA_ESTACION[t]() : tr(ESTACIONES[t].nombre).toLowerCase();
const MANO_SVG = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17V8.5a1.8 1.8 0 0 1 3.6 0V15M13.6 15V6.3a1.8 1.8 0 0 1 3.6 0V15M17.2 15V7.5a1.8 1.8 0 0 1 3.6 0V16M20.8 16v-4a1.8 1.8 0 0 1 3.6 0v7c0 5-3.4 9-8.4 9-3.4 0-5.4-1.6-7-4.2l-3-5a1.9 1.9 0 0 1 3.1-2.1L10 19"/></svg>';
const TODO_SVG = '<svg viewBox="0 0 32 32" fill="currentColor"><rect x="5" y="5" width="9" height="9" rx="2"/><rect x="18" y="5" width="9" height="9" rx="2"/><rect x="5" y="18" width="9" height="9" rx="2"/><rect x="18" y="18" width="9" height="9" rx="2"/></svg>';
// «1 rama y 1 cordel de fibra»
const yLista = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + tr(' y ') + l[l.length - 1];
const cosas = o => yLista(Object.entries(o).map(([t, n]) => `${n} ${nombre(t).toLowerCase()}`));

// La carpeta de las imágenes: la de los recursos publicados (../../recursos/… desde docs/jugar/<prototipo>/) o la que
// diga ?iconos= (las pruebas).
export function carpetaIconos() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('iconos') : null;
  return q || '../../' + CARPETA_ICONOS;
}

// fab: la Fabricacion con las estaciones que se ven. inventario(): lo que llevas. suelo(): el Suelo. posicion(): { x, z, rot }.
// hacer(accion, alResultado): manda { tipo: 'fabricar' | 'recoger_fabricado' | 'colocar_estacion' | 'depositar_estacion' | 'retirar_estacion', … }.
export function montarPanelFabricar({ panel, boton, fab, inventario, suelo, posicion, hacer, alAbrir = () => {} }) {
  let abierto = false, firma = '', aviso = { txt: '', error: false };
  let pestana = 'manos', sel = null, estacionActiva = null, fichaMovil = false;
  // lo encargado: manos y cada estación → [{ receta, fin }] (fin con la hora de este navegador)
  let encargos = { manos: [], estaciones: {} };
  const base = carpetaIconos();
  let indice = {}; // tipo → { propio } (lo que aún no tiene modelo sale «sin modelo aún»)
  // el índice y las imágenes se piden al abrir el panel por primera vez (no antes: quien nunca lo abre no los baja)
  let pedido = false;
  const cargarIndice = () => { if (pedido || typeof fetch !== 'function') return; pedido = true; fetch(base + 'indice.json').then(r => r.ok ? r.json() : null).then(j => { if (j && j.iconos) { indice = j.iconos; firma = ''; pintar(); } }).catch(() => {}); };

  panel.classList.add('fab-panel');
  panel.innerHTML = `<div class="fab-cab"><span class="fab-cab-ic"></span><div class="fab-cab-txt"><h2></h2><small></small></div><button class="cerrar fab-cerrar" aria-label="✕">✕</button></div>
    <nav class="fab-pestanas"></nav><div class="fab-centro"><div class="fab-mesa"></div><div class="fab-cuerpo"></div></div>
    <div class="fab-velo"></div><aside class="fab-ficha"></aside><div class="fab-pie"><div class="fab-aviso"></div><div class="fab-sec-marcha"></div></div>`;
  const $ = s => panel.querySelector(s);
  const cuerpo = $('.fab-cuerpo'), mesa = $('.fab-mesa'), ficha = $('.fab-ficha'), nav = $('.fab-pestanas'), marcha = $('.fab-sec-marcha'), divAviso = $('.fab-aviso');

  const ahora = () => Date.now();
  const lugar = () => { const p = posicion(); return { x: p.x, z: p.z }; };
  const img = (t, cls = '') => `<img class="fab-img ${cls}" src="${esc(base + t + '.webp')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  const sinModelo = t => indice[t] && indice[t].propio === false;
  const icono = t => `<span class="fab-ic">${img(t)}${sinModelo(t) ? `<em class="fab-pend">${esc(tr('sin modelo aún'))}</em>` : ''}</span>`;
  const dondeUso = uso => uso === 'manos' ? tr('Con las manos') : tr(USOS[uso].nombre);
  const segundos = s => s >= 60 ? tr('{m} min', { m: Math.round(s / 6) / 10 }) : tr('{s} s', { s });
  const estacionDeUso = uso => estacionesDeUso(uso)[0] || null;
  const iconoPestana = k => k === 'todo' ? `<span class="fab-svg">${TODO_SVG}</span>` : k === 'manos' ? `<span class="fab-svg">${MANO_SVG}</span>` : `<span class="fab-ic">${img('est_' + estacionDeUso(k))}</span>`;
  const cerca = (e, p, d = ALCANCE_ESTACION) => Math.hypot(e.x - p.x, e.z - p.z) <= d;

  // La estación de la pestaña que tienes al lado: la que se abrió con Usar, si sigue cerca; si no, la más cercana.
  function estacionDePestana(p) {
    if (pestana === 'todo' || pestana === 'manos') return null;
    const a = estacionActiva && fab.estaciones[estacionActiva];
    if (a && !a.obra && ESTACIONES[a.tipo] && ESTACIONES[a.tipo].uso === pestana && cerca(a, p)) return a;
    return Object.values(fab.estaciones).filter(e => !e.obra && ESTACIONES[e.tipo] && ESTACIONES[e.tipo].uso === pestana && cerca(e, p))
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null;
  }

  // Lo que llevas que se puede dejar en una estación: materiales sueltos (no lo puesto, ni un contenedor con algo
  // dentro, ni una prenda cosida), con su ruta.
  function dejables(inv) {
    const rutas = [...inv.rutasGuardar(), ...(inv.lugares.hombro ? ['hombro'] : [])], res = [];
    for (const ruta of rutas) {
      const b = inv.buscar(ruta), c = b && b.cosa, d = c && inv.def(c);
      if (!c || !d || (!ruta.includes('/') && !ruta.startsWith('mano:') && d.lugar)) continue;
      if ((c.dentro && c.dentro.some(Boolean)) || c.hechura || c.tinte) continue;
      res.push({ ruta, tipo: c.tipo, n: c.n });
    }
    return res;
  }
  const SITIO_CORTO = r => r.startsWith('mano:') ? tr('mano') : r.startsWith('cintura') ? tr('cinto') : r.startsWith('espalda') ? tr('mochila') : tr('hombro');

  // ---------- cartas ----------
  function carta(x) {
    const nf = Object.values(x.faltan).reduce((a, b) => a + b, 0);
    const extra = x.grupo === 'casi' ? `<span class="fab-falta-n">${esc(nf ? tr('faltan {n}', { n: nf }) : tr('apagada'))}</span>`
      : x.grupo === 'despues' ? `<span class="fab-necesita">${img('est_' + estacionDeUso(x.uso))}</span>` : '';
    return `<button class="fab-carta fab-${x.grupo}${sel === x.receta ? ' fab-sel' : ''}" data-fila="${x.receta}" data-grupo="${x.grupo}">${icono(x.da)}${extra}<span class="fab-nom">${esc(tr(x.nombre))}</span></button>`;
  }
  const grupo = (tit, cls, cartas) => cartas.length ? `<section class="fab-sec ${cls}"><h3>${esc(tit)}</h3><div class="fab-cartas">${cartas.join('')}</div></section>` : '';

  // ---------- la ficha ----------
  function filaMaterial(t, pide, info, falta, despues) {
    const s = info && info.sitios ? SITIOS.filter(([k]) => info.sitios[k]).map(([k, txt]) => `${info.sitios[k]} ${tr(txt)}`) : [];
    if (falta && !despues) s.push(tr('faltan {n}', { n: falta }));
    const n = despues ? `${pide}` : `${pide - (falta || 0)}/${pide}`;
    return `<div class="fab-mat${falta ? ' fab-falta' : ''}">${icono(t)}<div><b>${esc(nombre(t))}</b><small>${esc(s.join(' · '))}</small></div><span class="fab-n">${esc(n)}</span></div>`;
  }
  function fichaReceta(x, lista, inv, est) {
    const pend = sinModelo(x.da) ? ` <em class="fab-pend-t">${esc(tr('sin modelo aún'))}</em>` : '';
    const da = x.n > 1 ? `${x.n} × ${nombre(x.da)}` : nombre(x.da);
    const chips = [`<span class="fab-chip">${x.uso === 'manos' ? `<span class="fab-svg">${MANO_SVG}</span>` : `<span class="fab-ic">${img('est_' + estacionDeUso(x.uso))}</span>`}${esc(dondeUso(x.uso))}</span>`,
      `<span class="fab-chip">${esc(segundos(x.s))}</span>`, ...(x.da !== x.receta || x.n > 1 ? [`<span class="fab-chip">${esc(tr('da {d}', { d: da }))}</span>`] : [])];
    const despues = x.grupo === 'despues';
    const mats = Object.entries(x.gasta).map(([t, n]) => filaMaterial(t, n, despues ? null : x.de[t], despues ? 0 : x.faltan[t] || 0, despues)).join('');
    let botones = '';
    if (x.grupo === 'ya') botones = `<button class="fab-hacer fab-btn" data-receta="${x.receta}"${x.estacion ? ` data-estacion="${esc(x.estacion)}"` : ''}>${esc(tr('Hacer'))} · ${esc(segundos(x.s))}</button>`;
    else if (despues) botones = `<p class="fab-gris">${esc(tr('Hace falta {e} a tu lado.', { e: tr(x.conQue) }))}</p>`;
    else if (x.apagada && !Object.keys(x.faltan).length) botones = `<button class="fab-btn fab-no" disabled>${esc(tr('El fuego está apagado: enciéndelo arriba.'))}</button>`;
    else {
      // atajo A: lo que falta y ya se puede hacer (con las manos o en una estación de al lado)
      for (const t of Object.keys(x.faltan)) {
        const y = lista.find(r => r.da === t && r.grupo === 'ya');
        if (!y) continue;
        const con = cosas(y.gasta), donde = y.estacion ? ', ' + tr('en {e}', { e: laEstacion(fab.estaciones[y.estacion].tipo) }) : '';
        botones += `<button class="fab-antes fab-btn2" data-receta="${y.receta}"${y.estacion ? ` data-estacion="${esc(y.estacion)}"` : ''}>${esc(tr('Hacer antes: {d} (con {c}{donde} · {t})', { d: `${y.n} ${nombre(y.da).toLowerCase()}`, c: con, donde, t: segundos(y.s) }))}</button>`;
      }
      // atajo B: en una estación, poner encima lo que falta y llevas
      if (x.estacion && est && est.id === x.estacion) {
        const puestos = [], quedan = { ...x.faltan };
        for (const d of dejables(inv)) {
          if (!quedan[d.tipo]) continue;
          const n = Math.min(quedan[d.tipo], d.n); quedan[d.tipo] -= n; puestos.push({ ruta: d.ruta, tipo: d.tipo, n });
        }
        const cabe = DEPOSITO_MAX - totalDeposito(est.deposito);
        if (puestos.length && puestos.reduce((a, p) => a + p.n, 0) <= cabe) {
          const lista2 = {}; for (const t of Object.keys(x.gasta)) for (const p of puestos) if (p.tipo === t) lista2[t] = (lista2[t] || 0) + p.n; // en el orden de la receta
          botones += `<button class="fab-poner-falta fab-btn2" data-estacion="${esc(est.id)}" data-poner="${esc(JSON.stringify(puestos))}">${esc(tr('Poner en {e} lo que falta: {c} (los llevas tú)', { e: laEstacion(est.tipo), c: cosas(lista2) }))}</button>`;
        }
      }
      if (Object.keys(x.faltan).length) botones += `<button class="fab-btn fab-no" disabled>${esc(tr('Te falta: {c}', { c: cosas(x.faltan) }))}</button>`;
      if (x.apagada) botones += `<p class="fab-gris">${esc(tr('El fuego está apagado: enciéndelo arriba.'))}</p>`;
    }
    const titMats = x.estacion ? tr('Lo que pide (de lo que está en la estación)') : tr('Lo que pide');
    return `<div class="fab-grande">${img(x.da)}</div><h3 class="fab-titulo">${esc(tr(x.nombre))}${pend}</h3>
      <p class="fab-para">${esc(tr(PARA[x.receta] || ''))}</p><div class="fab-chips">${chips.join('')}</div>
      <h4>${esc(titMats)}</h4><div class="fab-mats">${mats}</div><div class="fab-acciones">${botones}</div>`;
  }
  // ---------- el fuego de la hoguera ----------
  const minutos = s => Math.max(1, Math.ceil(s / 60));
  function pintarFuego(e, inv) {
    const st = estadoFuego(e.fuego, ahora()), yesca = YESCAS.reduce((t, y) => t + inv.cuantos(y), 0), taladro = inv.cuantos(HERRAMIENTA_FUEGO) > 0;
    const estado = st.encendida ? tr('Encendida: le quedan {m} min', { m: minutos(st.queda) }) : st.cenizas ? tr('Apagada: solo quedan las cenizas') : tr('Apagada');
    const puesto = !st.encendida && st.combustible > 0 ? tr('Tiene puesto para arder {m} min.', { m: minutos(st.combustible) }) : !st.encendida ? tr('No tiene nada que arder: échale ramas o leña.') : tr('Da luz y calor. Échale más para que dure.');
    const falta = !taladro && !yesca ? tr('Te falta el taladro de fuego y la yesca.') : !taladro ? tr('Te falta el taladro de fuego.') : !yesca ? tr('Te falta la yesca.') : '';
    const puede = !st.encendida && st.combustible > 0 && taladro && yesca;
    const echar = ['rama', 'lena'].map(t => `<button class="fab-btn2 fab-echar" data-estacion="${esc(e.id)}" data-objeto="${t}"${inv.cuantos(t) ? '' : ' disabled'}>${icono(t)}${esc(tr('Echar 1 {c} (+{m} min · llevas {n})', { c: nombre(t).toLowerCase(), m: ARDE[t] / 60, n: inv.cuantos(t) }))}</button>`).join('');
    return `<section class="fab-fuego${st.encendida ? ' fab-ardiendo' : ''}"><div class="fab-bt"><b>${esc(estado)}</b><span>${esc(puesto)}</span></div>
      <div class="fab-fuego-acc">${st.encendida ? '' : `<button class="fab-btn fab-encender" data-estacion="${esc(e.id)}"${puede ? '' : ' disabled'}>${esc(tr('Encender (gasta 1 yesca; con el taladro de fuego)'))}</button>${falta ? `<small class="fab-gris">${esc(falta)}</small>` : ''}`}${echar}</div></section>`;
  }
  // ---------- la estación de al lado: lo que tiene encima y lo que llevas ----------
  function pintarMesa(e, inv) {
    const est = ESTACIONES[e.tipo], dep = e.deposito || {}, hay = totalDeposito(dep);
    const encima = Object.entries(dep).map(([t, n]) => `<button class="fab-hueco fab-coger" data-dep="${esc(t)}" data-estacion="${esc(e.id)}" data-objeto="${esc(t)}" title="${esc(tr('Coger') + ': ' + nombre(t))}">${icono(t)}<b class="fab-num">${n}</b><span class="fab-hueco-nom">${esc(nombre(t))}</span></button>`).join('');
    const vacios = Math.max(0, 5 - Object.keys(dep).length);
    const lleva = hay >= DEPOSITO_MAX ? `<p class="fab-gris">${esc(tr('No cabe nada más.'))}</p>`
      : dejables(inv).map(x => `<button class="fab-hueco fab-dejar" data-estacion="${esc(e.id)}" data-de="${esc(x.ruta)}" title="${esc(tr('Dejar') + ': ' + nombre(x.tipo))}">${icono(x.tipo)}<b class="fab-num">${x.n}</b><i class="fab-de">${esc(SITIO_CORTO(x.ruta))}</i><span class="fab-hueco-nom">${esc(nombre(x.tipo))}</span></button>`).join('')
      || `<p class="fab-gris">${esc(tr('No llevas nada que dejar.'))}</p>`;
    return `<section class="fab-sec-dep" data-estacion="${esc(e.id)}"><div class="fab-bandeja"><div class="fab-bt"><b>${esc(tr('Encima de {e}', { e: laEstacion(e.tipo) }))}</b><span>${esc(tr('{n} de {m} · toca para coger', { n: hay, m: DEPOSITO_MAX }))}</span></div>
      <div class="fab-huecos">${encima || `<p class="fab-gris">${esc(tr('No hay nada: deja aquí lo que piden sus recetas.'))}</p>`}${encima ? '<span class="fab-hueco fab-vacio"></span>'.repeat(vacios) : ''}</div></div>
      <div class="fab-bandeja"><div class="fab-bt"><b>${esc(tr('Lo que llevas'))}</b><span>${esc(tr('toca para dejar'))}</span></div><div class="fab-huecos">${lleva}</div></div></section>`;
  }

  // ---------- lo que está en marcha ----------
  function encargo(c, estacion, i) {
    const rc = RECETAS[c.receta], listo = c.fin <= ahora();
    const e = fab.estaciones[estacion], donde = estacion ? tr(e && ESTACIONES[e.tipo] ? ESTACIONES[e.tipo].nombre : 'En una estación') : tr('Con las manos');
    return `<div class="fab-enc${listo ? ' fab-listo' : ''}" data-encargo="${i}">${icono(rc.da)}<div class="fab-enc-txt"><b>${esc(tr(rc.nombre))}</b>${listo
      ? `<button class="fab-recoger"${estacion ? ` data-estacion="${esc(estacion)}"` : ''}>${esc(tr('Recoger'))}</button>`
      : `<div class="fab-barra"><i data-fin="${c.fin}" data-dura="${rc.s * 1000}"></i></div><small>${esc(donde)} · <span class="fab-tiempo" data-fin="${c.fin}"></span></small>`}</div></div>`;
  }

  function pintar() {
    if (!abierto) return;
    const inv = inventario(), p = lugar(), t = ahora();
    const lista = fab.lista(p, inv, suelo(), t), est = estacionDePestana(p);
    const deEsta = pestana === 'todo' ? lista : lista.filter(x => x.uso === pestana);
    const cuenta = k => lista.filter(x => x.grupo === 'ya' && (k === 'todo' || x.uso === k)).length;
    // la carta elegida: la que había, si sigue en la pestaña; si no, la primera
    const claves = deEsta.map(x => x.receta);
    const orden = ['ya', 'casi', 'despues'];
    if (!claves.includes(sel)) sel = [...deEsta].sort((a, b) => orden.indexOf(a.grupo) - orden.indexOf(b.grupo)).map(x => x.receta)[0] || claves[0] || null;

    const cab = est ? { ic: `<span class="fab-ic">${img('est_' + est.tipo)}</span>`, h: tr(ESTACIONES[est.tipo].nombre), s: tr(ESTACIONES[est.tipo].hace) + ' · ' + tr('sus recetas gastan lo que está en ella') }
      : pestana === 'manos' ? { ic: '', h: tr('Fabricar'), s: tr('Con las manos, en cualquier sitio: lo que llevas y lo que hay en el suelo a tu lado') }
      : pestana === 'todo' ? { ic: '', h: tr('Fabricar'), s: tr('Todo lo que se puede hacer') }
      : { ic: '', h: tr('Fabricar'), s: tr('Hace falta {e} a tu lado.', { e: tr(conQue(pestana)) }) + ' ' + tr('Los puestos de trabajo se levantan desde Construir, en «Puestos de trabajo».') };
    const htmlNav = PESTANAS.map(k => `<button class="fab-pest${k === pestana ? ' fab-sel' : ''}" data-pestana="${k}">${iconoPestana(k)}<b>${esc(NOMBRE_PESTANA[k] ? NOMBRE_PESTANA[k]() : k)}</b>${cuenta(k) ? `<span class="fab-cuenta">${cuenta(k)}</span>` : ''}</button>`).join('');
    const htmlMesa = est ? (ESTACIONES[est.tipo].fuego ? pintarFuego(est, inv) : '') + pintarMesa(est, inv) : '';
    const g = k => deEsta.filter(x => x.grupo === k).map(carta);
    const htmlCuerpo = grupo(tr('Puedes hacerlo ya'), 'fab-sec-ya', g('ya')) + grupo(tr('Te falta algo'), 'fab-sec-casi', g('casi'))
      + grupo(tr('Hace falta una estación'), 'fab-sec-despues', g('despues'))
      || `<p class="fab-gris">${esc(tr('Nada todavía: mira lo que te falta debajo.'))}</p>`;
    const x = deEsta.find(r => r.receta === sel);
    const htmlFicha = `<button class="fab-ficha-cerrar" aria-label="✕"></button>` + (x ? fichaReceta(x, lista, inv, est) : '');
    const htmlMarcha = (() => {
      const l = [];
      encargos.manos.forEach((c, i) => l.push(encargo(c, null, 'm' + i)));
      for (const [id, m] of Object.entries(encargos.estaciones)) {
        const e = fab.estaciones[id];
        if (e && !cerca(e, p, ALCANCE_ESTACION * 4)) continue; // las de lejos no se ven aquí
        m.forEach((c, i) => l.push(encargo(c, id, id + i)));
      }
      return l.length ? `<span class="fab-pie-tit">${esc(tr('En marcha'))}</span>${l.join('')}` : '';
    })();
    const nueva = [cab.ic, cab.h, cab.s, htmlNav, htmlMesa, htmlCuerpo, htmlFicha, htmlMarcha].join('\u0001');
    if (nueva !== firma) {
      firma = nueva;
      $('.fab-cab-ic').innerHTML = cab.ic; $('.fab-cab h2').textContent = cab.h; $('.fab-cab small').textContent = cab.s;
      nav.innerHTML = htmlNav; mesa.innerHTML = htmlMesa; cuerpo.innerHTML = htmlCuerpo; ficha.innerHTML = htmlFicha; marcha.innerHTML = htmlMarcha;
      panel.classList.toggle('fab-con-mesa', !!est);
    }
    panel.classList.toggle('fab-ficha-abierta', fichaMovil);
    for (const s of marcha.querySelectorAll('.fab-tiempo')) {
      const falta = Number(s.dataset.fin) - t;
      if (falta > 0) s.textContent = tr('quedan {s} s', { s: Math.ceil(falta / 1000) });
      else { firma = ''; } // acaba de terminar: el botón de recoger sale en la siguiente vuelta
    }
    for (const b of marcha.querySelectorAll('.fab-barra i')) b.style.width = Math.max(0, Math.min(100, 100 - (Number(b.dataset.fin) - t) / Number(b.dataset.dura) * 100)).toFixed(1) + '%';
    divAviso.textContent = aviso.txt; divAviso.classList.toggle('fab-error', aviso.error);
  }
  const decir = (txt, error = false) => { aviso = { txt, error }; if (error) firma = ''; pintar(); }; // tras un error, el botón vuelve a estar activo

  function anotarEncargo(receta, estacion) {
    const l = estacion ? (encargos.estaciones[estacion] ||= []) : encargos.manos;
    const empieza = Math.max(ahora(), ...l.map(c => c.fin));
    l.push({ receta, fin: empieza + RECETAS[receta].s * 1000 });
  }
  function encargar(receta, estacion, b) {
    const p = lugar();
    if (b) b.disabled = true;
    hacer({ tipo: 'fabricar', receta, estacion, x: p.x, z: p.z }, (r) => {
      if (!r.ok) { decir(tr(r.motivo), true); return; }
      anotarEncargo(receta, r.estacion || estacion);
      firma = ''; decir(tr('Encargado: {r}.', { r: tr(RECETAS[receta].nombre) }));
    });
  }

  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button') || ev.target.closest('.fab-velo'); if (!b || !panel.contains(b)) return;
    const p = lugar();
    if (b.classList.contains('fab-cerrar')) { cerrar(); return; }
    if (b.classList.contains('fab-velo') || b.classList.contains('fab-ficha-cerrar')) { fichaMovil = false; pintar(); return; }
    if (b.classList.contains('fab-pest')) { pestana = b.dataset.pestana; sel = null; fichaMovil = false; firma = ''; pintar(); return; }
    if (b.classList.contains('fab-carta')) { sel = b.dataset.fila; fichaMovil = true; firma = ''; pintar(); return; }
    if (b.classList.contains('fab-hacer') || b.classList.contains('fab-antes')) { encargar(b.dataset.receta, b.dataset.estacion || null, b); return; }
    if (b.classList.contains('fab-recoger')) {
      const estacion = b.dataset.estacion || null;
      b.disabled = true;
      hacer({ tipo: 'recoger_fabricado', estacion, x: p.x, z: p.z }, (r) => {
        if (!r.ok) { decir(tr(r.motivo), true); return; }
        const t = ahora(), l = estacion ? encargos.estaciones[estacion] || [] : encargos.manos;
        // lo terminado ya es tuyo (lo que no cabía, al suelo a tus pies)
        const quedan = r.quedan ? l : l.filter(c => c.fin > t);
        if (estacion) { if (quedan.length) encargos.estaciones[estacion] = quedan; else delete encargos.estaciones[estacion]; } else encargos.manos = quedan;
        const dados = (r.dados || []).map(d => `${d.cantidad} × ${nombre(d.objeto)}${d.alSuelo ? ' ' + tr('(al suelo: no te cabía)') : ''}`).join(', ');
        firma = ''; decir(tr('Recoges: {d}.', { d: dados }));
      });
      return;
    }
    if (b.classList.contains('fab-encender') || b.classList.contains('fab-echar')) {
      const enc = b.classList.contains('fab-encender'), estacion = b.dataset.estacion;
      b.disabled = true;
      hacer(enc ? { tipo: 'encender_fuego', estacion, x: p.x, z: p.z } : { tipo: 'echar_fuego', estacion, objeto: b.dataset.objeto, x: p.x, z: p.z }, (r) => {
        if (!r.ok) { decir(tr(r.motivo), true); return; }
        firma = ''; decir(enc ? tr('La hoguera prende.') : tr('Echas al fuego: 1 {c}.', { c: nombre(b.dataset.objeto).toLowerCase() }));
      });
      return;
    }
    if (b.classList.contains('fab-dejar') || b.classList.contains('fab-coger')) {
      const dejar = b.classList.contains('fab-dejar'), estacion = b.dataset.estacion;
      b.disabled = true;
      const accion = dejar ? { tipo: 'depositar_estacion', estacion, de: b.dataset.de, x: p.x, z: p.z } : { tipo: 'retirar_estacion', estacion, objeto: b.dataset.objeto, x: p.x, z: p.z };
      hacer(accion, (r) => {
        if (!r.ok) { decir(tr(r.motivo), true); return; }
        const que = Object.entries(r.dejado || r.cogido || {}).map(([t, n]) => `${n} × ${nombre(t)}`).join(', ');
        firma = ''; decir(tr(dejar ? 'Dejas en la estación: {d}.' : 'Coges de la estación: {d}.', { d: que }));
      });
      return;
    }
    if (b.classList.contains('fab-poner-falta')) {
      // uno detrás de otro: cada uno espera la respuesta del anterior (si uno falla, para y lo dice)
      const l = JSON.parse(b.dataset.poner || '[]'), estacion = b.dataset.estacion, dejado = {};
      b.disabled = true;
      const siguiente = (i) => {
        if (i >= l.length) { firma = ''; decir(tr('Dejas en la estación: {d}.', { d: Object.entries(dejado).map(([t, n]) => `${n} × ${nombre(t)}`).join(', ') })); return; }
        const q = lugar();
        hacer({ tipo: 'depositar_estacion', estacion, de: l[i].ruta, cantidad: l[i].n, x: q.x, z: q.z }, (r) => {
          if (!r.ok) { decir(tr(r.motivo), true); return; }
          for (const [t, n] of Object.entries(r.dejado || {})) dejado[t] = (dejado[t] || 0) + n;
          siguiente(i + 1);
        });
      };
      siguiente(0);
      return;
    }
  });

  let reloj = null;
  function abrir(pest = 'manos', estacion = null) {
    abierto = true; panel.hidden = false; aviso = { txt: '', error: false }; firma = ''; fichaMovil = false;
    pestana = pest; estacionActiva = estacion; sel = null; cargarIndice();
    pintar(); alAbrir(); if (!reloj) reloj = setInterval(pintar, 1000);
  }
  function cerrar() { abierto = false; panel.hidden = true; fichaMovil = false; if (reloj) { clearInterval(reloj); reloj = null; } }
  if (boton) boton.onclick = () => (abierto ? cerrar() : abrir());

  return {
    get abierto() { return abierto; },
    get pestana() { return pestana; },
    abrir: () => abrir(), cerrar, alternar() { if (abierto) cerrar(); else abrir(); },
    // con Usar delante de una estación: el panel, en su pestaña y con ella
    abrirEstacion(id) { const e = fab.estaciones[id]; if (!e || !ESTACIONES[e.tipo]) return false; abrir(ESTACIONES[e.tipo].uso, id); return true; },
    // (solo se rehace si ha cambiado lo que enseña: rehacerlo a cada mensaje del servidor perdía el clic que caía en medio)
    pintar() { pintar(); },
    // lo encargado que manda el servidor en la bienvenida ({ manos: [{ receta, falta }], estaciones: { id: [...] } })
    ponerEncargos(datos) {
      const t = ahora(), de = l => (Array.isArray(l) ? l : []).filter(c => c && Object.hasOwn(RECETAS, c.receta)).map(c => ({ receta: c.receta, fin: t + Math.max(0, Number(c.falta) || 0) }));
      encargos = { manos: de(datos && datos.manos), estaciones: {} };
      for (const [id, l] of Object.entries((datos && datos.estaciones) || {})) { const m = de(l); if (m.length) encargos.estaciones[id] = m; }
      firma = ''; pintar();
    },
    get encargos() { return encargos; },
  };
}
