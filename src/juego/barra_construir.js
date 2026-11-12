// Kinhold — la barra de construir (las pestañas y las piezas, con su coste en iconos y lo que tienes) y el contador de
// arriba (lo almacenado en tu tierra, plegado). Partido de src/juego/main.js, 12 nov, sin cambiar nada de lo que hace.
import { t } from './textos.js';
import { tr } from '../idioma.js';
import { PIEZAS, DECORACION, MATERIALES, enEsteTramo } from '../logica/piezas.js';
import { CATALOGO, OBJETO_DE_MATERIAL, MATERIAL_DE_OBJETO } from '../logica/inventario.js';
import { ESTACIONES, DONDE, esAlmacen, esCama } from '../logica/fabricacion.js';
import { CARPETA_INTERFAZ, CARPETA_PIEZAS } from '../logica/iconos.js';
import { carpetaIconos } from './panel_fabricar.js';

const $ = (id) => document.getElementById(id);

// estado: el del juego (modo, sel, dir…); pj: el personaje; fabCliente: las estaciones que se ven; inventario(): el
// tuyo; miMojon(): tu mojón (o null); mundo y enLinea: () => los de ahora; cambiarModo y evaluarColocacion: los del juego.
export function crearBarraConstruir({ estado, pj, fabCliente, inventario, miMojon, mundo, enLinea, cambiarModo, evaluarColocacion }) {
  const CATEGORIAS = [
    ['tierra', t('catTierra')], ['base', t('catBase')], ['estructura', t('catEstructura')], ['muro', t('catMuros')],
    ['tejado', t('catTejados')], ['acceso', t('catAcceso')], ['exterior', t('catExterior')], ['puestos', tr('Puestos de trabajo')], ['almacenajes', tr('Almacenajes')], ['camas', tr('Camas')], ['deco', t('catDeco')],
  ];
  let categoria = 'base';
  // Lo que tienes de cada cosa para construir (estudio de la interfaz, 7 nov: «el coste en iconos, en rojo lo que no tienes,
  // y lo que hay en tu tierra»): lo que llevas encima más lo almacenado en tu tierra (en línea, en los almacenajes de la
  // zona de tu mojón; sin servidor, el arcón de pruebas). La obra no coge de lo almacenado sola: es lo que hay a mano.
  function almacenadoEnTierra() {
    const mojon = miMojon(), zona = mojon ? mundo().tierraDe(mojon.x, mojon.z) : null, hay = {};
    if (zona === null) return hay;
    for (const e of Object.values(fabCliente.estaciones)) if (esAlmacen(e.tipo) && !e.obra && mundo().tierraDe(e.x, e.z) === zona)
      for (const [k, n] of Object.entries(e.deposito || {})) hay[k] = (hay[k] || 0) + n;
    return hay;
  }
  function tienesObjeto(tipo, enTierra) {
    const arcon = enLinea() ? 0 : (mundo().materiales[MATERIAL_DE_OBJETO[tipo]] ?? 0);
    return inventario().cuantos(tipo) + (enTierra[tipo] || 0) + arcon;
  }
  const RAIZ_PIEZAS = '../../' + CARPETA_PIEZAS;
  function imagenEntrada(e) {
    if (e.clase === 'mojon') return '../../' + CARPETA_INTERFAZ + 'g_mojon.webp';
    if (e.clase === 'nivelar') return '../../' + CARPETA_INTERFAZ + 'g_construir.webp';
    if (e.clase === 'puesto') return carpetaIconos() + 'est_' + e.tipo + '.webp';
    return RAIZ_PIEZAS + (e.clase === 'deco' ? 'deco_' : 'pz_') + e.tipo + '.webp';
  }
  const catPuesto = k => esAlmacen(k) ? 'almacenajes' : esCama(k) ? 'camas' : 'puestos';
  function construirBarra() {
    const tabs = $('pestanas'); tabs.innerHTML = '';
    for (const [id, nombre] of CATEGORIAS) {
      const b = document.createElement('button');
      b.textContent = nombre; b.dataset.cat = id;
      b.className = id === categoria ? 'sel' : '';
      b.onclick = () => { categoria = id; construirBarra(); };
      tabs.appendChild(b);
    }
    const lista = $('piezas'); lista.innerHTML = '';
    const entradas = categoria === 'puestos' || categoria === 'almacenajes' || categoria === 'camas'
      ? Object.entries(ESTACIONES).filter(([k]) => catPuesto(k) === categoria).map(([k, d]) => ({ clase: 'puesto', tipo: k, def: d }))
      : categoria === 'deco'
      ? Object.entries(DECORACION).filter(([, d]) => enEsteTramo(d)).map(([k, d]) => ({ clase: 'deco', tipo: k, def: d }))
      : Object.entries(PIEZAS).filter(([, d]) => d.cat === categoria && enEsteTramo(d)).map(([k, d]) => ({ clase: k === 'mojon' ? 'mojon' : 'pieza', tipo: k, def: d }));
    if (categoria === 'tierra') entradas.push({ clase: 'nivelar', tipo: 'brocha', def: { nombre: 'Brocha de nivelar', coste: {} }, nota: tr('alisa el suelo') });
    const enTierra = enLinea() ? almacenadoEnTierra() : {};
    for (const e of entradas) {
      const b = document.createElement('button');
      b.className = 'pieza' + (estado.sel.tipo === e.tipo ? ' sel' : '');
      // el coste, en iconos: cuánto pide y, pequeño, cuánto tienes (en rojo si no llega)
      const costes = Object.entries(e.def.coste || {}).map(([m, n]) => {
        const tipo = e.clase === 'puesto' ? m : OBJETO_DE_MATERIAL[m];
        const nom = e.clase === 'puesto' ? tr(CATALOGO[m].nombre) : tr(MATERIALES[m]);
        const hay = tipo ? tienesObjeto(tipo, enTierra) : 0;
        return `<span class="cc${hay < n ? ' falta' : ''}" title="${n} ${nom.toLowerCase()} · ${tr('tienes {n}', { n: hay })}"><img src="${carpetaIconos()}${tipo}.webp" alt="${nom}" loading="lazy">${n}<i>/${hay}</i></span>`;
      }).join('');
      const pie = e.nota ? `<small>${e.nota}</small>` : e.clase === 'mojon' ? `<small>${tr('tu tierra')}</small>` : `<span class="pz-coste">${costes}</span>`;
      b.innerHTML = `<img class="pz-img" src="${imagenEntrada(e)}" alt="" loading="lazy"><b>${tr(e.def.nombre)}</b>${pie}`;
      b.title = tr(e.def.nombre) + (e.clase === 'puesto' ? ' · ' + tr(DONDE[e.def.donde]).toLowerCase() : '');
      if (e.clase === 'nivelar') b.id = 'btnBrocha';
      b.onclick = () => {
        estado.sel = { clase: e.clase, tipo: e.tipo };
        estado.dir = 0;
        if (e.clase === 'nivelar') estado.alturaBrocha = null; // al volver a coger la brocha, la altura se vuelve a tomar del suelo
        if (estado.modo !== 'construir') cambiarModo('construir');
        construirBarra(); evaluarColocacion();
      };
      lista.appendChild(b);
    }
    if (estado.modo === 'construir') document.documentElement.style.setProperty('--alto-barra', $('barra').offsetHeight + 'px');
  }
  // lo que tienes cambia (coges, dejas, entregas): el coste se vuelve a pintar solo si cambia algo (se mira cada medio
  // segundo, no en cada fotograma; rehacer los botones a cada rato se comería los clics)
  let ultimaBarra = 0;
  function refrescarBarra() {
    if (estado.modo !== 'construir' || performance.now() - ultimaBarra < 500) return;
    ultimaBarra = performance.now();
    const enTierra = enLinea() ? almacenadoEnTierra() : {};
    const tipos = new Set([...Object.values(OBJETO_DE_MATERIAL), ...Object.values(ESTACIONES).flatMap(d => Object.keys(d.coste || {}))]);
    const firma = categoria + ':' + [...tipos].map(t => tienesObjeto(t, enTierra)).join(',');
    if (firma === refrescarBarra.firma) return;
    refrescarBarra.firma = firma;
    const desplaza = $('piezas').scrollLeft;
    construirBarra();
    $('piezas').scrollLeft = desplaza;
  }
  function marcarSeleccion() { categoria = estado.sel.clase === 'deco' ? 'deco' : estado.sel.clase === 'puesto' ? catPuesto(estado.sel.tipo) : (estado.sel.clase === 'mojon' || estado.sel.clase === 'nivelar' ? 'tierra' : PIEZAS[estado.sel.tipo].cat); construirBarra(); }

  // El contador de arriba (valravnx, 1 nov): en línea, solo dentro de tu tierra (la zona de tu mojón) y con lo que tienes
  // almacenado en ella; fuera, no sale. Lo almacenado es lo guardado en los almacenajes de la base de tu tierra (7 nov:
  // el acopio de troncos, la pila de piedras, la leñera), de los que te llegan del servidor (los trozos de tu alrededor);
  // hasta que los hubo, era lo que había en el suelo de tu tierra. Sin servidor (las pruebas de navegador), lo que hay en
  // el arcón de pruebas, como antes.
  let htmlMateriales = null;
  // El contador de arriba (lo almacenado en tu tierra), plegado (valravnx, 9 nov: «desplegable y nunca fijo, porque tapa
  // mucha pantalla sobre todo en móvil»): una placa pequeña con el total; tocándola se despliega la lista y se vuelve a
  // plegar. Siempre empieza plegado.
  let materialesAbierto = false;
  function pintarMateriales() {
    const m = $('materiales');
    let html = '', titulo = '', total = 0;
    if (!enLinea()) { titulo = tr('En el arcón:'); html = Object.entries(MATERIALES).map(([k, n]) => { total += mundo().materiales[k] ?? 0; return `<span><b>${mundo().materiales[k] ?? 0}</b> ${tr(n).toLowerCase()}</span>`; }).join(''); }
    else {
      const mojon = miMojon(), zona = mojon ? mundo().tierraDe(mojon.x, mojon.z) : null;
      const esMio = (x, z) => zona !== null && mundo().tierraDe(x, z) === zona;
      if (esMio(pj.x, pj.z)) {
        const hay = {};
        for (const e of Object.values(fabCliente.estaciones)) if (esAlmacen(e.tipo) && !e.obra && esMio(e.x, e.z))
          for (const [k, n] of Object.entries(e.deposito || {})) hay[k] = (hay[k] || 0) + n;
        const ks = Object.keys(hay).filter(k => CATALOGO[k]).sort((a, b) => hay[b] - hay[a]);
        titulo = tr('En tu tierra:'); total = ks.reduce((t, k) => t + hay[k], 0);
        html = ks.length ? ks.map(k => `<span><b>${hay[k]}</b> ${tr(CATALOGO[k].nombre).toLowerCase()}</span>`).join('')
          : `<span>${tr('aún no tienes nada almacenado')}</span>`;
      }
    }
    if (html) html = `<button type="button" class="mat-cab" aria-expanded="${materialesAbierto}">${titulo.replace(/:$/, '')} <b>${total}</b><i class="fl"></i></button><div class="mat-lista">${html}</div>`;
    if (html !== htmlMateriales) { htmlMateriales = html; m.innerHTML = html; }
    m.classList.toggle('abierto', materialesAbierto);
    m.hidden = !html;
  }
  $('materiales').addEventListener('click', (e) => {
    if (!e.target.closest('.mat-cab')) return;
    materialesAbierto = !materialesAbierto; htmlMateriales = null; pintarMateriales();
  });

  // (sin mojón, construir se abre en la pestaña Tierra)
  function ponerCategoria(c) { categoria = c; construirBarra(); }
  return { construirBarra, refrescarBarra, marcarSeleccion, pintarMateriales, ponerCategoria };
}
