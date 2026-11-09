// Combate en el servidor (hito 1f). Lógica pura (sin three.js ni websocket): la usa servidor/servidor.mjs
// y la pueden usar las pruebas sin red.
//
// Cada jugador conectado tiene un luchador (src/combate/logica.js). Los clientes no dicen qué pasa: solo
// mandan intenciones (cargar y soltar un golpe por una línea, parar, tensar y soltar, coger arma). El
// servidor lleva el reloj de todos los luchadores, y cuando un golpe llega a su impacto o una flecha a su
// blanco lo resuelve con ejecutarCombate / avanzarProyectil (src/logica/acciones.js), siempre con el autor
// de la conexión. Lo que hiere queda en el registro con su autor.
//
// Con lag, una intención cuenta desde que llega al servidor (no desde que el jugador pulsó): antes de
// aplicarla, el combate se avanza hasta ese instante, así los tiempos (preparación, ventana de parada
// perfecta) son exactos en el reloj del servidor. Decisión provisional: sin compensar el lag.
//
// Mensajes (JSON):
//   Un solo modo, el del combate en el mundo (valravnx, 31 oct; el de la liza, el «Duelo en línea», con sus capas y
//   guardias, se quitó el 6 nov): cuatro direcciones, golpe cargado y comprometido, finta con el botón de parar.
//   cliente → servidor   { tipo: 'combate', que: 'arma', sacada }           saca o guarda el arma (los demás la ven)
//                        { tipo: 'combate', que: 'cargar', linea }          empieza a cargar un golpe (alto, izquierda,
//                                                                             derecha, estocada); solo con el arma sacada
//                        { tipo: 'combate', que: 'descargar' }              suelta el botón: el golpe sale
//                        { tipo: 'combate', que: 'fintar' }                 cancela el golpe que se carga (finta)
//                        { tipo: 'combate', que: 'parar', activo, linea }   activo: true / false; linea: el lado
//                        { tipo: 'combate', que: 'tensar' }                 coger impulso para lanzar (el arco, la
//                                                                             piedra o la lanza de la mano)
//                        { tipo: 'combate', que: 'soltar', x, y, z }         punto al que apunta (y: sobre su suelo)
//                        { tipo: 'combate', que: 'equipar', arma }          ya no cuenta (valravnx, 9 nov): el arma es
//                                                                             lo que lleva en la mano (armar, desde su
//                                                                             inventario); se acepta sin hacer nada
//   Lo que se lanza (la piedra, la lanza) sale de su inventario al soltar (alLanzar, lo da el servidor); la lanza cae
//   al suelo donde acaba su vuelo (el evento «flecha» lleva objeto), la piedra se gasta. Con el terreno (mundo), las
//   alturas van sobre el suelo de cada sitio y lo lanzado puede dar a una liebre (resultado «presa», con su id).
//                        { tipo: 'combate', que: 'curar', herida, metodo }   herida: índice en sus heridas
//                        { tipo: 'combate', que: 'dejarCura' }               deja la cura a medias (echa a correr)
//                        { tipo: 'combate', que: 'reiniciar' }               vuelve a empezar sano: solo si está fuera
//                                                                             de combate o no hay nadie en pie cerca
//   La posición y el giro del luchador salen de su estado de presencia ({ tipo: 'estado', … }).
//   Strandvang, tierras del rey (valravnx, 31 oct): con `tierras` (en(x, z) de src/logica/tierras_rey.js), el golpe o la
//   flecha entre dos jugadores cuando uno de los dos está en Strandvang se rechaza: no hiere, queda en el registro con
//   su autor y el motivo, y el evento sale con resultado «tierras del rey».
//   servidor → clientes  { tipo: 'combate', eventos: [...] }               golpes, flechas e impactos, en orden
//                        { tipo: 'luchadores', t, lista: [...] }             cada tic, los que han cambiado
import { Luchador, LINEAS, ARMAS, RITMO, TRATAMIENTOS, T, azar, angulo, difAngulo, defTiro } from '../combate/logica.js';
import { RegistroAcciones, ejecutarCombate, avanzarProyectil } from './acciones.js';
import { motivoProtegido, RESULTADO_TIERRAS } from './tierras_rey.js';

export const PASO = 1 / 60;          // s: el combate se avanza en pasos de como mucho esto
export const DURA_PROYECTIL = 8;     // s: una flecha que no ha caído en este tiempo se quita
export const CERCA_REINICIAR = 15;   // m: no se vuelve a empezar sano con alguien en pie más cerca que esto
const LIMITE = 300000;   // (m: el continente mide 256 km; la cuenta de admin puede ir por todo él)

const numero = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMITE;

// Comprueba una intención de un cliente. Devuelve la intención limpia o null.
export function validarIntencion(m) {
  if (!m || typeof m !== 'object' || m.tipo !== 'combate') return null;
  switch (m.que) {
    case 'parar':
      if (typeof m.activo !== 'boolean') return null;
      if (m.linea !== undefined && !LINEAS.includes(m.linea)) return null;
      return { que: 'parar', activo: m.activo, ...(m.linea ? { linea: m.linea } : {}) };
    case 'arma': return typeof m.sacada === 'boolean' ? { que: 'arma', sacada: m.sacada } : null;
    case 'cargar': return LINEAS.includes(m.linea) ? { que: 'cargar', linea: m.linea } : null;
    case 'descargar': return { que: 'descargar' };
    case 'fintar': return { que: 'fintar' };
    case 'tensar': return { que: 'tensar' };
    case 'dejarCura': return { que: 'dejarCura' };
    case 'curar': return Number.isInteger(m.herida) && m.herida >= 0 && Object.hasOwn(TRATAMIENTOS, m.metodo) ? { que: 'curar', herida: m.herida, metodo: m.metodo } : null;
    case 'reiniciar': return { que: 'reiniciar' };
    case 'soltar': return [m.x, m.y, m.z].every(numero) ? { que: 'soltar', x: m.x, y: m.y, z: m.z } : null;
    case 'equipar':
      // la armadura ya no la dice el cliente: es la ropa que lleva puesta en el inventario (CombateServidor.vestir);
      // si la manda (las versiones de antes), no cuenta
      if (!Object.hasOwn(ARMAS, m.arma)) return null;
      return { que: 'equipar', arma: m.arma };
    default: return null;
  }
}

// Lo que se reparte de cada luchador (lo que hace falta para dibujarlo y para leer sus golpes)
function foto(autor, L) {
  return {
    autor, arma: L.arma, objeto: L.objeto || null, armadura: L.armadura, prendas: [...L.puestas], accion: L.accion, linea: L.linea,
    duracion: Math.round(L.duracion * 1000), tAccion: Math.round(L.tAccion * 1000),
    bloqueando: L.bloqueando, lineaBloqueo: L.lineaBloqueo, sacada: !!L.sacada, tension: Math.round(L.tension * 100) / 100,
    cansancio: Math.round(L.cansancio), sangre: Math.round(L.sangre), heridas: L.heridas.length,
    // cada herida: zona, gravedad y tipo (para dibujarla y decir qué hace); el sangrado lo lleva el servidor
    // y lo que se le ha hecho (v: vendada, c: cosida, q: cauterizada, e: entablillada, h: emplasto)
    lista: L.heridas.map(h => [h.zona, h.gravedad, h.tipo, Math.round(h.sangrado * 100) / 100, marcasCura(h)]),
    botiquin: { ...L.botiquin }, contra: L.puedeContraatacar(),
    fuera: L.fuera, ...(L.fuera ? { motivoFuera: L.motivoFuera } : {}),
  };
}
export const MARCAS_CURA = { v: 'vendada', c: 'cosida', q: 'cauterizada', e: 'entablillada', h: 'hierbas' };
const marcasCura = (h) => Object.entries(MARCAS_CURA).filter(([, k]) => h[k]).map(([m]) => m).join('');
// lo que cambia sin parar (el avance de la acción) no cuenta para decidir si hay que mandarlo otra vez
const clave = (f) => [f.arma, f.objeto, f.armadura, f.prendas.join(','), f.accion, f.linea, f.bloqueando, f.lineaBloqueo, f.sacada, f.cansancio, f.sangre, f.lista.map(h => h[1] + h[4]).join(','), Object.values(f.botiquin).join(','), f.fuera, f.contra, Math.round(f.tension * 10)].join('|');

export class CombateServidor {
  // ritmo: el de RITMO (decisión provisional: «normal» para todos en línea). semilla: azar de las heridas.
  // tierras: en(x, z) de crearTierrasRey (src/logica/tierras_rey.js), o null para no proteger ningún sitio.
  // mundo (opcional): { suelo(x, z), presas() → [{ id, x, z }] } — el terreno y las liebres (moverProyectil).
  // alLanzar(autor, L) → { tipo, n, gasta } o null: lo saca de su inventario al soltar (sin ello, se lanza sin gastar nada).
  constructor({ ritmo = RITMO.normal, semilla = 1, registro = new RegistroAcciones(1000), tierras = null, mundo = null, alLanzar = null } = {}) {
    this.ctx = { luchadores: {}, r: azar(semilla), mundo };
    this.alLanzar = alLanzar;
    this.tierras = tierras;
    if (tierras) this.ctx.protegido = (A, B) => motivoProtegido(tierras, A, B);
    this.registro = registro;
    this.ritmo = ritmo;
    this.proyectiles = [];
    this.reloj = 0;            // s del combate
    this.pendientes = [];      // eventos sin repartir
    this.mandado = new Map();  // autor → clave de lo último repartido
  }
  get luchadores() { return this.ctx.luchadores; }

  // prendas: lo que lleva puesto en el inventario (lo que le protege); sin ellas, la armadura (el rival de las pruebas).
  entrar(autor, { arma = 'espada_larga', armadura = 'gambeson', prendas = null, x = 0, z = 0, rot = 0 } = {}) {
    this.ctx.luchadores[autor] = new Luchador({ nombre: autor, arma, armadura, prendas, ritmo: this.ritmo, x, z, rot });
    this.ctx.luchadores[autor].reloj = this.reloj;
    return this.ctx.luchadores[autor];
  }
  quitar(autor) {
    delete this.ctx.luchadores[autor]; this.mandado.delete(autor);
    for (const p of this.proyectiles) if (p.autor === autor) p.tirador = { x: p.x, z: p.z }; // su flecha sigue volando
  }
  // Se ha cortado su conexión: se saca del combate (nadie puede darle mientras no está) pero se devuelve su
  // luchador tal cual (heridas, sangre, cansancio, arma) para que vuelva igual si se conecta otra vez.
  apartar(autor) {
    const L = this.ctx.luchadores[autor];
    this.quitar(autor);
    return L || null;
  }
  // Vuelve el luchador apartado; su reloj se pone al del combate (no le pasa el tiempo que ha estado fuera).
  volver(autor, L) {
    L.reloj = this.reloj;
    this.ctx.luchadores[autor] = L;
    this.mandado.delete(autor);   // se reparte otra vez a todos en el próximo tic
    return L;
  }
  // Lo que lleva puesto (tipos de prendas): lo pone el servidor, de su inventario, al entrar y cada vez que cambia.
  // Se lo puede quitar o poner en mitad de una pelea: el inventario ya lo deja o no (no hay tiempo de ponerse nada).
  vestir(autor, prendas) {
    const L = this.ctx.luchadores[autor];
    if (L) L.vestir(prendas);
  }
  // El arma es lo que lleva en la mano (src/logica/arma_mano.js): lo pone el servidor desde su inventario, al entrar y
  // cada vez que cambia. Si ya no puede lanzar lo que estaba tensando, se cancela.
  armar(autor, { arma, objeto = null }) {
    const L = this.ctx.luchadores[autor];
    if (!L || !Object.hasOwn(ARMAS, arma)) return;
    L.arma = arma; L.objeto = objeto;
    if (L.accion === 'tensando' && !defTiro(arma)) L.cancelarTensado('sin');
    if (L.accion === 'preparando' && ARMAS[arma].tipo !== 'cuerpo') L.fintar();
  }
  // posición y giro (de la presencia)
  colocar(autor, x, z, giro) {
    const L = this.ctx.luchadores[autor];
    if (!L || !numero(x) || !numero(z) || !numero(giro)) return;
    L.x = x; L.z = z;
    if (L.accion !== 'aturdido' && !L.fuera) L.rot = giro;
  }

  // Una intención de un jugador. autor: el de la conexión (lo pone el servidor). Devuelve { ok, motivo? }.
  intencion(autor, m) {
    const L = this.ctx.luchadores[autor];
    if (!L) return { ok: false, motivo: 'No estás en el combate.' };
    const i = validarIntencion(m);
    if (!i) return { ok: false, motivo: 'Intención no válida.' };
    if (i.que === 'reiniciar') return this.reiniciar(autor);
    if (L.fuera) return { ok: false, motivo: 'Estás fuera de combate.' };
    let ok = false;
    switch (i.que) {
      case 'parar':
        if (i.activo && !L.sacada) break;
        L.bloquear(i.activo, i.linea); ok = L.bloqueando === i.activo; break;
      // el golpe se carga mientras se mantiene el botón, sale al soltarlo y la finta lo cancela
      case 'arma':
        if (!i.sacada) { L.bloquear(false); if (L.accion === 'preparando') L.fintar(); }
        L.sacada = i.sacada; ok = true; break;
      case 'cargar': ok = !!L.sacada && L.cargar(i.linea); break;
      case 'descargar': ok = true; if (L.accion === 'preparando') L.descargar(); break;
      case 'fintar': ok = L.fintar(); break;
      case 'tensar': ok = L.empezarTensar(); break;
      case 'soltar': {
        if (L.accion !== 'tensando') break;
        if (L.tension < T.tensionMinima) { L.soltar(); ok = true; break; }   // soltar flojo: no sale nada, pero vale
        // lo que se lanza sale de su inventario (sin ello en la mano, no sale nada)
        const objeto = this.alLanzar ? this.alLanzar(autor, L) : null;
        if (this.alLanzar && !objeto) { L.cancelarTensado('sin'); break; }
        const tiro = L.soltar();
        const base = this.ctx.mundo && this.ctx.mundo.suelo ? this.ctx.mundo.suelo(L.x, L.z) : null;
        const r = ejecutarCombate(this.ctx, this.registro, { autor, tipo: 'disparo', x: i.x, y: i.y, z: i.z, tension: tiro.tension, tTenso: tiro.tTenso });
        if (r.ok) {
          r.proyectil.t0 = this.reloj;
          if (Number.isFinite(base)) r.proyectil.base = base;
          if (objeto) r.proyectil.objeto = objeto;
          this.proyectiles.push(r.proyectil);
          const p = r.proyectil;
          this.pendientes.push({ tipo: 'disparo', n: this.registro.total, autor, arma: p.arma, t: this.ms(),
            x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, ...(Number.isFinite(base) ? { base } : {}), ...(objeto ? { objeto: objeto.tipo } : {}) });
        } else if (objeto) this.pendientes.push({ tipo: 'flecha', autor, arma: L.arma, t: this.ms(), x: L.x, y: 0, z: L.z, resultado: 'suelo', objeto });   // (cae a sus pies)
        ok = r.ok; break;
      }
      case 'equipar': ok = true; break;   // (ya no cuenta: el arma es lo de la mano)
      case 'dejarCura': ok = L.accion === 'curando'; L.cortarCura('dejaCura'); break;
      case 'curar': {
        const r = ejecutarCombate(this.ctx, this.registro, { autor, tipo: 'curar', herida: i.herida, metodo: i.metodo });
        if (!r.ok) return { ok: false, motivo: r.motivo };
        ok = true; break;
      }
    }
    return ok ? { ok: true } : { ok: false, motivo: 'Ahora no se puede.' };
  }

  // Volver a empezar sano, con la misma arma, armadura y sitio. Para que no sirva para
  // curarse a mitad de una pelea: solo fuera de combate o sin nadie en pie a menos de CERCA_REINICIAR.
  reiniciar(autor) {
    const L = this.ctx.luchadores[autor];
    const cerca = this.rivales(autor).some(o => !o.fuera && Math.hypot(o.x - L.x, o.z - L.z) < CERCA_REINICIAR);
    if (!L.fuera && cerca) return { ok: false, motivo: 'Hay alguien cerca: no se puede volver a empezar en mitad de una pelea.' };
    const N = this.entrar(autor, { arma: L.arma, armadura: L.armadura, prendas: L.prendas, x: L.x, z: L.z, rot: L.rot });
    N.sacada = L.sacada;
    this.pendientes.push({ tipo: 'reinicio', autor, t: this.ms() });
    return { ok: true };
  }

  // A quién puede dar el luchador de autor: a todos los demás
  rivales(autor) {
    return Object.entries(this.ctx.luchadores).filter(([id]) => id !== autor).map(([, o]) => o);
  }

  ms() { return Math.round(this.reloj * 1000); }

  // Avanza el combate dt segundos (en pasos cortos). Los eventos se quedan en pendientes.
  avanzar(dt) {
    while (dt > 1e-9) {
      const h = Math.min(PASO, dt); dt -= h;
      this.reloj += h;
      for (const [autor, L] of Object.entries(this.ctx.luchadores)) {
        const ev = L.actualizar(h);
        for (const e of ev) {
          if (e.tipo === 'impacto') this.impacto(autor, L, e.linea);
          else if (e.tipo === 'curado') this.pendientes.push({ tipo: 'curado', autor, metodo: e.metodo, zona: e.zona, gravedad: e.gravedad, t: this.ms() });
        }
      }
      for (const p of this.proyectiles) {
        if (!p.activo) continue;
        const antes = this.registro.total;
        const res = avanzarProyectil(this.ctx, this.registro, p, h, Object.values(this.ctx.luchadores));
        if (res) {
          const e = { tipo: 'flecha', autor: p.autor, arma: p.arma, t: this.ms(), x: p.x, y: p.y, z: p.z, resultado: res.tipo === 'protegido' ? RESULTADO_TIERRAS : res.tipo,
            ...(res.presa ? { presa: res.presa } : {}), ...(p.objeto ? { objeto: p.objeto } : {}) };
          if (this.registro.total > antes) {
            const r = this.registro.entradas[this.registro.entradas.length - 1];
            Object.assign(e, { n: r.n, objetivo: r.datos.objetivo });
            if (!r.ok) e.motivo = r.motivo;
            if (r.zona) { e.zona = r.zona; e.gravedad = r.gravedad; }
          }
          this.pendientes.push(e);
        } else if (this.reloj - p.t0 > DURA_PROYECTIL) {
          p.activo = false;   // (lo lanzado que no ha caído en ese tiempo cae donde está)
          if (p.objeto) this.pendientes.push({ tipo: 'flecha', autor: p.autor, arma: p.arma, t: this.ms(), x: p.x, y: p.y, z: p.z, resultado: 'suelo', objeto: p.objeto });
        }
      }
      if (this.proyectiles.length && !this.proyectiles[0].activo) this.proyectiles = this.proyectiles.filter(p => p.activo);
    }
  }

  // Avanza hasta el segundo s del combate (lo usa el servidor con su reloj)
  avanzarHasta(s) { if (s > this.reloj) this.avanzar(s - this.reloj); }

  // Un golpe llega a su impacto: a quién da lo decide la geometría (el más cercano delante y a su alcance;
  // si no hay nadie, al aire).
  impacto(autor, L, linea) {
    const alcance = linea === 'estocada' ? L.def.alcanceEstocada : L.def.alcance;
    let objetivo = null, mejor = Infinity;
    for (const [id, o] of Object.entries(this.ctx.luchadores)) {
      if (id === autor || o.fuera) continue;
      const d = Math.hypot(o.x - L.x, o.z - L.z);
      const delante = difAngulo(L.rot, angulo(L, o)) <= Math.PI / 3;
      if (d <= alcance + 0.5 && delante && d < mejor) { mejor = d; objetivo = id; }
    }
    if (!objetivo) {
      L.cansancio = Math.min(100, L.cansancio + 6);   // como un fallo de resolverGolpe
      this.pendientes.push({ tipo: 'golpe', autor, linea, resultado: 'al aire', t: this.ms() });
      return;
    }
    const r = ejecutarCombate(this.ctx, this.registro, { autor, tipo: 'golpe', objetivo, linea });
    const e = { tipo: 'golpe', n: this.registro.total, autor, objetivo, linea, resultado: r.resultado, t: this.ms() };
    if (!r.ok) { e.resultado = RESULTADO_TIERRAS; e.motivo = r.motivo; }   // rechazado (tierras del rey)
    if (r.zona) { e.zona = r.zona; e.gravedad = r.gravedad; e.danio = r.tipo; }
    if (r.nota) e.nota = r.nota;
    this.pendientes.push(e);
  }

  // Los eventos desde la última vez (para repartirlos a todos en el mismo orden)
  sacarEventos() { const e = this.pendientes; this.pendientes = []; return e; }

  // Los luchadores que han cambiado desde la última vez (todos si todos = true, para la bienvenida)
  cambiados(todos = false) {
    const lista = [];
    for (const [autor, L] of Object.entries(this.ctx.luchadores)) {
      const f = foto(autor, L), k = clave(f);
      if (todos || this.mandado.get(autor) !== k) lista.push(f);
      if (!todos) this.mandado.set(autor, k);
    }
    return lista;
  }
}
