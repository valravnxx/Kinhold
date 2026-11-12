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
import { Color, Uniform, Vector2, Vector3, Matrix3, Matrix4 } from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';
import { GLSL_COMPRESION } from '../logica/horizonte.js';

// El cielo vivo (el ciclo de día y noche, valravnx 7 nov; src/mundo/cielo.js): si lo hay, el cielo se pinta aquí por la
// dirección de cada píxel (no por su altura en la pantalla): el degradado, el halo y el disco del sol, la luna con la
// cara que le da el sol (así sale su fase sola) y las estrellas, que giran con la noche. En sRGB, como la niebla.
const GLSL_CIELO = `uniform vec3 cieloArriba;uniform vec3 cieloAbajo;uniform float uVivo;uniform vec3 uSol;uniform vec3 uLuna;uniform vec3 uColSol;uniform float uEstrellas;uniform mat3 uGiro;
uniform mat4 uInvProy;uniform mat4 uCamMundo;uniform float uPx;uniform float uTiempo;
vec3 rayoDe(vec2 uv){vec4 v=uInvProy*vec4(uv*2.0-1.0,1.0,1.0);v.xyz/=v.w;return normalize((uCamMundo*vec4(v.xyz,0.0)).xyz);}
// sin luna, sol ni estrellas: lo que tiene detrás lo que se ve lejos (la bruma y los bordes)
vec3 cieloBase(vec3 d){
  float e=d.y,c=max(dot(d,uSol),0.0),bajo=1.0-smoothstep(4.0,30.0,degrees(asin(clamp(uSol.y,-1.0,1.0))));
  float vis=smoothstep(-0.2,0.02,uSol.y);
  vec3 h=mix(cieloAbajo,uColSol,0.32*bajo*vis*pow(c,3.0)*(1.0-smoothstep(0.0,0.5,e)));
  vec3 col=mix(h,cieloArriba,pow(clamp(e/0.6,0.0,1.0),0.75));
  col+=uColSol*vis*(0.22*pow(c,3000.0)+0.1*pow(c,300.0)+0.12*pow(c,16.0)*(0.5+0.5*bajo)+0.07*pow(c,4.0)*bajo);
  return col;
}
vec3 hashC(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
// una capa de estrellas: el cielo como las seis caras de un cubo, cada una en N × N celdas, y en algunas celdas una
// estrella, lejos de su borde (no sale cortada); sale más gorda si un píxel es más grande que ella, y menos clara
float capaEstrellas(vec3 s,float N,float cuantas,float radio,float brillo){
  vec3 a=abs(s);vec2 uv;float cara;
  if(a.x>=a.y&&a.x>=a.z){uv=s.yz/a.x;cara=s.x>0.0?0.0:1.0;}
  else if(a.y>=a.z){uv=s.xz/a.y;cara=s.y>0.0?2.0:3.0;}
  else{uv=s.xy/a.z;cara=s.z>0.0?4.0:5.0;}
  vec2 p=(uv*0.5+0.5)*N,cel=floor(p);
  vec3 h=hashC(vec3(cel,cara*31.0+N));
  if(h.x>cuantas)return 0.0;
  vec2 pos=cel+0.25+0.5*hashC(vec3(cel,cara*31.0+N+7.0)).xy;
  float px=uPx*N*0.5,r=max(radio,px*0.7),d=length(p-pos);
  float b=brillo*(0.15+0.85*pow(h.y,3.0))*min(1.0,radio*radio/(px*px*0.49)+0.35);
  return b*exp(-d*d/(r*r))*(0.85+0.15*sin(uTiempo*(1.5+3.0*h.z)+h.y*40.0));
}
// las nubes (12 nov, el aspecto de maqueta): ruido en un techo plano, que pasa despacio; blancas y cálidas del lado del
// sol de día, y apenas una sombra de noche. Solo cuestan en los píxeles de cielo.
float ruidoN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hashC(vec3(i,1.7)).x,b=hashC(vec3(i+vec2(1.0,0.0),1.7)).x,c=hashC(vec3(i+vec2(0.0,1.0),1.7)).x,e=hashC(vec3(i+vec2(1.0,1.0),1.7)).x;
  return mix(mix(a,b,f.x),mix(c,e,f.x),f.y);}
float fbmN(vec2 p){float s=0.0,k=0.5;for(int i=0;i<4;i++){s+=k*ruidoN(p);p=p*2.03+vec2(17.3,9.1);k*=0.5;}return s;}
vec4 nubes(vec3 d){
  if(d.y<0.015)return vec4(0.0);
  vec2 p=d.xz/(d.y+0.16)*1.15+uTiempo*vec2(0.0045,0.0017);
  float n=fbmN(p),cob=smoothstep(0.5,0.72,n)*smoothstep(0.015,0.16,d.y);
  if(cob<0.003)return vec4(0.0);
  // la luz: más clara donde la nube es más fina hacia el sol
  float haciaSol=fbmN(p+normalize(uSol.xz+vec2(0.0001))*0.22),luz=clamp(0.62+1.5*(n-haciaSol),0.0,1.0);
  float dia=smoothstep(-0.12,0.14,uSol.y),bajo=1.0-smoothstep(4.0,30.0,degrees(asin(clamp(uSol.y,-1.0,1.0))));
  vec3 clara=mix(vec3(1.0,0.99,0.97),mix(vec3(1.0),uColSol,0.6),bajo),sombra=mix(cieloArriba,cieloAbajo,0.5)*0.92+0.04;
  vec3 c=mix(mix(cieloAbajo,cieloArriba,0.5)*0.8,mix(sombra,clara,luz),dia);
  return vec4(c,cob*mix(0.5,0.92,dia));
}
vec3 cieloVivo(vec3 d){
  vec3 col=cieloBase(d);
  float sobre=smoothstep(-0.03,0.01,d.y);
  // las estrellas (más débiles cerca del horizonte, donde hay más aire), dos capas: muchas débiles y pocas brillantes
  if(uEstrellas>0.001){
    vec3 s=uGiro*d;
    float st=capaEstrellas(s,420.0,0.3,0.12,0.9)+capaEstrellas(s,160.0,0.16,0.1,1.6)+capaEstrellas(s,55.0,0.12,0.06,2.6);
    vec3 tinte=mix(vec3(1.0,0.86,0.72),vec3(0.78,0.86,1.0),hashC(floor(s*160.0)).z);
    float aire=mix(0.35,1.0,smoothstep(0.0,0.25,d.y))*smoothstep(-0.01,0.02,d.y);
    // la Vía Láctea: una franja tenue y desigual que cruza el cielo
    float v=dot(s,normalize(vec3(0.35,0.2,0.92)));
    float nube=0.55+0.25*sin(s.x*7.0+sin(s.y*5.0)*1.7)*sin(s.y*6.0-s.z*4.0)+0.2*sin(s.z*13.0+s.x*9.0);
    float franja=exp(-v*v/0.03)*nube;
    col+=(tinte*st*(0.6+0.8*franja)+vec3(0.55,0.6,0.75)*0.05*franja)*uEstrellas*aire;
  }
  // las nubes, por delante de las estrellas y por detrás del sol y de la luna (que se ven a través)
  vec4 nb=nubes(d);col=mix(col,nb.rgb,nb.a);
  // el sol: un disco de 0,7° con el borde suave
  float cs=dot(d,uSol),bajoS=1.0-smoothstep(2.0,25.0,degrees(asin(clamp(uSol.y,-1.0,1.0))));
  col=mix(col,mix(vec3(1.0,0.98,0.92)*1.5,vec3(1.0,0.9,0.72)*1.35,bajoS),smoothstep(cos(radians(0.7)+uPx*1.5),cos(radians(0.7)),cs)*sobre);
  // la luna: un disco de 1° con la cara que mira al sol iluminada (de ahí sale la fase) y sus mares
  float cl=dot(d,uLuna),rl=radians(1.0);
  if(cl>cos(rl+uPx*2.0)){
    vec3 de=normalize(cross(uLuna,abs(uLuna.y)<0.99?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0))),ar=cross(de,uLuna);
    vec2 q=vec2(dot(d,de),dot(d,ar))/sin(rl);
    float r2=dot(q,q),borde=1.0-smoothstep(1.0-uPx*2.0/rl,1.0,sqrt(r2));
    vec3 n=normalize(q.x*de+q.y*ar-sqrt(max(0.0,1.0-r2))*uLuna);
    float luz=smoothstep(-0.04,0.12,dot(n,uSol));
    float mar=0.16*smoothstep(0.38,0.0,length(q-vec2(-0.28,0.22)))+0.14*smoothstep(0.32,0.0,length(q-vec2(0.18,0.05)))+0.1*smoothstep(0.3,0.0,length(q-vec2(-0.05,-0.38)))+0.05*sin(q.x*9.0+1.3)*sin(q.y*7.0-0.4);
    vec3 lc=vec3(0.93,0.93,0.9)*(1.0-mar)*luz*(1.0-0.55*smoothstep(-0.1,0.3,uSol.y))+vec3(0.035,0.04,0.05);
    col=mix(col,max(col,lc),borde*sobre);
  }
  // el halo de la luna, de noche
  col+=vec3(0.55,0.62,0.78)*0.09*pow(max(cl,0.0),220.0)*uEstrellas;
  return col;
}
`;

const frag = GLSL_COMPRESION + GLSL_CIELO + `uniform vec3 colorNiebla;uniform float nieblaCerca;uniform float nieblaLejos;
uniform float tope;uniform float maxLejos;uniform float lejosH;uniform float r0;uniform float sComp;uniform float wComp;uniform vec2 tanMedio;
vec3 aSRGB(const in vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
vec3 aLineal(const in vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
void mainImage(const in vec4 inputColor,const in vec2 uv,const in float depth,out vec4 outputColor){
  // el cielo: con horizonte se pinta aquí (el mismo degradado que la página) y todo sale opaco: los bordes contra el
  // cielo, con el suavizado que sea (MSAA o SMAA, que va después), ya no dejan una raya clara
  bool vivo=uVivo>0.5;
  vec3 rayo=vivo?rayoDe(uv):vec3(0.0,1.0,0.0);
  if(depth>=0.999999){
    if(vivo) outputColor=vec4(aLineal(cieloVivo(rayo)),1.0);
    else if(tope<1.0) outputColor=vec4(aLineal(mix(cieloArriba,cieloAbajo,clamp((1.0-uv.y)/0.6,0.0,1.0))),1.0);
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
    hacia=vivo?cieloBase(rayo):mix(cieloArriba,cieloAbajo,clamp((1.0-uv.y)/0.6,0.0,1.0));
    f+=(maxLejos-tope)*(1.0-exp2(-max(0.0,real-nieblaLejos)/lejosH));
  }
  vec3 s=mix(aSRGB(clamp(inputColor.rgb,0.0,1.0)),hacia,f);
  // en los bordes contra el cielo (el lienzo es transparente ahí) el suavizado deja píxeles a medias, que la página
  // mezclaba con su fondo como si fueran más claros (una raya clara en las crestas): con el horizonte, el cielo de
  // detrás se sabe, así que se mezcla aquí y el píxel queda opaco
  if(vivo&&inputColor.a<1.0) outputColor=vec4(aLineal(mix(tope<1.0?hacia:cieloBase(rayo),s,inputColor.a)),1.0);
  else if(tope<1.0&&inputColor.a<1.0) outputColor=vec4(aLineal(mix(hacia,s,inputColor.a)),1.0);
  else outputColor=vec4(aLineal(s),inputColor.a);
}`;

export class NieblaEffect extends Effect {
  // niebla: la THREE.Fog de la escena (su color y sus distancias); camara: la que dibuja (para el rayo de cada píxel);
  // horizonte (opcional): { tope, max, lejos, r0, s } (perfiles.js HORIZONTE y la compresión del horizonte)
  // vivo (opcional): el estado del cielo de día y noche (src/mundo/cielo.js), que se copia en cada fotograma
  constructor(niebla, camara = null, horizonte = null, vivo = null) {
    super('NieblaEffect', frag, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([['colorNiebla', new Uniform(new Color())], ['nieblaCerca', new Uniform(45)], ['nieblaLejos', new Uniform(130)],
        ['tope', new Uniform(1)], ['maxLejos', new Uniform(1)], ['lejosH', new Uniform(30000)], ['r0', new Uniform(1e9)], ['sComp', new Uniform(1)], ['wComp', new Uniform(0)],
        ['tanMedio', new Uniform(new Vector2(1, 1))], ['cieloArriba', new Uniform(new Color(0xa9bfca))], ['cieloAbajo', new Uniform(new Color(0xd9e1e0))],
        ['uVivo', new Uniform(0)], ['uSol', new Uniform(new Vector3(0, 1, 0))], ['uLuna', new Uniform(new Vector3(0, -1, 0))], ['uColSol', new Uniform(new Color(1, 1, 1))],
        ['uEstrellas', new Uniform(0)], ['uGiro', new Uniform(new Matrix3())], ['uInvProy', new Uniform(new Matrix4())], ['uCamMundo', new Uniform(new Matrix4())],
        ['uPx', new Uniform(0.001)], ['uTiempo', new Uniform(0)]]),
    });
    this.camara = camara;
    this.niebla = niebla;
    this.vivo = vivo;
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
  update(renderer) {
    const c = this.camara, U = (k) => this.uniforms.get(k);
    if (c && c.isPerspectiveCamera) { const t = Math.tan(c.fov * Math.PI / 360); U('tanMedio').value.set(t * c.aspect, t); }
    const v = this.vivo;
    U('uVivo').value = v && v.activo && c ? 1 : 0;
    if (!U('uVivo').value) return;
    this.poner(this.niebla);   // (su color cambia con la hora)
    U('uSol').value.copy(v.sol); U('uLuna').value.copy(v.luna); U('uColSol').value.copy(v.colorSol);
    U('cieloArriba').value.copy(v.arriba); U('cieloAbajo').value.copy(v.horizonte);
    U('uEstrellas').value = v.estrellas; U('uGiro').value.copy(v.giro); U('uTiempo').value = v.tiempo;
    c.updateMatrixWorld();
    U('uInvProy').value.copy(c.projectionMatrixInverse); U('uCamMundo').value.copy(c.matrixWorld);
    // lo que mide un píxel (rad), para que las estrellas y los bordes no salgan ni más finos ni dentados
    const alto = renderer ? renderer.getDrawingBufferSize(this.__tam || (this.__tam = new Vector2())).y : innerHeight;
    U('uPx').value = (c.isPerspectiveCamera ? c.fov * Math.PI / 180 : 1) / Math.max(1, alto);
  }
}
