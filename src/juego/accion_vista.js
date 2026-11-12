// Kinhold — la acción, a la vista (estudio de la interfaz del 7 nov): la etiqueta sobre la cosa, el aro en el suelo, el
// botón de acción del móvil y la lista de lo demás que hay al alcance. Partido de src/juego/main.js, 12 nov, sin
// cambiar nada de lo que hace.
import * as THREE from 'three';
import { tr } from '../idioma.js';
import { CARPETA_INTERFAZ } from '../logica/iconos.js';
import { carpetaIconos } from './panel_fabricar.js';

const $ = (id) => document.getElementById(id);
export const urlIcono = (ic) => !ic ? '' : ic.startsWith('g_') ? '../../' + CARPETA_INTERFAZ + ic + '.webp' : carpetaIconos() + ic + '.webp';
export const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// escena, camara, renderer: los de three.js; estado: el del juego; pj: el personaje; menuUsar: el menú del clic derecho;
// miMojon(): tu mojón (o null); sueloEn(x, z): la altura del suelo; mundo: () => el de ahora; ocultos(): si un panel
// abierto la tapa; accionPrincipal() y opcionesUsar(): lo que haría Usar y lo demás que hay al alcance.
export function crearAccionVista({ escena, camara, renderer, estado, pj, menuUsar, miMojon, sueloEn, mundo, ocultos, accionPrincipal, opcionesUsar }) {
  // Cada poco (no en cada fotograma: mira todo lo de alrededor) se mira qué haría Usar y qué más hay al alcance; en cada
  // fotograma se coloca la etiqueta sobre la cosa y el aro en el suelo bajo ella. En PC, la tecla F; con varias cosas, la
  // lista (clic en una para hacerla). En el móvil, el botón de acción grande lleva la imagen de la cosa y el verbo.
  document.body.classList.toggle('tactil-ui', !!estado.esTactil);
  const aroAccion = new THREE.Group();
  {
    const mat = (o) => new THREE.MeshBasicMaterial({ color: 0xf0c46e, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    const filo = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.5, 48), mat(0.9));
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.56, 48), mat(0.14));
    for (const m of [halo, filo]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 3; aroAccion.add(m); }
    aroAccion.visible = false;
    escena.add(aroAccion);
  }
  const RADIO_ARO = { arbol: 1.1, obra: 1.0, est: 0.85 };
  let accionVista = null, accionOps = [], accionHasta = 0;
  const vProy = new THREE.Vector3();
  function pintarAccion() {
    const ahora = performance.now();
    const etq = $('accionEtq'), lista = $('accionLista'), btn = $('btnUsar');
    const ocultar = estado.modo !== 'mover' || document.body.classList.contains('combate') || !menuUsar.hidden
      || ocultos();
    if (ahora >= accionHasta) {
      accionHasta = ahora + 150;
      // el mojón de arriba (en PC, en tu tierra): abre la pestaña Tu tierra
      { const mo = miMojon(), z = mo ? mundo().tierraDe(mo.x, mo.z) : null; $('btnMojon').hidden = estado.esTactil || z === null || mundo().tierraDe(pj.x, pj.z) !== z; }
      accionVista = ocultar ? null : accionPrincipal();
      // la lista: lo demás que hay al alcance (lo mismo que el clic derecho), sin repetir la acción de Usar. Solo cuando se
      // pide (valravnx, 8 nov: «salen solos, siendo un caos… toggle con alt o click derecho, pero no todo el rato»): Alt en
      // PC y mantener pulsado el botón de acción en el móvil la abren y la cierran; sin pedirla, la etiqueta dice que hay más
      const otras = accionVista ? opcionesUsar().filter(o => o.texto !== accionVista.texto) : [];
      // se cierra sola al cambiar de cosa (al alejarte o al hacerla): abrirla vale para lo que tienes delante, no para siempre
      const cosa = accionVista ? `${accionVista.pos.x.toFixed(1)},${accionVista.pos.z.toFixed(1)}` : null;
      if (estado.verLista && cosa !== estado.listaDe) estado.verLista = false;
      accionOps = estado.verLista ? otras.slice(0, 3) : [];
      accionVista && (accionVista.hayMas = !estado.verLista && otras.length > 0);
      pintarBotonAccion(btn, accionVista);
      pintarLista(lista, accionVista, accionOps);
    }
    const a = accionVista;
    btn.classList.toggle('activo', !!a && !a.apagada);
    if (!a) { etq.hidden = true; lista.hidden = true; aroAccion.visible = false; return; }
    const y0 = a.y ?? sueloEn(a.pos.x, a.pos.z);
    // el aro, en el suelo bajo la cosa (algo más grande para un árbol, una obra o una estación)
    const r = a.icono === 'g_construir' ? RADIO_ARO.obra : (a.alto || 0) >= 3 ? RADIO_ARO.arbol : String(a.icono).startsWith('est_') ? RADIO_ARO.est : (a.alto || 0) <= 0.4 ? 0.42 : 0.6;
    aroAccion.visible = !(a.pos.x === pj.x && a.pos.z === pj.z); // (lo que va contigo, como comer, no lleva aro)
    aroAccion.position.set(a.pos.x, y0 + 0.04, a.pos.z); aroAccion.scale.setScalar(r / 0.5);
    // la etiqueta, sobre la cosa (si está delante de la cámara)
    vProy.set(a.pos.x, y0 + Math.min(a.alto ?? 1, 2.2) + 0.15, a.pos.z).project(camara);
    const rc = renderer.domElement.getBoundingClientRect();
    if (vProy.z >= 1 || Math.abs(vProy.x) > 1.1 || Math.abs(vProy.y) > 1.1) { etq.hidden = true; lista.hidden = true; return; }
    const sx = rc.left + (vProy.x + 1) / 2 * rc.width, sy = rc.top + (1 - vProy.y) / 2 * rc.height;
    const clave = [a.texto, a.sub, a.barra, a.apagada, a.hayMas, Math.round((a.prog || 0) * 20)].join('|');
    if (etq.dataset.clave !== clave) {
      etq.dataset.clave = clave;
      const L = 2 * Math.PI * 8;
      const prog = a.prog ? `<svg class="prog" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle cx="10" cy="10" r="8" fill="none" stroke="#f0c46e" stroke-width="3" stroke-dasharray="${L * a.prog} ${L}"/></svg>` : '';
      const mas = a.hayMas ? `<span class="mas">${estado.esTactil ? '' : '<span class="k">Alt</span>'}${esc(tr('más'))}</span>` : '';
      etq.innerHTML = `<div class="etq placa"><div class="lin">${estado.esTactil ? '' : '<span class="k">F</span>'}<span>${esc(a.texto)}</span>${prog}${mas}</div>`
        + (a.sub ? `<small>${esc(a.sub)}</small>` : '') + (a.barra !== undefined ? `<div class="barra"><i style="width:${Math.round(a.barra * 100)}%"></i></div>` : '') + '</div>';
      etq.classList.toggle('apagada', !!a.apagada);
    }
    // en el móvil, sin etiqueta sobre la cosa (valravnx, 9 nov: «cuando paso delante de algo sale»): el botón de acción
    // grande ya lleva su imagen, el verbo y lo que falta; queda el aro en el suelo
    etq.hidden = !!estado.esTactil;
    // (que no se salga por los lados)
    const ancho = etq.offsetWidth / 2 + 8;
    etq.style.left = Math.max(ancho, Math.min(innerWidth - ancho, sx)) + 'px';
    etq.style.top = Math.max(etq.offsetHeight + 8, sy - 10) + 'px';
    if (!lista.hidden && !estado.esTactil) { lista.style.left = Math.min(innerWidth - lista.offsetWidth - 10, sx + ancho - 4) + 'px'; lista.style.top = Math.max(60, sy - etq.offsetHeight - 10) + 'px'; }
  }
  function pintarBotonAccion(btn, a) {
    const img = btn.querySelector('.ic'), verbo = btn.querySelector('.verbo'), lleno = btn.querySelector('.lleno'), prog = btn.querySelector('.prog');
    if (!img) return;
    const ic = a ? a.icono : 'g_colocar', src = window.__sinImagenes ? '' : urlIcono(ic);
    if (img.getAttribute('src') !== src) { if (src) img.setAttribute('src', src); else img.removeAttribute('src'); }
    img.classList.toggle('g', String(ic).startsWith('g_'));
    // el verbo, corto: lo de antes de los dos puntos («Coger del suelo: 2 × Rama» → «Coger del suelo»)
    verbo.textContent = a ? a.texto.split(/[:(]/)[0].trim() : tr('Usar');
    btn.setAttribute('aria-label', a ? a.texto : tr('Usar'));
    prog.toggleAttribute('hidden', !(a && a.prog));   // (un svg no tiene .hidden)
    if (a && a.prog) lleno.setAttribute('stroke-dasharray', `${2 * Math.PI * 51 * a.prog} 400`);
  }
  function pintarLista(lista, a, ops) {
    if (!a || !ops.length) { lista.hidden = true; lista.innerHTML = ''; return; }
    const clave = [a.texto, ...ops.map(o => o.texto)].join('|');
    lista.hidden = false;
    if (lista.dataset.clave === clave) return;
    lista.dataset.clave = clave;
    lista.innerHTML = '';
    const fila = (texto, icono, hacer, sel) => {
      const b = document.createElement('button');
      b.className = 'placa' + (sel ? ' sel' : '');
      b.innerHTML = `${icono && !window.__sinImagenes ? `<img src="${urlIcono(icono)}" alt="" onerror="this.style.visibility='hidden'">` : '<img alt="" style="visibility:hidden">'}<span>${esc(texto)}</span>${sel && !estado.esTactil ? '<span class="k">F</span>' : ''}`;
      b.onclick = (e) => { e.stopPropagation(); hacer(); accionHasta = 0; };
      lista.appendChild(b);
    };
    fila(a.texto, a.icono, a.hacer, true);
    for (const o of ops) fila(o.texto, null, o.hacer, false);
  }
  function alternarLista() {
    estado.verLista = !estado.verLista; accionHasta = 0;
    estado.listaDe = accionVista ? `${accionVista.pos.x.toFixed(1)},${accionVista.pos.z.toFixed(1)}` : null;
  }

  return { pintarAccion, alternarLista, aroAccion, vista: () => accionVista };
}
