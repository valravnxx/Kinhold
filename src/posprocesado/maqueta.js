// Kinhold — el desenfoque de maqueta mientras se juega (valravnx, 12 nov, tras la auditoría: «pruébala, vamos a meterla
// y ver si es muy intrusivo o no»). La referencia del juego (diseno/referencia/aspecto_del_juego.jpg) es una maqueta en
// miniatura fotografiada de cerca: nítida en una franja y desenfocada arriba y abajo. Aquí, lo mismo y barato: una sola
// pasada que emborrona según la altura en la pantalla (no según la profundidad): nada en la franja del centro, donde
// está el personaje y lo que hace, y cada vez más hacia el borde de arriba y el de abajo. 12 muestras en espiral.
//
// No esconde nada de lo que importa para jugar (GDD, apartado 3): la franja nítida ocupa el centro de la pantalla y lo de
// los bordes se sigue viendo, solo más blando. Se puede quitar en Ajustes (src/juego/graficos.js). El desenfoque de
// profundidad de verdad (DepthOfFieldEffect) sigue siendo solo para escenas concretas.
import { Uniform } from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

// centro: la altura de la franja nítida (0 abajo, 1 arriba); franja: media altura de lo que queda nítido del todo;
// fuerza: el radio del emborronado en el borde, en alturas de pantalla
export const MAQUETA = { centro: 0.46, franja: 0.2, fuerza: 0.011 };

const frag = `uniform float uCentro;uniform float uFranja;uniform float uFuerza;
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
  float lejos=abs(uv.y-uCentro);
  float k=smoothstep(uFranja,0.56,lejos);
  if(k<0.002){outputColor=inputColor;return;}
  vec2 r=vec2(uFuerza/aspect,uFuerza)*k;
  vec4 s=inputColor;float n=1.0;
  // espiral del ángulo de oro: 12 muestras repartidas en el disco
  for(int i=1;i<=12;i++){
    float fi=float(i),a=fi*2.39996323,d=sqrt(fi/12.0);
    s+=texture2D(inputBuffer,uv+vec2(cos(a),sin(a))*d*r);n+=1.0;
  }
  outputColor=s/n;
}`;

export class MaquetaEffect extends Effect {
  constructor({ centro = MAQUETA.centro, franja = MAQUETA.franja, fuerza = MAQUETA.fuerza } = {}) {
    super('MaquetaEffect', frag, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['uCentro', new Uniform(centro)], ['uFranja', new Uniform(franja)], ['uFuerza', new Uniform(fuerza)]]),
    });
  }
}

// cuánto se emborrona a una altura de la pantalla (0–1), de 0 a 1: lo mismo que el sombreador (para las pruebas)
export function emborronado(y, M = MAQUETA) {
  const t = Math.max(0, Math.min(1, (Math.abs(y - M.centro) - M.franja) / (0.56 - M.franja)));
  return t * t * (3 - 2 * t);
}
