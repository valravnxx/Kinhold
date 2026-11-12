// El combate en el servidor (partido de servidor/servidor.mjs, 12 nov): los luchadores (src/logica/combate_servidor.js)
// con lo que llevan puesto y en la mano, lo que se lanza, lo que se gasta al dar y al recibir, la caza, lo que hiere un
// árbol al caer y su tic. Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync } from 'fs';
import { CombateServidor } from '../../src/logica/combate_servidor.js';
import { puestasDe } from '../../src/logica/prendas.js';
import { armaDeMano, loQueSeLanza } from '../../src/logica/arma_mano.js';
import { bajoLaCaida, golpeDeCaida } from '../../src/logica/tala.js';
import { gastar, gastarCosa, gastarRopa, GASTA_AL_DAR, GASTA_AL_PARAR, GOLPE_ROPA } from '../../src/logica/desgaste.js';

export function instalarCombate(S) {
  const { semilla, tierras, terreno, objetos, guardarObjetos, enviar, conexionDe, clientes, reloj, mundo, archivoObjetosReg, archivoCombate } = S;
  // combate: el reloj es el del servidor; antes de cada intención se avanza hasta ahora
  // Strandvang, tierras del rey: ahí no se hiere a otro jugador (tierras: en(x, z) de src/logica/tierras_rey.js)
  // el arma es lo de la mano (valravnx, 9 nov; src/logica/arma_mano.js): lo que se lanza sale de su inventario al soltar
  // (la lanza entera, una piedra de la pila; las dos caen al suelo); con el terreno, alturas sobre el suelo y liebres
  const combate = new CombateServidor({ semilla, tierras: tierras || null,
    mundo: { suelo: terreno ? (x, z) => terreno.suelo(x, z) : null, presas: () => (S.fauna ? S.fauna.todas() : []) },
    alLanzar: (autor) => {
      const inv = objetos.invs.de(autor), q = loQueSeLanza(inv.lugares);
      if (!q) return null;
      const r = inv.sacar(q.mano, q.cuanto);
      if (!r.ok) return null;
      guardarObjetos(); enviar(conexionDe.get(autor), { tipo: 'inventario', inventario: objetos.inventarioDe(autor) }); S.repartirLlevado(autor);
      return { tipo: r.cosa.tipo, n: r.cosa.n, gasta: q.gasta, ...(r.cosa.usado ? { usado: r.cosa.usado } : {}) };
    } });
  const ultimaPelea = new Map();   // autor → hora (ms) de su último golpe o flecha dada o recibida
  // el duelo con lo que llevas (7 nov): lo que le protege es la ropa que tiene puesta en su inventario del servidor
  // y su arma, lo que lleva en la mano (valravnx, 9 nov: antes, siempre la espada larga)
  const vestirLuchador = (autor) => { const l = objetos.invs.de(autor).lugares; combate.vestir(autor, puestasDe(l)); combate.armar(autor, armaDeMano(l)); };
  const t0 = reloj();
  let muriendo = false;   // (morir no vuelve a mirar las muertes)
  const ponerAlDia = () => { combate.avanzarHasta((reloj() - t0) / 1000); if (!muriendo) { muriendo = true; try { S.revisarMuertes(); } finally { muriendo = false; } } };
  // La ropa y la armadura que se gastan (10 nov; src/logica/desgaste.js, gastarRopa): con los golpes que hieren y con
  // el uso. Lo que se acaba, se rompe: se le avisa, se vuelve a vestir su luchador y se reparte su aspecto.
  const gastarRopaDe = (autor, n, zona = null) => {
    const l = gastarRopa(objetos.invs.de(autor), n, zona);
    if (!l.length) return;
    guardarObjetos();
    const rotas = l.filter(g => g.roto), ws = conexionDe.get(autor);
    if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor), ...(rotas.length ? { roto: rotas[0].tipo } : {}) });
    if (rotas.length) {
      S.repartirLlevado(autor);
      for (const g of rotas) appendFileSync(archivoObjetosReg, JSON.stringify({ autor, tipo: 'se_rompe', objeto: g.tipo, ahora: Date.now() }) + '\n');
    }
  };
  let escritas = 0;
  const repartirCombate = () => {
    const fauna = S.fauna;
    const eventos = combate.sacarEventos();
    if (eventos.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'combate', eventos });
    // lo lanzado que cae (P4, 9 nov): la lanza y la piedra quedan en el suelo donde acaban; la liebre a la que da,
    // muerta, sale de la fauna y queda en el suelo para despiezarla
    let suelo = false;
    // herramientas y armas que se gastan (10 nov; src/logica/desgaste.js): el golpe que alcanza gasta el arma de quien lo
    // da, y el que se para, también la de quien lo para; la lanza lanzada, al dar a una presa. Al acabarse, se rompe.
    const gastarArma = (autor) => {
      const inv = objetos.invs.de(autor), m = armaDeMano(inv.lugares).mano, g = m ? gastar(inv, m) : null;
      if (!g) return;
      guardarObjetos();
      const ws = conexionDe.get(autor);
      if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(autor), ...(g.roto ? { roto: g.tipo } : {}) });
      if (g.roto) { S.repartirLlevado(autor); appendFileSync(archivoObjetosReg, JSON.stringify({ autor, tipo: 'se_rompe', objeto: g.tipo, ahora: Date.now() }) + '\n'); }
    };
    for (const e of eventos) {
      if (e.tipo !== 'golpe' || !e.objetivo) continue;
      if (GASTA_AL_DAR.has(e.resultado)) gastarArma(e.autor);
      if (GASTA_AL_PARAR.has(e.resultado)) gastarArma(e.objetivo);
    }
    // la ropa y la armadura (10 nov): el golpe o lo lanzado que hiere gasta lo que cubre esa zona a quien lo recibe
    for (const e of eventos) if ((e.tipo === 'golpe' || e.tipo === 'flecha' || e.tipo === 'arbol') && e.objetivo && e.zona && objetos.invs.de(e.objetivo)) gastarRopaDe(e.objetivo, GOLPE_ROPA, e.zona);
    for (const e of eventos) {
      if (e.tipo !== 'flecha') continue;
      const ahora = Date.now(), enT = (x, z) => !!mundo.tierraDe(x, z);
      const lanzado = e.objeto && !e.objeto.gasta ? { tipo: e.objeto.tipo, n: e.objeto.n, ...(e.objeto.usado ? { usado: e.objeto.usado } : {}) } : null;
      const roto = lanzado && e.presa ? gastarCosa(lanzado) : null;   // la lanza que da a una presa se gasta
      if (roto && roto.roto) { const ws = conexionDe.get(e.autor); if (ws) enviar(ws, { tipo: 'inventario', inventario: objetos.inventarioDe(e.autor), roto: lanzado.tipo }); appendFileSync(archivoObjetosReg, JSON.stringify({ autor: e.autor, tipo: 'se_rompe', objeto: lanzado.tipo, ahora }) + '\n'); }
      else if (lanzado) { objetos.suelo.dejar(lanzado, e.x, e.z, ahora, e.autor, enT(e.x, e.z)); suelo = true; }
      if (e.presa && fauna) {
        const l = fauna.de(e.presa);
        if (l && fauna.matar(e.presa)) { objetos.suelo.dejar({ tipo: 'liebre', n: 1 }, l.x, l.z, ahora, e.autor, enT(l.x, l.z)); suelo = true; }
        appendFileSync(archivoObjetosReg, JSON.stringify({ autor: e.autor, tipo: 'caza', presa: e.presa, arma: e.arma, ok: !!l, ahora }) + '\n');
      }
    }
    if (suelo) { guardarObjetos(); S.repartirSuelo(Date.now()); }
    // quién ha peleado (un golpe o una flecha dada o recibida): si se desconecta en el minuto siguiente, más tiempo atacable
    for (const e of eventos) if (e.objetivo && (e.tipo === 'golpe' || e.tipo === 'flecha')) { const t = Date.now(); ultimaPelea.set(e.autor, t); ultimaPelea.set(e.objetivo, t); }
    const nuevas = combate.registro.entradas.filter(e => e.n > escritas);
    if (nuevas.length) { appendFileSync(archivoCombate, nuevas.map(e => JSON.stringify(e)).join('\n') + '\n'); escritas = nuevas[nuevas.length - 1].n; }
  };
  // Lo que hiere un árbol al caer (tarea «Crujido de aviso y daño», 12 nov)
  const caidaHiere = (autor, id, caida) => {
    const a = objetos.sitioArbol(id); if (!a) return;
    const alt = objetos.tala.alturaEn, desde = Date.now();
    const personas = Object.entries(combate.luchadores).map(([quien, L]) => ({ autor: quien, x: L.x, z: L.z }));
    for (const b of bajoLaCaida(a, caida, personas, alt)) {
      setTimeout(() => {
        const L = combate.luchadores[b.autor]; if (!L || L.fuera) return;
        const g = golpeDeCaida(a, caida, L.x, L.z, (Date.now() - desde) / 1000 + 0.05, alt);
        if (!g) return;
        ponerAlDia(); combate.herirConArbol(autor, b.autor, g, id); repartirCombate();
      }, Math.max(0, b.t * 1000 - (Date.now() - desde))).unref?.();
    }
  };
  Object.assign(S, { combate, ultimaPelea, vestirLuchador, ponerAlDia, gastarRopaDe, repartirCombate, caidaHiere });
}

// el tic del combate (cada ticoCombate ms): a todos, los luchadores que han cambiado
export function arrancarCombate(S) {
  const { ponerAlDia, repartirCombate, combate, clientes, enviar } = S;
  return setInterval(() => {
    ponerAlDia(); repartirCombate();
    const lista = combate.cambiados();
    if (lista.length) for (const ws of clientes.keys()) enviar(ws, { tipo: 'luchadores', t: combate.ms(), lista });
  }, S.ticoCombate);
}
