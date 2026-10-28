// Bots: jugadores simulados que se conectan al servidor de la prueba online (hito 1f) y andan, construyen y
// pelean como lo haría un jugador, con los mismos mensajes que la demo en línea. Son para medir el servidor
// (CPU, memoria y tráfico por jugador) con muchos a la vez; no tienen nada que el servidor no valide igual que
// con una persona: el autor lo pone el servidor y cada acción pasa por la lógica pura.
//
// Cada bot va pasando por tres fases, de FASE segundos cada una, en este orden: andar (pasea cerca del mojón),
// construir (pone el marco de un cimiento de piedra o de troncos, le lleva el material y trabaja en él hasta terminarlo) y
// pelear (se acerca a su pareja y se tiran golpes por líneas al azar, paran y cambian de guardia). Los bots van
// por parejas (0 y 1, 2 y 3…) con la misma fase, para que se encuentren al pelear. Un bot fuera de combate
// vuelve a empezar sano al acabar la pelea.
//
// Decisiones provisionales (para la medición, sin efecto en el juego):
// - Todos construyen alrededor del único mojón del mundo (el servidor de prueba tiene uno; si no lo hay, lo
//   pone el primer bot en 0,0): es el caso más cargado, todos se ven a todos.
// - Si no queda sitio libre en la tierra del mojón, el bot desmonta un cimiento terminado al azar (de cualquiera): así el mundo
//   no crece sin fin durante una medición larga.
// - Si faltan materiales, el bot usa «rellenar» (el botón de pruebas del prototipo, que el servidor admite).
// - Mandan su estado 10 veces por segundo (como la demo), andando a 1,4 m/s.
//
// Lo que ve de las obras lo saca de una copia del mundo rehecha con la lógica pura a partir de lo que reparte el
// servidor; los bots de un mismo enjambre comparten esa copia (una sola por proceso, así 100 bots no rehacen
// cada acción 100 veces y la medición del servidor no se ensucia).
//
// Uso: node servidor/bots.mjs [dirección] [cuántos] [segundos]
//      (por defecto ws://127.0.0.1:8080, 10 bots y 60 s). Cada 10 s y al final escribe lo medido en JSON.
import { WebSocket } from 'ws';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { Mundo, RADIO_MOJON, MAX_RATO } from '../src/logica/construccion.js';
import { RegistroAcciones, ejecutar } from '../src/logica/acciones.js';
import { LINEAS, GUARDIAS } from '../src/combate/logica.js';

export const FASE = 20;          // s de cada fase (andar, construir, pelear)
export const CADA = 100;         // ms entre estados
export const VELOCIDAD = 1.4;    // m/s andando
export const DISTANCIA_PELEA = 1.4;  // m a los que se ponen dos rivales
export const FASES = ['andar', 'construir', 'pelear'];
export const PIEZAS_BOT = ['cim_piedra', 'cim_tronco'];   // lo que levantan (cimientos: van en cualquier sitio llano)

// azar con semilla (para que dos ejecuciones con la misma semilla hagan lo mismo)
export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Copia del mundo compartida por los bots de un enjambre. Aplica cada entrada una sola vez (por su número):
// todas las conexiones reciben las acciones en el mismo orden, así que la primera vez que se ve una ya se han
// visto todas las anteriores.
export class EspejoMundo {
  constructor() { this.mundo = new Mundo(); this.registro = new RegistroAcciones(1); this.ultimo = 0; this.avisos = new Map(); }
  meter(e) {
    if (!e || !e.ok || !(e.n > this.ultimo)) return;
    this.ultimo = e.n;
    const r = ejecutar(this.mundo, this.registro, { autor: e.autor, tipo: e.tipo, ...e.datos });
    const aviso = this.avisos.get(e.autor);
    if (aviso) aviso(e, r);
  }
}

export class Bot {
  constructor(enjambre, i, opciones = {}) {
    this.enjambre = enjambre; this.i = i;
    this.r = azar((opciones.semilla || 1) * 7919 + i * 104729);
    this.fase = opciones.fase || FASE;
    this.fases = opciones.fases || FASES;
    this.desfase = opciones.desfase ?? 0.37;   // las parejas no cambian de fase todas a la vez
    this.piezas = opciones.piezas || PIEZAS_BOT;
    this.yo = null; this.ws = null; this.abierto = false; this.cerrado = null;
    // empieza en el mismo sitio que su pareja, cerca del mojón
    const rp = azar((opciones.semilla || 1) * 7919 + (i >> 1) * 104729 + 1);
    const a = rp() * Math.PI * 2, d = 4 + rp() * (RADIO_MOJON - 8);
    this.x = Math.cos(a) * d; this.z = Math.sin(a) * d; this.giro = 0; this.anim = 'quieto';
    this.destino = null;
    this.id = 0; this.esperando = new Map();   // id de acción → { t, resolver }
    this.obra = null;            // { construccion, clave } la que está levantando
    this.ocupado = false;        // esperando la respuesta de una acción de obra
    this.siguiente = 0;          // ms (reloj del bot) de la próxima intención de combate
    this.L = null;               // lo último que el servidor dice de su luchador
    this.m = { enviados: 0, bytesEnviados: 0, recibidos: 0, bytesRecibidos: 0, porTipo: {}, accionesOk: 0, accionesMal: 0,
      motivos: {}, obrasTerminadas: 0, intenciones: 0, rechazos: 0, golpesDados: 0, golpesAlAire: 0, heridasRecibidas: 0,
      reinicios: 0, errores: 0, latencias: [] };
  }
  get pareja() { return this.enjambre.bots[this.i ^ 1] || null; }
  faseAhora(t) { return this.fases[Math.floor((t / 1000) / this.fase + (this.i >> 1) * this.desfase) % this.fases.length]; }

  conectar(url) {
    return new Promise((listo, fallo) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.on('open', () => { this.abierto = true; this.enviar({ tipo: 'aspecto', sexo: this.r() < 0.5 ? 'hombre' : 'mujer', capas: [this.r() < 0.5 ? 'tunica' : 'vestido'] }); });
      ws.on('message', (d) => {
        this.m.recibidos++; this.m.bytesRecibidos += d.length;
        let msg; try { msg = JSON.parse(d.toString()); } catch (e) { return; }
        this.m.porTipo[msg.tipo] = (this.m.porTipo[msg.tipo] || 0) + 1;
        this.recibir(msg);
        if (msg.tipo === 'bienvenida') listo(this);
      });
      ws.on('close', (codigo) => { this.abierto = false; this.cerrado = codigo; for (const e of this.esperando.values()) e.resolver({ ok: false, motivo: 'Cerrada.' }); this.esperando.clear(); });
      ws.on('error', (e) => { if (!this.yo) fallo(e); });
    });
  }
  enviar(msg) {
    if (!this.abierto || this.ws.readyState !== WebSocket.OPEN) return false;
    const t = JSON.stringify(msg);
    this.ws.send(t);
    this.m.enviados++; this.m.bytesEnviados += Buffer.byteLength(t);
    return true;
  }
  accion(accion) {
    const id = ++this.id;
    return new Promise((r) => {
      if (!this.enviar({ tipo: 'accion', id, accion })) return r({ ok: false, motivo: 'Cerrada.' });
      this.esperando.set(id, { t: performance.now(), resolver: r });
    });
  }
  recibir(msg) {
    const E = this.enjambre.espejo;
    switch (msg.tipo) {
      case 'bienvenida':
        this.yo = msg.autor;
        for (const e of msg.entradas) E.meter(e);
        break;
      case 'accion': E.meter(msg.entrada); break;
      case 'resultado': {
        const e = this.esperando.get(msg.id);
        if (!e) break;
        this.esperando.delete(msg.id);
        this.m.latencias.push(performance.now() - e.t);
        if (msg.ok) this.m.accionesOk++; else { this.m.accionesMal++; this.m.motivos[msg.motivo] = (this.m.motivos[msg.motivo] || 0) + 1; }
        e.resolver(msg);
        break;
      }
      case 'luchadores': for (const f of msg.lista) if (f.autor === this.yo) this.L = f; break;
      case 'combate':
        for (const ev of msg.eventos) {
          if (ev.tipo !== 'golpe') continue;
          if (ev.autor === this.yo) { if (ev.objetivo) this.m.golpesDados++; else this.m.golpesAlAire++; }
          if (ev.objetivo === this.yo && ev.resultado === 'herida') this.m.heridasRecibidas++;
        }
        break;
      case 'combate_rechazo': this.m.rechazos++; break;
      case 'error': this.m.errores++; break;
    }
  }

  // Un paso (cada CADA ms): moverse, mandar el estado y hacer lo de su fase.
  paso(t, dt) {
    if (!this.abierto || !this.yo) return;
    const fase = this.faseAhora(t);
    if (fase !== this.faseAntes) { this.faseAntes = fase; this.destino = null; this.desdeTrabajo = undefined; if (fase !== 'pelear' && this.L && this.L.fuera) this.reiniciar(); }
    let anim = 'quieto';
    if (fase === 'andar') {
      if (!this.destino || Math.hypot(this.destino.x - this.x, this.destino.z - this.z) < 0.3) this.destino = this.puntoTierra(RADIO_MOJON - 2);
      anim = this.andarHacia(this.destino, dt) ? 'andar' : 'quieto';
    } else if (fase === 'construir') {
      anim = this.construir(t, dt);
    } else {
      anim = this.pelear(t, dt);
    }
    this.anim = anim;
    this.enviar({ tipo: 'estado', x: +this.x.toFixed(3), y: 0, z: +this.z.toFixed(3), giro: +this.giro.toFixed(3), anim, tc: Math.round(t) });
  }
  puntoTierra(radio) {
    const M = this.enjambre.espejo.mundo.mojon || { x: 0, z: 0 };
    const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * radio;
    return { x: M.x + Math.cos(a) * d, z: M.z + Math.sin(a) * d };
  }
  // anda hacia p; devuelve true si se ha movido
  andarHacia(p, dt, parar = 0.05) {
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    if (d <= parar + 1e-3) return false;   // con margen: si no, por redondeo se queda siempre a un pelo
    const paso = Math.min(d - parar, VELOCIDAD * dt);
    this.x += dx / d * paso; this.z += dz / d * paso;
    this.giro = Math.atan2(dx, dz);
    return true;
  }

  construir(t, dt) {
    const M = this.enjambre.espejo.mundo;
    if (this.ocupado) return 'talar';
    if (!M.mojon) return 'quieto';   // lo pone el enjambre al arrancar
    if (this.obra) {
      const c = M.construcciones.find(x => x.id === this.obra.construccion);
      const p = c && c.piezas.get(this.obra.clave);
      if (!p || !p.obra) { if (p) this.m.obrasTerminadas++; this.obra = null; this.desdeTrabajo = undefined; return 'quieto'; }
      if (this.destino && this.andarHacia(this.destino, dt, 1.2)) return 'andar';
      const falta = M.faltaEntregar(p);
      if (falta.length) this.hacer({ tipo: 'entregar', construccion: c.id, clave: this.obra.clave, material: falta[0].m, cantidad: falta[0].n, desde: 0 });
      else {
        // como la demo: un rato de trabajo cada medio segundo, con el tiempo de verdad que ha pasado
        if (this.desdeTrabajo === undefined) this.desdeTrabajo = t;
        const seg = (t - this.desdeTrabajo) / 1000;
        if (seg >= 0.5) { this.desdeTrabajo = t; this.hacer({ tipo: 'trabajar', construccion: c.id, clave: this.obra.clave, segundos: +Math.min(MAX_RATO, seg).toFixed(3) }); }
      }
      return 'talar';
    }
    // sitio libre para un cimiento
    for (let n = 0; n < 12; n++) {
      // cerca de donde está (como un jugador, que construye a su alrededor); si cae fuera de la tierra, en otro sitio de ella
      const a = this.r() * Math.PI * 2, d = 1.5 + this.r() * 2.5;
      let q = { x: this.x + Math.cos(a) * d, z: this.z + Math.sin(a) * d };
      if (Math.hypot(q.x - M.mojon.x, q.z - M.mojon.z) > RADIO_MOJON - 1.5) q = this.puntoTierra(RADIO_MOJON - 1.5);
      const pieza = this.piezas[Math.floor(this.r() * this.piezas.length)];
      const cand = M.candidata(pieza, q.x, q.z, 0, 0, 0);
      if (!cand) continue;
      const v = M.validar(cand, true);
      if (!v.ok) continue;
      this.destino = q;
      this.hacer({ tipo: 'colocar', pieza, x: q.x, z: q.z, k: 0, rot: 0, dir: 0 }, (e, r) => {
        if (r.ok && r.clave !== undefined) this.obra = { construccion: r.construccion.id, clave: r.clave };
      });
      return 'quieto';
    }
    // sin sitio: desmonta uno terminado al azar
    const hechos = [];
    for (const c of M.construcciones) for (const [clave, p] of c.piezas) if (!p.obra && this.piezas.includes(p.tipo)) hechos.push({ c, clave });
    if (hechos.length) { const h = hechos[Math.floor(this.r() * hechos.length)]; this.hacer({ tipo: 'desmontar', construccion: h.c.id, clave: h.clave }); }
    return 'quieto';
  }
  // Manda una acción de obra y espera su respuesta antes de la siguiente (como un jugador, que no repite el
  // clic hasta ver qué pasa). alAplicar: se llama cuando la copia del mundo aplica esa acción (con su resultado).
  hacer(accion, alAplicar) {
    this.ocupado = true;
    const E = this.enjambre.espejo;
    if (alAplicar) E.avisos.set(this.yo, (e, r) => { if (e.tipo === accion.tipo) { E.avisos.delete(this.yo); alAplicar(e, r); } });
    this.accion(accion).then((r) => {
      this.ocupado = false;
      if (!r.ok) {
        if (alAplicar) E.avisos.delete(this.yo);
        if (r.motivo === 'Faltan materiales.' || /material/i.test(r.motivo || '')) this.accion({ tipo: 'rellenar', cantidad: 1000 });
      }
    });
  }

  pelear(t, dt) {
    const P = this.pareja;
    if (!P || !P.abierto) return this.andarHacia(this.destino || (this.destino = this.puntoTierra(RADIO_MOJON - 2)), dt) ? 'andar' : 'quieto';
    if (this.L && this.L.fuera) { if (P.L && P.L.fuera && t >= this.siguiente) { this.reiniciar(); this.siguiente = t + 1500; } return 'quieto'; }
    // se pone a DISTANCIA_PELEA de su pareja, mirándola
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    if (d > DISTANCIA_PELEA + 0.15) { this.andarHacia({ x: P.x, z: P.z }, dt, DISTANCIA_PELEA); return 'andar'; }
    this.giro = Math.atan2(dx, dz);
    if (t < this.siguiente) return 'quieto';
    const r = this.r();
    if (r < 0.55) this.intencion({ que: 'atacar', linea: LINEAS[Math.floor(this.r() * LINEAS.length)] });
    else if (r < 0.85) { this.intencion({ que: 'parar', activo: true }); setTimeout(() => this.intencion({ que: 'parar', activo: false }), 250 + this.r() * 300); }
    else this.intencion({ que: 'guardia', guardia: Object.keys(GUARDIAS)[Math.floor(this.r() * Object.keys(GUARDIAS).length)] });
    this.siguiente = t + 700 + this.r() * 900;
    return 'quieto';
  }
  intencion(i) { if (this.enviar({ tipo: 'combate', ...i })) this.m.intenciones++; }
  reiniciar() { this.intencion({ que: 'reiniciar' }); this.m.reinicios++; }
  cerrar() { if (this.ws) this.ws.close(1000, 'Fin'); }
}

// Un grupo de bots en un mismo proceso, con un solo reloj (un setInterval para todos).
export class Enjambre {
  constructor({ url, cuantos = 10, semilla = 1, fase = FASE, fases = FASES, desfase = 0.37, piezas = PIEZAS_BOT, escalonar = 20 } = {}) {
    Object.assign(this, { url, cuantos, semilla, fase, escalonar });
    this.opciones = { semilla, fase, fases, desfase, piezas };
    this.espejo = new EspejoMundo();
    this.bots = [];
    this.reloj = null;
  }
  async arrancar() {
    for (let i = 0; i < this.cuantos; i++) {
      const b = new Bot(this, i, this.opciones);
      this.bots.push(b);
      await b.conectar(this.url);
      if (this.escalonar) await new Promise(r => setTimeout(r, this.escalonar));
      // sin mojón no se puede construir: lo pone el primero en 0,0 (si faltan materiales, rellena antes)
      if (i === 0 && !this.espejo.mundo.mojon) {
        let r = await b.accion({ tipo: 'mojon', x: 0, z: 0 });
        if (!r.ok && r.motivo === 'Faltan materiales.') { await b.accion({ tipo: 'rellenar', cantidad: 1000 }); r = await b.accion({ tipo: 'mojon', x: 0, z: 0 }); }
      }
    }
    this.t0 = performance.now();
    let antes = 0;
    this.reloj = setInterval(() => {
      const t = performance.now() - this.t0, dt = Math.min(0.5, (t - antes) / 1000); antes = t;
      for (const b of this.bots) b.paso(t, dt);
    }, CADA);
    return this;
  }
  async parar() {
    clearInterval(this.reloj);
    for (const b of this.bots) b.cerrar();
    await new Promise(r => setTimeout(r, 200));
  }
  // lo medido de todos (sumado) y de cada uno
  medida() {
    const suma = {};
    const lat = [];
    for (const b of this.bots) {
      for (const [k, v] of Object.entries(b.m)) {
        if (k === 'latencias') { lat.push(...v); continue; }
        if (typeof v === 'number') suma[k] = (suma[k] || 0) + v;
        else { suma[k] = suma[k] || {}; for (const [kk, vv] of Object.entries(v)) suma[k][kk] = (suma[k][kk] || 0) + vv; }
      }
    }
    lat.sort((a, b) => a - b);
    const pct = (p) => lat.length ? Math.round(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] * 10) / 10 : null;
    const seg = this.t0 ? (performance.now() - this.t0) / 1000 : 0;
    return { bots: this.bots.length, conectados: this.bots.filter(b => b.abierto).length, segundos: Math.round(seg * 10) / 10, ...suma,
      latenciaAccionMs: { p50: pct(0.5), p95: pct(0.95), max: pct(1) },
      porBotYSegundo: seg > 0 ? { mensajesEnviados: +(suma.enviados / this.bots.length / seg).toFixed(1), bytesEnviados: Math.round(suma.bytesEnviados / this.bots.length / seg),
        mensajesRecibidos: +(suma.recibidos / this.bots.length / seg).toFixed(1), bytesRecibidos: Math.round(suma.bytesRecibidos / this.bots.length / seg) } : null };
  }
}

// Arranque desde la línea de órdenes
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.argv[2] || 'ws://127.0.0.1:8080';
  const cuantos = Number(process.argv[3]) || 10;
  const segundos = Number(process.argv[4]) || 60;
  const E = new Enjambre({ url, cuantos });
  await E.arrancar();
  console.log(`${cuantos} bots conectados a ${url}`);
  const informe = setInterval(() => console.log(JSON.stringify(E.medida())), 10000);
  await new Promise(r => setTimeout(r, segundos * 1000));
  clearInterval(informe);
  console.log(JSON.stringify(E.medida(), null, 1));
  await E.parar();
  process.exit(0);
}
