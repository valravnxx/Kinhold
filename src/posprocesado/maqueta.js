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
// (arriba, la franja nítida llega más lejos: ahí están los árboles y lo que tienes delante)
export const MAQUETA = { centro: 0.46, franja: 0.2, franjaArriba: 0.32, fuerza: 0.009 };

// El modo maqueta al 100 % (valravnx, 13 nov: «pon un modo en opciones para tener el modo maqueta 100%»). Lo que hace
// creíble una foto de maqueta (la lente basculada sobre una miniatura): poquísima profundidad de campo. Así que, además de
// la franja de la pantalla (más estrecha y con más emborronado), se emborrona también por la distancia: el plano
// enfocado pasa por el personaje (la distancia que hay en el centro de la franja) y lo que está claramente más cerca o
// más lejos se emborrona aunque caiga en el centro de la pantalla. 24 muestras (no se ve granulado con el radio mayor),
// las luces fuertes pesan más (el emborronado de lente, no de mancha) y el color de juguete: un poco más de saturación
// y de contraste, como se hace al falsear maquetas en fotografía. De noche, casi nada, como el normal.
//   franja/franjaArriba/fuerza: las del normal, más cortas y más fuertes; cerca/lejos: desde qué fracción de la
//   distancia de foco por delante o por detrás empieza a emborronarse y dónde llega al máximo; profundidad: cuánto
//   pesa la distancia frente a la altura; saturacion/contraste: el color de juguete (1 = como está)
export const MAQUETA_FUERTE = { centro: 0.46, franja: 0.1, franjaArriba: 0.17, fuerza: 0.02, cerca: 0.18, lejos: 0.95, profundidad: 0.85, saturacion: 1.14, contraste: 1.06 };

const frag = `uniform float uCentro;uniform float uFranja;uniform float uFranjaArriba;uniform float uFuerza;uniform float uNoche;
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
  float lejos=abs(uv.y-uCentro);
  float k=smoothstep(uv.y>uCentro?uFranjaArriba:uFranja,0.56,lejos);
  if(k<0.002||uNoche>0.98){outputColor=inputColor;return;}
  // (en una pantalla de pie, el mismo tanto por ciento del alto son muchos más píxeles de ancho: algo menos)
  vec2 r=vec2(uFuerza/aspect,uFuerza)*k*min(1.0,0.5+0.5*aspect)*(1.0-0.85*uNoche);
  vec4 s=inputColor;float n=1.0;
  // espiral del ángulo de oro: 12 muestras repartidas en el disco
  for(int i=1;i<=12;i++){
    float fi=float(i),a=fi*2.39996323,d=sqrt(fi/12.0);
    s+=texture2D(inputBuffer,uv+vec2(cos(a),sin(a))*d*r);n+=1.0;
  }
  outputColor=s/n;
}`;

const fragFuerte = `uniform float uCentro;uniform float uFranja;uniform float uFranjaArriba;uniform float uFuerza;uniform float uNoche;
uniform float uCerca;uniform float uLejos;uniform float uProfundidad;uniform float uSaturacion;uniform float uContraste;
float distanciaEn(const in vec2 p){return -getViewZ(readDepth(p));}
void mainImage(const in vec4 inputColor,const in vec2 uv,const in float depth,out vec4 outputColor){
  // el foco: la distancia en el centro de la franja (donde está el personaje), la media de cinco puntos
  float foco=(distanciaEn(vec2(0.5,uCentro))+distanciaEn(vec2(0.47,uCentro))+distanciaEn(vec2(0.53,uCentro))
    +distanciaEn(vec2(0.5,uCentro-0.03))+distanciaEn(vec2(0.5,uCentro+0.03)))*0.2;
  float lejos=abs(uv.y-uCentro);
  float ky=smoothstep(uv.y>uCentro?uFranjaArriba:uFranja,0.5,lejos);
  float rel=abs(-getViewZ(depth)-foco)/max(foco,0.5);
  float kz=smoothstep(uCerca,uLejos,rel)*uProfundidad;
  float k=clamp(max(ky,kz)+0.35*ky*kz,0.0,1.0)*(1.0-0.85*uNoche);
  vec3 c=inputColor.rgb;
  if(k>0.002){
    vec2 r=vec2(uFuerza/aspect,uFuerza)*k*min(1.0,0.5+0.5*aspect);
    // espiral del ángulo de oro: 24 muestras en el disco; las luces fuertes pesan más (como en una lente)
    vec3 s=c;float n=1.0;
    for(int i=1;i<=24;i++){
      float fi=float(i),a=fi*2.39996323,d=sqrt(fi/24.0);
      vec3 m=texture2D(inputBuffer,uv+vec2(cos(a),sin(a))*d*r).rgb;
      float w=1.0+2.0*max(0.0,dot(m,vec3(0.2126,0.7152,0.0722))-0.7);
      s+=m*w;n+=w;
    }
    c=s/n;
  }
  // el color de juguete (menos de noche)
  float sat=mix(1.0,uSaturacion,1.0-uNoche),con=mix(1.0,uContraste,1.0-uNoche);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(vec3(l),c,sat);
  c=(c-0.5)*con+0.5;
  outputColor=vec4(clamp(c,0.0,1.0),inputColor.a);
}`;

// El de 100 %: el mismo funcionamiento que el normal, con la distancia de cada píxel (EffectAttribute.DEPTH)
export class MaquetaFuerteEffect extends Effect {
  constructor({ vivo = null, ...m } = {}) {
    const M = { ...MAQUETA_FUERTE, ...m };
    super('MaquetaFuerteEffect', fragFuerte, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map([['uCentro', new Uniform(M.centro)], ['uFranja', new Uniform(M.franja)], ['uFranjaArriba', new Uniform(M.franjaArriba)], ['uFuerza', new Uniform(M.fuerza)], ['uNoche', new Uniform(0)],
        ['uCerca', new Uniform(M.cerca)], ['uLejos', new Uniform(M.lejos)], ['uProfundidad', new Uniform(M.profundidad)], ['uSaturacion', new Uniform(M.saturacion)], ['uContraste', new Uniform(M.contraste)]]),
    });
    this.vivo = vivo;
  }
  update() { this.uniforms.get('uNoche').value = this.vivo && this.vivo.activo ? this.vivo.estrellas : 0; }
}

// cuánto se emborrona en el de 100 %, de 0 a 1, a una altura de la pantalla y a una distancia (en veces la del foco: 1
// es el personaje): lo mismo que el sombreador (para las pruebas)
export function emborronadoFuerte(y, rel, M = MAQUETA_FUERTE) {
  const paso = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ky = paso(y > M.centro ? M.franjaArriba : M.franja, 0.5, Math.abs(y - M.centro));
  const kz = paso(M.cerca, M.lejos, Math.abs(rel - 1)) * M.profundidad;
  return Math.min(1, Math.max(ky, kz) + 0.35 * ky * kz);
}

export class MaquetaEffect extends Effect {
  // vivo (opcional): el estado del cielo de día y noche (src/mundo/cielo.js). De noche casi no se emborrona: las
  // estrellas son puntos, y con 12 muestras cada una salía como un corro de puntos
  constructor({ centro = MAQUETA.centro, franja = MAQUETA.franja, franjaArriba = MAQUETA.franjaArriba, fuerza = MAQUETA.fuerza, vivo = null } = {}) {
    super('MaquetaEffect', frag, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['uCentro', new Uniform(centro)], ['uFranja', new Uniform(franja)], ['uFranjaArriba', new Uniform(franjaArriba)], ['uFuerza', new Uniform(fuerza)], ['uNoche', new Uniform(0)]]),
    });
    this.vivo = vivo;
  }
  update() { this.uniforms.get('uNoche').value = this.vivo && this.vivo.activo ? this.vivo.estrellas : 0; }
}

// cuánto se emborrona a una altura de la pantalla (0–1), de 0 a 1: lo mismo que el sombreador (para las pruebas)
export function emborronado(y, M = MAQUETA) {
  const f = y > M.centro ? M.franjaArriba : M.franja;
  const t = Math.max(0, Math.min(1, (Math.abs(y - M.centro) - f) / (0.56 - f)));
  return t * t * (3 - 2 * t);
}
