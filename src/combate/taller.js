// Kinhold — los luchadores del duelo con el personaje del taller propio (MakeHuman vestido por capas).
// La armadura del duelo son las capas del taller: lino = camisa y calzas, gambesón = gambesón, malla = gambesón y cota.
// Las piernas y el cuerpo van con las animaciones del taller (guardia, andar, correr); los brazos se colocan cada
// fotograma con cinemática inversa de dos huesos para que las manos agarren el arma donde la pone la lógica de poses de
// modelos.js (la misma de antes: golpes, paradas, escudo, arco y honda no cambian). Las heridas se pegan en la superficie
// del cuerpo o de la ropa, donde entra el golpe, y siguen al hueso.
import * as THREE from 'three';
import { crearPersonajeMH } from '../personajes/makehuman.js';

export const CAPAS_ARMADURA = { lino: [], gambeson: ['gambeson'], malla: ['gambeson', 'cota'] };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = V(0, 0, 0), _b = V(0, 0, 0), _c = V(0, 0, 0), _d = V(0, 0, 0), _e = V(0, 0, 0);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

// Gira un hueso (en el mundo) para que la dirección hueso→punto `de` pase a apuntar a `hacia`
function girarHueso(hueso, de, hacia) {
  const p = hueso.getWorldPosition(_a);
  const u = _b.copy(de).sub(p), w = _c.copy(hacia).sub(p);
  if (u.lengthSq() < 1e-10 || w.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(u.normalize(), w.normalize());
  hueso.getWorldQuaternion(_q2);
  hueso.parent.getWorldQuaternion(_q3);
  hueso.quaternion.copy(_q3.invert().multiply(_q.multiply(_q2)));
  hueso.updateMatrixWorld(true);
}

// Cinemática inversa de dos huesos (brazo y antebrazo): la muñeca va a `objetivo`; el codo, hacia `polo`
function brazoHacia(b, objetivo, polo) {
  const S = b.sup.getWorldPosition(V(0, 0, 0)), E0 = b.inf.getWorldPosition(V(0, 0, 0)), H0 = b.mano.getWorldPosition(V(0, 0, 0));
  const la = S.distanceTo(E0), lb = E0.distanceTo(H0);
  const dir = objetivo.clone().sub(S);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(la - lb) + 1e-3, (la + lb) * 0.999);
  const n = dir.normalize();
  const cos = (la * la + d * d - lb * lb) / (2 * la * d), sen = Math.sqrt(Math.max(0, 1 - cos * cos));
  const perp = polo.clone().sub(n.clone().multiplyScalar(polo.dot(n)));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
  perp.normalize();
  const codo = S.clone().addScaledVector(n, la * cos).addScaledVector(perp, la * sen);
  girarHueso(b.sup, E0, codo);
  girarHueso(b.inf, b.mano.getWorldPosition(_d), S.clone().addScaledVector(n, d));
}

// Gira la mano lo mínimo para que los dedos queden atravesados al eje del arma (que la rodeen)
function cerrarMano(b, eje) {
  const h = b.mano.getWorldPosition(V(0, 0, 0));
  const f = b.dedo.getWorldPosition(V(0, 0, 0)).sub(h);
  const quiero = f.clone().addScaledVector(eje, -f.dot(eje));
  if (quiero.lengthSq() < 1e-8) return;
  girarHueso(b.mano, h.clone().add(f), h.clone().add(quiero.setLength(f.length())));
}

// Viste el combatiente de modelos.js con el personaje del taller. Mientras carga (o si no carga) se queda el muñeco.
// `capas`: si se da, la ropa que se ve (la del personaje elegido, ya ajustada a la armadura); si no, la de la armadura.
export function vestirConTaller(raiz, { armadura = 'lino', colorCinta = 0xc0392b, sexo = 'hombre', capas = null } = {}, recursos) {
  const u = raiz.userData;
  u.taller = { estado: 'cargando' };
  return crearPersonajeMH({ sexo, capas: capas || CAPAS_ARMADURA[armadura] || [] }, recursos).then(mh => {
    for (const hijo of [...u.cuerpo.children]) if (hijo !== u.armas) hijo.visible = false;
    u.cuerpo.add(mh.raiz);
    mh.raiz.updateMatrixWorld(true);
    const h = mh.hueso;
    const brazo = (l) => ({ sup: h[`upperarm_${l}`], inf: h[`lowerarm_${l}`], mano: h[`hand_${l}`], dedo: h[`middle_01_${l}`] });
    // zonas de herida: el hueso al que se pega la mancha y el tramo del cuerpo donde puede entrar
    const hombros = [h.upperarm_l, h.upperarm_r], caderas = [h.thigh_l, h.thigh_r];
    const zonas = {
      cabeza: { hueso: h.head, de: h.head, a: h.head, alto: 0.03 }, // sin par: la cabeza mira al frente aunque el tronco gire
      torso: { hueso: h.spine_02, de: h.spine_01, a: h.spine_03, alto: 0.08, par: hombros },
      brazoI: { hueso: h.upperarm_l, de: h.upperarm_l, a: h.lowerarm_l, par: hombros },
      brazoD: { hueso: h.upperarm_r, de: h.upperarm_r, a: h.lowerarm_r, par: hombros },
      piernaI: { hueso: h.thigh_l, de: h.thigh_l, a: h.calf_l, par: caderas },
      piernaD: { hueso: h.thigh_r, de: h.thigh_r, a: h.calf_r, par: caderas },
    };
    const dedos = [];
    for (const f of ['index', 'middle', 'ring', 'pinky']) for (const k of ['01', '02', '03']) if (h[`${f}_${k}_l`] && h[`${f}_${k}_r`]) dedos.push([h[`${f}_${k}_l`], h[`${f}_${k}_r`]]);
    u.taller = { estado: 'listo', mh, brazos: { i: brazo('l'), d: brazo('r') }, zonas, modo: '', capas: mh.capas, dedos };
    u.heridasPintadas = 0; // las que ya tuviera el muñeco se vuelven a pintar sobre el personaje
    // distintivo (cinta azul o amarilla) en el pecho, por encima de la ropa
    const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.012), new THREE.MeshLambertMaterial({ color: colorCinta }));
    cinta.name = 'cinta';
    pegar(u, cinta, { hueso: h.spine_03, de: h.spine_03, a: h.spine_03, alto: 0.07, par: hombros }, 0.07, 0.02, 1);
  }).catch(e => { u.taller = { estado: 'error', error: e.message || String(e) }; console.warn('Luchador del taller no cargado, sigue el muñeco:', e); });
}

const _ray = new THREE.Raycaster();
// Pega una malla en la superficie visible del personaje, delante del tramo de una zona (en la dirección `frente` del
// cuerpo), y la deja colgada del hueso para que le siga. lado: desplazamiento a su izquierda; alto: a lo largo del tramo (0-1).
function pegar(u, malla, z, lado, alto, frente = 1) {
  const t = u.taller, cuerpo = u.cuerpo;
  cuerpo.updateMatrixWorld(true);
  const p0 = z.de.getWorldPosition(V(0, 0, 0)), p1 = z.a.getWorldPosition(V(0, 0, 0));
  const centro = p0.lerp(p1, 0.5 + alto);
  if (z.alto) centro.y += z.alto;
  // izquierda y frente del tramo según su par de huesos (hombros o caderas): en guardia el tronco va girado
  const arriba = V(0, 1, 0).transformDirection(cuerpo.matrixWorld);
  const izq = z.par ? z.par[0].getWorldPosition(V(0, 0, 0)).sub(z.par[1].getWorldPosition(_e)).normalize() : V(1, 0, 0).transformDirection(cuerpo.matrixWorld);
  const del = izq.clone().cross(arriba).normalize().multiplyScalar(frente);
  centro.addScaledVector(izq, lado);
  const origen = centro.clone().addScaledVector(del, 0.6);
  _ray.set(origen, del.clone().negate());
  _ray.far = 1.2;
  const mallas = [];
  // el pelo no: su borde es transparente y la mancha quedaría flotando
  t.mh.modelo.traverse(n => { if (n.isMesh && n.visible && !/ojo|pelo/.test(n.name)) mallas.push(n); });
  const imp = _ray.intersectObjects(mallas, false)[0];
  const punto = imp ? imp.point : centro.addScaledVector(del, 0.12);
  const normal = imp && imp.face ? imp.face.normal.clone().transformDirection(imp.object.matrixWorld) : del;
  if (normal.dot(del) < 0) normal.negate();
  malla.position.copy(punto).addScaledVector(normal, 0.004);
  malla.lookAt(punto.clone().add(normal));
  z.hueso.attach(malla); // se queda donde está y pasa a seguir al hueso
  malla.userData.superficie = !!imp;
  return malla;
}

const HOMBROS_POSES = 1.48;
const TAM = { leve: 0.07, grave: 0.11, 'muy grave': 0.16 };
const SANGRE = 0x8a1410, MORADO = 0x5b3a5e;
// Mancha de una herida (corte o estocada: sangre; contundente: moratón) sobre el personaje del taller
export function pintarHeridaTaller(u, h, n) {
  const z = u.taller.zonas[h.zona];
  if (!z) return;
  const tam = (TAM[h.gravedad] || 0.07) * (h.zona === 'cabeza' ? 0.6 : 1); // en la cara, más pequeña
  const geo = h.tipo === 'perforante' ? new THREE.CircleGeometry(tam * 0.45, 8) : new THREE.PlaneGeometry(tam * (h.tipo === 'corte' ? 0.45 : 1), tam * 1.3);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: h.tipo === 'contundente' ? MORADO : SANGRE, transparent: true, opacity: h.tipo === 'contundente' ? 0.7 : 0.92, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.name = 'herida';
  const desplaz = ((n * 37) % 7 - 3) * 0.02;
  const lado = h.zona === 'torso' ? desplaz * 2.2 : h.zona === 'cabeza' ? desplaz * 1.2 : 0;
  const alto = h.zona === 'cabeza' ? 0 : desplaz * 1.5;
  pegar(u, m, z, lado, alto, 1);
  if (h.tipo === 'corte') m.rotateZ(((n * 53) % 5 - 2) * 0.35); // tajo en diagonal
}

// Animación del luchador del taller: clip de piernas y cuerpo según lo que hace, y brazos a las manos del arma.
// manos: { d, i } puntos de cada muñeca en el marco del cuerpo (o null para dejar el brazo como en el clip);
// eje: dirección del arma en ese marco, para cerrar la mano.
export function animarTaller(u, L, dt, velocidad, manos, eje) {
  const t = u.taller;
  if (!t || t.estado !== 'listo') return;
  const mh = t.mh;
  let m = 'quieto', ritmo = 1;
  if (velocidad > 0.1) {
    m = velocidad < 1.8 ? 'andar' : 'correr'; ritmo = velocidad / (mh.velocidad[m] || 1); // natural, medida al cargar
    ritmo = THREE.MathUtils.clamp(ritmo, 0.6, 1.6);
  } else if (L.def && L.def.tipo === 'cuerpo' && !L.fuera) m = 'guardia';
  if (m !== t.modo) { mh.poner(m, 0.2); t.modo = m; }
  mh.acciones[m].timeScale = ritmo;
  mh.mezclador.update(dt);
  // el clip de guardia trae la mano izquierda abierta (es de espada de una mano): se cierra como la derecha
  if (manos && manos.i && eje && eje.i) for (const [i, d] of t.dedos) i.quaternion.copy(d.quaternion);
  u.cuerpo.parent.updateMatrixWorld(true);
  const cuerpo = u.cuerpo, armas = u.armas;
  // las poses de las manos están hechas para hombros a 1,48 m; el personaje del taller los tiene más bajos (y más aún
  // agachado en guardia): el arma se mueve con sus hombros
  const hombros = t.brazos.i.sup.getWorldPosition(V(0, 0, 0)).add(t.brazos.d.sup.getWorldPosition(_e)).multiplyScalar(0.5);
  const dy = cuerpo.worldToLocal(hombros).y - HOMBROS_POSES;
  armas.position.y += (dy - armas.position.y) * Math.min(1, dt * 10);
  armas.updateMatrixWorld(true);
  // brazo de un lado hacia su punto del arma (la muñeca un poco antes del puño, en la línea que viene del hombro);
  // devuelve cuánto le falta a la muñeca para llegar
  const colocarBrazo = (lado) => {
    const b = t.brazos[lado];
    const obj = armas.localToWorld(manos[lado].clone());
    const S = b.sup.getWorldPosition(V(0, 0, 0));
    obj.addScaledVector(obj.clone().sub(S).normalize(), -0.06);
    const polo = V(lado === 'i' ? 0.6 : -0.6, -1, -0.35).transformDirection(cuerpo.matrixWorld);
    brazoHacia(b, obj, polo);
    if (eje && eje[lado]) cerrarMano(b, eje[lado].clone().transformDirection(armas.matrixWorld));
    return b.mano.getWorldPosition(V(0, 0, 0)).sub(obj);
  };
  if (!manos) return;
  const falta = manos.d ? colocarBrazo('d') : null;
  // si la mano del arma no llega (estocada a fondo, golpe muy abierto), el arma se queda en la mano en vez de flotar
  // delante; la otra mano va después, a donde ha quedado el puño
  if (falta && manos.arma !== false && falta.lengthSq() > 1e-8) {
    const antes = armas.worldToLocal(u.manos.getWorldPosition(V(0, 0, 0)));
    const despues = armas.worldToLocal(u.manos.getWorldPosition(V(0, 0, 0)).add(falta));
    const mover = despues.sub(antes);
    u.manos.position.add(mover);
    u.manos.updateMatrixWorld(true);
    if (manos.dosManos && manos.i) manos.i.add(mover);
  }
  if (manos.i) colocarBrazo('i');
}
