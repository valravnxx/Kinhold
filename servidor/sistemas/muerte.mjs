// Dormir desconectado y morir en el servidor (partido de servidor/servidor.mjs, 12 nov): quien se va se queda dormido
// en el mundo (src/logica/dormidos.js) y quien muere deja su cuerpo y la mitad de lo que llevaba (src/logica/muerte.js).
// Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync } from 'fs';
import { redondear as redondearNecesidades } from '../../src/logica/necesidades.js';
import { Dormidos, DESCONECTADO } from '../../src/logica/dormidos.js';
import { Cuerpos, despojar, repartir, sitiosAlrededor, necesidadesAlVolver, reaparicion, MUERTO } from '../../src/logica/muerte.js';

export function instalarMuerte(S) {
  const { tiemposDormido, duraCuerpo, reloj, apartados, posiciones, registrar, combate, objetos, aspectos, clientes, conexionDe, enviar, mundo, archivoObjetosReg, terreno,
    necesidades, necesidadesDe, alientoAntes, durmiendo, antesNec, sitioSalida, vestirLuchador, guardarObjetos, guardarPosiciones } = S;
  // Desconectarse (GDD, apartado 6; src/logica/dormidos.js): quien se va se queda dormido en el mundo, donde estaba, y los
  // demás lo ven tumbado con su símbolo de desconectado (su presencia sigue, con la animación DESCONECTADO). En su tierra
  // (o en la de quien le ha invitado), protegido enseguida, y a su cama ligada si la tiene; fuera, su luchador sigue en
  // el combate unos minutos (atacable; más si peleó en el último minuto) y luego se aparta (ya no se le puede hacer nada)
  // y, con cama, pasa a ella. Al volver con su ficha, se despierta donde duerme. Decisiones provisionales: las
  // necesidades no avanzan mientras duerme desconectado (como antes); al reiniciar el servidor no queda nadie dormido
  // a la vista (lo que se guarda es dónde estaba: posiciones.json).
  const dormidos = new Dormidos(tiemposDormido);
  // su presencia, tumbado y desconectado donde dice d (a los demás les llega con el tic de la presencia)
  const presenciaDormida = (autor, d) => {
    const presencia = S.presencia;
    const previo = presencia.ultimo.get(autor);
    presencia.ultimo.set(autor, { autor, t: Math.max(reloj(), previo ? previo.t + 1 : 0), x: d.x, y: d.y, z: d.z, giro: d.giro, anim: DESCONECTADO });
    presencia.cambiados.add(autor);
  };
  // se acaba su tiempo atacable: fuera del combate (como al cortarse, pero se guarda mientras duerma) y, con cama, a ella
  const revisarDormidos = (ahora = Date.now()) => {
    for (const f of dormidos.revisar(ahora)) {
      S.ponerAlDia();
      const L = combate.apartar(f.autor);
      if (L) apartados.set(f.autor, { L, hasta: Infinity });
      if (f.cama) {
        presenciaDormida(f.autor, f.d);
        posiciones.set(f.autor, { x: f.d.x, y: f.d.y, z: f.d.z, giro: f.d.giro }); S.posicionesCambiadas = true;
        registrar(`${f.autor} pasa dormido a su cama`);
      }
    }
  };
  // Morir y que te saqueen (P4; GDD, apartado 6; src/logica/muerte.js). Se muere de sed y de hambre (el tic de las
  // necesidades le quita sangre a su luchador), en el combate (su luchador cae) o ahogado (lo dice su navegador, con
  // { tipo: 'morir', motivo: 'ahogado' }, y el servidor mira que esté en el agua honda). Mueras como mueras: tu cuerpo
  // queda donde caíste 1 hora (lo ven todos: una presencia «cuerpo:…» tumbada con tu aspecto) y la mitad de lo que
  // llevabas, al azar del servidor, cae a su alrededor (cualquiera puede cogerlo); la otra mitad se rompe. Tú vuelves
  // sano a tu cama ligada o, sin ella, a tu sitio de salida, y tu navegador lo sabe con { tipo: 'muerte', … }.
  const cuerpos = new Cuerpos(duraCuerpo);
  const reaparecido = new Map();   // autor → { x, z, t }: hasta que su navegador mande un estado de allí
  const morir = (autor, motivo, ahora = Date.now()) => {
    const presencia = S.presencia;
    const p = presencia.ultimo.get(autor);
    if (!p || p.anim === MUERTO) return null;
    const conectado = conexionDe.has(autor), dormido = dormidos.de(autor);
    if (objetos.soltarAlSalir(autor, ahora)) { /* la rastra que arrastraba se queda donde estaba */ }
    // el cuerpo, con su aspecto (lo que llevaba encima no: está en el suelo)
    const cuerpo = cuerpos.dejar(autor, p, motivo, ahora);
    const asp = aspectos.get(autor) || { sexo: 'hombre', capas: [] };
    aspectos.set(cuerpo.id, { ...asp, llevado: null });
    for (const ws of clientes.keys()) enviar(ws, { tipo: 'aspecto', autor: cuerpo.id, ...aspectos.get(cuerpo.id) });
    presencia.ultimo.set(cuerpo.id, { autor: cuerpo.id, t: reloj(), x: p.x, y: p.y, z: p.z, giro: p.giro, anim: MUERTO });
    presencia.cambiados.add(cuerpo.id);
    // la mitad de lo que llevaba, al suelo alrededor; la otra mitad se rompe
    const { quedan, rotas } = repartir(despojar(objetos.invs.de(autor)), Math.random);
    sitiosAlrededor(p.x, p.z, quedan.length).forEach((q, i) => objetos.suelo.dejar(quedan[i], q.x, q.z, ahora, autor, !!mundo.tierraDe(q.x, q.z)));
    const entrada = { autor, tipo: 'morir', motivo, x: p.x, z: p.z, cuerpo: cuerpo.id, quedan: quedan.map(c => [c.tipo, c.n]), rotas: rotas.map(c => [c.tipo, c.n]), ok: true, ahora };
    try { appendFileSync(archivoObjetosReg, JSON.stringify(entrada) + '\n'); } catch (e) { registrar(`no se pudo apuntar la muerte: ${e && e.message}`); }
    // dónde vuelve: su cama ligada o su sitio de salida
    const idCama = objetos.fab.camaDe(autor), cm = idCama ? objetos.fab.estaciones[idCama] : null;
    const r = reaparicion({ cama: cm ? { x: cm.x, y: terreno ? terreno.suelo(cm.x, cm.z) : p.y, z: cm.z, giro: p.giro } : null, salida: sitioSalida(autor, p), porDefecto: { x: 0, y: 0, z: 0, giro: 0 } });
    const pos = { x: r.x, y: r.y, z: r.z, giro: r.giro || 0 };
    necesidades.set(autor, necesidadesAlVolver(necesidadesDe(autor))); S.necesidadesCambiadas = true;
    // sano: un luchador nuevo (con la misma arma de combate), y vestido con lo que le queda
    const L = combate.luchadores[autor];
    combate.quitar(autor);
    const N = combate.entrar(autor, { arma: L ? L.arma : undefined, x: pos.x, z: pos.z, rot: pos.giro });
    combate.pendientes.push({ tipo: 'reinicio', autor, t: combate.ms() });
    vestirLuchador(autor);
    alientoAntes.delete(autor); durmiendo.delete(autor); antesNec.delete(autor);
    posiciones.set(autor, pos); S.posicionesCambiadas = true;
    if (dormido) {
      // dormido en el mundo (desconectado) y muerto: duerme ya en su cama o en su salida, protegido
      Object.assign(dormido, { x: pos.x, y: pos.y, z: pos.z, giro: pos.giro, hasta: ahora, protegido: true, enCama: r.enCama });
      presenciaDormida(autor, dormido);
      const A = combate.apartar(autor); if (A) apartados.set(autor, { L: A, hasta: Infinity });
    } else if (conectado) {
      presencia.anclar(autor, pos, reloj());
      presencia.ultimo.set(autor, { autor, t: reloj(), x: pos.x, y: pos.y, z: pos.z, giro: pos.giro, anim: 'quieto' }); presencia.cambiados.add(autor);
      combate.colocar(autor, pos.x, pos.z, pos.giro);
      reaparecido.set(autor, { x: pos.x, z: pos.z, t: reloj() });
      const ws = conexionDe.get(autor);
      enviar(ws, { tipo: 'muerte', motivo, posicion: pos, enCama: r.enCama, cuerpo: { id: cuerpo.id, x: cuerpo.x, z: cuerpo.z, hasta: cuerpo.hasta } });
      enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor) });
      enviar(ws, { tipo: 'necesidades', necesidades: redondearNecesidades(necesidades.get(autor)) });
      S.repartirLlevado(autor);
    }
    guardarObjetos(); S.repartirSuelo(ahora); S.repartirCombate();
    try { guardarPosiciones(); } catch (e) { registrar(`no se pudo guardar posiciones.json: ${e && e.message}`); }
    registrar(`muere ${autor} (${motivo}): vuelve ${r.enCama ? 'a su cama' : 'a su salida'}; en su cuerpo quedan ${quedan.reduce((s, c) => s + c.n, 0)}, se rompen ${rotas.reduce((s, c) => s + c.n, 0)}`);
    return { cuerpo, posicion: pos, enCama: r.enCama, quedan, rotas, N };
  };
  // los que han caído en el combate (o sin sangre por la sed o el hambre): mueren
  const revisarMuertes = () => {
    for (const [a, L] of Object.entries(combate.luchadores)) if (L.fuera && (conexionDe.has(a) || dormidos.esta(a))) morir(a, L.motivoFuera || 'Desangrado');
  };
  // los cuerpos que ya llevan su hora: se van (los demás dejan de verlos)
  const revisarCuerpos = (ahora = Date.now()) => {
    for (const c of cuerpos.limpiar(ahora)) {
      S.presencia.quitar(c.id); aspectos.delete(c.id);
      for (const ws of clientes.keys()) enviar(ws, { tipo: 'sale', autor: c.id });
    }
  };
  Object.assign(S, { dormidos, presenciaDormida, revisarDormidos, cuerpos, reaparecido, morir, revisarMuertes, revisarCuerpos });
}
