// Lo que lleva cada uno y lo del suelo en el servidor (partido de servidor/servidor.mjs, 12 nov): los objetos
// (src/logica/objetos_red.js), su guardado en objetos.json y los mensajes { tipo: 'objeto', … } (comer, beber, talar,
// fabricar, recoger…). Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { ObjetosServidor } from '../../src/logica/objetos_red.js';
import { trozoDe } from '../../src/logica/trozos_red.js';
import { saciar as saciarNecesidad, redondear as redondearNecesidades, NUTRE, comestible } from '../../src/logica/necesidades.js';
import { reemplazar, reemplazarSinEsperar } from '../guardado.mjs';

export function instalarObjetos(S) {
  const { mundo, arconPruebas, terreno, registrar, archivoObjetos, guardarCada } = S;
  // lo que lleva cada uno y lo del suelo: dónde está cada autor lo dice su presencia (S.presencia)
  const objetos = new ObjetosServidor({
    posicion: (a) => { const e = S.presencia && S.presencia.ultimo.get(a); return e ? { x: e.x, z: e.z, giro: e.giro } : null; },
    enTierras: (a, x, z) => !!mundo.tierraDe(x, z),   // en la tierra de alguien, lo soltado no se pierde
    arconPruebas, terreno,
    puedeTocar: (a, x, z) => mundo.puedeTocar(x, z, a),   // las estaciones de fabricar, en tierra de otro solo si te ha invitado
    bajoTecho: (x, z) => mundo.bajoTecho(x, z),           // los puestos de trabajo: la hoguera, solo fuera
    alMuro: (x, z) => mundo.muroCercano(x, z, 0.5),       // los colgaderos, pegados a un muro
    obrasCerca: (x, z, r) => mundo.obrasCerca(x, z, r),   // con lo que puede dar un árbol al caer (src/logica/tala.js)
  });
  if (existsSync(archivoObjetos)) {
    try { objetos.importar(JSON.parse(readFileSync(archivoObjetos, 'utf8'))); } catch (e) { registrar(`objetos.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  // se escribe en uno aparte y se cambia de nombre: si el servidor se apaga a mitad, queda el anterior entero
  // (12 nov) guardarObjetos() solo apunta que hay cambios: se escribe como mucho una vez cada guardarCada ms, sin bloquear,
  // y nunca dos escrituras a la vez (si cambia mientras se escribe, se vuelve a escribir después). Así un hachazo por
  // segundo, o varios jugadores a la vez, no reescriben el archivo entero en cada acción.
  let objetosSucios = false, escribiendoObjetos = null, plazoObjetos = null, escriturasObjetos = 0;
  const escribirObjetos = () => {
    plazoObjetos = null;
    if (!objetosSucios || escribiendoObjetos) return;
    objetosSucios = false; escriturasObjetos++;
    const texto = JSON.stringify(objetos.exportar());   // lo de este momento; lo que cambie mientras se escribe, en la siguiente
    escribiendoObjetos = writeFile(archivoObjetos + '.tmp', texto).then(() => reemplazarSinEsperar(archivoObjetos + '.tmp', archivoObjetos, registrar))
      .catch(e => { objetosSucios = true; registrar(`no se pudo guardar objetos.json: ${e && e.message}`); })
      .finally(() => { escribiendoObjetos = null; if (objetosSucios && !plazoObjetos) plazoObjetos = setTimeout(escribirObjetos, guardarCada); });
  };
  const guardarObjetos = () => { objetosSucios = true; if (!plazoObjetos && !escribiendoObjetos) plazoObjetos = setTimeout(escribirObjetos, guardarCada); };
  // al cerrar o apagarse: espera a la que esté a medias y escribe lo que falte, de golpe
  const guardarObjetosYa = async () => {
    if (plazoObjetos) { clearTimeout(plazoObjetos); plazoObjetos = null; }
    if (escribiendoObjetos) await escribiendoObjetos;
    if (plazoObjetos) { clearTimeout(plazoObjetos); plazoObjetos = null; }
    if (!objetosSucios) return;
    objetosSucios = false; escriturasObjetos++;
    writeFileSync(archivoObjetos + '.tmp', JSON.stringify(objetos.exportar())); reemplazar(archivoObjetos + '.tmp', archivoObjetos, registrar);
  };
  Object.assign(S, { objetos, guardarObjetos, guardarObjetosYa, escriturasObjetos: () => escriturasObjetos });
}

// { tipo: 'objeto', id, accion } de la conexión c ({ ws, autor })
export function atenderObjeto(S, c, msg) {
  const { ws, autor } = c;
  const { enviar, objetos, necesidades, necesidadesDe, guardarObjetos, repartirLlevado, beber, archivoObjetosReg, cansar, durmiendo, reloj, clientes, vista, caidaHiere,
    repartirSuelo, repartirEstaciones } = S;
  if (!msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion)) return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
  // el autor lo pone el servidor, y la hora también
  const ahora = Date.now();
  // comer (P4): una unidad de lo que llevas (src/logica/necesidades.js, NUTRE), de tu inventario, por el servidor
  if (msg.accion.tipo === 'comer') {
    const tipo = msg.accion.objeto, inv = objetos.invs.de(autor);
    let r;
    if (typeof tipo !== 'string' || !comestible(tipo)) r = { ok: false, motivo: 'Eso no se come.' };
    else r = inv.gastar(tipo, 1);
    if (r.ok) { necesidades.set(autor, saciarNecesidad(necesidadesDe(autor), 'hambre', NUTRE[tipo])); S.necesidadesCambiadas = true; guardarObjetos(); }
    else if (r.motivo === 'No llevas tanto.') r.motivo = 'No llevas nada de eso.';
    enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: r.ok, ...(r.ok ? { datos: { hambre: Math.round(necesidadesDe(autor).hambre * 100) / 100 } } : { motivo: r.motivo }) });
    enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
    if (r.ok) { enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidadesDe(autor)) }); repartirLlevado(autor); }
    return;
  }
  // beber del río (P4): lo llevan las necesidades, no los objetos
  if (msg.accion.tipo === 'beber') {
    const r = beber(autor, ahora);
    enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: r.ok, ...(r.ok ? { datos: { sed: r.sed } } : { motivo: r.motivo }) });
    if (r.ok) enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidadesDe(autor)) });
    return;
  }
  const r = objetos.ejecutar(Object.assign({}, msg.accion, { autor }), ahora);
  if (r.entrada) appendFileSync(archivoObjetosReg, JSON.stringify(r.entrada) + '\n');
  if (r.ok) guardarObjetos();
  const { ok: _o, motivo: _m, entrada: _e, suelo: _s, estaciones: _es, ...datos } = r;
  enviar(ws, { tipo: 'resultado_objeto', id: Number.isSafeInteger(msg.id) ? msg.id : null, ok: !!r.ok, ...(r.ok ? { datos } : { motivo: r.motivo }) });
  enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
  if (r.ok) repartirLlevado(autor);
  if (r.ok) cansar(autor, msg.accion.tipo);   // talar, trocear, fabricar y recoger cansan (src/logica/necesidades.js)
  // dormir en la cama ligada: hasta que se mueva de donde se tumbó (el tic de las necesidades)
  if (r.ok && msg.accion.tipo === 'dormir') { const c = objetos.fab.estaciones[msg.accion.estacion]; if (c) durmiendo.set(autor, { x: c.x, z: c.z, t: reloj() }); }
  // lo talado antes que el suelo: así el navegador esconde lo que deja el árbol hasta que lo ve caer
  // lo talado y lo recogido, solo lo de su trozo y solo a quien lo tiene alrededor (el autor siempre)
  const aSuTrozo = (sitio, hacer) => {
    const k = sitio ? trozoDe(sitio.x, sitio.z) : null, solo = k ? new Set([k]) : new Set();
    for (const [otro, a] of clientes) if (a === autor || (k && vista.tiene(a, k))) hacer(otro, solo);
  };
  if (r.ok && r.cae) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo), cae: { arbol: msg.accion.arbol, dir: r.dir, autor, caida: r.caida } }));
  // el crujido de aviso (12 nov): a punto de caer, lo oyen todos los de alrededor (al soltarse, con el 'tala' de arriba)
  // el árbol caído, limpio (12 nov): lo que deja va en el suelo de abajo; aquí, que ya no está tumbado
  if (r.ok && r.limpio) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo), limpio: { arbol: msg.accion.arbol, autor, objetos: r.objetos } }));
  if (r.ok && r.cruje) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro) => enviar(otro, { tipo: 'crujido', arbol: msg.accion.arbol, autor }));
  // y quien quede debajo (src/logica/tala.js, golpeDeCaida): se mira cuándo le llegaría con dónde está ahora y, en
  // ese momento, otra vez con dónde está entonces (el que se aparta a tiempo se libra). La herida lleva su autor.
  if (r.ok && r.cae && r.caida) caidaHiere(autor, msg.accion.arbol, r.caida);
  // lo descortezado y lo sangrado (8 nov): lo de ese árbol, a quien lo tiene alrededor
  if (r.ok && (msg.accion.tipo === 'descortezar' || msg.accion.tipo === 'sangrar')) aSuTrozo(objetos.sitioArbol(msg.accion.arbol), (otro, solo) => enviar(otro, { tipo: 'tala', estado: objetos.talaVisible(solo) }));
  if (r.suelo) repartirSuelo(ahora);
  if (r.estaciones) repartirEstaciones();
  if (r.ok && (msg.accion.tipo === 'recoger' || msg.accion.tipo === 'desbrozar' || r.rota)) aSuTrozo(objetos.sitioPunto(msg.accion.punto), (otro, solo) => enviar(otro, { tipo: 'recoleccion', estado: objetos.recoleccionVisible(solo) }));
}
