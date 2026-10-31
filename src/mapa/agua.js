// Kinhold — el agua: un solo material para ríos y mar, de lejos y de cerca (MeshPhong de three.js con su luz, sombras
// y niebla, más un trozo de sombreador propio). Cada vértice del agua lleva:
//   aFlujo (vec2): hacia dónde corre y a qué velocidad (m/s); 0 en el mar
//   aHondo: cuánta agua hay debajo (m), sacada de las alturas del terreno (sin pasadas extra de pantalla: va en el móvil)
//   aTipo:  0 río, 1 mar
//   aOla:   cuánto oleaje de verdad (la superficie sube y baja) — solo en el mar de cerca; 0 en el resto
// Lo que hace:
//   - río: rizos que corren en la dirección del agua con el método del «mapa de flujo» (dos fases desplazadas media
//     vuelta y mezcladas en triángulo, como el agua de Portal 2: así el dibujo corre sin estirarse ni reiniciarse a la
//     vista); espuma en la orilla y, donde corre deprisa, regueros de espuma que bajan con la corriente;
//   - mar: oleaje con tres olas de Gerstner (la superficie sube y baja y las crestas se afilan; cada ola va a la
//     velocidad de las de verdad, √(g/k)), rizos encima y olas que rompen en la costa: franjas de espuma que avanzan
//     hacia la orilla según baja la hondura y una línea de espuma donde muere el agua;
//   - los dos: color según la hondura (claro y transparente en la orilla, oscuro donde cubre) y algo del cielo
//     reflejado al mirar de lado.
import * as THREE from 'three';

export const tiempoAgua = { value: 0 };
// La altura del oleaje del mar (m) en un punto de la escena (x, z) y en el tiempo t (s): las mismas tres olas de
// Gerstner del sombreador (solo lo que suben y bajan), para que lo que flota o nada vaya con ellas
const OLAS = [[1, 0.25, 22, 0.32], [0.7, -0.7, 11, 0.14], [0.2, 1, 6.5, 0.06]].map(([x, z, largo, alto]) => { const l = Math.hypot(x, z); return { dx: x / l, dz: z / l, k: 2 * Math.PI / largo, alto }; });
export function alturaOla(x, z, t = tiempoAgua.value) {
  let y = 0;
  for (const o of OLAS) { const c = Math.sqrt(9.8 / o.k); y += o.alto * Math.sin(o.k * (o.dx * x + o.dz * z - c * t)); }
  return y;
}
const LEJOS = new THREE.Vector4(1e9, 1e9, -1e9, -1e9);

// hueco: un rectángulo (x0, z0, x1, z1) de la escena donde este agua no se dibuja (el de lejos, bajo el trozo de cerca)
export function crearMaterialAgua() {
  const m = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x5c6668, shininess: 90, transparent: true, side: THREE.DoubleSide, depthWrite: true });
  const hueco = { value: LEJOS.clone() };
  m.userData.hueco = hueco;
  m.ponerHueco = (x0, z0, x1, z1) => hueco.value.set(x0, z0, x1, z1);
  m.quitarHueco = () => hueco.value.copy(LEJOS);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = tiempoAgua;
    sh.uniforms.uHueco = hueco;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aFlujo; attribute float aHondo; attribute float aTipo; attribute float aOla; attribute float aOrilla; attribute float aEspuma;
uniform float uTiempo;
varying vec2 vFlujo; varying float vHondo; varying float vTipo; varying float vOrilla; varying vec3 vMundo; varying vec3 vNorM; varying float vEspuma;
// una ola de Gerstner: dirección, longitud (m), altura (m) y lo afilada que es la cresta
void ola(vec2 p, vec2 d, float largo, float alto, float afilado, inout vec3 desp, inout vec3 nor) {
  float k = 6.2831853 / largo, c = sqrt(9.8 / k), f = k * (dot(d, p) - c * uTiempo);
  float q = afilado / (k * alto * 3.0 + 0.0001);
  desp += vec3(q * alto * d.x * cos(f), alto * sin(f), q * alto * d.y * cos(f));
  nor += vec3(-d.x * k * alto * cos(f), -q * k * alto * sin(f) * 0.0, -d.y * k * alto * cos(f));
}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vec3 despOla = vec3(0.0);
if (aOla > 0.001) {
  vec3 n = vec3(0.0);
  vec2 p = (modelMatrix * vec4(position, 1.0)).xz;
  // viento del oeste (como en el clima del mapa): la ola grande viene de ahí y dos menores de lado
  ola(p, normalize(vec2(1.0, 0.25)), 22.0, 0.32, 0.6, despOla, n);
  ola(p, normalize(vec2(0.7, -0.7)), 11.0, 0.14, 0.5, despOla, n);
  ola(p, normalize(vec2(0.2, 1.0)), 6.5, 0.06, 0.4, despOla, n);
  despOla *= aOla; n *= aOla;
  objectNormal = normalize(vec3(n.x, 1.0, n.z));
}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += despOla;
vFlujo = aFlujo; vHondo = aHondo; vTipo = aTipo; vOrilla = aOrilla; vEspuma = aEspuma; vNorM = normalize(mat3(modelMatrix) * objectNormal);
vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTiempo; uniform vec4 uHueco;
varying vec2 vFlujo; varying float vHondo; varying float vTipo; varying float vOrilla; varying vec3 vMundo; varying vec3 vNorM; varying float vEspuma;
float hashA(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruidoA(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashA(i), hashA(i + vec2(1, 0)), u.x), mix(hashA(i + vec2(0, 1)), hashA(i + vec2(1, 1)), u.x), u.y); }
// pendiente de los rizos (derivada de unas ondas cruzadas, sin texturas) en un punto (m)
vec2 rizos(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 k1 = vec2(1.9, 0.7), k2 = vec2(-1.1, 2.3), k3 = vec2(3.7, -2.9), k4 = vec2(-5.3, -4.1);
  g += k1 * cos(dot(p, k1) + t * 1.3) * 0.050;
  g += k2 * cos(dot(p, k2) - t * 1.7) * 0.035;
  g += k3 * cos(dot(p, k3) + t * 2.3) * 0.016;
  g += k4 * cos(dot(p, k4) - t * 2.9) * 0.009;
  return g;
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vMundo.x > uHueco.x && vMundo.x < uHueco.z && vMundo.z > uHueco.y && vMundo.z < uHueco.w) discard;
float hondo = max(vHondo, 0.0);
// el dibujo de la corriente: dos fases desplazadas media vuelta, mezcladas en triángulo (no se ve el reinicio)
float ciclo = 2.4, f0 = fract(uTiempo / ciclo), f1 = fract(uTiempo / ciclo + 0.5), w0 = 1.0 - abs(2.0 * f0 - 1.0);
vec2 q0 = vMundo.xz - vFlujo * f0 * ciclo, q1 = vMundo.xz - vFlujo * f1 * ciclo;
vec2 pend = mix(rizos(q1, uTiempo * 0.4), rizos(q0, uTiempo * 0.4), w0);
float vel = length(vFlujo);
// espuma: en la orilla, en las rompientes del mar y en los regueros de los rápidos
float espuma = 0.0;
float roto = ruidoA(vMundo.xz * 0.35 + uTiempo * 0.05) * 0.6 + ruidoA(vMundo.xz * 1.7) * 0.4;
if (vTipo > 0.5) {
  // olas que rompen: franjas que avanzan hacia la orilla (unos 12 m entre una y otra) y se deshacen al llegar,
  // y la línea de espuma donde muere el agua, que sube y baja
  float banda = sin(vOrilla * 0.52 + uTiempo * 1.4 + roto * 2.0);
  espuma += smoothstep(0.78, 0.98, banda) * (1.0 - smoothstep(8.0, 40.0, vOrilla)) * smoothstep(0.5, 3.0, vOrilla) * (0.45 + 0.55 * roto);
  espuma += (1.0 - smoothstep(1.4 + 0.8 * sin(uTiempo * 0.9 + roto * 3.0), 3.4, vOrilla)) * 0.85;
  pend *= 1.6;
} else {
  espuma += (1.0 - smoothstep(1.0, 2.4, vOrilla)) * 0.5 * roto;
  float reguero = mix(ruidoA(q1 * 0.9), ruidoA(q0 * 0.9), w0);
  espuma += smoothstep(0.66, 0.92, reguero) * smoothstep(1.8, 2.8, vel) * 0.6;
  pend *= 0.7 + 0.5 * smoothstep(0.4, 2.5, vel);
}
// saltos de agua: donde la lámina cae casi en vertical, el agua baja en chorros blancos que corren hacia abajo; al pie,
// la poza de espuma (aEspuma, que se apaga aguas abajo)
float caida = smoothstep(0.35, 0.8, 1.0 - abs(normalize(vNorM).y));
if (caida > 0.0) {
  vec2 dirF = normalize(vFlujo + vec2(1e-4, 0.0));
  float tr = dot(vMundo.xz, vec2(-dirF.y, dirF.x));
  float chorro = ruidoA(vec2(tr * 1.3, vMundo.y * 0.45 + uTiempo * 4.0)) * 0.6 + ruidoA(vec2(tr * 4.0, vMundo.y * 1.4 + uTiempo * 7.0)) * 0.4;
  espuma = max(espuma, caida * (0.5 + 0.5 * chorro));
  pend *= 1.0 - caida;
}
espuma = max(espuma, vEspuma * (0.45 + 0.55 * roto) * (0.75 + 0.25 * sin(uTiempo * 3.0 + roto * 6.0)));
espuma = clamp(espuma, 0.0, 1.0);
// de lejos los rizos se apagan (si no, salen dibujos en anillos: más finos que un píxel)
float lejos = length(vMundo - cameraPosition);
pend *= 1.0 - smoothstep(35.0, 220.0, lejos);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 somero = vTipo > 0.5 ? vec3(0.30, 0.42, 0.40) : vec3(0.33, 0.40, 0.33);
vec3 hondoC = vTipo > 0.5 ? vec3(0.06, 0.14, 0.18) : vec3(0.10, 0.17, 0.18);
diffuseColor.rgb = mix(somero, hondoC, smoothstep(0.0, vTipo > 0.5 ? 6.0 : 2.0, hondo));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.86), espuma);
diffuseColor.rgb = pow(diffuseColor.rgb, vec3(2.2));   // los colores de arriba van en sRGB, como los de la paleta; aquí se trabaja en lineal
diffuseColor.a = mix(mix(0.45, 0.93, smoothstep(0.0, 1.2, hondo)), 0.97, espuma);
// en el último metro y medio antes de la orilla el agua se desvanece: así el corte con el terreno (que en una rejilla
// de 1 m sale escalonado si la orilla es empinada) no se ve
diffuseColor.a *= smoothstep(0.15, 1.6, vOrilla);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
normal = normalize(normal + (viewMatrix * vec4(-pend.x, 0.0, -pend.y, 0.0)).xyz);`)
      .replace('#include <envmap_fragment>', `#include <envmap_fragment>
// algo del cielo reflejado al mirar el agua de lado
float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
outgoingLight = mix(outgoingLight, vec3(0.55, 0.63, 0.69), fres * 0.3 * (1.0 - espuma));`);
  };
  m.customProgramCacheKey = () => 'aguaKinhold2';
  return m;
}

// pone los atributos del agua en una geometría (los que falten, con lo que da «río quieto y hondo»)
export function atributosAgua(geo, { flujo = null, hondo = null, tipo = null, ola = null, orilla = null, espuma = null } = {}) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aFlujo', new THREE.BufferAttribute(flujo || new Float32Array(n * 2), 2));
  geo.setAttribute('aHondo', new THREE.BufferAttribute(hondo || new Float32Array(n).fill(1), 1));
  geo.setAttribute('aTipo', new THREE.BufferAttribute(tipo || new Float32Array(n), 1));
  geo.setAttribute('aOla', new THREE.BufferAttribute(ola || new Float32Array(n), 1));
  geo.setAttribute('aOrilla', new THREE.BufferAttribute(orilla || new Float32Array(n).fill(50), 1));
  geo.setAttribute('aEspuma', new THREE.BufferAttribute(espuma || new Float32Array(n), 1));
  return geo;
}

// distancia (m) de cada punto de una rejilla n × n (paso en m) al punto seco más cercano: dos pasadas de chaflán
// semilla (opcional): para los puntos junto a la orilla, la distancia exacta hasta donde el agua corta el terreno entre
// dos puntos de la rejilla (negativa en los secos): así la línea de la orilla no sale escalonada
export function distanciaOrilla(seco, n, paso, tope = 60, semilla = null) {
  const d = new Float32Array(n * n), D = Math.SQRT2, fijo = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) { d[k] = seco[k] ? 0 : tope; if (semilla && !isNaN(semilla[k])) { d[k] = semilla[k] / paso; fijo[k] = 1; } }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; if (seco[k] || fijo[k]) continue; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1); if (j > 0) { v = Math.min(v, d[k - n] + 1); if (i > 0) v = Math.min(v, d[k - n - 1] + D); if (i < n - 1) v = Math.min(v, d[k - n + 1] + D); } d[k] = v; }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { const k = j * n + i; if (seco[k] || fijo[k]) continue; let v = d[k];
    if (i < n - 1) v = Math.min(v, d[k + 1] + 1); if (j < n - 1) { v = Math.min(v, d[k + n] + 1); if (i < n - 1) v = Math.min(v, d[k + n + 1] + D); if (i > 0) v = Math.min(v, d[k + n - 1] + D); } d[k] = v; }
  for (let k = 0; k < n * n; k++) d[k] = Math.min(tope, Math.max(d[k], seco[k] && !fijo[k] ? 0 : -tope) * paso);
  return d;
}
