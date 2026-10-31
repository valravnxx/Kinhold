// Kinhold — el jugador de la construcción: el personaje del taller propio (MakeHuman vestido por código, con las
// animaciones de Quaternius) con camisa y calzas de lino y descalzo, como empieza según el GDD (los pies descalzos
// están desde la taller-v12).
// Mientras se carga (o si no se puede cargar, p. ej. abriendo el html suelto sin servidor) se ve el muñeco inicial.
import * as THREE from 'three';
import { mat, cajaR, deMano } from '../mundo/modelos.js';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { crearPersonajeMH } from '../personajes/makehuman.js';
import { NIVELES, OCULTO, RADIO_VISTA, nivelDetalle, pixelesEnPantalla } from '../logica/detalle.js';
import { crearLlevado } from './llevado.js';

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

const PIEL = 0xd6a77a, LINO = 0xd9cfb8, LINO_OSC = 0xbfb498, PELO = 0x4a3324, CORDEL = 0x8a7a55;


function pieza(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// muñeco provisional (el de siempre), solo mientras carga el del taller
function crearMuneco() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const piernas = [];
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(lado * 0.12, 0.9, 0);
    cadera.add(pieza(new THREE.BoxGeometry(0.17, 0.78, 0.2), LINO_OSC, 0, -0.39, 0));
    cadera.add(pieza(new THREE.BoxGeometry(0.15, 0.1, 0.26), PIEL, 0, -0.85, 0.04));
    cuerpo.add(cadera);
    piernas.push(cadera);
  }
  cuerpo.add(pieza(new THREE.BoxGeometry(0.46, 0.62, 0.26), LINO, 0, 1.22, 0));
  cuerpo.add(pieza(new THREE.BoxGeometry(0.48, 0.06, 0.28), CORDEL, 0, 0.93, 0));
  const brazos = [];
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.3, 1.48, 0);
    hombro.add(pieza(new THREE.BoxGeometry(0.13, 0.42, 0.14), LINO, 0, -0.21, 0));
    hombro.add(pieza(new THREE.BoxGeometry(0.11, 0.24, 0.12), PIEL, 0, -0.52, 0));
    cuerpo.add(hombro);
    brazos.push(hombro);
  }
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.62, 0);
  cabeza.add(pieza(new THREE.BoxGeometry(0.1, 0.1, 0.1), PIEL, 0, 0.02, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.15, 0), PIEL, 0, 0.2, 0));
  cabeza.add(pieza(new THREE.IcosahedronGeometry(0.155, 0), PELO, 0, 0.26, -0.03));
  cuerpo.add(cabeza);
  g.userData = { piernas, brazos, cuerpo, fase: 0 };
  return g;
}
function animarMuneco(g, velocidad, dt) {
  const u = g.userData;
  if (velocidad > 0.1) {
    u.fase += dt * velocidad * 2.4;
    const a = Math.sin(u.fase) * Math.min(0.7, velocidad * 0.16);
    u.piernas[0].rotation.x = a; u.piernas[1].rotation.x = -a;
    u.brazos[0].rotation.x = -a * 0.8; u.brazos[1].rotation.x = a * 0.8;
    u.cuerpo.position.y = Math.abs(Math.cos(u.fase)) * 0.03;
  } else {
    for (const p of [...u.piernas, ...u.brazos]) p.rotation.x *= 0.8;
    u.cuerpo.position.y *= 0.8;
  }
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
// Pone el hacha en la mano derecha: el mango atravesado a los dedos (del meñique al índice, la cabeza por el lado
// del pulgar) y el filo hacia los nudillos, como se agarra. Se calcula con los huesos, así vale para cualquier cuerpo.
function empunarHacha(mh) {
  const h = mh.hueso, mano = h.hand_r, med = h.middle_01_r, ind = h.index_01_r, men = h.pinky_01_r;
  if (!mano || !med || !ind || !men) return null;
  mh.raiz.updateMatrixWorld(true);
  const loc = (b) => mano.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const pm = loc(med), f = pm.clone().normalize();                       // hacia los nudillos
  const y = loc(ind).sub(loc(men)); y.addScaledVector(f, -y.dot(f)).normalize(); // del meñique al índice
  const x = new THREE.Vector3().crossVectors(y, f);
  const hacha = modeloHacha();
  hacha.matrix.makeBasis(x, y, f).setPosition(pm.multiplyScalar(1.15));
  hacha.matrix.decompose(hacha.position, hacha.quaternion, hacha.scale);
  // la mano tiene la escala del esqueleto: el hacha se deja a su tamaño de verdad
  const e = new THREE.Vector3(); mano.getWorldScale(e); hacha.scale.divideScalar(e.x || 1);
  hacha.visible = false;
  mano.add(hacha);
  return hacha;
}

// Devuelve { raiz, animar(velocidad, dt, talando), cargado(), modo(), mh }. `recursos`: carpeta de los .glb del taller.
// `sexo`, `capas` y `aspecto`: los del personaje elegido en el visor (por defecto, hombre con camisa y calzas, descalzo).
// `ropa`: { tintes, hechuras } de lo que lleva puesto (src/logica/hechura.js: vestidoDe); sin ella, los de siempre.
export function crearJugador(recursos, sexo = 'hombre', capas = ['descalzo'], aspecto = undefined, ropa = {}) {
  const raiz = new THREE.Group();
  const muneco = crearMuneco();
  raiz.add(muneco);
  const j = { raiz, mh: null, error: null, modo: 'quieto' };
  j.listo = crearPersonajeMH({ sexo, capas, aspecto, tintes: ropa.tintes, hechuras: ropa.hechuras }, recursos).then(mh => {
    raiz.remove(muneco);
    raiz.add(mh.raiz);
    j.mh = mh;
    j.hacha = empunarHacha(mh);
    cuenta.add(j);
  }).catch(e => { j.error = e.message || String(e); console.warn('Personaje del taller no cargado, sigue el muñeco:', e); });
  j.animar = (velocidad, dt, talando = false) => {
    if (!j.mh) { animarMuneco(muneco, velocidad, dt); return; }
    // andar despacio (joystick a medias), correr a partir de 1,8 m/s; la animación se acelera con la velocidad,
    // hasta 1,6× (más rápido se ve atropellado; a 6 m/s los pies resbalan algo)
    let m = 'quieto', ritmo = 1;
    if (velocidad > 0.1) {
      m = velocidad < 1.8 ? 'andar' : 'correr'; ritmo = velocidad / (j.mh.velocidad[m] || 1); // natural, medida al cargar
      ritmo = THREE.MathUtils.clamp(ritmo, 0.6, 1.6);
    } else if (talando) m = 'talar';
    // con algo grande en las dos manos (src/juego/llevado.js), los brazos lo sujetan delante; quieto, la misma postura
    if (j.cargaDos && m !== 'talar' && j.mh.acciones.cargar) { m = 'cargar'; if (velocidad <= 0.1) ritmo = 0; }
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
  j.ponerLlevado = (l) => { j.llevadoPedido = l; j.cargaDos = !!(l && l.dos); if (j.mh) llevado.poner(l); };
  j.listo.then(() => { if (j.mh && j.llevadoPedido) llevado.poner(j.llevadoPedido); });
  j.animar = (...a) => { animarCuerpo(...a); llevado.paso(); };
  return j;
}
