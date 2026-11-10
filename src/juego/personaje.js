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
import { nudillosA } from '../personajes/ik.js';
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
  modelo.matrix.makeBasis(x, y, f).setPosition(pm.multiplyScalar(1.15));
  modelo.matrix.decompose(modelo.position, modelo.quaternion, modelo.scale);
  // la mano tiene la escala del esqueleto: la herramienta se deja a su tamaño de verdad
  const e = new THREE.Vector3(); mano.getWorldScale(e); modelo.scale.divideScalar(e.x || 1);
  modelo.visible = false;
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
  if (tipo !== 'hacha_piedra' || globalThis.__sinModelosManos /* solo para comprobar que la prueba falla */) return modeloHacha();
  const g = deMano(loteHachaPiedra()); g.name = 'hacha_piedra';
  return g;
}

// Devuelve { raiz, animar(velocidad, dt, talando), mh }. `recursos`: la carpeta de personajes del taller
// (src/mundo/eleccion.js: recursosTaller); los de Meshy están a su lado, en meshy-v1. `sexo`: el del personaje elegido.
// `capas`, `aspecto` y `ropa` ({ tintes, hechuras }) se guardan para cuando los modelos de Meshy lleven ropa y aspecto.
const HACHAS_MANO = new Set(['hacha_mano', 'hacha_piedra', 'hacha_hierro', 'mazo_piedra']);
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
      ritmo = velocidad > 0.1 ? THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.andar || 1), 0.5, 1.6) : 0; m = 'arrastrar';
    // empujando la carretilla (src/juego/carretilla.js): algo inclinado, con los brazos bajos en las varas, andando o
    // quieto (la de empujar del taller, taller-carga-v3); sin ella, como al llevar algo en brazos
    } else if (j.empuja && j.mh.acciones.empujarCarretilla) {
      if (velocidad > 0.1) { ritmo = THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.andar || 1), 0.5, 1.6); m = 'empujarCarretilla'; } else m = 'empujarQuieto';
    } else if (j.empuja && j.mh.acciones.cargar) {
      ritmo = velocidad > 0.1 ? THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.andar || 1), 0.5, 1.6) : 0; m = 'cargar';
    } else if (j.cargaDos && m !== 'talar' && j.mh.acciones.cargar) { m = 'cargar'; if (velocidad <= 0.1) ritmo = 0; }
    // un tronco al hombro: la mano derecha arriba sujetándolo y el cuerpo algo inclinado, andando o quieto (taller-carga-v3).
    // Corriendo, la misma de andar, más deprisa (con el tronco al hombro no se corre suelto)
    else if (j.alHombro && m !== 'talar' && j.mh.acciones.hombro) {
      if (m === 'quieto') m = 'hombroQuieto';
      else { ritmo = THREE.MathUtils.clamp(velocidad / (j.mh.velocidad.andar || 1), 0.6, 1.8); m = 'hombro'; }
    }
    // dormir en la cama ligada (P4): se tumba (y se queda tumbado) y, al despertar, se levanta (taller-dormir-v1)
    // (tumbado del todo, la de dormir: los brazos a lo largo del cuerpo, no levantados como acaba la de tumbarse)
    // (el cuerpo de quien ha muerto, src/logica/muerte.js: ya tumbado del todo, sin la de tumbarse)
    if (j.durmiendo && j.muerto && j.mh.acciones.dormido) m = 'dormido';
    else if (j.durmiendo && j.mh.acciones.tumbarse) m = j.modo === 'dormido' || (j.modo === 'tumbarse' && j.mh.acciones.dormido && j.mh.acciones.tumbarse.time >= j.mh.acciones.tumbarse.getClip().duration - 0.05) ? 'dormido' : 'tumbarse';
    else if ((j.modo === 'tumbarse' || j.modo === 'dormido') && j.mh.acciones.levantarse) { m = 'levantarse'; j.levantaHasta = performance.now() + j.mh.acciones.levantarse.getClip().duration * 1000; }
    else if (j.modo === 'levantarse' && performance.now() < (j.levantaHasta || 0)) m = 'levantarse';
    // sentado en el suelo a descansar (P4, 8 nov; taller-sentarse-v1): quieto; al moverse, se levanta (main.js)
    else if (j.sentado && m === 'quieto' && j.mh.acciones.sentado) m = 'sentado';
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
    if (cada && j.cuadro % cada === 0) { j.mh.mezclador.update(j.dtPendiente); j.dtPendiente = 0; }
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
      nudillosA(b.r, ar, polo('r')); nudillosA(b.l, al, polo('l'));
      return true;
    }
    if (j.cargaDos && !j.empuja) {
      // delante del pecho, a 35 cm, y las manos a sus lados (a 20 cm del centro)
      const pecho = (j.mh.hueso.spine_03 || j.mh.hueso.spine_02).getWorldPosition(new THREE.Vector3());
      const c = pecho.addScaledVector(_f, 0.35).addScaledVector(_u, -0.22);
      nudillosA(b.r, c.clone().addScaledVector(_l, -0.2), polo('r'));
      nudillosA(b.l, c.clone().addScaledVector(_l, 0.2), polo('l'));
      return true;
    }
    return false;
  };
  j.animar = (...a) => {
    animarCuerpo(...a);
    const antes = colocarBrazos();
    llevado.paso();
    // el tronco al hombro sigue a la clavícula (no lo mueve el brazo): primero el tronco, luego la mano encima
    if (j.alHombro && j.mh && j.mh.meshy && !globalThis.__sinBrazosMeshy) {
      const p = llevado.agarreHombro();
      if (p) { const b = brazos(); if (!antes) { j.raiz.updateMatrixWorld(true); ejes(b); } nudillosA(b.r, p, polo('r').addScaledVector(_u, 1.4)); }
    }
  };
  return j;
}
