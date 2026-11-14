// Kinhold — la lluvia que se ve (P11b, «La lluvia y el riego»): gotas alrededor de la cámara, en una sola malla
// (LineSegments: un trazo por gota) que se mueve entera en la tarjeta gráfica, sin tocar nada en cada fotograma más que
// unos pocos uniformes. Es barata: una sola llamada de dibujo y CUANTAS trazos (menos en el móvil).
// Las gotas están fijas en el mundo dentro de una caja que se repite (no van pegadas a la cámara: al moverte, pasas
// entre ellas), caen inclinadas un poco por el viento y se apagan en los bordes de la caja y pegadas a la cámara.
// cantidad (0–1): cuántas gotas se ven (de ninguna a todas) — el paso de un tiempo a otro lo hace src/mundo/tiempo_vista.js.
// No escriben profundidad (no ensucian la oclusión ambiental ni la niebla); contra el cielo las mezcla la niebla del
// posprocesado (src/posprocesado/niebla.js, el alfa del lienzo).
import * as THREE from 'three';

export const CAJA = [26, 16, 26];     // m: la caja que se repite, alrededor de la cámara
export const VELOCIDAD = 9;           // m/s: lo que cae una gota (de verdad, unos 9 m/s)
export const LARGO = 0.55;            // m: lo que mide el trazo (lo que recorre la gota mientras se ve)

const VERT = `attribute vec4 semilla;attribute float punta;
uniform vec3 uCentro;uniform vec3 uCaja;uniform float uT;uniform vec2 uViento;uniform float uLargo;uniform float uVel;uniform float uCantidad;
varying float vAlfa;
void main(){
  // la gota en el mundo: su sitio en la caja, menos lo que ha caído, y la caja repetida alrededor de la cámara
  vec3 caida=normalize(vec3(uViento.x,-uVel,uViento.y));
  vec3 p=semilla.xyz*uCaja+caida*(uT*length(vec3(uViento.x,uVel,uViento.y))*(0.85+0.3*semilla.w));
  p=uCentro+(fract((p-uCentro)/uCaja+0.5)-0.5)*uCaja;
  p+=caida*punta*uLargo;
  // se apaga en los bordes de la caja y muy cerca de la cámara; y no sale si sobra para esta cantidad
  vec3 r=abs(p-uCentro)/(uCaja*0.5);
  float borde=1.0-smoothstep(0.65,1.0,max(r.x,max(r.y,r.z)));
  float cerca=smoothstep(0.8,2.5,distance(p,cameraPosition));
  vAlfa=borde*cerca*step(semilla.w,uCantidad)*(1.0-0.75*punta);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`;
const FRAG = `uniform vec3 uColor;uniform float uOpacidad;varying float vAlfa;
void main(){if(vAlfa<0.01)discard;gl_FragColor=vec4(uColor,uOpacidad*vAlfa);}`;

// cuantas: gotas (trazos); en el móvil, menos
export function crearLluvia(escena, { cuantas = 4000 } = {}) {
  const sem = new Float32Array(cuantas * 2 * 4), punta = new Float32Array(cuantas * 2), pos = new Float32Array(cuantas * 2 * 3);
  // un azar fijo (siempre las mismas gotas: las capturas se pueden comparar)
  let s = 12345;
  const azar = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
  for (let i = 0; i < cuantas; i++) {
    const g = [azar(), azar(), azar(), azar()];
    for (let k = 0; k < 2; k++) { sem.set(g, (i * 2 + k) * 4); punta[i * 2 + k] = k; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));   // (no se usa: la posición sale de la semilla)
  geo.setAttribute('semilla', new THREE.BufferAttribute(sem, 4));
  geo.setAttribute('punta', new THREE.BufferAttribute(punta, 1));
  const uniforms = {
    uCentro: { value: new THREE.Vector3() }, uCaja: { value: new THREE.Vector3(...CAJA) }, uT: { value: 0 },
    uViento: { value: new THREE.Vector2(1.6, 0.7) }, uLargo: { value: LARGO }, uVel: { value: VELOCIDAD }, uCantidad: { value: 0 },
    uColor: { value: new THREE.Color(0xc9d2da) }, uOpacidad: { value: 0.3 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, fog: false });
  const malla = new THREE.LineSegments(geo, mat);
  malla.frustumCulled = false;   // (la caja va con la cámara: siempre a la vista)
  malla.renderOrder = 10;
  malla.visible = false;
  malla.name = 'lluvia';
  escena.add(malla);
  let t = 0;
  return {
    malla, cuantas,
    get cantidad() { return uniforms.uCantidad.value; },
    // camara: la que dibuja; cantidad: 0–1; luz: lo clara que se ve una gota (0–1, más de día, menos de noche); dt en s
    paso(camara, cantidad, luz = 1, dt = 1 / 60) {
      t = (t + dt) % 3600;
      uniforms.uT.value = t;
      uniforms.uCantidad.value = cantidad;
      uniforms.uCentro.value.copy(camara.position);
      uniforms.uColor.value.setRGB(0.7, 0.74, 0.78).multiplyScalar(0.25 + 0.75 * luz);
      malla.visible = cantidad > 0.002;
    },
  };
}
