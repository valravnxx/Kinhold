// Kinhold — la niebla como efecto de posprocesado, igual que la de three.js.
// three.js mezcla la niebla DESPUÉS del mapeo tonal, en los colores ya como se ven (sRGB). Con el posprocesado, la
// niebla de la escena se mezclaría ANTES, en colores lineales, y la misma niebla se vería mucho más espesa (medido el
// 4 nov: arriba de la vista general, 225 de 255 contra 109 en la v5 publicada). Así que, con posprocesado, la escena va
// sin niebla y la pone este efecto, detrás del mapeo tonal: misma distancia (desde la cámara, de cerca a lejos con
// smoothstep, como three.js), mismo color y en el mismo espacio de color. El cielo (sin profundidad) no lleva niebla,
// como en three.js. De paso, lo que sale lejos se cubre después de la oclusión ambiental, como debe ser.
//
// Con el horizonte (los perfiles altos, valravnx 5 nov; src/mundo/horizonte.js): la niebla de cerca no pasa de «tope»
// (si llegara a 1, taparía las montañas) y lo lejano se funde con el cielo de detrás, hacia «max» (lo que falta, la
// mitad cada «lejos» metros de verdad). El
// horizonte va comprimido (lo más allá de r0 se acerca a la cámara por la línea de mirada): aquí se deshace, con la
// distancia por el rayo de cada píxel, para saber lo lejos que está de verdad.
import { Color, Uniform, Vector2 } from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';
import { GLSL_COMPRESION } from '../logica/horizonte.js';

const frag = GLSL_COMPRESION + `uniform vec3 colorNiebla;uniform float nieblaCerca;uniform float nieblaLejos;
uniform float tope;uniform float maxLejos;uniform float lejosH;uniform float r0;uniform float sComp;uniform float wComp;uniform vec2 tanMedio;uniform vec3 cieloArriba;uniform vec3 cieloAbajo;
vec3 aSRGB(const in vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
vec3 aLineal(const in vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
void mainImage(const in vec4 inputColor,const in vec2 uv,const in float depth,out vec4 outputColor){
  // el cielo: con horizonte se pinta aquí (el mismo degradado que la página) y todo sale opaco: los bordes contra el
  // cielo, con el suavizado que sea (MSAA o SMAA, que va después), ya no dejan una raya clara
  if(depth>=0.999999){
    if(tope<1.0) outputColor=vec4(aLineal(mix(cieloArriba,cieloAbajo,clamp((1.0-uv.y)/0.6,0.0,1.0))),1.0);
    else outputColor=inputColor;
    return;
  }
#ifdef PERSPECTIVE_CAMERA
  float d=-perspectiveDepthToViewZ(depth,cameraNear,cameraFar);
#else
  float d=-orthographicDepthToViewZ(depth,cameraNear,cameraFar);
#endif
  float f=min(smoothstep(nieblaCerca,nieblaLejos,d),tope);
  vec3 hacia=colorNiebla;
  if(tope<1.0){
    // la distancia por el rayo (no la de frente) y sin la compresión del horizonte
    float rad=d*length(vec3((uv*2.0-1.0)*tanMedio,1.0));
    float real=hzDescomp(rad,r0,sComp,wComp);
    // lo lejano se funde con el cielo que tiene detrás (el degradado de la página: arriba, y del 60 % para abajo, el
    // del horizonte, que es el color de la niebla), como las montañas de verdad: así no salen más claras que el
    // cielo ni con una raya clara en la cresta; y se va perdiendo con la distancia (la mitad de lo que falta cada lejosH)
    hacia=mix(cieloArriba,cieloAbajo,clamp((1.0-uv.y)/0.6,0.0,1.0));
    f+=(maxLejos-tope)*(1.0-exp2(-max(0.0,real-nieblaLejos)/lejosH));
  }
  vec3 s=mix(aSRGB(clamp(inputColor.rgb,0.0,1.0)),hacia,f);
  // en los bordes contra el cielo (el lienzo es transparente ahí) el suavizado deja píxeles a medias, que la página
  // mezclaba con su fondo como si fueran más claros (una raya clara en las crestas): con el horizonte, el cielo de
  // detrás se sabe, así que se mezcla aquí y el píxel queda opaco
  if(tope<1.0&&inputColor.a<1.0) outputColor=vec4(aLineal(mix(hacia,s,inputColor.a)),1.0);
  else outputColor=vec4(aLineal(s),inputColor.a);
}`;

export class NieblaEffect extends Effect {
  // niebla: la THREE.Fog de la escena (su color y sus distancias); camara: la que dibuja (para el rayo de cada píxel);
  // horizonte (opcional): { tope, max, lejos, r0, s } (perfiles.js HORIZONTE y la compresión del horizonte)
  constructor(niebla, camara = null, horizonte = null) {
    super('NieblaEffect', frag, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([['colorNiebla', new Uniform(new Color())], ['nieblaCerca', new Uniform(45)], ['nieblaLejos', new Uniform(130)],
        ['tope', new Uniform(1)], ['maxLejos', new Uniform(1)], ['lejosH', new Uniform(30000)], ['r0', new Uniform(1e9)], ['sComp', new Uniform(1)], ['wComp', new Uniform(0)],
        ['tanMedio', new Uniform(new Vector2(1, 1))], ['cieloArriba', new Uniform(new Color(0xa9bfca))], ['cieloAbajo', new Uniform(new Color(0xd9e1e0))]]),
    });
    this.camara = camara;
    this.poner(niebla);
    this.ponerHorizonte(horizonte);
  }
  poner(niebla) {
    if (!niebla) return;
    // el color tal como se ve (sRGB), que es como lo mezcla three.js
    this.uniforms.get('colorNiebla').value.copy(niebla.color).convertLinearToSRGB();
    this.uniforms.get('nieblaCerca').value = niebla.near;
    this.uniforms.get('nieblaLejos').value = niebla.far;
  }
  ponerHorizonte(h) {
    const u = (k, v) => { this.uniforms.get(k).value = v; };
    if (!h) { u('tope', 1); u('maxLejos', 1); u('r0', 1e9); u('sComp', 1); u('wComp', 0); return; }
    u('tope', h.tope); u('maxLejos', h.max); u('lejosH', h.lejos); u('r0', h.r0); u('sComp', h.s); u('wComp', h.w || 0);
    // los colores del cielo, tal como se ven (sRGB; los hex de la luz ya lo son)
    if (h.cielo) { this.uniforms.get('cieloArriba').value.setHex(h.cielo[0]).convertLinearToSRGB(); this.uniforms.get('cieloAbajo').value.setHex(h.cielo[1]).convertLinearToSRGB(); }
  }
  update() {
    const c = this.camara;
    if (c && c.isPerspectiveCamera) { const t = Math.tan(c.fov * Math.PI / 360); this.uniforms.get('tanMedio').value.set(t * c.aspect, t); }
  }
}
