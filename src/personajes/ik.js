// Kinhold — cinemática inversa de dos huesos para los brazos (la del duelo, src/combate/taller.js, puesta aparte para
// usarla también en el juego: la mano sobre el tronco al hombro, en las agarraderas de la carretilla, a los lados de lo
// que se lleva en brazos). Los personajes de Meshy no traen esas posturas en su biblioteca: se colocan los brazos sobre
// la animación de andar o de estar quieto.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = V(0, 0, 0), _b = V(0, 0, 0), _c = V(0, 0, 0), _d = V(0, 0, 0);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

// Gira un hueso (en el mundo) para que la dirección hueso→punto `de` pase a apuntar a `hacia`
export function girarHueso(hueso, de, hacia) {
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
export function brazoHacia(b, objetivo, polo) {
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


// Lleva los nudillos (el punto middle_01 de la mano, src/personajes/meshy.js) a `punto` (en el mundo), con el codo hacia
// `polo`: mueve la muñeca lo que les falta, dos veces (la mano gira con el antebrazo).
export function nudillosA(b, punto, polo) {
  for (let i = 0; i < 2; i++) {
    const m = b.mano.getWorldPosition(V(0, 0, 0)), n = b.nudillo ? b.nudillo.getWorldPosition(V(0, 0, 0)) : m.clone();
    brazoHacia(b, punto.clone().sub(n.sub(m)), polo);
  }
}
