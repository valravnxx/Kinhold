// Combate en el servidor (hito 1f). Lógica pura (sin three.js ni websocket): la usa servidor/servidor.mjs
// y la pueden usar las pruebas sin red.
//
// Cada jugador conectado tiene un luchador (src/combate/logica.js). Los clientes no dicen qué pasa: solo
// mandan intenciones (atacar por una línea, parar, cambiar de guardia, tensar y soltar, coger arma). El
// servidor lleva el reloj de todos los luchadores, y cuando un golpe llega a su impacto o una flecha a su
// blanco lo resuelve con ejecutarCombate / avanzarProyectil (src/logica/acciones.js), siempre con el autor
// de la conexión. Lo que hiere queda en el registro con su autor.
//
// Con lag, una intención cuenta desde que llega al servidor (no desde que el jugador pulsó): antes de
// aplicarla, el combate se avanza hasta ese instante, así los tiempos (preparación, ventana de parada
// perfecta) son exactos en el reloj del servidor. Decisión provisional: sin compensar el lag.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'combate', que: 'atacar', linea }          linea: alto, izquierda, derecha, bajo, estocada
//                        { tipo: 'combate', que: 'parar', activo }           activo: true / false
//                        { tipo: 'combate', que: 'guardia', guardia }        solo en el modo de guardias
//                        { tipo: 'combate', que: 'tensar' }
//                        { tipo: 'combate', que: 'soltar', x, y, z }         punto al que apunta
//                        { tipo: 'combate', que: 'equipar', arma, armadura } solo estando libre
//                        { tipo: 'combate', que: 'liza' }                   entra en la liza (el «Duelo en línea»)
//                        { tipo: 'combate', que: 'reiniciar' }               vuelve a empezar sano: solo si está fuera
//                                                                             de combate o no hay nadie en pie cerca
//   Liza: los luchadores de la liza (duelo en línea) solo se dan entre ellos, y los de fuera (los que construyen)
//   tampoco les dan ni les ven las flechas; así un duelo y una obra pueden ir a la vez en el mismo servidor.
//   La posición y el giro del luchador salen de su estado de presencia ({ tipo: 'estado', … }).
//   servidor → clientes  { tipo: 'combate', eventos: [...] }               golpes, flechas e impactos, en orden
//                        { tipo: 'luchadores', t, lista: [...] }             cada tic, los que han cambiado
import { Luchador, LINEAS, GUARDIAS, ARMAS, ARMADURAS, RITMO, azar, angulo, difAngulo } from '../combate/logica.js';
import { RegistroAcciones, ejecutarCombate, avanzarProyectil } from './acciones.js';

export const PASO = 1 / 60;          // s: el combate se avanza en pasos de como mucho esto
export const DURA_PROYECTIL = 8;     // s: una flecha que no ha caído en este tiempo se quita
export const CERCA_REINICIAR = 15;   // m: no se vuelve a empezar sano con alguien en pie más cerca que esto
const LIMITE = 100000;

const numero = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMITE;

// Comprueba una intención de un cliente. Devuelve la intención limpia o null.
export function validarIntencion(m) {
  if (!m || typeof m !== 'object' || m.tipo !== 'combate') return null;
  switch (m.que) {
    case 'atacar': return LINEAS.includes(m.linea) ? { que: 'atacar', linea: m.linea } : null;
    case 'parar': return typeof m.activo === 'boolean' ? { que: 'parar', activo: m.activo } : null;
    case 'guardia': return Object.hasOwn(GUARDIAS, m.guardia) ? { que: 'guardia', guardia: m.guardia } : null;
    case 'tensar': return { que: 'tensar' };
    case 'liza': return { que: 'liza' };
    case 'reiniciar': return { que: 'reiniciar' };
    case 'soltar': return [m.x, m.y, m.z].every(numero) ? { que: 'soltar', x: m.x, y: m.y, z: m.z } : null;
    case 'equipar':
      if (!Object.hasOwn(ARMAS, m.arma)) return null;
      if (m.armadura !== undefined && !Object.hasOwn(ARMADURAS, m.armadura)) return null;
      return { que: 'equipar', arma: m.arma, ...(m.armadura ? { armadura: m.armadura } : {}) };
    default: return null;
  }
}

// Lo que se reparte de cada luchador (lo que hace falta para dibujarlo y para leer sus golpes)
function foto(autor, L) {
  return {
    autor, arma: L.arma, armadura: L.armadura, accion: L.accion, linea: L.linea,
    duracion: Math.round(L.duracion * 1000), tAccion: Math.round(L.tAccion * 1000),
    bloqueando: L.bloqueando, guardia: L.guardia, tension: Math.round(L.tension * 100) / 100,
    cansancio: Math.round(L.cansancio), sangre: Math.round(L.sangre), heridas: L.heridas.length,
    // cada herida: zona, gravedad y tipo (para dibujarla y decir qué hace); el sangrado lo lleva el servidor
    lista: L.heridas.map(h => [h.zona, h.gravedad, h.tipo, Math.round(h.sangrado * 100) / 100]), liza: !!L.liza, contra: L.puedeContraatacar(),
    fuera: L.fuera, ...(L.fuera ? { motivoFuera: L.motivoFuera } : {}),
  };
}
// lo que cambia sin parar (el avance de la acción) no cuenta para decidir si hay que mandarlo otra vez
const clave = (f) => [f.arma, f.armadura, f.accion, f.linea, f.bloqueando, f.guardia, f.cansancio, f.sangre, f.heridas, f.fuera, f.liza, f.contra, Math.round(f.tension * 10)].join('|');

export class CombateServidor {
  // ritmo: el de RITMO (decisión provisional: «normal» para todos en línea). semilla: azar de las heridas.
  constructor({ ritmo = RITMO.normal, modo = 'capas', semilla = 1, registro = new RegistroAcciones(1000) } = {}) {
    this.ctx = { luchadores: {}, r: azar(semilla) };
    this.registro = registro;
    this.ritmo = ritmo; this.modo = modo;
    this.proyectiles = [];
    this.reloj = 0;            // s del combate
    this.pendientes = [];      // eventos sin repartir
    this.mandado = new Map();  // autor → clave de lo último repartido
  }
  get luchadores() { return this.ctx.luchadores; }

  entrar(autor, { arma = 'espada_larga', armadura = 'gambeson', x = 0, z = 0, rot = 0 } = {}) {
    this.ctx.luchadores[autor] = new Luchador({ nombre: autor, arma, armadura, modo: this.modo, ritmo: this.ritmo, x, z, rot });
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
      case 'atacar': ok = L.atacar(i.linea); break;
      case 'parar': L.bloquear(i.activo); ok = L.bloqueando === i.activo; break;
      case 'guardia': ok = L.cambiarGuardia(i.guardia); break;
      case 'tensar': ok = L.empezarTensar(); break;
      case 'soltar': {
        const tiro = L.soltar();
        if (!tiro) { ok = L.accion === 'libre' && L.cancelado === 'flojo'; break; }   // soltar flojo: no sale nada, pero vale
        const r = ejecutarCombate(this.ctx, this.registro, { autor, tipo: 'disparo', x: i.x, y: i.y, z: i.z, tension: tiro.tension, tTenso: tiro.tTenso });
        if (r.ok) {
          r.proyectil.t0 = this.reloj;
          this.proyectiles.push(r.proyectil);
          const p = r.proyectil;
          this.pendientes.push({ tipo: 'disparo', n: this.registro.total, autor, arma: p.arma, t: this.ms(),
            x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz });
        }
        ok = r.ok; break;
      }
      case 'equipar':
        if (!L.puedeActuar() || L.bloqueando) break;
        L.arma = i.arma; if (i.armadura) L.armadura = i.armadura; ok = true; break;
      case 'liza': L.liza = true; ok = true; break;
    }
    return ok ? { ok: true } : { ok: false, motivo: 'Ahora no se puede.' };
  }

  // Volver a empezar sano (otra partida en la liza), con la misma arma, armadura y sitio. Para que no sirva para
  // curarse a mitad de una pelea: solo fuera de combate o sin nadie en pie a menos de CERCA_REINICIAR.
  reiniciar(autor) {
    const L = this.ctx.luchadores[autor];
    const cerca = this.rivales(autor).some(o => !o.fuera && Math.hypot(o.x - L.x, o.z - L.z) < CERCA_REINICIAR);
    if (!L.fuera && cerca) return { ok: false, motivo: 'Hay alguien cerca: no se puede volver a empezar en mitad de una pelea.' };
    const N = this.entrar(autor, { arma: L.arma, armadura: L.armadura, x: L.x, z: L.z, rot: L.rot });
    N.liza = L.liza;
    this.pendientes.push({ tipo: 'reinicio', autor, t: this.ms() });
    return { ok: true };
  }

  // A quién puede dar el luchador de autor: los demás de su mismo lado de la liza
  rivales(autor) {
    const L = this.ctx.luchadores[autor];
    return Object.entries(this.ctx.luchadores).filter(([id, o]) => id !== autor && !!o.liza === !!(L && L.liza)).map(([, o]) => o);
  }

  ms() { return Math.round(this.reloj * 1000); }

  // Avanza el combate dt segundos (en pasos cortos). Los eventos se quedan en pendientes.
  avanzar(dt) {
    while (dt > 1e-9) {
      const h = Math.min(PASO, dt); dt -= h;
      this.reloj += h;
      for (const [autor, L] of Object.entries(this.ctx.luchadores)) {
        const ev = L.actualizar(h);
        for (const e of ev) if (e.tipo === 'impacto') this.impacto(autor, L, e.linea);
      }
      for (const p of this.proyectiles) {
        if (!p.activo) continue;
        const antes = this.registro.total;
        const tirador = this.ctx.luchadores[p.autor];
        const lado = tirador ? !!tirador.liza : !!p.liza;
        p.liza = lado;
        const res = avanzarProyectil(this.ctx, this.registro, p, h, Object.values(this.ctx.luchadores).filter(o => !!o.liza === lado));
        if (res) {
          const e = { tipo: 'flecha', autor: p.autor, arma: p.arma, t: this.ms(), x: p.x, y: p.y, z: p.z, resultado: res.tipo };
          if (this.registro.total > antes) {
            const r = this.registro.entradas[this.registro.entradas.length - 1];
            Object.assign(e, { n: r.n, objetivo: r.datos.objetivo });
            if (r.zona) { e.zona = r.zona; e.gravedad = r.gravedad; }
          }
          this.pendientes.push(e);
        } else if (this.reloj - p.t0 > DURA_PROYECTIL) p.activo = false;
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
      if (id === autor || o.fuera || !!o.liza !== !!L.liza) continue;
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
