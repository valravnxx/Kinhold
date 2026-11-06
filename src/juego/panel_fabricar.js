// Kinhold — el panel de fabricación (P3, «De nada a una casa»; revisión del 1 nov: las recetas siempre a la vista,
// nadie las aprende). Se abre con H o con el botón «Fabricar», en PC y en el móvil (a pantalla completa):
//  - En marcha: lo que tienes encargado (en tus manos o en una estación), con lo que le falta; lo terminado se recoge.
//  - Puedes hacerlo ya: tienes la estación al lado (o es con las manos) y no te falta nada. Botón «Hacer».
//  - Casi: tienes la estación, pero te falta algo (lo que falta, en rojo).
//  - Después, en gris: te falta la estación de su uso, y dice cuál.
//  - Estaciones: las que puedes poner delante de ti, con lo que cuestan.
// Cada material dice de dónde sale: tu mano, el cinturón, la mochila, el hombro o el suelo a tu lado (como lo
// gastaría la lógica, src/logica/fabricacion.js: primero lo que llevas, luego el suelo).
// El panel no cambia nada por su cuenta: manda la acción con hacer(accion, alResultado) (en línea, al servidor, que
// pone el autor) y espera la respuesta.
import { CATALOGO } from '../logica/inventario.js';
import { RECETAS, USOS, ESTACIONES, ALCANCE_ESTACION } from '../logica/fabricacion.js';
import { tr } from '../idioma.js';

const SITIOS = [['mano', 'de la mano'], ['cinturon', 'del cinturón'], ['mochila', 'de la mochila'], ['hombro', 'del hombro'], ['suelo', 'del suelo']];
const nombre = t => tr((CATALOGO[t] || {}).nombre || t);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const DELANTE = 1.2; // m: dónde se pone una estación, delante de ti

// fab: la Fabricacion con las estaciones que se ven. inventario(): lo que llevas. suelo(): el Suelo. posicion(): { x, z, rot }.
// hacer(accion, alResultado): manda { tipo: 'fabricar' | 'recoger_fabricado' | 'colocar_estacion', … }.
export function montarPanelFabricar({ panel, boton, fab, inventario, suelo, posicion, hacer, alAbrir = () => {} }) {
  let abierto = false, firma = '', aviso = { txt: '', error: false };
  // lo encargado: manos y cada estación → [{ receta, fin }] (fin con la hora de este navegador)
  let encargos = { manos: [], estaciones: {} };

  panel.innerHTML = `<button class="cerrar fab-cerrar">✕</button><h2>${tr('Fabricar')}</h2><div class="fab-aviso"></div><div class="fab-cuerpo"></div>`;
  const cuerpo = panel.querySelector('.fab-cuerpo'), divAviso = panel.querySelector('.fab-aviso');

  const ahora = () => Date.now();
  const lugar = () => { const p = posicion(); return { x: p.x, z: p.z }; };
  const delante = () => { const p = posicion(); return { x: p.x + Math.sin(p.rot || 0) * DELANTE, z: p.z + Math.cos(p.rot || 0) * DELANTE }; };

  function textoMaterial(tipo, n, info, falta) {
    const s = info && info.sitios ? SITIOS.filter(([k]) => info.sitios[k]).map(([k, t]) => `${info.sitios[k]} ${tr(t)}`) : [];
    return `<span class="fab-mat${falta ? ' fab-falta' : ''}"><b>${n} ${esc(nombre(tipo))}</b>${s.length ? ` <small>(${esc(s.join(', '))})</small>` : ''}${falta ? ` <small class="fab-rojo">${esc(tr('faltan {n}', { n: falta }))}</small>` : ''}</span>`;
  }
  const dondeUso = uso => uso === 'manos' ? tr('Con las manos') : tr(USOS[uso].nombre);
  const segundos = s => s >= 60 ? tr('{m} min', { m: Math.round(s / 6) / 10 }) : tr('{s} s', { s });

  function filaReceta(x) {
    const mats = Object.entries(x.gasta).map(([t, n]) => textoMaterial(t, n, x.grupo === 'despues' ? null : x.de[t], x.grupo === 'despues' ? 0 : x.faltan[t] || 0)).join('');
    const da = x.n > 1 ? `${x.n} × ${nombre(x.da)}` : nombre(x.da);
    const pie = x.grupo === 'despues' ? `<small class="fab-gris">${esc(tr('Hace falta {e} a tu lado.', { e: tr(x.conQue) }))}</small>` : '';
    const btn = x.grupo === 'ya' ? `<button class="fab-hacer" data-receta="${x.receta}"${x.estacion ? ` data-estacion="${esc(x.estacion)}"` : ''}>${tr('Hacer')}</button>` : '';
    return `<div class="fab-fila fab-${x.grupo}" data-fila="${x.receta}"><div class="fab-tit"><b>${esc(tr(x.nombre))}</b><small>${esc(dondeUso(x.uso))} · ${esc(segundos(x.s))}${x.da !== x.receta || x.n > 1 ? ' · ' + esc(tr('da {d}', { d: da })) : ''}</small>${btn}</div><div class="fab-mats">${mats}</div>${pie}</div>`;
  }

  function filaEstacion(e) {
    const mats = Object.entries(e.coste).map(([t, n]) => textoMaterial(t, n, e.de[t], e.faltan[t] || 0)).join('');
    const req = e.requiere.length ? `<small class="${e.sinHerramienta ? 'fab-rojo' : 'fab-gris'}">${esc(tr('Hay que llevar {h} (no se gasta).', { h: e.requiere.map(nombre).map(s => s.toLowerCase()).join(tr(' o ')) }))}</small>` : '';
    return `<div class="fab-fila ${e.puede ? 'fab-ya' : 'fab-casi'}" data-fila="estacion:${e.tipo}"><div class="fab-tit"><b>${esc(tr(e.nombre))}</b><small>${esc(tr(e.hace))}</small>${e.puede ? `<button class="fab-poner" data-tipo="${e.tipo}">${tr('Poner delante')}</button>` : ''}</div><div class="fab-mats">${mats}</div>${req}</div>`;
  }

  function filaEncargo(c, estacion, i) {
    const rc = RECETAS[c.receta], listo = c.fin <= ahora();
    const e = fab.estaciones[estacion], donde = estacion ? tr(e && ESTACIONES[e.tipo] ? ESTACIONES[e.tipo].nombre : 'En una estación') : tr('Con las manos');
    return `<div class="fab-fila fab-marcha" data-encargo="${i}"><div class="fab-tit"><b>${esc(tr(rc.nombre))}</b><small>${esc(donde)} · <span class="fab-tiempo" data-fin="${c.fin}">${listo ? esc(tr('terminado')) : ''}</span></small>${listo ? `<button class="fab-recoger"${estacion ? ` data-estacion="${esc(estacion)}"` : ''}>${tr('Recoger')}</button>` : ''}</div></div>`;
  }

  function pintar() {
    if (!abierto) return;
    const inv = inventario(), p = lugar(), t = ahora();
    const lista = fab.lista(p, inv, suelo(), t), est = fab.listaEstaciones(delante(), inv, suelo(), t);
    const grupo = g => lista.filter(x => x.grupo === g);
    const marcha = [];
    encargos.manos.forEach((c, i) => marcha.push(filaEncargo(c, null, 'm' + i)));
    for (const [id, l] of Object.entries(encargos.estaciones)) {
      const e = fab.estaciones[id];
      if (e && Math.hypot(e.x - p.x, e.z - p.z) > ALCANCE_ESTACION * 4) continue; // las de lejos no se ven aquí
      l.forEach((c, i) => marcha.push(filaEncargo(c, id, id + i)));
    }
    const seccion = (tit, cls, filas, vacio = '') => filas.length || vacio ? `<section class="fab-sec ${cls}"><h3>${esc(tr(tit))}</h3>${filas.join('') || `<p class="fab-gris">${esc(tr(vacio))}</p>`}</section>` : '';
    const html = seccion('En marcha', 'fab-sec-marcha', marcha)
      + seccion('Puedes hacerlo ya', 'fab-sec-ya', grupo('ya').map(filaReceta), 'Nada todavía: mira lo que te falta debajo.')
      + seccion('Casi: te falta algo', 'fab-sec-casi', grupo('casi').map(filaReceta))
      + seccion('Después: hace falta una estación', 'fab-sec-despues', grupo('despues').map(filaReceta))
      + seccion('Estaciones: se ponen delante de ti', 'fab-sec-est', est.map(filaEstacion));
    if (html !== firma) { firma = html; cuerpo.innerHTML = html; }
    for (const s of cuerpo.querySelectorAll('.fab-tiempo')) {
      const falta = Number(s.dataset.fin) - t;
      if (falta > 0) s.textContent = tr('quedan {s} s', { s: Math.ceil(falta / 1000) });
      else if (!s.textContent) { firma = ''; } // acaba de terminar: el botón de recoger sale en la siguiente vuelta
    }
    divAviso.textContent = aviso.txt; divAviso.classList.toggle('fab-error', aviso.error);
  }
  const decir = (txt, error = false) => { aviso = { txt, error }; pintar(); };

  function anotarEncargo(receta, estacion) {
    const l = estacion ? (encargos.estaciones[estacion] ||= []) : encargos.manos;
    const empieza = Math.max(ahora(), ...l.map(c => c.fin));
    l.push({ receta, fin: empieza + RECETAS[receta].s * 1000 });
  }

  cuerpo.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const p = lugar();
    if (b.classList.contains('fab-hacer')) {
      const receta = b.dataset.receta, estacion = b.dataset.estacion || null;
      b.disabled = true;
      hacer({ tipo: 'fabricar', receta, estacion, x: p.x, z: p.z }, (r) => {
        if (!r.ok) { decir(tr(r.motivo), true); return; }
        anotarEncargo(receta, r.estacion || estacion);
        firma = ''; decir(tr('Encargado: {r}.', { r: tr(RECETAS[receta].nombre) }));
      });
    } else if (b.classList.contains('fab-recoger')) {
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
    } else if (b.classList.contains('fab-poner')) {
      const d = delante(), tipo = b.dataset.tipo;
      b.disabled = true;
      hacer({ tipo: 'colocar_estacion', estacion: tipo, x: d.x, z: d.z }, (r) => {
        if (!r.ok) { decir(tr(r.motivo), true); return; }
        firma = ''; decir(tr('Pones {e} delante de ti.', { e: tr(ESTACIONES[tipo].nombre).toLowerCase() }));
      });
    }
  });

  let reloj = null;
  function abrir() { abierto = true; panel.hidden = false; aviso = { txt: '', error: false }; firma = ''; pintar(); alAbrir(); if (!reloj) reloj = setInterval(pintar, 1000); }
  function cerrar() { abierto = false; panel.hidden = true; if (reloj) { clearInterval(reloj); reloj = null; } }
  panel.querySelector('.fab-cerrar').onclick = cerrar;
  if (boton) boton.onclick = () => (abierto ? cerrar() : abrir());

  return {
    get abierto() { return abierto; },
    abrir, cerrar, alternar() { if (abierto) cerrar(); else abrir(); },
    pintar() { firma = ''; pintar(); },
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
