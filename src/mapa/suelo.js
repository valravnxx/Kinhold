// Kinhold — el material del suelo del paisaje: el de la textura «suelo» del estilo v5 (Lambert con su relieve), con dos
// cambios para las paredes de roca:
//   - proyección triplanar: la textura se proyecta desde los tres ejes y se mezcla según hacia dónde mira el suelo; así
//     en una pared no sale estirada en rayas verticales, como pasa al proyectarla solo desde arriba;
//   - en lo que es pared (más de unos 50°), sombreado por caras planas: la roca se ve en facetas con aristas, no como
//     una superficie blanda.
import { materialTex } from '../mundo/estilos.js';

const hechos = {};
export function materialSuelo({ lejos = false } = {}) {
  const k = lejos ? 'lejos' : 'cerca';
  if (hechos[k]) return hechos[k];
  const m = materialTex('suelo').clone();
  if (lejos) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSueloPos; varying vec3 vSueloNor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSueloPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vSueloNor = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSueloPos; varying vec3 vSueloNor;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec3 pesoT = pow(abs(normalize(vSueloNor)), vec3(4.0)); pesoT /= (pesoT.x + pesoT.y + pesoT.z);
  vec2 uvX = vSueloPos.zy * 0.5, uvY = vSueloPos.xz * 0.5, uvZ = vSueloPos.xy * 0.5;
  vec4 texT = texture2D(map, uvX) * pesoT.x + texture2D(map, uvY) * pesoT.y + texture2D(map, uvZ) * pesoT.z;
  diffuseColor *= texT;
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    // pared: caras planas (la normal de cada triángulo, sacada de cómo cambia la posición en la pantalla)
    float pared = 1.0 - smoothstep(0.5, 0.68, normalize(vSueloNor).y);
    if (pared > 0.0) {
      vec3 plana = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
      normal = normalize(mix(normal, plana, pared));
    }
  }`);
  };
  m.customProgramCacheKey = () => 'sueloKinhold' + k;
  return (hechos[k] = m);
}
