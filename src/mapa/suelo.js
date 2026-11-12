// Kinhold — el material del suelo del paisaje.
//
// Desde el 12 nov (hito «El aspecto»: el suelo con materiales), el de cerca mezcla cuatro texturas CC0 de verdad
// (docs/recursos/suelo/cc0-v1/, de ambientCG): hierba, tierra, roca y hojarasca, según lo que hay en cada punto
// (el atributo «mezcla» de los trozos: src/mundo/color_suelo.js, pesos). Así se hace el suelo en los mundos abiertos:
//   - el color del sitio sigue saliendo de los vértices (bioma, calvas, playa, lecho de los ríos…), y cada textura pone
//     encima su detalle (dividida por su color medio: aclara y oscurece sin cambiar el color del sitio);
//   - entre un material y otro, la mezcla va por altura (cada textura lleva su altura en el alfa): en el borde de una
//     calva asoman primero las piedrecitas y la tierra alta, no un fundido borroso;
//   - la roca, proyectada desde los tres ejes (en las paredes no se estira en rayas) y por caras planas en lo empinado;
//     las demás, desde arriba;
//   - con relieve (sus mapas de normales) en los perfiles gráficos que lo llevan.
// Mientras las texturas no han llegado (o si no llegan), el suelo de antes: el color de los vértices por la textura
// «suelo» del estilo v5.
import * as THREE from 'three';
import { materialTex } from '../mundo/estilos.js';

const SIN_HUECO = new THREE.Vector4(1e9, 1e9, -1e9, -1e9);
export const CAPAS_SUELO = ['hierba', 'tierra', 'roca', 'hojarasca'];
// metros que ocupa cada textura en el suelo (una vez entera)
export const ESCALA_SUELO = { hierba: 2.6, tierra: 2.2, roca: 3.5, hojarasca: 2.0 };

// lo que comparten los materiales de cerca: las texturas y cuánto relieve
const capas = {
  tHierba: { value: null }, tTierra: { value: null }, tRoca: { value: null }, tHoja: { value: null },
  nHierba: { value: null }, nTierra: { value: null }, nRoca: { value: null }, nHoja: { value: null },
  uMedias: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] },
  uEscala: { value: new THREE.Vector4(ESCALA_SUELO.hierba, ESCALA_SUELO.tierra, ESCALA_SUELO.roca, ESCALA_SUELO.hojarasca) },
  uRelieve: { value: 1 },
};
let hayCapas = false;
if (typeof window !== 'undefined') window.__capasSuelo = capas;   // (para las pruebas: cuánto relieve, qué texturas)

const hechos = {};
export function materialSuelo({ lejos = false } = {}) {
  const k = lejos ? 'lejos' : 'cerca';
  if (hechos[k]) return hechos[k];
  const m = materialTex('suelo').clone();
  if (lejos) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 });
  else if (hayCapas) m.defines = { CAPAS_SUELO: 1 };
  // el de lejos deja un hueco bajo el trozo de cerca (si no, en los cortados de cerca, más hondos que la rejilla de
  // lejos, el suelo de lejos asoma en pirámides)
  const hueco = { value: SIN_HUECO.clone() };
  m.ponerHueco = (x0, z0, x1, z1) => hueco.value.set(x0, z0, x1, z1);
  m.quitarHueco = () => hueco.value.copy(SIN_HUECO);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHuecoSuelo = hueco;
    if (!lejos) Object.assign(sh.uniforms, capas);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSueloPos; varying vec3 vSueloNor;\n#ifdef CAPAS_SUELO\nattribute vec4 mezcla; varying vec4 vMezcla;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSueloPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vSueloNor = normalize(mat3(modelMatrix) * objectNormal);\n#ifdef CAPAS_SUELO\nvMezcla = mezcla;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSueloPos; varying vec3 vSueloNor; uniform vec4 uHuecoSuelo;
#ifdef CAPAS_SUELO
varying vec4 vMezcla;
uniform sampler2D tHierba, tTierra, tRoca, tHoja, nHierba, nTierra, nRoca, nHoja;
uniform vec3 uMedias[4]; uniform vec4 uEscala; uniform float uRelieve;
vec4 bCapas; vec3 pwCapas;
#endif`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vSueloPos.x > uHuecoSuelo.x && vSueloPos.x < uHuecoSuelo.z && vSueloPos.z > uHuecoSuelo.y && vSueloPos.z < uHuecoSuelo.w) discard;')
      .replace('#include <map_fragment>', `#ifdef CAPAS_SUELO
  {
    vec3 nW = normalize(vSueloNor);
    vec3 pw = pow(abs(nW), vec3(4.0)); pw /= (pw.x + pw.y + pw.z); pwCapas = pw;
    vec2 p = vSueloPos.xz;
    vec4 cH = texture2D(tHierba, p / uEscala.x), cT = texture2D(tTierra, p / uEscala.y), cF = texture2D(tHoja, p / uEscala.w);
    // (y otra vez la hierba, cuatro veces más grande y girada: que no se vea la misma baldosa repetida)
    vec4 cH2 = texture2D(tHierba, mat2(0.8, -0.6, 0.6, 0.8) * p / (uEscala.x * 6.3));
    cH = vec4(cH.rgb * mix(vec3(1.0), cH2.rgb / uMedias[0], 0.45), mix(cH.a, cH2.a, 0.3));
    vec4 cR = texture2D(tRoca, vSueloPos.zy / uEscala.z) * pw.x + texture2D(tRoca, p / uEscala.z) * pw.y + texture2D(tRoca, vSueloPos.xy / uEscala.z) * pw.z;
    // la mezcla por altura: cada peso, por la altura de su textura; ganan los de arriba y el borde queda estrecho
    vec4 w = max(vMezcla, 0.0);
    vec4 hw = w * (0.4 + vec4(cH.a, cT.a, cR.a, cF.a));
    float mx = max(max(hw.x, hw.y), max(hw.z, hw.w));
    vec4 b = max(hw - (mx - 0.22), 0.0); b /= (b.x + b.y + b.z + b.w + 1e-5); bCapas = b;
    // el detalle: cada textura dividida por su color medio, algo menos saturado (el color lo pone el sitio)
    // (cada una con su color en distinta medida: la tierra y la roca casi solo claros y oscuros; la hojarasca, con el suyo)
    vec3 L = vec3(0.299, 0.587, 0.114);
    vec3 dH = cH.rgb / uMedias[0], dT = cT.rgb / uMedias[1], dR = cR.rgb / uMedias[2], dF = cF.rgb / uMedias[3];
    dH = mix(vec3(dot(dH, L)), dH, 0.5); dT = vec3(dot(dT, L)); dR = mix(vec3(dot(dR, L)), dR, 0.3); dF = mix(vec3(dot(dF, L)), dF, 0.85);
    vec3 d = dH * b.x + dT * b.y + dR * b.z + dF * b.w;
    // a lo lejos, el detalle se va (la misma textura muchas veces seguidas hace rayas y aguas); y 0,6: lo que oscurecía
    // la textura «suelo» de antes, con la que están hechos los colores de los vértices
    // y también donde se ve muy de canto: cuando cada píxel de la pantalla abarca varios de la textura, su detalle hace
    // bandas (el aliasing de mirar una textura en ángulo rasante); ahí se va también
    float tpp = max(length(dFdx(p)), length(dFdy(p))) / uEscala.y * 512.0;
    // a media distancia, las mismas texturas leídas cinco veces más grandes: siguen los terrones y las manchas, sin las
    // bandas de las pequeñas; muy lejos, ya sin detalle (lo cubre la bruma)
    float medioD = max(smoothstep(22.0, 45.0, length(vViewPosition)), smoothstep(7.0, 18.0, tpp));
    float lejosD = smoothstep(90.0, 220.0, length(vViewPosition));
    vec2 p5 = p / 5.0;
    vec3 eH = cH2.rgb / uMedias[0], eT = texture2D(tTierra, p5 / uEscala.y).rgb / uMedias[1], eF = texture2D(tHoja, p5 / uEscala.w).rgb / uMedias[3], eR = texture2D(tRoca, p5 / uEscala.z).rgb / uMedias[2];
    eH = mix(vec3(dot(eH, L)), eH, 0.5); eT = vec3(dot(eT, L)); eR = vec3(dot(eR, L)); eF = mix(vec3(dot(eF, L)), eF, 0.85);
    vec3 dM = mix(vec3(1.0), eH, 0.6) * b.x + eT * b.y + eR * b.z + eF * b.w;
    vec3 dTodo = mix(clamp(d, 0.0, 2.2), clamp(mix(vec3(1.0), dM, 0.75), 0.0, 2.2), medioD);
    diffuseColor.rgb *= 0.6 * mix(dTodo, vec3(1.0), lejosD);
  }
#else
#ifdef USE_MAP
  vec3 pesoT = pow(abs(normalize(vSueloNor)), vec3(4.0)); pesoT /= (pesoT.x + pesoT.y + pesoT.z);
  vec2 uvX = vSueloPos.zy * 0.5, uvY = vSueloPos.xz * 0.5, uvZ = vSueloPos.xy * 0.5;
  vec4 texT = texture2D(map, uvX) * pesoT.x + texture2D(map, uvY) * pesoT.y + texture2D(map, uvZ) * pesoT.z;
  diffuseColor *= texT;
#endif
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef CAPAS_SUELO
  if (uRelieve > 0.0) {
    // el relieve de cada textura, desde arriba (la roca, desde los tres ejes), en el mundo y luego a la vista
    vec2 p = vSueloPos.xz; vec3 pw = pwCapas, b3;
    vec3 rH = texture2D(nHierba, p / uEscala.x).xyz * 2.0 - 1.0, rT = texture2D(nTierra, p / uEscala.y).xyz * 2.0 - 1.0, rF = texture2D(nHoja, p / uEscala.w).xyz * 2.0 - 1.0;
    vec3 rX = texture2D(nRoca, vSueloPos.zy / uEscala.z).xyz * 2.0 - 1.0, rY = texture2D(nRoca, p / uEscala.z).xyz * 2.0 - 1.0, rZ = texture2D(nRoca, vSueloPos.xy / uEscala.z).xyz * 2.0 - 1.0;
    vec3 plano = vec3(rH.x, 0.0, -rH.y) * bCapas.x + vec3(rT.x, 0.0, -rT.y) * bCapas.y + vec3(rF.x, 0.0, -rF.y) * bCapas.w;
    vec3 roca = (vec3(0.0, rX.y, rX.x) * pw.x + vec3(rY.x, 0.0, -rY.y) * pw.y + vec3(rZ.x, rZ.y, 0.0) * pw.z) * bCapas.z;
    float tppR = max(length(dFdx(p)), length(dFdy(p))) / uEscala.y * 512.0;
    vec3 nW = normalize(normalize(vSueloNor) + (plano + roca) * 0.85 * uRelieve * (1.0 - smoothstep(14.0, 50.0, length(vViewPosition))) * (1.0 - smoothstep(9.0, 26.0, tppR)));
    normal = normalize(mat3(viewMatrix) * nW);
  }
#endif
  {
    // pared: caras planas (la normal de cada triángulo, sacada de cómo cambia la posición en la pantalla)
    float pared = 1.0 - smoothstep(0.5, 0.68, normalize(vSueloNor).y);
    if (pared > 0.0) {
      vec3 plana = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
      normal = normalize(mix(normal, plana, pared * 0.75));
    }
  }`);
  };
  m.customProgramCacheKey = () => 'sueloKinhold' + k + (m.defines && m.defines.CAPAS_SUELO ? 'capas' : '');
  return (hechos[k] = m);
}

// Carga las texturas del suelo (carpeta: la de docs/recursos/suelo/cc0-v1/, como la ve la página). Nunca falla: si no
// llegan, se queda el suelo de antes. ?suelo=antes: el de antes (para comparar). Devuelve una promesa (true si llegaron).
let cargando = null;
export function cargarTexturasSuelo(carpeta) {
  if (cargando) return cargando;
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('suelo') === 'antes') return (cargando = Promise.resolve(false));
  const l = new THREE.TextureLoader();
  const tex = (n, color) => l.loadAsync(carpeta + n + '.webp').then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  });
  const U = { hierba: ['tHierba', 'nHierba'], tierra: ['tTierra', 'nTierra'], roca: ['tRoca', 'nRoca'], hojarasca: ['tHoja', 'nHoja'] };
  cargando = Promise.all([
    fetch(carpeta + 'medias.json').then(r => r.json()),
    ...CAPAS_SUELO.flatMap(c => [tex(c, true), tex(c + '_relieve', false)]),
  ]).then(([medias, ...t]) => {
    CAPAS_SUELO.forEach((c, i) => { capas[U[c][0]].value = t[i * 2]; capas[U[c][1]].value = t[i * 2 + 1]; capas.uMedias.value[i].fromArray(medias[c]); });
    hayCapas = true;
    if (hechos.cerca) { hechos.cerca.defines = { ...(hechos.cerca.defines || {}), CAPAS_SUELO: 1 }; hechos.cerca.needsUpdate = true; }
    return true;
  }).catch(() => false);
  return cargando;
}
export const carpetaSuelo = (recursos) => String(recursos || '../../recursos/personajes/taller/').replace(/personajes\/[^/]*\/?$/, 'suelo/cc0-v1/');
// el relieve del suelo (0–1), según el perfil gráfico
export const ponerRelieveSuelo = (v) => { capas.uRelieve.value = v; };
export const hayTexturasSuelo = () => hayCapas;
