// Kinhold — el combate dentro del mundo (valravnx, 30 oct): sin escena ni duelo aparte. En «Mover», con el arma
// sacada (tecla C o el botón «Arma»):
//  - PC: al hacer clic el ratón queda cogido: moverlo gira la cámara (también arriba y abajo) y Esc lo suelta.
//    Cuatro direcciones (valravnx, 31 oct): arriba, izquierda, derecha y abajo, que es clavar (la estocada). Clic
//    izquierdo mantenido: carga el golpe en la dirección del último movimiento del ratón (sin movimiento, la última
//    usada); al soltar sale, con más fuerza cuanto más se cargó. El golpe va comprometido: moverse no lo cambia; el
//    clic derecho lo cancela (finta, cuesta aliento) y, si se mantiene, para; también se puede empezar otro golpe.
//    Clic derecho mantenido: parar, por el lado del último movimiento, cambiándolo sin soltar (con escudo, sin lado:
//    para lo que viene de frente).
//  - Móvil: dos rosas fijas a la derecha, con cuatro sectores cada una (valravnx, 1 nov: «parar sigue siendo un botón
//    y no otro joystick como el de atacar»). La de abajo ataca: tocar un sector carga por ese lado y soltar lo lanza.
//    La de encima para: tocar un sector para por ese lado, deslizar el dedo cambia de lado y soltar deja de parar; con
//    un golpe cargándose, tocarla lo cancela (finta). Fijar y Rival van a la izquierda, encima del aliento.
//  - Fijar (Tab o el botón): con un rival fijado vuelve la cámara del duelo (detrás de ti, mirándole) y andas a su
//    alrededor; sin fijar, cámara y movimiento libres.
// Un rival de práctica (botón «Rival») viene a por ti con la máquina del duelo. Todo golpe pasa por las acciones con
// autor (ejecutarCombate). El arma es lo que llevas en la mano (valravnx, 9 nov; src/logica/arma_mano.js): las hachas, el
// cuchillo, el mazo, el palo, la lanza; con las manos vacías o con algo que no es un arma, puños. El servidor la pone desde
// tu inventario; aquí se dibuja la misma. Lanzar (la lanza endurecida o una piedra): Espacio mantenido en PC (con la
// piedra, también el clic izquierdo) o el botón «Lanzar» en el móvil; se apunta con la mira (lo que hay en el centro de la
// cámara) y, al soltar, sale con algo de desvío (lo decide el servidor). La lanza y la piedra caen al suelo donde acaban,
// para recogerlas. Lo lanzado (de cualquiera) se ve volar. El rival de práctica pelea con un palo.
// En línea (valravnx, 31 oct: «sacábamos arma y no veíamos al otro con arma en mano ni los ataques nos hacían nada»):
// sacar y guardar el arma, cargar, soltar, fintar y parar se mandan también al servidor (src/logica/combate_servidor.js),
// que resuelve los golpes entre jugadores con su autor; aquí se hace enseguida en la copia propia para no esperar a la
// red, y las heridas, la sangre y caer las dice el servidor (su foto). A los demás los dibuja src/juego/en_linea.js.
// Provisional: el rival de práctica sigue siendo solo tuyo (lo que te hace se ve aquí hasta la próxima foto del servidor).
// En Strandvang, tierras del rey (src/logica/tierras_rey.js), el servidor rechaza los golpes entre jugadores: el evento
// llega con resultado «tierras del rey» y se dice; contra el rival de práctica se pelea igual.
import * as THREE from 'three';
import { Luchador, IA, LINEAS, ESPEJO, NOMBRE_ZONA, angulo, difAngulo, RITMO, azar } from '../combate/logica.js';
import { crearCombatiente, ponerArma, animarCombatiente, pintarHeridas, sacudir, Rastro } from '../combate/modelos.js';
import { LectorDireccion, lineaDe } from '../combate/direccion.js';
import { ejecutarCombate } from '../logica/acciones.js';
import { aplicarFoto, resultadoDeEvento } from '../logica/combate_cliente.js';
import { loQueSeLanza } from '../logica/arma_mano.js';
import { T as TC, ARMAS, defTiro } from '../combate/logica.js';
import { modeloArma } from '../combate/modelos.js';
import { crearModeloLanza } from './fauna.js';
import { tr } from '../idioma.js';

// abajo, clavar (la estocada): la punta hacia delante
const FLECHA = { alto: '▲', izquierda: '◀', derecha: '▶', estocada: '▼' };
// dónde va cada marca alrededor del centro (en múltiplos del radio)
const SITIO = { alto: [0, -1], izquierda: [-1, 0], derecha: [1, 0], estocada: [0, 1] };

export function crearCombateMundo({ escena, camara, lienzo, pj, cam, jugador, recursos, sexo, aspecto, capasActuales, prendasActuales,
  modo, alturaEn, registro, esTactil, aviso, red = () => null,
  // pelear en cualquier sitio del mundo (hito «El juego en el mundo de verdad»): el rival de práctica anda por donde
  // andarías tú (sin atravesar obras ni árboles, sin subir cortados ni meterse donde cubre), y nadando no se lucha
  andarHasta = (x0, z0, x1, z1) => ({ x: x1, z: z1 }), puedeLuchar = () => true,
  // lo que llevas en las manos (src/logica/arma_mano.js): armaMano() → { arma, objeto }; lugares() → los del inventario
  armaMano = () => ({ arma: 'punos', objeto: null }), lugares = () => ({}) }) {
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
  #cmbRosa,#cmbRosaParar{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(22px + env(safe-area-inset-bottom,0px));width:138px;height:138px;border-radius:50%;background:rgba(36,30,24,.45);border:2px solid rgba(241,232,216,.35);touch-action:none;z-index:6}
  #cmbRosaParar{bottom:calc(172px + env(safe-area-inset-bottom,0px));background:rgba(28,40,56,.45);border-color:rgba(127,178,230,.45)}
  #cmbRosa b,#cmbRosaParar b{position:absolute;transform:translate(-50%,-50%);font:700 20px system-ui,sans-serif;color:rgba(241,232,216,.7);pointer-events:none}
  #cmbRosa b.sel{color:#e8b64c} #cmbRosaParar b.para{color:#7fb2e6} #cmbRosa b.viene,#cmbRosaParar b.viene{color:#e05a4a}
  #cmbRosa i,#cmbRosaParar i{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:600 12px system-ui,sans-serif;font-style:normal;color:rgba(241,232,216,.75);pointer-events:none}
  #cmbRosaParar.sel{border-color:#7fb2e6}
  /* móvil: las dos rosas a la derecha (atacar abajo, parar encima); Fijar y Rival en fila a la izquierda, encima del
     aliento, que va encima del joystick; lo que llevas en las manos no se enseña mientras se pelea (tapaba la rosa) */
  body.combate.tactil #cmbBotones{right:auto;left:calc(22px + env(safe-area-inset-left,0px));bottom:calc(222px + env(safe-area-inset-bottom,0px));flex-direction:row}
  body.combate.tactil #cmbBotones button{min-width:0;padding:7px 12px}
  body.combate.tactil #llevas{display:none}
  /* pantallas bajas: las rosas algo más pequeñas, para que la de parar no llegue a los botones de modo */
  @media (max-height:740px){#cmbRosa,#cmbRosaParar{width:116px;height:116px}#cmbRosaParar{bottom:calc(148px + env(safe-area-inset-bottom,0px))}}
  /* PC: el aliento encima de lo que llevas en las manos (los huecos de abajo, de 64 px; iban los dos en el centro) */
  body.combate:not(.tactil) #cmbEstado{bottom:calc(112px + env(safe-area-inset-bottom,0px))}
  body.combate.tactil #cmbEstado{left:calc(22px + env(safe-area-inset-left,0px));bottom:calc(162px + env(safe-area-inset-bottom,0px));transform:none;flex-wrap:wrap;max-width:150px;gap:4px 8px;font-size:12px}
  body.combate.tactil #btnUsar,body.combate.tactil #modos > button[data-modo]{display:none!important}   /* (los redondos de la barra nueva, 8 nov, quedaban encima de las rosas) */
  body.combate.tactil #cmbMsg{top:calc(50% - 150px);font-size:14px}
  `;
  document.head.appendChild(css);
  const div = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; d.hidden = true; document.body.appendChild(d); return d; };
  const mira = div('cmbMira', LINEAS.map(l => `<b data-l="${l}" style="left:${SITIO[l][0] * 30}px;top:${SITIO[l][1] * 30}px">${FLECHA[l]}</b>`).join(''));
  const carga = div('cmbCarga', '<i></i>');
  const estadoEl = div('cmbEstado', `<span data-t="aliento"></span><span class="barra"><i></i></span><span class="sangre"></span>`);
  const msg = div('cmbMsg');
  const marcasRosa = (texto) => LINEAS.map(l => `<b data-l="${l}" style="left:${50 + SITIO[l][0] * 34}%;top:${50 + SITIO[l][1] * 34}%">${FLECHA[l]}</b>`).join('') + `<i>${texto}</i>`;
  const rosa = div('cmbRosa', marcasRosa(tr('Atacar')));
  const rosaParar = div('cmbRosaParar', marcasRosa(tr('Parar')));
  const botones = div('cmbBotones');
  const boton = (id, texto, donde = botones) => { const b = document.createElement('button'); b.id = id; b.textContent = tr(texto); donde.appendChild(b); return b; };
  const bFijar = boton('cmbFijar', 'Fijar');
  const bRival = boton('cmbRival', 'Rival');
  const bLanzar = boton('cmbLanzar', 'Lanzar'); bLanzar.title = tr('Mantén para coger impulso y suelta para lanzar (Espacio)'); bLanzar.hidden = true;
  botones.hidden = true;
  // el botón de sacar el arma va con los de modo (Mover, Construir, Desmontar)
  const bArma = document.createElement('button'); bArma.id = 'btnArma'; bArma.textContent = tr('Arma');
  bArma.title = tr('Sacar o guardar el arma (C)');
  (document.getElementById('modos') || document.body).appendChild(bArma);
  estadoEl.querySelector('[data-t="aliento"]').textContent = tr('Aliento');

  // en línea: lo mismo se manda al servidor (si no hay conexión, no pasa nada: se juega con el rival de práctica)
  const enRed = () => { const e = red(); return e && e.estado === 'conectado' && e.red.yo ? e : null; };
  const mandar = (m) => { const e = enRed(); if (e) e.enviar({ tipo: 'combate', ...m }); };

  let tMsg = 0;
  function decir(texto) { msg.textContent = texto; msg.hidden = false; tMsg = 2.6; }

  // ---------- Sacar y guardar el arma ----------
  function sacar() {
    if (c.activo || modo() !== 'mover') return;
    if (!puedeLuchar()) { decir(tr('Nadando no se puede sacar el arma')); return; }
    c.activo = true;
    const ritmo = RITMO.normal;
    const am = armaMano();
    if (!c.L || c.L.fuera) c.L = new Luchador({ nombre: tr('Tú'), arma: am.arma, prendas: prendasActuales(), ritmo, x: pj.x, z: pj.z, rot: pj.rot });
    else c.L.vestir(prendasActuales());
    if (!c.modelo) {
      c.modelo = crearCombatiente({ armadura: c.L.armadura, colorCinta: 0x46607e, recursos, sexo, capas: capasActuales(), aspecto });
      escena.add(c.modelo);
    }
    c.armaVista = null; armarDeMano();
    c.modelo.visible = true; jugador.raiz.visible = false;
    mandar({ que: 'arma', sacada: true });   // el arma y la armadura no se mandan: son lo que llevas (servidor)
    c.ctx = { luchadores: { jugador: c.L }, r };
    // la cámara se acerca y baja para luchar (por detrás del hombro); al guardar el arma vuelve a como estaba
    c.camAntes = { dist: cam.dist, pitch: cam.pitch };
    cam.dist = 6; cam.pitch = 0.42;
    document.body.classList.add('combate'); document.body.classList.toggle('tactil', esTactil);
    bArma.classList.add('sel');
  }
  // el arma es lo que llevas en la mano: si cambia (coges, sueltas, se gasta la piedra), se cambia la de la mano
  function armarDeMano() {
    const am = armaMano(), k = am.arma + '|' + am.objeto;
    if (c.L) { c.L.arma = am.arma; c.L.objeto = am.objeto; }
    if (c.modelo && c.armaVista !== k) { c.armaVista = k; ponerArma(c.modelo, am.arma, am.objeto); }
    bLanzar.hidden = !loQueSeLanza(lugares());
  }
  function guardar() {
    if (!c.activo) return;
    if (c.L && c.L.accion === 'tensando') { c.L.cancelarTensado('guardar'); c.tirando = false; }
    c.activo = false; c.fijado = null; c.atacando = false; c.parando = false;
    if (c.L) { c.L.bloquear(false); if (c.L.accion === 'preparando') c.L.descargar(); }
    mandar({ que: 'arma', sacada: false });
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
    // aparece a unos 6 m, por delante si se puede: el primer sitio al que se llega andando desde donde estás
    let x = null, z = null, a = 0;
    for (let i = 0; i < 16 && x === null; i++) {
      a = pj.rot + (i === 0 ? (r() - 0.5) * 0.8 : Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI / 8);
      const px = pj.x + Math.sin(a) * 6, pz = pj.z + Math.cos(a) * 6, p = andarHasta(pj.x, pj.z, px, pz);
      if (Math.hypot(p.x - px, p.z - pz) < 0.05) { x = px; z = pz; }
    }
    if (x === null) { decir(tr('Aquí no hay sitio para un rival')); return; }
    const L = new Luchador({ nombre: tr('Rival'), arma: 'palo', armadura: 'gambeson', ritmo: RITMO.normal, x, z, rot: a + Math.PI });
    const ia = new IA(L, 'normal', azar((Date.now() >> 3) & 0xffff));
    const m = crearCombatiente({ armadura: 'gambeson', colorCinta: 0xb3923f, recursos });
    ponerArma(m, 'palo'); escena.add(m);
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
  // ---------- Lanzar (la lanza, la piedra) ----------
  // se coge impulso mientras se mantiene (Espacio o el botón; con la piedra, también el clic) y al soltar sale hacia la
  // mira: lo que hay en el centro de la cámara, a la altura de la mira (34 % desde arriba), hasta 45 m
  const rayo = new THREE.Raycaster();
  function puntoMira() {
    rayo.setFromCamera(new THREE.Vector2(0, 1 - 2 * 0.34), camara);
    const o = rayo.ray.origin, d = rayo.ray.direction;
    for (let t = 1; t <= 50; t += 0.4) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, h = alturaEn(x, z);
      if (Math.hypot(x - pj.x, z - pj.z) > 1.5 && y <= h) return { x, y: h, z };
    }
    return { x: o.x + d.x * 40, y: o.y + d.y * 40, z: o.z + d.z * 40 };
  }
  function empezarTiro() {
    if (!c.activo || !c.L || c.L.fuera || c.tirando) return;
    if (!loQueSeLanza(lugares())) { decir(tr('No llevas nada que lanzar en la mano')); return; }
    if (c.L.bloqueando) { c.L.bloquear(false); mandar({ que: 'parar', activo: false }); }
    if (c.L.empezarTensar()) { c.tirando = true; mandar({ que: 'tensar' }); }
  }
  function soltarTiro(apunta = null) {   // (apunta: un punto { x, y, z } en vez de la mira; las pruebas)
    if (!c.tirando) return;
    c.tirando = false;
    const p = apunta && Number.isFinite(apunta.x) ? apunta : puntoMira();
    // si sale o es flojo lo dice el servidor con su reloj (aquí, con pocos fotogramas, la copia tensa más despacio): se
    // manda siempre el punto, con su altura sobre tu suelo
    c.L.soltar();
    mandar({ que: 'soltar', x: p.x, y: Math.max(-50, Math.min(50, p.y - alturaEn(pj.x, pj.z))), z: p.z });
  }
  bLanzar.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { bLanzar.setPointerCapture(e.pointerId); } catch (err) { /* nada */ } empezarTiro(); });
  const finLanzar = (e) => { e.stopPropagation(); soltarTiro(); };
  bLanzar.addEventListener('pointerup', finLanzar); bLanzar.addEventListener('pointercancel', finLanzar);

  function empezarGolpe(linea) {
    if (!c.activo || !c.L || c.L.fuera) return;
    if (c.L.def.tipo === 'distancia') { empezarTiro(); return; }   // (la piedra: el clic la lanza)
    if (c.L.bloqueando) { c.L.bloquear(false); mandar({ que: 'parar', activo: false }); }
    if (c.L.cargar(linea)) { c.atacando = true; mandar({ que: 'cargar', linea }); }
  }
  function soltarGolpe() { if (c.tirando && c.L && c.L.def.tipo === 'distancia') { soltarTiro(); return; } if (c.atacando) { c.L.descargar(); c.atacando = false; mandar({ que: 'descargar' }); } }
  // el botón de parar mientras se prepara un golpe lo cancela (finta) y, si se mantiene, para
  function fintar() {
    if (!c.L || c.L.accion !== 'preparando') return false;
    c.atacando = false;
    if (!c.L.fintar()) return false;
    mandar({ que: 'fintar' });
    decir(tr('Finta'));
    return true;
  }
  function parar(activo, linea) {
    if (!c.activo || !c.L) return;
    if (activo) fintar();
    c.parando = activo;
    c.L.bloquear(activo, linea);
    mandar(activo ? { que: 'parar', activo: true, linea: c.L.lineaBloqueo } : { que: 'parar', activo: false });
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
    // al coger el ratón (pointer lock) llega un salto enorme sin botones: no es un movimiento de la mano
    if (Math.abs(dx) + Math.abs(dy) < 400) moverRaton(dx, dy, e.timeStamp / 1000);
    // solo si cambia un botón (con otro ya pulsado, el navegador lo avisa así, con «button» ≥ 0); un movimiento
    // normal trae button = -1 y sus «buttons» no sirven para saber qué se ha pulsado o soltado
    if (e.button >= 0) pulsados(e);
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

  // ---------- Rosas (móvil) ----------
  const lineaEn = (el, x, y) => { const b = el.getBoundingClientRect(); return lineaDe(x - (b.left + b.width / 2), y - (b.top + b.height / 2)); };
  // atacar: tocar carga por ese lado y soltar lo lanza (el golpe va comprometido: deslizar no lo cambia)
  let dedoRosa = null;
  rosa.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { rosa.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    dedoRosa = e.pointerId;
    empezarGolpe(lineaEn(rosa, e.clientX, e.clientY));
  });
  const finRosa = (e) => { if (e.pointerId !== dedoRosa) return; dedoRosa = null; soltarGolpe(); };
  rosa.addEventListener('pointerup', finRosa); rosa.addEventListener('pointercancel', finRosa);
  // parar: tocar para por ese lado (y, con un golpe cargándose, lo cancela: finta), deslizar cambia de lado, soltar deja de parar
  let dedoParar = null, ladoParar = null;
  rosaParar.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { rosaParar.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    dedoParar = e.pointerId;
    ladoParar = lineaEn(rosaParar, e.clientX, e.clientY);
    parar(true, ladoParar); rosaParar.classList.add('sel');
  });
  rosaParar.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dedoParar) return;
    const l = lineaEn(rosaParar, e.clientX, e.clientY);
    if (l !== ladoParar) { ladoParar = l; parar(true, l); }
  });
  const finParar = (e) => { if (e.pointerId !== dedoParar) return; dedoParar = null; parar(false); rosaParar.classList.remove('sel'); };
  rosaParar.addEventListener('pointerup', finParar); rosaParar.addEventListener('pointercancel', finParar);

  // ---------- Teclas ----------
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyC' && !e.repeat) alternar();
    if (e.code === 'Space' && c.activo && modo() === 'mover') { e.preventDefault(); if (!e.repeat) empezarTiro(); }
    if (e.code === 'Tab' && c.activo) { e.preventDefault(); fijar(); }
  });

  addEventListener('keyup', (e) => { if (e.code === 'Space' && c.tirando) { e.preventDefault(); soltarTiro(); } });

  // ---------- Lo lanzado, volando (de todos: lo dice el servidor con el evento «disparo») ----------
  // se mueve aquí con la misma gravedad que en el servidor, desde la altura del suelo de quien lo lanza, y se quita al
  // llegar al suelo o cuando el servidor dice dónde ha dado (evento «flecha»). Donde cae, la lanza o la piedra la pone el suelo.
  const vuelos = [], tiros = [];
  function modeloVuelo(e) {
    if (e.objeto === 'lanza_endurecida') return crearModeloLanza();
    const g = new THREE.Group(), m = modeloArma(e.arma === 'piedras' ? 'piedras' : e.arma === 'arco' ? 'arco' : 'piedras', e.objeto || null);
    g.add(m); return g;
  }
  function volar(e) {
    const base = Number.isFinite(e.base) ? e.base : alturaEn(e.x, e.z), m = modeloVuelo(e);
    escena.add(m);
    vuelos.push({ autor: e.autor, m, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, base, t: 0 });
    c.volados = (c.volados || 0) + 1;
  }
  const _v = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  function pasoVuelos(dt) {
    for (let i = vuelos.length - 1; i >= 0; i--) {
      const v = vuelos[i];
      v.t += dt; v.vy -= TC.g * dt; v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt;
      const h = alturaEn(v.x, v.z);
      v.m.position.set(v.x, v.base + v.y, v.z);
      v.m.quaternion.setFromUnitVectors(_z, _v.set(v.vx, v.vy, v.vz).normalize());
      if (v.base + v.y <= h || v.t > 8) { escena.remove(v.m); vuelos.splice(i, 1); }
    }
  }
  function cayo(e) {   // el servidor dice dónde ha caído: fuera el que vuela de ese autor (el más antiguo)
    const i = vuelos.findIndex(v => v.autor === e.autor);
    if (i >= 0) { escena.remove(vuelos[i].m); vuelos.splice(i, 1); }
  }

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
      'tierras del rey': tr('Tierras del rey: aquí no puedes herir a otro jugador'),
    } : {
      herida: tr('Te hieren: {g} en {z}', { g, z }), parada: tr('Paras el golpe'), 'parada perfecta': tr('¡Parada perfecta! Contraataca ya'),
      'golpe maestro': tr('¡Golpe maestro! Desvías su golpe y el tuyo entra'), fallo: tr('El rival golpea al aire'),
      'tierras del rey': tr('Tierras del rey: su golpe no te hiere'),
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
    const clave = modo() + vis + !!c.tirando;
    if (clave !== c.vistaAntes) {
      c.vistaAntes = clave;
      bArma.hidden = modo() !== 'mover';
      mira.hidden = carga.hidden = !vis || (esTactil && !c.tirando);   // (en el móvil, la mira solo al apuntar)
      estadoEl.hidden = !vis; botones.hidden = !vis; rosa.hidden = rosaParar.hidden = !vis || !esTactil;
    }
    if (tMsg > 0) { tMsg -= dt; if (tMsg <= 0) msg.hidden = true; }
    pasoVuelos(dt);
    if (c.activo) armarDeMano();
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
      if (!b) { if (!enRed()) decir(tr('Golpe al aire')); continue; }   // en línea, lo que dé a otro jugador lo dice el servidor
      const res = resolver('jugador', b.id, e.linea);
      if (res) { decirResultado(res, true); efectos(res, c.modelo, b.m); }
    }
    // rivales
    for (const x of c.rivales) {
      let v = 0;
      if (!L.fuera && !x.L.fuera) {
        const m = x.ia.pensar(dt, L);
        if (m.mx || m.mz) {
          v = x.L.velocidad(m.correr);
          const p = andarHasta(x.L.x, x.L.z, x.L.x + m.mx * v * dt, x.L.z + m.mz * v * dt);
          x.L.x = p.x; x.L.z = p.z;
        }
      } else if (x.L.bloqueando) x.L.bloquear(false);
      for (const e of x.L.actualizar(dt, false)) if (e.tipo === 'impacto') {
        const res = resolver(x.id, 'jugador', e.linea);
        if (res) { decirResultado(res, false); efectos(res, x.m, c.modelo); }
      }
      if (!x.L.fuera) {   // apartarse de ti, pero sin meterse en una pared ni en el agua
        const x0 = x.L.x, z0 = x.L.z;
        separar(L, x.L);
        const p = andarHasta(x0, z0, x.L.x, x.L.z); x.L.x = p.x; x.L.z = p.z;
      }
      x.m.position.set(x.L.x, alturaEn(x.L.x, x.L.z), x.L.z);
      x.m.rotation.y = x.L.rot;
      pintarHeridas(x.m, x.L.heridas);
      animarCombatiente(x.m, x.L, dt, v, x.L.factorPiernas() < 0.9);
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
      mandar({ que: 'reiniciar' });
      c.L = new Luchador({ nombre: tr('Tú'), arma: armaMano().arma, prendas: prendasActuales(), ritmo: RITMO.normal, x: pj.x, z: pj.z, rot: pj.rot });
      c.ctx.luchadores.jugador = c.L;
      decir(tr('Te levantas (prueba: vuelves curado)'));
    }
    if (c.modelo) {
      c.modelo.position.set(pj.x, pj.y, pj.z);
      c.modelo.rotation.y = c.L.rot;
      pintarHeridas(c.modelo, c.L.heridas);
      animarCombatiente(c.modelo, c.L, dt, velocidad, c.L.factorPiernas() < 0.9);
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
    for (const cont of [mira, rosa, rosaParar]) for (const b of cont.querySelectorAll('b')) {
      const l = b.dataset.l;
      b.classList.toggle('sel', L.atacando() && L.linea === l);
      b.classList.toggle('para', L.bloqueando && L.lineaBloqueo === l);
      b.classList.toggle('viene', viene === l);
    }
    carga.firstChild.style.width = Math.round((L.accion === 'preparando' ? L.carga() : L.accion === 'tensando' ? L.tension : 0) * 100) + '%';
    estadoEl.querySelector('.barra i').style.width = Math.round(100 - L.cansancio) + '%';
    estadoEl.querySelector('.sangre').textContent = tr('Sangre {s} %', { s: Math.round(L.sangre) });
  }

  // ---------- Lo que dice el servidor (en línea) ----------
  // yo: el autor propio. La foto propia trae las heridas, la sangre y si has caído (lo que deciden los golpes de los
  // demás); los eventos de golpe propios o contra ti, el texto y la sacudida. Lo de los demás lo dibuja en_linea.js.
  function recibir(msg, yo, modeloDe = () => null) {
    if (!yo) return;
    // al conectar (o volver a conectar), el servidor sabe si llevas el arma sacada
    if (msg.tipo === 'bienvenida' && c.activo) mandar({ que: 'arma', sacada: true });
    if (msg.tipo === 'luchadores' || msg.tipo === 'bienvenida') {
      const f = (msg.tipo === 'luchadores' ? msg.lista : msg.luchadores || []).find(x => x.autor === yo);
      if (!f) return;
      if (!c.L) c.L = new Luchador({ nombre: tr('Tú'), arma: armaMano().arma, prendas: prendasActuales(), ritmo: RITMO.normal, x: pj.x, z: pj.z, rot: pj.rot });
      const caido = c.L.fuera;
      aplicarFoto(c.L, f, { propio: true, prediciendo: true });
      // de pie otra vez (tras volver a empezar sano en el servidor)
      if (!c.L.fuera && caido) { c.caidoHasta = 0; c.L.accion = 'libre'; }
      return;
    }
    if (msg.tipo !== 'combate') return;
    for (const e of msg.eventos || []) {
      if (e.tipo === 'disparo' || e.tipo === 'flecha') { tiros.push(e); if (tiros.length > 20) tiros.shift(); }   // (las pruebas)
      if (e.tipo === 'disparo') volar(e);
      if (e.tipo === 'flecha') { cayo(e); if (e.autor === yo && e.resultado === 'presa') decir(tr('¡Le has dado a la liebre!')); }
      if (e.tipo !== 'golpe' || (e.autor !== yo && e.objetivo !== yo)) continue;
      const res = resultadoDeEvento(e);
      const propio = e.autor === yo;
      if (propio && res.resultado === 'fallo' && blancoDelJugador()) continue;   // ya lo resolvió el rival de práctica
      decirResultado(res, propio);
      const otro = modeloDe(propio ? e.objetivo : e.autor);
      if (propio) efectos(res, c.modelo, otro); else efectos(res, otro, c.modelo);
    }
  }

  return {
    paso, sacar, guardar, llamarRival, fijar, recibir,
    get activo() { return c.activo; },
    // para el movimiento del mundo: con el arma sacada se anda como dice la lógica (cargando, parando, herido…)
    factorVelocidad(corriendo) { return c.activo && c.L ? c.L.velocidad(corriendo) / (corriendo ? 6 : 3.6) : 1; },
    // para las pruebas
    get L() { return c.L; }, get rivales() { return c.rivales; }, get fijado() { return c.fijado; }, get vuelos() { return vuelos; }, get tiros() { return tiros; }, get volados() { return c.volados || 0; },
    get modelo() { return c.modelo; }, empezarTiro, soltarTiro, puntoMira,
    raton: { mover: moverRaton, pulsar(b) { const l = c.lector.alPulsar(ahora()); if (b === 2) parar(true, l); else empezarGolpe(l); }, soltar(b) { if (b === 2) parar(false); else soltarGolpe(); } },
  };
}
