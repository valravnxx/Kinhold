// Kinhold — la niebla como efecto de posprocesado, igual que la de three.js.
// three.js mezcla la niebla DESPUÉS del mapeo tonal, en los colores ya como se ven (sRGB). Con el posprocesado, la
// niebla de la escena se mezclaría ANTES, en colores lineales, y la misma niebla se vería mucho más espesa (medido el
// 4 nov: arriba de la vista general, 225 de 255 contra 109 en la v5 publicada). Así que, con posprocesado, la escena va
// sin niebla y la pone este efecto, detrás del mapeo tonal: misma distancia (desde la cámara, de cerca a lejos con
// smoothstep, como three.js), mismo color y en el mismo espacio de color. El cielo (sin profundidad) no lleva niebla,
// como en three.js. De paso, lo que sale lejos se cubre después de la oclusión ambiental, como debe ser.
import { Color, Uniform } from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

const frag = `uniform vec3 colorNiebla;uniform float nieblaCerca;uniform float nieblaLejos;
vec3 aSRGB(const in vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
vec3 aLineal(const in vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
void mainImage(const in vec4 inputColor,const in vec2 uv,const in float depth,out vec4 outputColor){
  if(depth>=0.999999){outputColor=inputColor;return;}
#ifdef PERSPECTIVE_CAMERA
  float d=-perspectiveDepthToViewZ(depth,cameraNear,cameraFar);
#else
  float d=-orthographicDepthToViewZ(depth,cameraNear,cameraFar);
#endif
  float f=smoothstep(nieblaCerca,nieblaLejos,d);
  vec3 s=aSRGB(clamp(inputColor.rgb,0.0,1.0));
  outputColor=vec4(aLineal(mix(s,colorNiebla,f)),inputColor.a);
}`;

export class NieblaEffect extends Effect {
  // niebla: la THREE.Fog de la escena (su color y sus distancias)
  constructor(niebla) {
    super('NieblaEffect', frag, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([['colorNiebla', new Uniform(new Color())], ['nieblaCerca', new Uniform(45)], ['nieblaLejos', new Uniform(130)]]),
    });
    this.poner(niebla);
  }
  poner(niebla) {
    if (!niebla) return;
    // el color tal como se ve (sRGB), que es como lo mezcla three.js
    this.uniforms.get('colorNiebla').value.copy(niebla.color).convertLinearToSRGB();
    this.uniforms.get('nieblaCerca').value = niebla.near;
    this.uniforms.get('nieblaLejos').value = niebla.far;
  }
}
