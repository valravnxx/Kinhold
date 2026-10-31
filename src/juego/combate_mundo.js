// Kinhold — el combate dentro del mundo (valravnx, 30 oct): sin liza ni duelo aparte. En «Mover», con el arma
// sacada (tecla C o el botón «Arma»):
//  - PC: al hacer clic el ratón queda cogido: moverlo gira la cámara (también arriba y abajo) y Esc lo suelta.
//    Cuatro direcciones (valravnx, 31 oct): arriba, izquierda, derecha y abajo, que es clavar (la estocada). Clic
//    izquierdo mantenido: carga el golpe en la dirección del último movimiento del ratón (sin movimiento, la última
//    usada); al soltar sale, con más fuerza cuanto más se cargó. El golpe va comprometido: moverse no lo cambia; el
//    clic derecho lo cancela (finta, cuesta aliento) y, si se mantiene, para; también se puede empezar otro golpe.
//    Clic derecho mantenido: parar, por el lado del último movimiento, cambiándolo sin soltar (con escudo, sin lado:
//    para lo que viene de frente).
//  - Móvil: la rosa fija abajo a la derecha, con cuatro sectores (tocar un sector carga por ese lado, soltar lo
//    lanza); «Parar» cancela el golpe que se carga (finta) y, mantenido, para por el lado que toques en la rosa.
//  - Fijar (Tab o el botón): con un rival fijado vuelve la cámara del duelo (detrás de ti, mirándole) y andas a su
//    alrededor; sin fijar, cámara y movimiento libres.
// Un rival de práctica (botón «Rival») viene a por ti con la máquina del duelo. Todo golpe pasa por las acciones con
// autor (ejecutarCombate). Provisional, hasta que el arma salga del inventario: espada larga.
import * as THREE from 'three';
import { Luchador, IA, LINEAS_DIRECCIONAL as LINEAS, ESPEJO, NOMBRE_ZONA, angulo, difAngulo, RITMO, azar } from '../combate/logica.js';
import { crearCombatiente, ponerArma, animarCombatiente, pintarHeridas, sacudir, Rastro } from '../combate/modelos.js';
import { LectorDireccion, lineaDe } from '../combate/direccion.js';
import { ejecutarCombate } from '../logica/acciones.js';
import { tr } from '../idioma.js';

// abajo, clavar (la estocada): la punta hacia delante
const FLECHA = { alto: '▲', izquierda: '◀', derecha: '▶', estocada: '▼' };
// dónde va cada marca alrededor del centro (en múltiplos del radio)
const SITIO = { alto: [0, -1], izquierda: [-1, 0], derecha: [1, 0], estocada: [0, 1] };

export function crearCombateMundo({ escena, camara, lienzo, pj, cam, jugador, recursos, sexo, aspecto, capasActuales, armaduraActual,
  modo, alturaEn, registro, esTactil, aviso }) {
  const c = {
    activo: false, L: null, modelo: null, rivales: [], fijado: null, ctx: null,
    lector: new LectorDireccion(), atacando: false, parando: false, raton: false, reloj: 0,
    ultimoGolpe: '', caidoHasta: 0,
  };
  const rastro = new Rastro(escena);
  const ahora = () => performance.now() / 1000;
  const r = azar((Date.now() >> 4) & 0xffff);

  // ---------- Interfaz ----------
  const css = document.createElement('style');
  css.textContent = `
  #cmbMira{position:fixed;left:50%;top:34%;width:0;height:0;pointer-events:none;z-index:6}
  #cmbMira b{position:absolute;transform:translate(-50%,-50%);font:700 15px system-ui,sans-serif;color:rgba(241,232,216,.55);text-shadow:0 1px 2px #000;transition:color .08s,font-size .08s}
  #cmbMira b.sel{color:#e8b64c;font-size:22px} #cmbMira b.para{color:#7fb2e6;font-size:22px} #cmbMira b.viene{color:#e05a4a;font-size:24px}
  #cmbCarga{position:fixed;left:50%;top:calc(34% + 44px);width:70px;height:5px;transform:translateX(-50%);background:rgba(0,0,0,.4);border-radius:3px;pointer-events:none;z-index:6}
  #cmbCarga i{display:block;height:100%;width:0;background:#e8b64c;border-radius:3px}
  #cmbEstado{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:5px 10px;border-radius:8px;background:rgba(30,26,20,.72);color:#f2e8d0;font:13px system-ui,sans-serif;z-index:6;pointer-events:none}
  #cmbEstado .barra{width:70px;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden} #cmbEstado .barra i{display:block;height:100%;background:#d9b77c}
  #cmbMsg{position:fixed;left:50%;top:22%;transform:translateX(-50%);padding:6px 12px;border-radius:8px;background:rgba(30,26,20,.78);color:#f2e8d0;font:15px system-ui,sans-serif;z-index:7;pointer-events:none;text-align:center;max-width:90vw}
  #cmbBotones{position:fixed;right:calc(10px + env(safe-area-inset-right,0px));bottom:calc(64px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;z-index:6}
  #cmbBotones button{min-width:84px}
  #cmbRosa{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));width:150px;height:150px;border-radius:50%;background:rgba(36,30,24,.45);border:2px solid rgba(241,232,216,.35);touch-action:none;z-index:6}
  #cmbRosa b{position:absolute;transform:translate(-50%,-50%);font:700 20px system-ui,sans-serif;color:rgba(241,232,216,.7);pointer-events:none}
  #cmbRosa b.sel{color:#e8b64c} #cmbRosa b.para{color:#7fb2e6} #cmbRosa b.viene{color:#e05a4a}
  #cmbRosa .centro{position:absolute;left:50%;top:50%;width:42%;height:42%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(241,232,216,.3);pointer-events:none}
  /* móvil: la rosa abajo a la derecha, sus botones encima de ella y el aliento encima del joystick */
  body.combate.tactil #cmbBotones{bottom:calc(316px + env(safe-area-inset-bottom,0px))}
  body.combate.tactil #cmbEstado{left:calc(22px + env(safe-area-inset-left,0px));bottom:calc(162px + env(safe-area-inset-bottom,0px));transform:none;flex-wrap:wrap;max-width:150px;gap:4px 8px;font-size:12px}
  body.combate.tactil #btnUsar{display:none}
  body.combate.tactil #cmbMsg{top:calc(50% - 150px);font-size:14px}
  `;
  document.head.appendChild(css);
  const div = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; d.hidden = true; document.body.appendChild(d); return d; };
  const mira = div('cmbMira', LINEAS.map(l => `<b data-l="${l}" style="left:${SITIO[l][0] * 30}px;top:${SITIO[l][1] * 30}px">${FLECHA[l]}</b>`).join(''));
  const carga = div('cmbCarga', '<i></i>');
  const estadoEl = div('cmbEstado', `<span data-t="aliento"></span><span class="barra"><i></i></span><span class="sangre"></span>`);
  const msg = div('cmbMsg');
  const rosa = div('cmbRosa', LINEAS.map(l => `<b data-l="${l}" style="left:${50 + SITIO[l][0] * 34}%;top:${50 + SITIO[l][1] * 34}%">${FLECHA[l]}</b>`).join(''));
  const botones = div('cmbBotones');
  const boton = (id, texto, donde = botones) => { const b = document.createElement('button'); b.id = id; b.textContent = tr(texto); donde.appendChild(b); return b; };
  const bParar = esTactil ? boton('cmbParar', 'Parar') : null;
  const bFijar = boton('cmbFijar', 'Fijar');
  const bRival = boton('cmbRival', 'Rival');
  botones.hidden = true;
  // el botón de sacar el arma va con los de modo (Mover, Construir, Desmontar)
  const bArma = document.createElement('button'); bArma.id = 'btnArma'; bArma.textContent = tr('Arma');
  bArma.title = tr('Sacar o guardar el arma (C)');
  (document.getElementById('modos') || document.body).appendChild(bArma);
  estadoEl.querySelector('[data-t="aliento"]').textContent = tr('Aliento');

  let tMsg = 0;
  function decir(texto) { msg.textContent = texto; msg.hidden = false; tMsg = 2.6; }

  // ---------- Sacar y guardar el arma ----------
  function sacar() {
    if (c.activo || modo() !== 'mover') return;
    c.activo = true;
    const ritmo = RITMO.normal;
    if (!c.L || c.L.fuera) c.L = new Luchador({ nombre: tr('Tú'), arma: 'espada_larga', armadura: armaduraActual(), modo: 'direccional', ritmo, x: pj.x, z: pj.z, rot: pj.rot });
    else { c.L.armadura = armaduraActual(); }
    if (!c.modelo) {
      c.modelo = crearCombatiente({ armadura: c.L.armadura, colorCinta: 0x46607e, recursos, sexo, capas: capasActuales(), aspecto });
      ponerArma(c.modelo, 'espada_larga');
      escena.add(c.modelo);
    }
    c.modelo.visible = true; jugador.raiz.visible = false;
    c.ctx = { luchadores: { jugador: c.L }, r };
    // la cámara se acerca y baja para luchar (por detrás del hombro); al guardar el arma vuelve a como estaba
    c.camAntes = { dist: cam.dist, pitch: cam.pitch };
    cam.dist = 6; cam.pitch = 0.42;
    document.body.classList.add('combate'); document.body.classList.toggle('tactil', esTactil);
    bArma.classList.add('sel');
  }
  function guardar() {
    if (!c.activo) return;
    c.activo = false; c.fijado = null; c.atacando = false; c.parando = false;
    if (c.L) { c.L.bloquear(false); if (c.L.accion === 'preparando') c.L.descargar(); }
    if (c.modelo) c.modelo.visible = false;
    jugador.raiz.visible = true;
    if (document.pointerLockElement === lienzo) document.exitPointerLock();
    if (c.camAntes) { cam.dist = c.camAntes.dist; cam.pitch = c.camAntes.pitch; c.camAntes = null; }
    document.body.classList.remove('combate');
    bArma.classList.remove('sel');
  }
  const alternar = () => (c.activo ? guardar() : sacar());
  bArma.addEventListener('click', (e) => { e.stopPropagation(); alternar(); });

  // ---------- Rivales de práctica ----------
  function llamarRival() {
    if (c.rivales.filter(x => !x.L.fuera).length >= 3) return;
    const d = 6, a = pj.rot + (r() - 0.5) * 0.8;
    const x = pj.x + Math.sin(a) * d, z = pj.z + Math.cos(a) * d;
    const L = new Luchador({ nombre: tr('Rival'), arma: 'espada_larga', armadura: 'gambeson', modo: 'direccional', ritmo: RITMO.normal, x, z, rot: a + Math.PI });
    const ia = new IA(L, 'normal', azar((Date.now() >> 3) & 0xffff));
    const m = crearCombatiente({ armadura: 'gambeson', colorCinta: 0xb3923f, recursos });
    ponerArma(m, 'espada_larga'); escena.add(m);
    const id = 'rival' + (c.rivales.length + 1);
    c.rivales.push({ id, L, ia, m, rastro: new Rastro(escena), caidoDesde: 0 });
    c.ctx.luchadores[id] = L;
    decir(tr('Un rival de práctica viene a por ti'));
  }
  bRival.addEventListener('click', (e) => { e.stopPropagation(); if (!c.activo) sacar(); llamarRival(); });

  // ---------- Fijar ----------
  function fijar() {
    if (c.fijado) { c.fijado = null; bFijar.classList.remove('sel'); return; }
    // el rival en pie más cercano por delante de la cámara (a menos de 14 m)
    const frente = cam.yaw + Math.PI;
    let mejor = null, md = Infinity;
    for (const x of c.rivales) {
      if (x.L.fuera) continue;
      const d = Math.hypot(x.L.x - pj.x, x.L.z - pj.z);
      if (d > 14) continue;
      const p = d + difAngulo(frente, Math.atan2(x.L.x - pj.x, x.L.z - pj.z)) * 4;
      if (p < md) { md = p; mejor = x; }
    }
    c.fijado = mejor;
    bFijar.classList.toggle('sel', !!mejor);
    if (!mejor) decir(tr('No hay nadie cerca a quien fijar'));
  }
  bFijar.addEventListener('click', (e) => { e.stopPropagation(); fijar(); });

  // ---------- Atacar y parar (comunes a ratón y rosa) ----------
  function empezarGolpe(linea) {
    if (!c.activo || !c.L || c.L.fuera) return;
    if (c.L.bloqueando) c.L.bloquear(false);
    if (c.L.cargar(linea)) c.atacando = true;
  }
  function soltarGolpe() { if (c.atacando) { c.L.descargar(); c.atacando = false; } }
  // el botón de parar mientras se prepara un golpe lo cancela (finta) y, si se mantiene, para
  function fintar() {
    if (!c.L || c.L.accion !== 'preparando') return false;
    c.atacando = false;
    if (!c.L.fintar()) return false;
    decir(tr('Finta'));
    return true;
  }
  function parar(activo, linea) {
    if (!c.activo || !c.L) return;
    if (activo) fintar();
    c.parando = activo;
    c.L.bloquear(activo, linea);
  }

  // ---------- Ratón (PC): el ratón cogido gira la cámara y elige la dirección ----------
  // Va antes que los manejadores del mundo (fase de captura) y, con el arma sacada en «Mover», se los salta.
  const nuestro = (e) => c.activo && modo() === 'mover' && e.pointerType === 'mouse';
  lienzo.addEventListener('pointerdown', (e) => {
    if (!nuestro(e)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (document.pointerLockElement !== lienzo) {
      // el primer clic solo coge el ratón (en las pruebas, sin bloqueo de puntero, ya cuenta como cogido)
      try { const p = lienzo.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* sin bloqueo */ }
      if (!c.raton) { c.raton = true; botonesAntes = e.buttons || 0; return; }
    }
    pulsados(e);
  }, true);
  lienzo.addEventListener('pointermove', (e) => {
    if (!nuestro(e)) return;
    e.stopImmediatePropagation();
    const bloqueado = document.pointerLockElement === lienzo;
    if (!bloqueado && !c.raton) return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    moverRaton(dx, dy, e.timeStamp / 1000);
    pulsados(e);
  }, true);
  lienzo.addEventListener('pointerup', (e) => {
    if (!nuestro(e)) return;
    e.stopImmediatePropagation();
    pulsados(e);
  }, true);
  // Qué botones se pulsan y se sueltan, mirando cuáles cambian: con un botón ya pulsado, pulsar o soltar el otro no da
  // pointerdown ni pointerup sino un pointermove con otros «buttons» (y la finta es justo eso: parar con el golpe cargado).
  // La hora de cada evento (no la de cuando se atiende): con pocos fotogramas, el movimiento de antes del clic sigue contando.
  let botonesAntes = 0;
  function pulsados(e) {
    const b = e.buttons || 0, t = e.timeStamp / 1000;
    const sube = b & ~botonesAntes, baja = botonesAntes & ~b;
    botonesAntes = b;
    if (sube & 1) empezarGolpe(c.lector.alPulsar(t));
    if (sube & 2) parar(true, c.lector.alPulsar(t));
    if (baja & 1) soltarGolpe();
    if (baja & 2) parar(false);
  }
  function moverRaton(dx, dy, t = ahora()) {
    c.lector.mover(dx, dy, t);
    // sin rival fijado, el ratón gira la cámara (izquierda-derecha y arriba-abajo)
    if (!c.fijado) {
      cam.yaw -= dx * 0.0035;
      cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.0028, 0.06, 1.35);
    }
    // el golpe va comprometido; la parada sí cambia de lado sin soltar
    if (c.parando && !c.atacando) {
      const l = c.lector.cambio(t);
      if (l) parar(true, l);
    }
  }
  document.addEventListener('pointerlockchange', () => {
    c.raton = document.pointerLockElement === lienzo;
    if (!c.raton) { botonesAntes = 0; soltarGolpe(); if (c.parando) parar(false); }
  });

  // ---------- Rosa (móvil) ----------
  let lineaParadaRosa = 'alto', dedoRosa = null;
  const lineaRosa = (x, y) => {
    const b = rosa.getBoundingClientRect();
    return lineaDe(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
  };
  rosa.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { rosa.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    dedoRosa = e.pointerId;
    const l = lineaRosa(e.clientX, e.clientY);
    if (c.parando) { lineaParadaRosa = l; parar(true, l); } else empezarGolpe(l);
  });
  rosa.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dedoRosa) return;
    const l = lineaRosa(e.clientX, e.clientY);
    if (c.parando && l !== lineaParadaRosa) { lineaParadaRosa = l; parar(true, l); }   // (el golpe no cambia: va comprometido)
  });
  const finRosa = (e) => { if (e.pointerId !== dedoRosa) return; dedoRosa = null; soltarGolpe(); };
  rosa.addEventListener('pointerup', finRosa); rosa.addEventListener('pointercancel', finRosa);
  if (bParar) {
    bParar.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { bParar.setPointerCapture(e.pointerId); } catch (err) { /* nada */ } parar(true, lineaParadaRosa); bParar.classList.add('sel'); });
    const fin = () => { parar(false); bParar.classList.remove('sel'); };
    bParar.addEventListener('pointerup', fin); bParar.addEventListener('pointercancel', fin);
  }

  // ---------- Teclas ----------
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyC' && !e.repeat) alternar();
    if (e.code === 'Tab' && c.activo) { e.preventDefault(); fijar(); }
  });

  // ---------- Golpes ----------
  function resolver(autor, objetivo, linea) {
    const res = ejecutarCombate(c.ctx, registro, { autor, tipo: 'golpe', objetivo, linea });
    if (!res.ok) return null;
    return res;
  }
  function decirResultado(res, delJugador) {
    const z = res.zona ? tr(NOMBRE_ZONA[res.zona]) : '', g = res.gravedad ? tr(res.gravedad) : '';
    const textos = delJugador ? {
      herida: tr('Hieres al rival: {g} en {z}', { g, z }), parada: tr('El rival para tu golpe'),
      'parada perfecta': tr('El rival para en el momento justo: quedas descolocado'), 'golpe maestro': tr('¡Golpe maestro del rival! Desvía el tuyo'),
      fallo: tr('Golpe al aire: fuera de alcance'),
    } : {
      herida: tr('Te hieren: {g} en {z}', { g, z }), parada: tr('Paras el golpe'), 'parada perfecta': tr('¡Parada perfecta! Contraataca ya'),
      'golpe maestro': tr('¡Golpe maestro! Desvías su golpe y el tuyo entra'), fallo: tr('El rival golpea al aire'),
    };
    if (textos[res.resultado]) decir(textos[res.resultado]);
  }
  function efectos(res, mAt, mDe) {
    if (res.resultado === 'herida' && mDe) sacudir(mDe, 1);
    else if (res.resultado === 'parada' || res.resultado === 'parada perfecta') { if (mDe) sacudir(mDe, 0.4); if (mAt && res.resultado === 'parada perfecta') sacudir(mAt, 0.8); }
  }
  // a quién va un golpe del jugador: el fijado o el rival en pie más cercano por delante
  function blancoDelJugador() {
    if (c.fijado && !c.fijado.L.fuera) return c.fijado;
    let mejor = null, md = Infinity;
    for (const x of c.rivales) {
      if (x.L.fuera) continue;
      const d = Math.hypot(x.L.x - c.L.x, x.L.z - c.L.z);
      if (d < md && difAngulo(c.L.rot, angulo(c.L, x.L)) < Math.PI / 2) { md = d; mejor = x; }
    }
    return mejor;
  }
  function separar(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.75;
    if (d < min && d > 1e-6) { const e = (min - d) / 2; b.x += dx / d * e * 2; b.z += dz / d * e * 2; }
  }
  const girarHacia = (actual, objetivo, k) => { let d = objetivo - actual; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return actual + d * Math.min(1, k); };

  // ---------- Cada fotograma ----------
  function paso(dt, { corriendo = false, velocidad = 0 } = {}) {
    c.reloj += dt;
    if (c.activo && modo() !== 'mover') guardar();
    const vis = c.activo;
    // solo se toca la página cuando cambia algo (sin tarjeta gráfica, cada cambio cuesta en cada fotograma)
    const clave = modo() + vis;
    if (clave !== c.vistaAntes) {
      c.vistaAntes = clave;
      bArma.hidden = modo() !== 'mover';
      mira.hidden = !vis || esTactil; carga.hidden = !vis || esTactil;
      estadoEl.hidden = !vis; botones.hidden = !vis; rosa.hidden = !vis || !esTactil;
    }
    if (tMsg > 0) { tMsg -= dt; if (tMsg <= 0) msg.hidden = true; }
    if (!c.L) return;
    const L = c.L;
    // tú: donde estás en el mundo, mirando hacia donde mira la cámara (o hacia el rival fijado)
    L.x = pj.x; L.z = pj.z;
    if (c.activo && !L.fuera) {
      if (c.fijado && !c.fijado.L.fuera) L.rot = girarHacia(L.rot, angulo(L, c.fijado.L), dt * 10);
      else L.rot = girarHacia(L.rot, cam.yaw + Math.PI, dt * 12);
      pj.rot = L.rot;
    }
    const evJ = L.actualizar(dt, corriendo);
    for (const e of evJ) if (e.tipo === 'impacto') {
      const b = blancoDelJugador();
      if (!b) { decir(tr('Golpe al aire')); continue; }
      const res = resolver('jugador', b.id, e.linea);
      if (res) { decirResultado(res, true); efectos(res, c.modelo, b.m); }
    }
    // rivales
    for (const x of c.rivales) {
      let v = 0;
      if (!L.fuera && !x.L.fuera) {
        const m = x.ia.pensar(dt, L);
        if (m.mx || m.mz) { v = x.L.velocidad(m.correr); x.L.x += m.mx * v * dt; x.L.z += m.mz * v * dt; }
      } else if (x.L.bloqueando) x.L.bloquear(false);
      for (const e of x.L.actualizar(dt, false)) if (e.tipo === 'impacto') {
        const res = resolver(x.id, 'jugador', e.linea);
        if (res) { decirResultado(res, false); efectos(res, x.m, c.modelo); }
      }
      if (!x.L.fuera) separar(L, x.L);
      x.m.position.set(x.L.x, alturaEn(x.L.x, x.L.z), x.L.z);
      x.m.rotation.y = x.L.rot;
      pintarHeridas(x.m, x.L.heridas);
      animarCombatiente(x.m, x.L, dt, v, x.L.factorPiernas() < 0.9, L.atacando() ? ESPEJO[L.linea] : 'estocada');
      x.rastro.actualizar(x.m, enVuelo(x.L));
      if (x.L.fuera && !x.caidoDesde) { x.caidoDesde = c.reloj; decir(tr('El rival cae: {m}', { m: tr(x.L.motivoFuera) })); if (c.fijado === x) c.fijado = null; }
    }
    // los caídos se quitan al rato
    for (const x of c.rivales.filter(x => x.caidoDesde && c.reloj - x.caidoDesde > 8)) {
      escena.remove(x.m); x.rastro.actualizar(x.m, false); delete c.ctx.luchadores[x.id];
      c.rivales.splice(c.rivales.indexOf(x), 1);
    }
    // tú caído: provisional para probar, al rato te levantas curado
    if (L.fuera && !c.caidoHasta) { c.caidoHasta = c.reloj + 5; decir(tr('Caes: {m}', { m: tr(L.motivoFuera) })); c.fijado = null; }
    if (L.fuera && c.reloj >= c.caidoHasta) {
      c.caidoHasta = 0;
      c.L = new Luchador({ nombre: tr('Tú'), arma: 'espada_larga', armadura: armaduraActual(), modo: 'direccional', ritmo: RITMO.normal, x: pj.x, z: pj.z, rot: pj.rot });
      c.ctx.luchadores.jugador = c.L;
      decir(tr('Te levantas (prueba: vuelves curado)'));
    }
    if (c.modelo) {
      c.modelo.position.set(pj.x, pj.y, pj.z);
      c.modelo.rotation.y = c.L.rot;
      pintarHeridas(c.modelo, c.L.heridas);
      const amenaza = rivalQueAtaca();
      animarCombatiente(c.modelo, c.L, dt, velocidad, c.L.factorPiernas() < 0.9, amenaza ? ESPEJO[amenaza.L.linea] : 'estocada');
      rastro.actualizar(c.modelo, c.activo && enVuelo(c.L));
    }
    // cámara del duelo con un rival fijado: detrás de ti, un poco de lado, mirándole
    if (c.activo && c.fijado) {
      const a = Math.atan2(pj.x - c.fijado.L.x, pj.z - c.fijado.L.z) + 0.45;
      cam.yaw = girarHacia(cam.yaw, a, dt * 4);
      cam.pitch += (0.5 - cam.pitch) * Math.min(1, dt * 3);
      cam.dist += (6.5 - cam.dist) * Math.min(1, dt * 3);
    }
    if (vis) pintarInterfaz();
  }
  const enVuelo = (L) => L.accion === 'golpeando' || L.accion === 'lanzando';
  function rivalQueAtaca() {
    let peor = null;
    for (const x of c.rivales) if (!x.L.fuera && x.L.atacando() && Math.hypot(x.L.x - pj.x, x.L.z - pj.z) < 4) if (!peor || x.L.hastaImpacto() < peor.L.hastaImpacto()) peor = x;
    return peor;
  }
  function pintarInterfaz() {
    const L = c.L, amenaza = rivalQueAtaca(), viene = amenaza ? ESPEJO[amenaza.L.linea] : null;
    for (const cont of [mira, rosa]) for (const b of cont.querySelectorAll('b')) {
      const l = b.dataset.l;
      b.classList.toggle('sel', L.atacando() && L.linea === l);
      b.classList.toggle('para', L.bloqueando && L.lineaBloqueo === l);
      b.classList.toggle('viene', viene === l);
    }
    carga.firstChild.style.width = Math.round((L.accion === 'preparando' ? L.carga() : 0) * 100) + '%';
    estadoEl.querySelector('.barra i').style.width = Math.round(100 - L.cansancio) + '%';
    estadoEl.querySelector('.sangre').textContent = tr('Sangre {s} %', { s: Math.round(L.sangre) });
  }

  return {
    paso, sacar, guardar, llamarRival, fijar,
    get activo() { return c.activo; },
    // para el movimiento del mundo: con el arma sacada se anda como dice la lógica (cargando, parando, herido…)
    factorVelocidad(corriendo) { return c.activo && c.L ? c.L.velocidad(corriendo) / (corriendo ? 6 : 3.6) : 1; },
    // para las pruebas
    get L() { return c.L; }, get rivales() { return c.rivales; }, get fijado() { return c.fijado; },
    raton: { mover: moverRaton, pulsar(b) { const l = c.lector.alPulsar(ahora()); if (b === 2) parar(true, l); else empezarGolpe(l); }, soltar(b) { if (b === 2) parar(false); else soltarGolpe(); } },
  };
}
