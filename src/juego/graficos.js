// Kinhold — el perfil gráfico y el posprocesado en el juego (valravnx, 5 nov: «mételo al juego ya», tras la prueba de
// posprocesado v1). La cadena de efectos es la de la prueba (src/posprocesado/efectos.js) y los seis perfiles los de
// src/posprocesado/perfiles.js. Aquí solo se elige el perfil y se dibuja con él:
//   - el que se haya elegido en este navegador (se guarda), o el de ?graficos=<perfil> en la dirección;
//   - si no, el que sugiere el aparato (sugerirPerfil): un móvil con buena gráfica, «Móvil alto y tableta», etc.
// Se cambia en el panel de rendimiento (el botón de los fps, junto a «Menú»: src/demo/rendimiento.js).
// En el juego no van el desenfoque (solo para escenas concretas, que aún no hay) ni los haces de luz (con la cámara del
// juego casi nunca se mira al sol, y en la prueba apenas se veían): la cadena es la de cada perfil sin esos dos.
import { PERFILES, perfil, efectosDe, sugerirPerfil } from '../posprocesado/perfiles.js';
import { crearPosprocesado } from '../posprocesado/efectos.js';

const CLAVE = 'kinhold_graficos';
const leer = () => { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } };
const guardar = (id) => { try { localStorage.setItem(CLAVE, id); } catch (e) { /* sin almacenamiento */ } };

// lo que se sabe del aparato antes de dibujar nada
export function aparatoDe(renderer) {
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    tactil: matchMedia('(pointer: coarse)').matches, memoria: navigator.deviceMemory || null, nucleos: navigator.hardwareConcurrency || null,
    grafica: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), dpr: window.devicePixelRatio || 1,
  };
}

// escena, camara y ambiente: los del juego; la niebla de la escena se toma ahora (con posprocesado la pone el efecto)
// horizonte (opcional): el del mundo (src/mundo/horizonte.js): los perfiles altos lo encienden, con su niebla
// cieloVivo (opcional): el del ciclo de día y noche (src/mundo/cielo.js), que pinta la niebla
export function crearGraficos(renderer, escena, camara, ambiente, horizonte = null, cieloVivo = null) {
  const niebla = escena.fog;
  const post = crearPosprocesado(renderer, escena, camara, { niebla: () => niebla, luzSol: ambiente.sol, compresion: horizonte ? () => horizonte.compresion : null, cielo: () => ambiente.cielo || null, cieloVivo });
  const aparato = aparatoDe(renderer);
  const sugerido = sugerirPerfil(aparato);
  const enDireccion = new URLSearchParams(location.search).get('graficos');
  let actual = [enDireccion, leer(), sugerido].find(id => id && PERFILES.some(p => p.id === id));
  const alCambiar = [];
  function poner(id, recordar = true) {
    if (!PERFILES.some(p => p.id === id)) return false;
    actual = id;
    post.montar(perfil(id), { ...efectosDe(perfil(id)), desenfoque: false, rayos: false });
    if (horizonte) horizonte.poner(perfil(id).horizonte || null);
    if (recordar) guardar(id);
    for (const f of alCambiar) f(id);
    return true;
  }
  poner(actual, false);
  const g = {
    PERFILES, sugerido, aparato,
    get perfil() { return actual; },
    poner,
    alCambiar: (f) => alCambiar.push(f),
    get pasadas() { return post.pasadas; },
    horizonte,
    dibujar: (dt) => post.dibujar(dt),
    setSize: (w, h) => post.setSize(w, h),
    medir: (n) => post.medir(n),
  };
  window.__graficos = g;
  return g;
}
