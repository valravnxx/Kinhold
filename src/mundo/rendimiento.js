// Kinhold — medida del rendimiento, común a todas las partes.
// Cada parte llama a vigilar(renderer) al crear su renderer; desde entonces se cuentan los fotogramas dibujados,
// cuánto tarda cada uno, los triángulos y las llamadas de dibujo de cada fotograma, la memoria de la tarjeta
// (geometrías y texturas que conoce three.js) y la de JavaScript (solo la dicen Chrome y los navegadores
// basados en él). No dibuja nada en pantalla: los números los enseña la demo (src/demo/rendimiento.js).
const estado = { renderer: null, escena: null, gente: null };
const ventana = { cuenta: 0, t0: 0, peor: 0, antes: 0 };
const medida = { fps: 0, ms: 0, peor: 0, triangulos: 0, dibujados: 0, geometrias: 0, texturas: 0, memoriaJS: null, personajes: 0, resolucion: 1, ancho: 0, alto: 0 };

// personajes en la escena: un esqueleto por personaje (las capas de ropa comparten el hueso raíz)
function contarPersonajes(escena) {
  const raices = new Set();
  escena.traverse(o => { if (o.isSkinnedMesh && o.visible && o.skeleton && o.skeleton.bones.length) raices.add(o.skeleton.bones[0]); });
  return raices.size;
}

export function vigilar(renderer) {
  estado.renderer = renderer;
  const info = renderer.info;
  const dibujar = renderer.render.bind(renderer);
  renderer.render = (escena, camara) => {
    dibujar(escena, camara);
    estado.escena = escena;
    const ahora = performance.now();
    if (ventana.antes) ventana.peor = Math.max(ventana.peor, ahora - ventana.antes);
    ventana.antes = ahora;
    if (!ventana.t0) ventana.t0 = ahora;
    ventana.cuenta++;
    medida.triangulos = info.render.triangles; medida.dibujados = info.render.calls;
    if (ahora - ventana.t0 >= 1000) cerrarVentana(ahora);
  };
}

function cerrarVentana(ahora) {
  const r = estado.renderer, dt = ahora - ventana.t0;
  medida.fps = Math.round(ventana.cuenta * 1000 / dt);
  medida.ms = +(dt / ventana.cuenta).toFixed(1);
  medida.peor = Math.round(ventana.peor);
  medida.geometrias = r.info.memory.geometries; medida.texturas = r.info.memory.textures;
  medida.memoriaJS = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  medida.resolucion = +r.getPixelRatio().toFixed(2);
  const gl = r.getContext(); medida.ancho = gl.drawingBufferWidth; medida.alto = gl.drawingBufferHeight;
  if (estado.escena) medida.personajes = contarPersonajes(estado.escena);
  ventana.t0 = ahora; ventana.cuenta = 0; ventana.peor = 0;
}

// la última medida (se renueva cada segundo); null si ninguna parte ha registrado su renderer
export function medidaRendimiento() { return estado.renderer ? { ...medida } : null; }

// Una parte puede ofrecer personajes de más para medir con gente: { poner(n), cuantos() }
export function ofrecerGente(g) { estado.gente = g; }
export function genteDePrueba() { return estado.gente; }
