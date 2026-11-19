// Kinhold — el jugador (y los demás jugadores en línea): el hombre o la mujer de Meshy (src/personajes/meshy.js), con
// sus animaciones de la biblioteca de Meshy (valravnx, 10 nov: fuera los modelos de antes, el del taller, el de
// Quaternius y el muñeco de bloques). Mientras se carga no se ve nada (sale en un momento).
import * as THREE from 'three';
import { cajaR, deMano } from '../mundo/modelos.js';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { crearPersonajeMeshy, carpetaMeshy } from '../personajes/meshy.js';
export { carpetaMeshy };
import { NIVELES, OCULTO, RADIO_VISTA, nivelDetalle, pixelesEnPantalla } from '../logica/detalle.js';
import { crearLlevado } from './llevado.js';
import { nudillosA, girarHueso } from '../personajes/ik.js';
import { loteHachaPiedra, loteMazoPiedra } from './modelos_objetos.js';

// Niveles de detalle (src/logica/detalle.js): cada personaje mira lo alto que sale en pantalla desde la cámara que se
// le da aquí y pone el suyo. Sin cámara, todos enteros. `forzar`: un nivel fijo para todos (pruebas y capturas).
const vista = { camara: null, forzar: null };
export function camaraDetalle(camara, forzar = null) { vista.camara = camara; vista.forzar = forzar; }
// para medir: con false, todos enteros y dibujados (como antes de los niveles); niveles(): cuántos personajes hay en cada nivel
export function usarDetalle(si) { vista.apagado = !si; }
export const detalleEncendido = () => !vista.apagado;
const cuenta = new Set();
export function nivelesEnUso() { const r = [0, 0, 0, 0]; for (const j of cuenta) if (j.mh && j.raiz.parent) r[j.mh.nivel]++; return r; }
const _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _f = new THREE.Frustum(), _e = new THREE.Sphere();
function nivelPara(j) {
  if (vista.apagado) return 0;
  if (vista.forzar !== null) return vista.forzar;
  const c = vista.camara; if (!c) return 0;
  j.raiz.getWorldPosition(_p); _p.y += 0.9;
  // fuera de la vista de la cámara: no se dibuja
  _f.setFromProjectionMatrix(_m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
  if (!_f.intersectsSphere(_e.set(_p, RADIO_VISTA))) return OCULTO;
  const px = pixelesEnPantalla(_p.distanceTo(c.position), innerHeight, c.fov);
  return nivelDetalle(px, j.mh.nivel);
}

// Hacha de talar con el estilo v5 (como la del tocón de la prueba): mango de fresno con veta, algo curvado y más
// grueso abajo, cabeza de hierro con el filo más claro y la cuña que la sujeta. Mango a lo largo de +Y (la mano en el
// origen, cerca del extremo) y filo hacia +Z.
export function modeloHacha() {
  const L = new Lote({ variacion: 0.04, rangoSuelo: 0.001, suelo: -100 });
  L.add(cil(0.016, 0.02, 0.72, 8), 'tabla', 0, 0.26, 0, { x: 0.04 }, { tex: 'veta' });
  L.add(new THREE.SphereGeometry(0.022, 8, 5), 'tabla', 0, -0.1, -0.003, null, { escala: new THREE.Vector3(1, 0.7, 1.3), tex: 'veta' });
  const y = 0.56;
  L.add(cajaR(0.034, 0.075, 0.07, 0.01), 'hierro', 0, y, 0.016);                                        // ojo
  // pala que se abre hacia el filo (más larga por abajo, la «barba»), de perfil en el plano ZY y grosor en X
  const perfil = new THREE.Shape([[0.03, 0.028], [0.135, 0.058], [0.14, -0.075], [0.105, -0.07], [0.03, -0.028]].map(([z, yy]) => new THREE.Vector2(z, yy)));
  const pala = new THREE.ExtrudeGeometry(perfil, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 });
  pala.translate(0, 0, -0.006); pala.rotateY(-Math.PI / 2); // el perfil va de X a Z
  L.add(pala, 'hierro', 0, y, 0, null, { plano: true });
  L.add(cil(0.004, 0.004, 0.13, 4), 0x9a9b9a, 0, y - 0.008, 0.141, { x: 0.04 }, { escala: new THREE.Vector3(2.2, 1, 1), plano: true, brillo: 1.15 }); // filo afilado, más claro
  L.add(cajaR(0.03, 0.04, 0.03, 0.008), 'hierro', 0, y, -0.035);                                          // cotillo
  L.add(new THREE.CircleGeometry(0.014, 6), 'corte', 0, y + 0.0385, 0.016, { x: -Math.PI / 2 });          // cuña
  const g = deMano(L); g.name = 'hacha'; // como las armas: echa sombra sin recibirla y con sombreado plano
  return g;
}
// Pico de una mano con el estilo v5 (como el hacha): mango de fresno con veta y, arriba, la cabeza de hierro atravesada,
// con la punta hacia delante (+Z, hacia los nudillos, por donde se golpea), algo curvada hacia el mango como los de
// verdad, y por detrás una azuela corta y ancha (el pico de cantero y de minero medieval: punta y pala). Mango a lo
// largo de +Y con la mano en el origen, como el hacha.
export function modeloPico() {
  const L = new Lote({ variacion: 0.04, rangoSuelo: 0.001, suelo: -100 });
  L.add(cil(0.016, 0.02, 0.68, 8), 'tabla', 0, 0.24, 0, { x: -0.03 }, { tex: 'veta' });
  L.add(new THREE.SphereGeometry(0.022, 8, 5), 'tabla', 0, -0.1, 0.003, null, { escala: new THREE.Vector3(1, 0.7, 1.3), tex: 'veta' });
  const y = 0.55;
  L.add(cajaR(0.036, 0.07, 0.064, 0.01), 'hierro', 0, y, 0);                                              // ojo
  // un tramo de la cabeza: de (y0, z0) hacia delante (s = 1) o hacia atrás (s = -1), bajando el ángulo a (rad)
  const tramo = (y0, z0, s, a, largo, r0, r1, lados = 6, esc = null) => {
    const dy = -Math.sin(a), dz = s * Math.cos(a);
    L.add(cil(r1, r0, largo, lados), 'hierro', 0, y0 + dy * largo / 2, z0 + dz * largo / 2,
      { x: s > 0 ? Math.PI / 2 + a : -(Math.PI / 2 + a) }, { plano: true, escala: esc });
    return [y0 + dy * largo, z0 + dz * largo];
  };
  // la punta: tres tramos que se afinan y se curvan hacia el mango
  let [py, pz] = tramo(y + 0.006, 0.026, 1, 0.08, 0.09, 0.019, 0.015);
  [py, pz] = tramo(py, pz, 1, 0.22, 0.08, 0.015, 0.009);
  [py, pz] = tramo(py, pz, 1, 0.42, 0.06, 0.009, 0.002);
  L.add(new THREE.SphereGeometry(0.004, 5, 3), 0x8e8f8e, 0, py, pz, null, { plano: true, brillo: 1.15 });  // la punta, gastada y clara
  // la azuela de atrás: corta, aplastada y que se abre hacia el filo
  [py, pz] = tramo(y + 0.004, -0.026, -1, 0.1, 0.1, 0.018, 0.012, 4, new THREE.Vector3(2.4, 1, 0.55));
  L.add(cil(0.004, 0.004, 0.05, 4), 0x9a9b9a, 0, py - 0.002, pz - 0.002, { z: Math.PI / 2 }, { escala: new THREE.Vector3(1, 1, 1.6), plano: true, brillo: 1.15 }); // filo, más claro
  L.add(new THREE.CircleGeometry(0.013, 6), 'corte', 0, y + 0.0355, 0, { x: -Math.PI / 2 });              // cuña
  const g = deMano(L); g.name = 'pico';
  return g;
}

// Pone una herramienta (mango a lo largo de +Y, la mano en el origen) en la mano derecha: el mango atravesado a los
// dedos (del meñique al índice, la cabeza por el lado del pulgar) y el filo o la punta hacia los nudillos, como se
// agarra. Se calcula con los huesos, así vale para cualquier cuerpo. Sale escondida.
export function empunar(mh, modelo) {
  const h = mh.hueso, mano = h.hand_r, med = h.middle_01_r, ind = h.index_01_r, men = h.pinky_01_r;
  if (!mano || !med || !ind || !men) return null;
  mh.raiz.updateMatrixWorld(true);
  const loc = (b) => mano.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const pm = loc(med), f = pm.clone().normalize();                       // hacia los nudillos
  const y = loc(ind).sub(loc(men)); y.addScaledVector(f, -y.dot(f)).normalize(); // del meñique al índice
  const x = new THREE.Vector3().crossVectors(y, f);
  // (los de Meshy traen marcado el agarre: en la palma, junto a los nudillos; herramientas/meshy/poner_dedos.mjs)
  modelo.matrix.makeBasis(x, y, f).setPosition(h.agarre_r ? loc(h.agarre_r) : pm.multiplyScalar(1.15));
  modelo.matrix.decompose(modelo.position, modelo.quaternion, modelo.scale);
  // la mano tiene la escala del esqueleto: la herramienta se deja a su tamaño de verdad
  const e = new THREE.Vector3(); mano.getWorldScale(e); modelo.scale.divideScalar(e.x || 1);
  modelo.visible = false;
  modelo.userData.agarreUnaMano = { p: modelo.position.clone(), q: modelo.quaternion.clone(), s: modelo.scale.clone() };
  // no es del cuerpo: los niveles de detalle (src/personajes/detalle.js) no la tocan ni la cuentan
  modelo.traverse(o => { if (o.isMesh) o.userData.herramienta = true; });
  mano.add(modelo);
  return modelo;
}
// La herramienta que pide cada trabajo (la animación): sin ella, el gesto se ve con la mano vacía
export const HERRAMIENTA_DE = { talar: 'hacha', minar: 'pico' };
export const MODELOS_HERRAMIENTA = { hacha: modeloHacha, pico: modeloPico };
// El hacha de cada tipo (7 nov): la de piedra, con su cabeza de piedra atada (src/juego/modelos_objetos.js); las demás,
// la de hierro (el hacha de hierro aún no tiene modelo propio). Mismo sistema: mango en +Y, mano en el origen, filo a +Z.
export function modeloHachaDe(tipo) {
  // (el mazo de piedra, 8 nov, se lleva y se usa como el hacha: con el mismo gesto, contra la roca)
  if (tipo === 'mazo_piedra' && !globalThis.__sinModelosManos) { const g = deMano(loteMazoPiedra()); g.name = 'mazo_piedra'; return g; }
  // (el pico de hierro, P10, 19 nov: el de la fragua; se empuña como el hacha)
  if (tipo === 'pico' && !globalThis.__sinModelosManos) return modeloPico();
  if (tipo !== 'hacha_piedra' || globalThis.__sinModelosManos /* solo para comprobar que la prueba falla */) return modeloHacha();
  const g = deMano(loteHachaPiedra()); g.name = 'hacha_piedra';
  return g;
}

// Devuelve { raiz, animar(velocidad, dt, talando), mh }. `recursos`: la carpeta de personajes del taller
// (src/mundo/eleccion.js: recursosTaller); los de Meshy están a su lado, en meshy-v2. `sexo`: el del personaje elegido.
// `capas`, `aspecto` y `ropa` ({ tintes, hechuras }) se guardan para cuando los modelos de Meshy lleven ropa y aspecto.
const HACHAS_MANO = new Set(['hacha_mano', 'hacha_piedra', 'hacha_hierro', 'mazo_piedra', 'pico']);
// En la canoa (P11d), sentado con las rodillas juntas: la de sentarse en el suelo va con las piernas cruzadas y las rodillas
// abiertas (a unos 0,25 m de cada lado), y en el casco, de 0,45 m por dentro, se salían por la borda. Tras la animación, el
// muslo gira hacia dentro hasta que la rodilla queda a RODILLA_CANOA m del medio del cuerpo, y la pierna, hasta que el pie
// queda de su lado a PIE_CANOA m (no cruzado) y sin bajar del fondo, y el pie, con la punta hacia delante.
const RODILLA_CANOA = 0.12, PIE_CANOA = 0.08;
const _cen = new THREE.Vector3(), _der = new THREE.Vector3(), _rod = new THREE.Vector3(), _obj = new THREE.Vector3(), _qr = new THREE.Quaternion(), _ade = new THREE.Vector3();
function juntarRodillas(j) {
  const h = j.mh && j.mh.hueso;
  if (!h || (typeof window !== 'undefined' && window.__mutarRodillas)) return;   // (la prueba de la canoa lo rompe a propósito)
  j.raiz.updateMatrixWorld(true);
  j.raiz.getWorldPosition(_cen);
  _der.set(1, 0, 0).applyQuaternion(j.raiz.getWorldQuaternion(_qr));
  for (const l of ['l', 'r']) {
    const muslo = h['thigh_' + l], pierna = h['calf_' + l], pie = h['foot_' + l];
    if (!muslo || !pierna || !muslo.parent) continue;
    pierna.getWorldPosition(_rod);
    const lado = _obj.copy(_rod).sub(_cen).dot(_der);
    if (Math.abs(lado) > RODILLA_CANOA) {
      _obj.copy(_rod).addScaledVector(_der, Math.sign(lado) * RODILLA_CANOA - lado);
      girarHueso(muslo, _rod, _obj);
    }
    // y el pie, de su lado y no cruzado debajo de la otra pierna (con el muslo girado, se iba por la otra borda)
    if (!pie) continue;
    const s = Math.sign(lado) || (l === 'l' ? 1 : -1);
    pie.getWorldPosition(_rod);
    const ladoPie = _obj.copy(_rod).sub(_cen).dot(_der);
    _obj.copy(_rod).addScaledVector(_der, s * PIE_CANOA - ladoPie);
    _obj.y = Math.max(_obj.y, _cen.y + 0.04);
    girarHueso(pierna, _rod, _obj);
    // y la punta del pie, hacia delante (hacia la proa): de lado, los dedos asomaban por la borda
    const dedos = h['ball_' + l];
    if (!dedos) continue;
    pie.getWorldPosition(_obj);
    dedos.getWorldPosition(_rod);
    const largo = _rod.distanceTo(_obj);
    _ade.set(0, 0, 1).applyQuaternion(_qr);
    _obj.addScaledVector(_ade, largo); _obj.y = Math.max(_obj.y, _cen.y + 0.04);   // (sin bajar del fondo)
    girarHueso(pie, _rod, _obj);
  }
}

export function crearJugador(recursos, sexo = 'hombre', capas = ['descalzo'], aspecto = undefined, ropa = {}) {
  const raiz = new THREE.Group();
  const j = { raiz, mh: null, error: null, modo: 'quieto' };
  j.listo = crearPersonajeMeshy({ sexo, capas, aspecto, tintes: ropa.tintes, hechuras: ropa.hechuras }, carpetaMeshy(recursos)).then(mh => {
    raiz.add(mh.raiz);
    j.mh = mh;
    j.hacha = empunar(mh, modeloHachaDe(j.tipoHacha)); j.hachaPuesta = j.tipoHacha;
    cuenta.add(j);
  }).catch(e => { j.error = e.message || String(e); console.warn('Personaje no cargado:', e); });
  j.animar = (velocidad, dt, talando = false) => {
    if (!j.mh) return;
    // andar despacio (joystick a medias), correr a partir de 1,8 m/s; la animación se acelera con la velocidad,
    // hasta 1,6× (más rápido se ve atropellado; a 6 m/s los pies resbalan algo)
    let m = 'quieto', ritmo = 1;
    if (velocidad > 0.1) {
      m = velocidad < 1.8 ? 'andar' : 'correr'; ritmo = velocidad / (j.mh.velocidad[m] || 1); // natural, medida al cargar
      ritmo = THREE.MathUtils.clamp(ritmo, 0.6, 1.6);
    } else if (talando) m = 'talar';
    // con algo grande en las dos manos (src/juego/llevado.js), los brazos lo sujetan delante; quieto, la misma postura
    // arrastrando la rastra (src/juego/rastra.js): inclinado, con las manos atrás en las varas; quieto, la misma postura
    if (j.arrastra && j.mh.acciones.arrastrar) {
      ritmo = velocidad > 0.1 ? THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.arrastrar || j.mh.velocidad.andar || 1), 0.5, 1.6) : 0; m = 'arrastrar';
    // empujando la carretilla (src/juego/carretilla.js): algo inclinado, con los brazos bajos en las varas, andando o
    // quieto (la de empujar del taller, taller-carga-v3); sin ella, como al llevar algo en brazos
    } else if (j.empuja && j.mh.acciones.empujarCarretilla) {
      if (velocidad > 0.1) { ritmo = THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.empujarCarretilla || j.mh.velocidad.andar || 1), 0.5, 1.6); m = 'empujarCarretilla'; } else m = 'empujarQuieto';
    } else if (j.empuja && j.mh.acciones.cargar) {
      ritmo = velocidad > 0.1 ? THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.cargar || j.mh.velocidad.andar || 1), 0.5, 1.6) : 0; m = 'cargar';
    } else if (j.cargaDos && m !== 'talar' && j.mh.acciones.cargar) { m = 'cargar'; if (velocidad <= 0.1) ritmo = 0; }
    // un tronco al hombro: la mano derecha arriba sujetándolo y el cuerpo algo inclinado, andando o quieto (taller-carga-v3).
    // Corriendo, la misma de andar, más deprisa (con el tronco al hombro no se corre suelto)
    else if (j.alHombro && m !== 'talar' && j.mh.acciones.hombro) {
      if (m === 'quieto') m = 'hombroQuieto';
      else { ritmo = THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.hombro || j.mh.velocidad.andar || 1), 0.6, 1.8); m = 'hombro'; }
    }
    // dormir en la cama ligada (P4): se tumba (y se queda tumbado) y, al despertar, se levanta (taller-dormir-v1)
    // (tumbado del todo, la de dormir: los brazos a lo largo del cuerpo, no levantados como acaba la de tumbarse)
    // (el cuerpo de quien ha muerto, src/logica/muerte.js: ya tumbado del todo, sin la de tumbarse)
    if (j.durmiendo && j.muerto && j.mh.acciones.dormido) m = 'dormido';
    else if (j.durmiendo && j.mh.acciones.tumbarse) m = j.modo === 'dormido' || (j.modo === 'tumbarse' && j.mh.acciones.dormido && j.mh.acciones.tumbarse.time >= j.mh.acciones.tumbarse.getClip().duration - 0.05) ? 'dormido' : 'tumbarse';
    else if ((j.modo === 'tumbarse' || j.modo === 'dormido') && j.mh.acciones.levantarse) { m = 'levantarse'; j.levantaHasta = performance.now() + j.mh.acciones.levantarse.getClip().duration * 1000; }
    else if (j.modo === 'levantarse' && performance.now() < (j.levantaHasta || 0)) m = 'levantarse';
    // sentado en el suelo a descansar (P4, 8 nov; taller-sentarse-v1): quieto; al moverse, se levanta (main.js)
    // (y en la canoa, P11d: con el remo en las dos manos, sentado igual; la pose de remar, de valravnx, cuando llegue)
    else if (j.sentado && (m === 'quieto' || m === 'cargar' || m === 'hombroQuieto') && velocidad <= 0.1 && j.mh.acciones.sentado) m = 'sentado';
    if (m === 'dormido' || m === 'sentado') ritmo = 1;
    if (m === 'tumbarse' || m === 'levantarse') { ritmo = 1; const a = j.mh.acciones[m]; if (a.loop !== THREE.LoopOnce) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
    if (m !== j.modo) { j.mh.poner(m, 0.2); j.modo = m; }
    if (j.hacha) j.hacha.visible = m === 'talar' || !!j.hachaEnMano;   // también si la llevas en la mano (inventario)
    j.mh.acciones[m].timeScale = ritmo;
    // el nivel de detalle; lejos, los huesos se mueven cada pocos fotogramas (con el tiempo de todos), y si no se ve, no
    const n = nivelPara(j);
    if (n !== j.mh.nivel) j.mh.ponerNivel(n);
    const cada = n < NIVELES.length ? NIVELES[n].cada : 0;
    j.dtPendiente = (j.dtPendiente || 0) + dt;
    j.cuadro = (j.cuadro || 0) + 1;
    if (cada && j.cuadro % cada === 0) { j.mh.mezclador.update(j.dtPendiente); j.dtPendiente = 0; if (m === 'sentado' && j.enCanoa) juntarRodillas(j); }
    else if (!cada) j.dtPendiente = Math.min(j.dtPendiente, 1);
  };
  // lo que llevas se ve puesto (src/juego/llevado.js): ponerLlevado(lo de src/logica/llevado.js); va con los huesos
  const llevado = crearLlevado(j), animarCuerpo = j.animar;
  j.llevado = llevado;
  // el hacha que se ve en la mano (y al talar) es la que lleva en las manos: la de piedra o la de hierro
  const ponerHacha = () => {
    if (!j.mh || j.hachaPuesta === j.tipoHacha) return;
    const visible = j.hacha ? j.hacha.visible : false;
    if (j.hacha) { j.hacha.parent?.remove(j.hacha); j.hacha.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
    j.hacha = empunar(j.mh, modeloHachaDe(j.tipoHacha)); j.hachaPuesta = j.tipoHacha;
    if (j.hacha) j.hacha.visible = visible;
  };
  j.ponerLlevado = (l) => {
    j.llevadoPedido = l; j.cargaDos = !!(l && l.dos); j.alHombro = !!(l && (l.hombro === 'tronco_corto' || l.hombro === 'tronco_delgado'));
    const h = l && [l.der, l.izq].find(t => HACHAS_MANO.has(t));
    j.hachaEnMano = !!h;                                   // también la de los demás jugadores (en línea)
    if (h) { j.tipoHacha = h; ponerHacha(); }
    if (j.mh) llevado.poner(l);
  };
  j.listo.then(() => { ponerHacha(); if (j.mh && j.llevadoPedido) llevado.poner(j.llevadoPedido); });
  // los brazos donde agarran (los de Meshy no traen esas posturas): lo grande en brazos, delante del pecho y entre las dos
  // manos; las agarraderas de la carretilla; y el tronco al hombro, con la mano derecha encima
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _f = new THREE.Vector3(), _l = new THREE.Vector3(), _u = new THREE.Vector3();
  const brazos = () => {
    const h = j.mh.hueso;
    return { r: { sup: h.upperarm_r, inf: h.lowerarm_r, mano: h.hand_r, nudillo: h.middle_01_r }, l: { sup: h.upperarm_l, inf: h.lowerarm_l, mano: h.hand_l, nudillo: h.middle_01_l } };
  };
  // adelante (del pie a la punta), a la izquierda (del hombro derecho al izquierdo) y arriba, en el mundo
  const ejes = (b) => {
    const h = j.mh.hueso;
    _f.subVectors(h.ball_l.getWorldPosition(_p), h.foot_l.getWorldPosition(_q)).setY(0).normalize();
    _l.subVectors(b.l.sup.getWorldPosition(_p), b.r.sup.getWorldPosition(_q)).setY(0).normalize();
    _u.set(0, 1, 0);
  };
  const polo = (lado) => new THREE.Vector3().addScaledVector(_l, lado === 'l' ? 0.6 : -0.6).addScaledVector(_u, -1).addScaledVector(_f, -0.35);
  // Remar (17 nov, valravnx: «animación de empujar por un lado, de un tironcillo… por el otro… de manera realista»;
  // provisional, hasta la animación de verdad). Por la fase de la palada (src/logica/canoa.js, faseRemada: la primera
  // mitad, la pala en el agua; la segunda, fuera y volviendo): el pecho gira hacia el lado de la palada y se echa adelante
  // al meter el remo, y se endereza tirando; el remo va con el puño arriba, sobre la borda, y la pala entra delante, tira
  // hasta la cadera, sale y vuelve por el aire (al otro lado si la siguiente va por el otro); las dos manos, en la caña:
  // la de arriba en el puño y la del lado de la palada abajo, cerca de la pala (al cambiar de lado se deslizan por ella).
  // Deja en j.palaRemo dónde van el puño y el centro de la pala, en el mundo (src/juego/llevado.js pone ahí el remo).
  const _T = new THREE.Vector3(), _B = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  const suave = x => x * x * (3 - 2 * x);
  const remar = (b) => {
    // (sin remar, el remo descansa atravesado delante, sobre las bordas, con la pala fuera por la derecha: con la postura
    // de llevarlo en las dos manos, sentado, la caña atravesaba el cuerpo)
    const quieto = !j.remada;
    const R = j.remada || { lado: 'r', fase: 0, enAgua: true, barre: false }, h = j.mh.hueso, pecho = h.spine_03 || h.spine_02;
    if (!pecho || !h.spine_01) return false;
    _f.set(0, 0, 1).applyQuaternion(j.raiz.getWorldQuaternion(_q1)).setY(0).normalize(); _l.crossVectors(_u, _f).normalize();
    const s = R.lado === 'l' ? 1 : -1, agua = R.fase < 0.5, k = agua ? suave(R.fase / 0.5) : suave((R.fase - 0.5) / 0.5);
    const s2 = R.barre ? s : -s;   // (la siguiente: por el mismo lado si está girando; si no, por el otro)
    // el pecho: girado hacia el lado de la palada al meter el remo (el hombro de abajo, adelante), y echado adelante
    const giro = quieto ? 0 : agua ? (0.38 + (-0.12 - 0.38) * k) * -s : (-0.12 * -s) + ((0.38 * -s2) - (-0.12 * -s)) * k;
    const echado = quieto ? 0.05 : agua ? 0.22 * (1 - k) : 0.22 * k;
    const gira = (hueso, q) => { hueso.getWorldQuaternion(_q2); hueso.parent.getWorldQuaternion(_q3); hueso.quaternion.copy(_q3.invert().multiply(q.multiply(_q2))); hueso.updateMatrixWorld(true); };
    gira(h.spine_01, _q1.setFromAxisAngle(_l, echado * 0.6));
    gira(pecho, _q1.setFromAxisAngle(_u, giro));
    // (las medidas, desde la raíz del personaje, que en la canoa va a ras del agua: x a la izquierda, y arriba, z adelante)
    const P = (fw, lat, up, out) => j.raiz.localToWorld(out.set(lat, up, fw));
    const ancho = R.barre ? 0.62 : 0.5;   // (la de girar, más abierta)
    // el puño, delante de la barbilla y casi en el medio (con los brazos del personaje, si cruza hacia el lado de la palada
    // el brazo de arriba va estirado a la altura del hombro y pasa por el cuello): al meter, al sacar
    const T0 = (sd, o) => P(0.3, sd * 0.02, 0.5, o), T1 = (sd, o) => P(0.25, sd * 0.08, 0.45, o);
    const B0 = (sd, o) => P(0.5, sd * ancho, -0.15, o), B1 = (sd, o) => P(R.barre ? -0.45 : -0.32, sd * ancho, -0.1, o);   // hacia la pala
    const a = new THREE.Vector3(), e = new THREE.Vector3();
    if (quieto) { P(0.32, 0.3, 0.3, _T); P(0.3, -0.9, 0.24, _B); }
    else if (agua) { _T.lerpVectors(T0(s, a), T1(s, e), k); _B.lerpVectors(B0(s, a), B1(s, e), k); }
    else {
      // fuera del agua: la pala sale baja, junto a la cadera, y vuelve adelante; si cambia de lado, pasa por delante del
      // pecho, el remo casi tumbado de un lado a otro (una curva que pasa por M a mitad de camino)
      _T.lerpVectors(T1(s, a), T0(s2, e), k).addScaledVector(_u, Math.sin(Math.PI * k) * 0.06);
      // (al cambiar de lado, la pala cruza por delante, por encima de la proa y más baja que el puño: el remo casi tumbado,
      // no de punta hacia arriba)
      const M = s2 !== s ? P(0.95, 0, 0.45, new THREE.Vector3()) : P(0.25, s * (ancho + 0.1), 0.35, new THREE.Vector3());
      B1(s, a); B0(s2, e);
      const c1 = M.multiplyScalar(2).addScaledVector(a, -0.5).addScaledVector(e, -0.5);
      _B.copy(a).multiplyScalar((1 - k) * (1 - k)).addScaledVector(c1, 2 * k * (1 - k)).addScaledVector(e, k * k);
      // (y sale enseguida del agua: sube el remo entero, puño y pala, sin ponerse de punta)
      const sube = Math.sin(Math.PI * Math.min(1, k * 1.6)) * (s2 !== s ? 0.25 : 0.3); _B.addScaledVector(_u, sube); _T.addScaledVector(_u, sube * 0.5);
    }
    // (el remo es rígido: la pala, a su largo del puño, 1,22 m al centro de la pala, en esa dirección)
    const dir = _B.sub(_T).normalize();
    j.palaRemo = { puno: _T.clone(), pala: _T.clone().addScaledVector(dir, 1.22) };
    // las manos: arriba, en el puño; abajo, por la caña, a 0,5 m de él (la del lado de la palada)
    const abajo = _T.clone().addScaledVector(dir, 0.5), arriba = _T.clone();
    const sitio = (lado, sd) => ((lado === 'l') === (sd > 0) ? abajo : arriba);
    const mano = (lado) => (agua ? sitio(lado, s) : sitio(lado, s).clone().lerp(sitio(lado, s2), k));
    // (los codos, abajo y hacia fuera: con el puño delante del pecho, el codo de la mano de arriba se subía a la altura del
    // hombro y se metía en el cuello, y desde detrás parecía el brazo por la nuca)
    const poloR = new THREE.Vector3().addScaledVector(_l, -0.6).addScaledVector(_u, -1).addScaledVector(_f, 0.1);
    const poloL = new THREE.Vector3().addScaledVector(_l, 0.6).addScaledVector(_u, -1).addScaledVector(_f, 0.1);
    // (la palma, no el nudillo, sobre la caña: el nudillo se pone donde toca, se mira dónde ha quedado la palma y se corrige
    // lo que le falta, dos veces; y el remo pasa luego por las dos palmas, como al llevarlo de pie, para que no quede en el
    // aire si el brazo no llega del todo)
    const palma = (lado) => b[lado].mano.getWorldPosition(new THREE.Vector3()).lerp(b[lado].nudillo.getWorldPosition(new THREE.Vector3()), 0.6);
    const quiere = { r: mano('r'), l: mano('l') }, apunta = { r: quiere.r.clone(), l: quiere.l.clone() };
    for (let i = 0; i < 3; i++) {
      nudillosA(b.r, apunta.r, poloR); nudillosA(b.l, apunta.l, poloL);
      if (i < 2 && !globalThis.__mutarPalmas) for (const lado of ['r', 'l']) apunta[lado].add(quiere[lado].clone().sub(palma(lado)));
    }
    if (!globalThis.__mutarPalmas) {
      // (lo que no llega el brazo, el remo lo sigue: la caña pasa por las dos palmas, sin cambiar dónde la agarra cada una;
      // si están muy juntas, al cambiar de lado, solo por la de más arriba y con su inclinación de antes)
      const P0 = j.palaRemo.puno, D = j.palaRemo.pala.clone().sub(P0).normalize();
      const pr = palma('r'), pl = palma('l'), tr = pr.clone().sub(P0).dot(D), tl = pl.clone().sub(P0).dot(D);
      const [A, tA, B, tB] = tr < tl ? [pr, tr, pl, tl] : [pl, tl, pr, tr];
      // (y solo si la caña entre las palmas va más o menos como el remo: si no, al cambiar de lado, las manos aún a medio
      // camino la ponían atravesando el cuerpo)
      const cosPalmas = B.clone().sub(A).normalize().dot(D);
      const w = Math.min(1, Math.max(0, (tB - tA - 0.15) / 0.15)) * Math.min(1, Math.max(0, (cosPalmas - 0.85) / 0.1)), D2 = D.clone().lerp(B.clone().sub(A).normalize(), w).normalize();   // (sin saltos)
      const puno = A.clone().addScaledVector(D2, -tA);
      j.palaRemo = { puno, pala: puno.clone().addScaledVector(D2, 1.22) };
    }
    return true;
  };
  const colocarBrazos = () => {
    if (!j.mh || !j.mh.meshy || !j.mh.raiz.visible || globalThis.__sinBrazosMeshy /* solo para comprobar que las pruebas fallan */) return false;
    const b = brazos(); if (!b.r.sup || !b.l.sup || !j.mh.hueso.ball_l) return false;
    j.raiz.updateMatrixWorld(true);
    ejes(b);
    if (j.empuja && j.agarraderas && j.agarraderas.length >= 2) {
      // cada mano, a la agarradera que tiene más cerca
      const ag = j.agarraderas.map(a => a.getWorldPosition(new THREE.Vector3()));
      const mr = b.r.mano.getWorldPosition(_p);
      const [ar, al] = ag[0].distanceTo(mr) <= ag[1].distanceTo(mr) ? [ag[0], ag[1]] : [ag[1], ag[0]];
      // el cuerpo de frente a las varas y, si los brazos no llegan, echado hacia delante (los de Meshy los tienen cortos)
      const h = j.mh.hueso, pecho = h.spine_03 || h.spine_02;
      if (pecho && h.spine_01) {
        const c = pecho.getWorldPosition(new THREE.Vector3()), sr = b.r.sup.getWorldPosition(new THREE.Vector3());
        const quiero = sr.clone().sub(c); quiero.addScaledVector(_f, -quiero.dot(_f));
        girarHueso(pecho, sr, c.clone().add(quiero));
        const alcance = 0.95 * (b.r.sup.getWorldPosition(_p).distanceTo(b.r.inf.getWorldPosition(_q)) + b.r.inf.getWorldPosition(_p).distanceTo(b.r.mano.getWorldPosition(_q)) + 0.085);
        const falta = Math.max(ar.distanceTo(b.r.sup.getWorldPosition(_p)), al.distanceTo(b.l.sup.getWorldPosition(_q))) - alcance;
        if (falta > 0) { const k = Math.min(falta * 1.3, 0.35), c2 = pecho.getWorldPosition(new THREE.Vector3()); girarHueso(h.spine_01, c2, c2.clone().addScaledVector(_f, k).addScaledVector(_u, -k * 0.4)); }
      }
      nudillosA(b.r, ar, polo('r')); nudillosA(b.l, al, polo('l'));
      return true;
    }
    if (j.cargaDos && j.enCanoa && j.llevadoPedido && j.llevadoPedido.der === 'remo' && !globalThis.__sinRemar) return remar(b);
    if (j.cargaDos && !j.empuja) {
      // delante del pecho, a 35 cm, y las manos a sus lados (a 20 cm del centro)
      const pecho = (j.mh.hueso.spine_03 || j.mh.hueso.spine_02).getWorldPosition(new THREE.Vector3());
      // la rodaja (P11c), por el canto: las manos a las 3 y a las 9 de la rueda (mide 48 cm de ancho), algo más abajo
      // para que los brazos lleguen con la rueda entera delante del pecho
      const rueda = j.llevadoPedido && j.llevadoPedido.der === 'rodaja';
      // el remo (P11d), por la caña: las manos más abiertas y algo más delante, para que la caña no roce la cadera
      const remo = j.llevadoPedido && j.llevadoPedido.der === 'remo', lado = rueda ? 0.25 : remo ? 0.27 : 0.2;
      // (la rodaja, con el delante y la izquierda del cuerpo entero, no del pie: en la postura de llevar en brazos el pie
      // va algo girado y la rueda, más ancha que un tronco, se iba hacia un lado)
      if (rueda || remo) { _f.set(0, 0, 1).applyQuaternion(j.raiz.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize(); _l.crossVectors(_u, _f).normalize(); }
      const c = pecho.addScaledVector(_f, rueda ? 0.32 : remo ? 0.4 : 0.35).addScaledVector(_u, rueda ? -0.28 : -0.22);
      nudillosA(b.r, c.clone().addScaledVector(_l, -lado), polo('r'));
      nudillosA(b.l, c.clone().addScaledVector(_l, lado), polo('l'));
      return true;
    }
    return false;
  };
  j.animar = (...a) => {
    animarCuerpo(...a);
    // con el hacha o el pico trabajando (los de Meshy, con la animación a dos manos): el mango pasa por las dos manos en
    // cada fotograma, la izquierda junto al pomo, la cabeza más allá de la derecha y el filo hacia delante (antes iba fijo a
    // la mano derecha y la cabeza se metía en la del personaje: lo vio la revisión de las capturas)
    if (j.mh && j.mh.meshy && j.hacha && j.hacha.visible && (j.modo === 'talar' || j.modo === 'minar') && j.mh.hueso.agarre_l && !globalThis.__unaMano) {
      const h = j.mh.hueso, mano = h.hand_r;
      j.raiz.updateMatrixWorld(true);
      const aR = h.agarre_r.getWorldPosition(new THREE.Vector3()), aL = h.agarre_l.getWorldPosition(new THREE.Vector3());
      // el mango, de la mano izquierda (junto al pomo) a la derecha, y la cabeza más allá; con las manos muy juntas la línea
      // entre ellas no vale y se sigue con la de antes (guardada respecto a la mano derecha, para que gire con ella)
      const y = aR.clone().sub(aL);
      const giroMano = new THREE.Quaternion(); mano.getWorldQuaternion(giroMano);
      if (y.length() >= 0.1) { y.normalize(); j.hacha.userData.ejeLocal = y.clone().applyQuaternion(giroMano.clone().invert()); }
      else if (j.hacha.userData.ejeLocal) y.copy(j.hacha.userData.ejeLocal).applyQuaternion(giroMano);
      if (y.lengthSq() > 1e-6) {
        y.normalize();
        const z = new THREE.Vector3(0, 0, 1).transformDirection(j.raiz.matrixWorld); z.addScaledVector(y, -z.dot(y));
        if (z.lengthSq() < 1e-6) z.set(0, 1, 0).addScaledVector(y, -y.y);
        z.normalize();
        const x = new THREE.Vector3().crossVectors(y, z);
        const mundo = new THREE.Matrix4().makeBasis(x, y, z).setPosition(aL.clone().addScaledVector(y, 0.05)); // a 5 cm del origen (el pomo está a −0,1)
        const local = mano.matrixWorld.clone().invert().multiply(mundo);
        local.decompose(j.hacha.position, j.hacha.quaternion, j.hacha.scale);
        const e = new THREE.Vector3(); mano.getWorldScale(e); j.hacha.scale.set(1 / e.x, 1 / e.y, 1 / e.z);
        j.hacha.userData.aDosManos = true;
      }
    } else if (j.hacha && j.hacha.userData.aDosManos && j.hacha.userData.agarreUnaMano) {
      // de vuelta a una mano: como lo puso empunar
      j.hacha.userData.aDosManos = false;
      j.hacha.position.copy(j.hacha.userData.agarreUnaMano.p); j.hacha.quaternion.copy(j.hacha.userData.agarreUnaMano.q); j.hacha.scale.copy(j.hacha.userData.agarreUnaMano.s);
    }
    // las manos cerradas en O sobre lo que agarran (el hacha o lo que va en la mano, el tronco al hombro, la carretilla,
    // lo que se lleva en brazos); abiertas si no
    if (j.mh && j.mh.cerrarMano) {
      const l = j.llevadoPedido;
      j.mh.cerrarMano('r', (j.hacha && j.hacha.visible) || (l && l.der) || j.empuja || j.cargaDos || j.alHombro || j.arrastra ? 1 : 0);
      j.mh.cerrarMano('l', (l && l.izq) || j.empuja || j.cargaDos || j.arrastra ? 1 : 0);
    }
    if (!j.enCanoa) j.palaRemo = null;
    const antes = colocarBrazos();
    llevado.paso();
    // el tronco al hombro sigue a la clavícula (no lo mueve el brazo): primero el tronco, luego la mano encima
    if (j.alHombro && j.mh && j.mh.meshy && !globalThis.__sinBrazosMeshy) {
      const p = llevado.agarreHombro();
      if (p) { const b = brazos(); if (!antes) { j.raiz.updateMatrixWorld(true); ejes(b); } nudillosA(b.r, p, new THREE.Vector3().addScaledVector(_f, 1).addScaledVector(_u, 0.6).addScaledVector(_l, -0.3)); } // (el codo delante, a la altura del hombro: la mano cae sobre el tronco)
    }
  };
  return j;
}
