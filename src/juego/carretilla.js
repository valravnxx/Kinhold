// Kinhold — la carretilla de rueda maciza en el juego (roadmap, hito «Equipo y carga»): el modelo con el estilo v5 y
// cómo va delante del que la empuja. La lógica (quién la empuja, lo que lleva, la guarda en tus tierras) está en
// src/logica/rastra.js (VEHICULOS.carretilla); el objeto es uno más del suelo (src/juego/suelo.js la dibuja con
// modeloCarretilla y src/juego/rastra.js la mueve con moverRastras).
//
// El modelo (documento de sistemas: «1 rodaja de tronco + 2 varas + 1 tronco corto»): la rueda es una rodaja de tronco
// (los anillos en las caras, la corteza en el canto) con un eje de palo; dos varas descortezadas a medias que salen
// del eje y se abren hacia atrás, donde se agarran; la caja, de tablas hendidas del tronco corto (el suelo de cinco
// tablas atravesadas y dos costados), atada con cordel a las varas; dos patas de palo para que se quede de pie.
// Aparcada descansa en la rueda y las patas; empujándola, gira sobre el eje hasta que las varas llegan a las manos,
// y la rueda rueda con lo que avanza.
import * as THREE from 'three';
import { Lote } from '../mundo/estilos.js';
import { cil } from '../mundo/decorado.js';
import { modelosRecoleccion } from './recoleccion.js';
import { DELANTE_CARRETILLA } from '../logica/rastra.js';
import { mallas, az, deLista, vara } from './rastra.js';

export const R_RUEDA = 0.24;          // m
const ANCHO_RUEDA = 0.11;
const Z_EJE = 0.55;                   // del centro de la carretilla al eje, hacia delante
const LARGO = 1.9;                    // de eje a agarraderas, por las varas
const ALTO_PARADA = 0.5;              // a qué altura quedan las agarraderas aparcada (sobre las patas)
export const ALTO_MANOS_CARR = 0.9;   // m: a qué altura van las agarraderas empujándola: en el puño de la animación de
                                      // empujar del taller (herramientas/taller/hacer_cargas.mjs: la muñeca a 0,95 m)
const U_MANO = LARGO - 0.12;          // m: de eje a donde van las manos, por las varas
const ALFA = Math.asin((ALTO_PARADA - R_RUEDA) / LARGO);   // lo que suben las varas del eje a las agarraderas
const X_DELANTE = 0.12, X_ATRAS = 0.23, R_VARA = 0.032;
// la caja, en las varas: de u = −0.28 a u = −1.08 (u: m desde el eje hacia atrás por las varas)
const U0 = -0.28, U1 = -1.08, ANCHO_CAJA = 0.27;

// La carretilla con la rueda hacia +z y su centro en el origen. carga: { tipo, n } o null.
// Devuelve un grupo con hijo 'cuerpo' (gira sobre el eje al empujarla) y, dentro, 'rueda' (rueda al avanzar).
export function modeloCarretilla(carga, id = 'c') {
  const cuerpo = new THREE.Group(); cuerpo.name = 'cuerpo';
  // ---- la rueda: una rodaja de tronco con su eje ----
  const R = new Lote({ rangoSuelo: 0.05, variacion: 0.06, suelo: -1 });
  const ejeX = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  R.add(cil(R_RUEDA, R_RUEDA * 0.98, ANCHO_RUEDA, 14), 'corteza', 0, 0, 0, ejeX);
  for (const s of [-1, 1]) R.add(new THREE.CircleGeometry(R_RUEDA * 0.94, 14), 'corte', s * (ANCHO_RUEDA / 2 + 0.002), 0, 0, { y: s * Math.PI / 2 }, { sinSuelo: true });
  // el agujero del eje, una cuña para que no se salga y una grieta de secado en la cara (es madera sin curar)
  for (const s of [-1, 1]) R.add(cil(0.034, 0.034, 0.02, 7), 'maderaOsc', s * (ANCHO_RUEDA / 2 + 0.006), 0, 0, ejeX, { sinSuelo: true });
  R.add(new THREE.BoxGeometry(0.004, R_RUEDA * 0.55, 0.012), 'maderaOsc', ANCHO_RUEDA / 2 + 0.004, R_RUEDA * 0.45, 0.02, { x: 0.25 }, { sinSuelo: true, tex: 'liso' });
  const rueda = mallas(R); rueda.name = 'rueda';
  cuerpo.add(rueda);
  // el eje: un palo que atraviesa la rueda y las dos varas
  const E = new Lote({ rangoSuelo: 0.05, variacion: 0.06, suelo: -1 });
  E.add(cil(0.022, 0.022, X_DELANTE * 2 + 0.1, 7), 'madera', 0, 0, 0, ejeX, { sinSuelo: true });
  // ---- las varas y la caja, en el plano de las varas (sube ALFA hacia atrás) ----
  const C = new Lote({ rangoSuelo: 0.05, variacion: 0.07, suelo: -1 });
  const xEn = (s, u) => s * (X_DELANTE + (X_ATRAS - X_DELANTE) * (-u / LARGO));
  for (const s of [-1, 1]) vara(C, xEn(s, 0.1), 0.1, xEn(s, -LARGO), -LARGO, 0, R_VARA, id, s + 5);
  // las agarraderas: la punta de cada vara, alisada y con cordel enrollado
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
    const u = -LARGO + 0.06 + k * 0.03;
    C.add(new THREE.TorusGeometry(R_VARA * 0.98, 0.006, 4, 9), 'lino', xEn(s, u), 0, u, { y: Math.atan2(s * (X_ATRAS - X_DELANTE), LARGO) }, { sinSuelo: true, tex: 'tejido' });
  }
  // el suelo de la caja: cinco tablas hendidas atravesadas, algo desiguales, encima de las varas
  const yS = R_VARA + 0.016;
  for (let i = 0; i < 5; i++) {
    const u = U0 - 0.08 - i * 0.16, w = 0.13 + (az(id, 10 + i) - 0.5) * 0.025, largo = ANCHO_CAJA * 2 + 0.06 + (az(id, 15 + i) - 0.5) * 0.04;
    C.add(new THREE.BoxGeometry(largo, 0.028, w), 'tabla', (az(id, 20 + i) - 0.5) * 0.02, yS, u, { y: (az(id, 25 + i) - 0.5) * 0.05, z: (az(id, 30 + i) - 0.5) * 0.03 });
  }
  // los costados: una tabla de canto a cada lado y otra delante, inclinada hacia fuera
  for (const s of [-1, 1]) C.add(new THREE.BoxGeometry(0.026, 0.14, -U1 + U0 + 0.02), 'tabla', s * ANCHO_CAJA, yS + 0.08, (U0 + U1) / 2, { z: -s * 0.18 });
  C.add(new THREE.BoxGeometry(ANCHO_CAJA * 2 + 0.04, 0.15, 0.026), 'tabla', 0, yS + 0.075, U0 + 0.01, { x: 0.35 });
  // las ataduras: dos vueltas de cordel donde la primera y la última tabla cruzan cada vara
  for (const u of [U0 - 0.08, U0 - 0.72]) for (const s of [-1, 1]) for (const k of [-1, 1])
    C.add(new THREE.TorusGeometry(0.038, 0.006, 4, 9), 'lino', xEn(s, u) + k * 0.012, R_VARA * 0.6, u, { y: Math.PI / 2 + k * 0.5, x: 0.6 }, { sinSuelo: true, tex: 'tejido' });
  const cama = mallas(C); cama.name = 'cama';
  for (const s of [-1, 1]) {   // dónde van las manos (para las pruebas y para medir)
    const m = new THREE.Object3D(); m.name = 'agarradera'; m.position.set(xEn(s, -U_MANO), 0, -U_MANO); cama.add(m);
  }
  cama.rotation.x = ALFA;
  cuerpo.add(cama, mallas(E));
  // ---- las patas: dos palos clavados bajo las varas, verticales (en el sitio del cuerpo, no de las varas) ----
  const P = new Lote({ rangoSuelo: 0.25, variacion: 0.07 });
  const uP = -1.02, zP = uP * Math.cos(ALFA), yP = -uP * Math.sin(ALFA);   // dónde cruzan las varas, desde el eje
  for (const s of [-1, 1]) {
    const largo = yP + R_RUEDA - 0.01;
    P.add(cil(0.024, 0.028, largo, 6), 'corteza', xEn(s, uP) + s * 0.02, yP - largo / 2, zP, { z: s * 0.08 });
  }
  cuerpo.add(mallas(P));
  // ---- la carga, en la caja ----
  if (carga && carga.n > 0) {
    const g = modeloCarga(carga, id);
    g.position.set(0, yS + 0.015, (U0 + U1) / 2);
    g.name = 'carga';
    cama.add(g);
  }
  const raiz = new THREE.Group();
  cuerpo.position.set(0, R_RUEDA, Z_EJE);
  raiz.add(cuerpo);
  return raiz;
}

// Lo que lleva, sobre el suelo de la caja (el origen, en su centro; +z hacia la rueda).
function modeloCarga(carga, id) {
  const L = new Lote({ rangoSuelo: 0.3, variacion: 0.07 });
  if (carga.tipo === 'tronco_corto') {   // a lo largo: dos abajo y dos encima
    [[-0.12, 0], [0.12, 0], [-0.06, 1], [0.08, 1]].slice(0, Math.min(4, carga.n)).forEach(([x, fila], i) => {
      const r = 0.12, y = r + fila * r * 1.7, z = (az(id, 60 + i) - 0.5) * 0.1;
      const m = new THREE.Matrix4().makeRotationY((az(id, 70 + i) - 0.5) * 0.08).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      L.add(cil(r, r * 1.04, 0.9, 9), 'corteza', x, y, z, m);
      for (const s of [-1, 1]) L.add(new THREE.CircleGeometry(r * 0.97, 9), 'corte', x, y, z + s * 0.452, new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI), { sinSuelo: true });
    });
  } else if (carga.tipo === 'lena') {     // la leña partida, en capas atravesadas; más alta cuanta más
    const vis = Math.min(carga.n, 30);
    for (let i = 0; i < vis; i++) {
      const capa = Math.floor(i / 6), k = i % 6, cruz = capa % 2 === 1;
      const x = cruz ? (az(id, 100 + i) - 0.5) * 0.08 : -0.2 + k * 0.08, z = cruz ? -0.28 + k * 0.11 : (az(id, 100 + i) - 0.5) * 0.08;
      const m = new THREE.Matrix4().makeRotationY(cruz ? Math.PI / 2 + (az(id, 130 + i) - 0.5) * 0.15 : (az(id, 130 + i) - 0.5) * 0.15)
        .multiply(new THREE.Matrix4().makeRotationZ(az(id, 160 + i) * 6)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      L.add(cil(0.045, 0.045, cruz ? 0.48 : 0.62, 3), i % 3 ? 'madera' : 'corteza', x, 0.04 + capa * 0.075, z, m, { plano: true });
    }
  } else if (carga.tipo === 'bloque_piedra') {
    L.add(new THREE.DodecahedronGeometry(0.3, 0), 'piedra', 0, 0.17, 0, { y: az(id, 80) * 6, x: 0.3 }, { escala: new THREE.Vector3(1.1, 0.62, 1.35), plano: true });
  }
  const g = mallas(L);
  if (carga.tipo === 'piedra') {          // un montón: más alto cuantas más
    const mods = modelosRecoleccion(), vis = Math.min(carga.n, 22);
    for (let i = 0; i < vis; i++) {
      const p = deLista(mods.piedra), capa = i < 9 ? 0 : i < 16 ? 1 : 2, a = i * 2.4 + az(id, i), r = [0.2, 0.13, 0.05][capa];
      p.position.set(Math.cos(a) * r, 0.02 + capa * 0.085, Math.sin(a) * r * 1.6);
      p.rotation.y = az(id, i + 20) * 6; p.scale.setScalar(0.85 + az(id, i + 40) * 0.3);
      g.add(p);
    }
  }
  return g;
}

// Empujándola, gira sobre el eje hasta que las agarraderas llegan a las manos; aparcada, sobre las patas.
export const GIRO_EMPUJAR = Math.asin((ALTO_MANOS_CARR - R_RUEDA) / U_MANO) - ALFA;
export function inclinarCarretilla(raiz, empujando) {
  const c = raiz.getObjectByName('cuerpo');
  if (c) c.rotation.x = empujando ? GIRO_EMPUJAR : 0;
}
// La rueda rueda lo que avanza (m).
export function rodarCarretilla(raiz, avance) {
  const r = raiz.getObjectByName('rueda');
  if (r) r.rotation.x += avance / R_RUEDA;
}
// Dónde quedan las agarraderas empujándola, desde el centro (hacia atrás, −z): para comprobar que llegan a las manos.
export const AGARRADERAS = { z: Z_EJE - U_MANO * Math.cos(ALFA + GIRO_EMPUJAR), y: ALTO_MANOS_CARR, delante: DELANTE_CARRETILLA };
