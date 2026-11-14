// Las obras y lo alisado con la brocha, por trozos del mundo (hito «El juego en el mundo de verdad»). Lógica pura (sin
// three.js ni websocket): la usan el servidor, el navegador (src/logica/en_linea.js) y las pruebas.
//
// Igual que lo talado y lo recogido (src/logica/trozos_red.js), a cada jugador le llega solo lo de los trozos que tiene
// alrededor. Pero las obras no se pueden mandar como una lista de acciones sueltas: los ids salen de un contador común
// (siguienteId) y el arcón de materiales y los mojones (src/logica/construccion.js) son de todo el mundo, así que rehacer solo una parte de las acciones
// daría otros ids y otro arcón que en el servidor. Por eso:
//   - La bienvenida y cada cambio de trozo llevan una foto del mundo de construcción con solo lo de esos trozos
//     ({ tipo: 'obras', obras }: lo que da Mundo.exportar, con las construcciones, la decoración y lo nivelado de esos
//     trozos y el contador, el arcón y el mojón de todos). El navegador cambia su mundo por ella.
//   - Cada acción que sale bien se reparte solo a quien tiene su trozo (y al autor); las que no tienen sitio (el mojón,
//     el arcón, rellenar) a todos. Va con «antes»: el contador, el arcón y el mojón del servidor justo antes de hacerla,
//     así el navegador la hace igual aunque no le hayan llegado las de otros sitios.
// Una construcción va en el trozo de su origen (ox, oz) entera, aunque pase a otro; la decoración y lo nivelado, en el de
// su punto.
import { trozoDe } from './trozos_red.js';

// Dónde cae una acción de construcción, antes de hacerla: { x, z }, o null si es de todo el mundo. Para 'colocar' en una
// construcción nueva aún no se sabe: se mira después con sitioColocada.
export function sitioAccion(mundo, a) {
  if (!a || typeof a !== 'object') return null;
  switch (a.tipo) {
    case 'nivelar': case 'decorar': case 'colocar': case 'estaca': case 'labrar': case 'sembrar': case 'segar': case 'coger_planta': case 'escardar': case 'regar':
      return Number.isFinite(a.x) && Number.isFinite(a.z) ? { x: a.x, z: a.z } : null;
    case 'entregar': case 'trabajar': case 'subir': case 'desmontar': case 'usar': {
      const c = mundo.construcciones.find(x => x.id === a.construccion);
      return c ? { x: c.ox, z: c.oz } : null;
    }
    case 'quitar_estaca': {
      const c = (mundo.campos || []).find(x => x.id === a.campo), p = c && Number.isInteger(a.i) && c.puntos[a.i];
      return p ? { x: p.x, z: p.z } : null;
    }
    case 'quitar': {
      const d = mundo.decoracion.find(x => x.id === a.id);
      return d ? { x: d.x, z: d.z } : null;
    }
    default: return null;   // mojon, quitar_mojon, invitar, desinvitar, rellenar, sacar_arcon, dejar_arcon: de todos
  }
}
// La de 'colocar', ya hecha: el origen de su construcción (nueva o la que ya había).
export const sitioColocada = (r) => (r && r.construccion && Number.isFinite(r.construccion.ox) ? { x: r.construccion.ox, z: r.construccion.oz } : null);

// Lo de todo el mundo, justo antes de una acción (va con ella al repartirla).
export const comunDe = (mundo) => ({ sid: mundo.siguienteId, materiales: { ...mundo.materiales }, mojones: copiaMojones(mundo.mojones), invitados: copiaInvitados(mundo.invitados) });
const copiaInvitados = (ms) => Object.fromEntries(Object.entries(ms || {}).filter(([, l]) => Array.isArray(l)).map(([a, l]) => [a, [...l]]));
const copiaMojones = (ms) => Object.fromEntries(Object.entries(ms || {}).map(([a, m]) => [a, { ...m }]));
// Y en el navegador, antes de hacerla.
export function ponerComun(mundo, c) {
  if (!c || typeof c !== 'object') return;
  if (Number.isSafeInteger(c.sid) && c.sid > 0) mundo.siguienteId = c.sid;
  if (c.materiales && typeof c.materiales === 'object' && !Array.isArray(c.materiales)) mundo.materiales = { ...mundo.materiales, ...c.materiales };
  if (c.mojones && typeof c.mojones === 'object' && !Array.isArray(c.mojones)) mundo.mojones = copiaMojones(c.mojones);
  if (c.invitados && typeof c.invitados === 'object' && !Array.isArray(c.invitados)) mundo.invitados = copiaInvitados(c.invitados);
}

// La foto del mundo de construcción con solo lo de los trozos dados (un Set de claves «i,j»).
export function obrasEnTrozos(mundo, trozos) {
  const d = mundo.exportar(), en = (x, z) => trozos.has(trozoDe(x, z));
  return {
    ...d,
    materiales: { ...d.materiales },
    construcciones: d.construcciones.filter(c => en(c.ox, c.oz)),
    decoracion: d.decoracion.filter(x => en(x.x, x.z)),
    nivelados: d.nivelados.filter(n => en(n.x, n.z)),
    campos: (d.campos || []).filter(c => c.puntos.some(p => en(p.x, p.z))),
  };
}
