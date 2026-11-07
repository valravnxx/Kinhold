// Kinhold — lógica de combate (sin gráficos, comprobable en Node). Todos los valores son iniciales: se ajustan probando.
//
// Un solo modo, el del combate en el mundo (valravnx, 30–31 oct; los de capas y de guardias, el de la liza, se quitaron
// el 6 nov con el prototipo de combate aparte): cuatro direcciones, el golpe se carga mientras se mantiene el botón y
// va comprometido (el botón de parar lo cancela: finta), y se para por un lado. De lo fácil a lo difícil:
//   1. Parar por el lado por el que viene el golpe. Cansa y no deja atacar. Con escudo no hay lado: lo de frente.
//   2. Parada perfecta: empezar a parar (o pasar al lado bueno) justo antes del impacto. No cansa, descoloca al
//      atacante y abre un contraataque que solo se para con otra parada perfecta.
//   3. Golpe maestro: atacar por el mismo lado del golpe que viene, al principio de su preparación.
//      Desvía su golpe y el tuyo entra sin que pueda pararse.
import { azar } from '../logica/azar.js';
import { ZONAS_CUERPO, proteccion } from '../logica/prendas.js';

// Cuatro direcciones (valravnx, 31 oct). Abajo es clavar (la estocada): fuera el tajo bajo y el centro («bloquear o
// atacar al centro es hiper difícil»).
export const LINEAS = ['alto', 'izquierda', 'derecha', 'estocada'];
export const NOMBRE_LINEA = { alto: 'Alto', izquierda: 'Izquierda', derecha: 'Derecha', estocada: 'Estocada' };
// Las zonas del cuerpo son las de la ropa (src/logica/prendas.js): una sola lista. Los pies no los busca ningún golpe.
export const ZONAS = ZONAS_CUERPO.filter(z => z !== 'pies');
export const NOMBRE_ZONA = { cabeza: 'cabeza', torso: 'torso', brazoI: 'brazo izquierdo', brazoD: 'brazo derecho', piernaI: 'pierna izquierda', piernaD: 'pierna derecha' };
// Un golpe desde mi izquierda llega por el lado derecho del rival: visto desde el rival, por su derecha.
export const ESPEJO = { alto: 'alto', estocada: 'estocada', izquierda: 'derecha', derecha: 'izquierda' };

// Dónde puede caer un golpe según la línea (izquierda/derecha: desde el lado del atacante)
export const ZONAS_POR_LINEA = {
  alto:      [['cabeza', 0.5], ['brazoI', 0.25], ['brazoD', 0.25]],
  izquierda: [['brazoD', 0.4], ['torso', 0.4], ['cabeza', 0.2]],
  derecha:   [['brazoI', 0.4], ['torso', 0.4], ['cabeza', 0.2]],
  estocada:  [['torso', 0.75], ['cabeza', 0.25]],
};

export const ARMAS = {
  espada_larga: { nombre: 'Espada larga', tipo: 'cuerpo', alcance: 1.9, alcanceEstocada: 2.15, prep: 0.42, prepEstocada: 0.32, golpe: 0.12, recup: 0.35, danio: 1.0, cansancio: 12 },
  // Provisional (v4, lo revisará valravnx): espada de una mano, algo más corta que la larga, con escudo redondo.
  espada_escudo: { nombre: 'Espada y escudo', tipo: 'cuerpo', alcance: 1.7, alcanceEstocada: 1.9, prep: 0.38, prepEstocada: 0.3, golpe: 0.12, recup: 0.33, danio: 0.9, cansancio: 10, escudo: true },
  palo:         { nombre: 'Palo', tipo: 'cuerpo', alcance: 1.5, alcanceEstocada: 1.6, prep: 0.5, prepEstocada: 0.4, golpe: 0.12, recup: 0.4, danio: 0.55, contundente: true, cansancio: 9 },
  arco:         { nombre: 'Arco', tipo: 'distancia', tensado: 1.0, recarga: 0.8, vMin: 18, vMax: 55, danio: 0.95, danioTipo: 'perforante', cansancio: 6 },
  piedras:      { nombre: 'Piedras', tipo: 'distancia', tensado: 0.5, recarga: 0.5, vMin: 8, vMax: 19, danio: 0.45, danioTipo: 'contundente', cansancio: 5 },
};

// Una sola tabla de armadura (7 nov): lo que frena un golpe sale de las prendas puestas (src/logica/prendas.js), zona
// a zona, como en la ropa: lo que se ve es lo que protege. Los tres nombres del duelo son conjuntos de prendas (lo que
// se ve con ellos en el taller: src/combate/taller.js). Sin yelmo, la cabeza va al aire con cualquiera de los tres.
const LINO = ['camisa_lino', 'pantalon_lino'];
export const ARMADURAS = {
  lino:     { nombre: 'Lino',          prendas: LINO },
  gambeson: { nombre: 'Gambesón',      prendas: [...LINO, 'gambeson'] },
  malla:    { nombre: 'Cota de malla', prendas: [...LINO, 'gambeson', 'cota_malla'] },
};
// El duelo con lo que llevas (7 nov): en línea, el luchador lleva las prendas que tiene puestas en el inventario
// (Luchador.prendas, lo pone el servidor) y lo que le frena un golpe sale de ellas. El nombre de la armadura queda
// solo para dibujar el modelo sencillo: el de lo más fuerte que lleva puesto.
export function armaduraDe(prendas) {
  const p = prendas || [];
  return p.includes('cota_malla') ? 'malla' : p.includes('gambeson') ? 'gambeson' : 'lino';
}

// ---------- Curación (GDD 13: tabla del análisis, apartado 15) ----------
// Cada herida se trata con lo suyo. En pleno combate se puede, pero lento y quedando vendido: mientras curas no
// atacas ni paras, apenas te mueves, y si te hieren o echas a correr la cura se pierde (sin gastar material).
// Valores iniciales (se ajustan probando). duracion: s con el brazo sano. material: lo que gasta del botiquín.
export const TRATAMIENTOS = {
  vendar:      { nombre: 'Vendar',       duracion: 4,  material: 'vendas' },
  coser:       { nombre: 'Coser',        duracion: 12, material: 'hilo' },
  cauterizar:  { nombre: 'Cauterizar',   duracion: 3,  fuego: true },
  entablillar: { nombre: 'Entablillar',  duracion: 8,  material: 'tablillas' },
  hierbas:     { nombre: 'Emplasto de hierbas', duracion: 5, material: 'hierbas' },
};
// Lo que lleva cada luchador del duelo (provisional, hasta que el duelo use el inventario de la demo)
export const BOTIQUIN = { vendas: 3, hilo: 2, tablillas: 1, hierbas: 2 };
const SANGRA = 0.05;     // por debajo, la herida ya no sangra
// Descanso: lo que tarda una herida que ya no sangra en bajar un grado (s; con emplasto, ×1/1,5)
export const SANAR = { leve: 120, grave: 600, 'muy grave': 1800 };
export const RECUPERAR_SANGRE = 1 / 30; // % de sangre por segundo cuando nada sangra
const MAS_LEVE = { 'muy grave': 'grave', grave: 'leve' };

// ¿Sirve ese tratamiento para esa herida? Devuelve null si sirve o el motivo (para enseñarlo) si no.
export function motivoNoSirve(h, metodo) {
  if (!h || !Object.hasOwn(TRATAMIENTOS, metodo)) return 'No hay nada que tratar.';
  const sangra = h.sangrado > SANGRA;
  switch (metodo) {
    case 'vendar': return h.vendada ? 'Ya está vendada.' : !sangra ? 'No sangra.' : null;
    case 'coser': return h.cosida ? 'Ya está cosida.' : h.tipo !== 'corte' || h.gravedad === 'leve' ? 'Solo para cortes profundos.' : null;
    case 'cauterizar': return h.cauterizada ? 'Ya está cauterizada.' : !sangra || h.gravedad === 'leve' ? 'Solo para sangrados graves.' : null;
    case 'entablillar': return h.entablillada ? 'Ya está entablillada.' : h.tipo !== 'contundente' || h.gravedad === 'leve' || !/^(brazo|pierna)/.test(h.zona) ? 'Solo para huesos rotos de brazos y piernas.' : null;
    case 'hierbas': return h.hierbas ? 'Ya lleva emplasto.' : null;
  }
  return null;
}
// Lo que hace cada tratamiento al terminar
function aplicarTratamiento(h, metodo) {
  switch (metodo) {
    case 'vendar': h.vendada = true; h.sangrado *= { leve: 0, grave: 0.35, 'muy grave': 0.6 }[h.gravedad]; break;
    case 'coser': h.cosida = true; h.sangrado = 0; break;
    case 'cauterizar': h.cauterizada = true; h.secuela = true; h.sangrado = 0; break;   // para el sangrado, deja secuela
    case 'entablillar': h.entablillada = true; break;    // el miembro estorba un grado menos
    case 'hierbas': h.hierbas = true; break;             // sana antes
  }
}

// Ritmo: multiplica la preparación de los golpes de los dos combatientes
export const RITMO = { aprendiz: 1.6, normal: 1.25, realista: 1.0 };

export const T = {
  ventanaPerfecta: 0.25,   // s antes del impacto en los que empezar a parar es parada perfecta
  aturdidoPerfecta: 0.7,
  ventanaContra: 0.8,      // s para contraatacar tras una parada perfecta
  factorContraataque: 0.6, // el contraataque se prepara más rápido
  ventanaMaestro: 0.5,     // fracción inicial de la preparación rival en la que cabe el golpe maestro
  aturdidoMaestro: 0.6,
  costeParada: 10, costeFallo: 6, costeFinta: 8,
  limiteFinta: 0.6,        // se puede fintar hasta el 60% de la propia preparación
  tensionMinima: 0.5,      // por debajo, soltar cancela el tiro sin disparar
  factorEscudo: 0.6,       // parar con escudo cuesta este tanto del aliento de parar con la espada
  anguloEscudo: 70 * Math.PI / 180, // el escudo para lo que viene dentro de este ángulo a cada lado del frente
  guardiaRota: 95,         // con este cansancio la parada normal cede
  anguloAtaque: 60 * Math.PI / 180,
  anguloDefensa: 80 * Math.PI / 180,
  g: 9.8,
  alturaTiro: 1.45,
  temblorDesde: 2.5,
  temblorRumbo: 0.6,
  temblorElevacion: 0.15,
  // El golpe (valravnx, 30 oct: el combate en el mundo) se carga mientras se mantiene el botón.
  // Soltar pronto lo lanza al llegar a «cargaMinima» de la preparación (sale antes, más flojo); a la preparación
  // entera, con toda su fuerza. Mantenerlo cargado del todo cansa. Desde que se suelta hasta el impacto, «vuelo».
  cargaMinima: 0.6, fuerzaMinima: 0.8, vuelo: 0.15, cansancioCargado: 4,
};

// ---------- Azar con semilla (vive en src/logica/azar.js; se sigue ofreciendo desde aquí) ----------
export { azar };

function elegir(pares, r) {
  let x = r(), acc = 0;
  for (const [v, p] of pares) { acc += p; if (x <= acc) return v; }
  return pares[pares.length - 1][0];
}
export function gravedadDe(sev) { return sev < 0.35 ? 'leve' : sev < 0.75 ? 'grave' : 'muy grave'; }

// ---------- Luchador ----------
export class Luchador {
  constructor({ nombre = 'Luchador', arma = 'espada_larga', armadura = 'lino', prendas = null, ritmo = 1, x = 0, z = 0, rot = 0 } = {}) {
    Object.assign(this, { nombre, arma, armadura, ritmo, x, z, rot });
    this.prendas = null; if (prendas) this.vestir(prendas);
    this.accion = 'libre'; this.tAccion = 0; this.duracion = 0;
    this.linea = null; this.calidad = 1;
    this.inicioAtaque = -1; this.prepTotal = 0; this.imparable = false; this.finta = false;
    this.soltado = true; this.soltarEn = null;   // si ya se soltó el botón y a qué carga se suelta sola
    this.bloqueando = false; this.lineaBloqueo = 'alto'; this.tBloqueo = 0;
    this.contraHasta = -1;
    this.heridas = []; this.sangre = 100; this.cansancio = 0;
    this.tension = 0; this.tTenso = 0; this.corriendo = false; this.cancelado = null;
    this.fuera = false; this.motivoFuera = '';
    this.reloj = 0;
    this.botiquin = { ...BOTIQUIN }; this.cercaFuego = false; this.cura = null;
  }
  get def() { return ARMAS[this.arma]; }
  // Lo que lleva puesto (tipos de src/logica/prendas.js): desde ahí, lo que le protege; la armadura, la que se dibuja.
  vestir(prendas) { this.prendas = [...(prendas || [])]; this.armadura = armaduraDe(this.prendas); }
  // Las prendas que le protegen: las que lleva puestas o, si nadie se las ha dado (el rival de práctica), las de su armadura.
  get puestas() { return this.prendas || (ARMADURAS[this.armadura] || ARMADURAS.lino).prendas; }
  // La parte de un golpe de ese tipo que le pasa a esa zona, con lo que lleva puesto (1 = nada lo frena).
  proteccion(zona, tipo) { return proteccion(this.puestas, zona, tipo); }

  // efectos de las heridas
  peorHerida(zonas) {
    const orden = { leve: 1, grave: 2, 'muy grave': 3 };
    let peor = 0;
    for (const h of this.heridas) if (zonas.includes(h.zona)) peor = Math.max(peor, orden[h.gravedad] - (h.entablillada ? 1 : 0));
    return peor;
  }
  factorBrazo() { return [1, 0.85, 0.7, 0.5][this.peorHerida(['brazoD'])] * [1, 0.95, 0.85, 0.75][this.peorHerida(['brazoI'])]; }
  factorPiernas() { return [1, 0.85, 0.6, 0.35][this.peorHerida(['piernaI', 'piernaD'])]; }
  velocidad(corriendo = false) {
    if (this.fuera) return 0;
    let v = (corriendo && this.cansancio < 90 ? 6 : 3.6) * this.factorPiernas();
    if (this.accion === 'preparando' || this.accion === 'lanzando' || this.accion === 'golpeando') v *= 0.45;
    if (this.accion === 'tensando') v *= 0.5;
    if (this.bloqueando) v *= 0.6;
    if (this.accion === 'aturdido') v *= 0.2;
    if (this.accion === 'curando') v *= 0.25;
    return v;
  }
  puedeActuar() { return !this.fuera && this.accion === 'libre'; }
  puedeContraatacar() { return this.reloj <= this.contraHasta; }

  // ---------- Cuerpo a cuerpo ----------
  duracionPreparacion(linea) {
    const a = this.def;
    let p = (linea === 'estocada' ? a.prepEstocada : a.prep) * this.ritmo;
    if (this.puedeContraatacar()) p *= T.factorContraataque;
    p /= this.factorBrazo();
    if (this.cansancio > 70) p *= 1.25;
    return p;
  }
  // Atacar por una línea de una vez: cargar y soltar enseguida (sale al llegar a la carga mínima). Preparando otro
  // golpe no se puede: va comprometido (la finta es cancelarlo con el botón de parar, fintar()).
  atacar(linea) {
    if (this.accion === 'preparando') return false;
    return this.cargar(linea) && this.descargar();
  }
  // Empezar a cargar un golpe por una línea (se mantiene el botón). soltarEn: carga (0..1) a la que se suelta sola
  // (para la máquina); sin ella, hasta que se llame a descargar().
  cargar(linea, soltarEn = null) {
    if (!LINEAS.includes(linea) || this.def.tipo !== 'cuerpo') return false;
    if (!this.puedeActuar() || this.cansancio >= 100) return false;
    this.bloqueando = false;
    this.imparable = this.puedeContraatacar();
    this.linea = linea; this.finta = false; this.soltado = false; this.soltarEn = soltarEn; this.calidad = 1;
    this.accion = 'preparando'; this.tAccion = 0;
    this.duracion = this.duracionPreparacion(linea);
    this.prepTotal = this.duracion;
    this.inicioAtaque = this.reloj;
    this.contraHasta = -1;
    this.cansancio = Math.min(100, this.cansancio + this.def.cansancio);
    return true;
  }
  // Finta (valravnx, 31 oct): elegida la dirección, el golpe está comprometido; el botón de parar lo cancela mientras
  // se prepara (no cuando ya ha salido). Cuesta aliento y deja libre para parar o para empezar otro golpe por otro lado.
  fintar() {
    if (this.accion !== 'preparando' || this.fuera) return false;
    this.accion = 'libre'; this.tAccion = 0; this.duracion = 0;
    this.soltado = true; this.soltarEn = null; this.imparable = false;
    this.finta = true;
    this.cansancio = Math.min(100, this.cansancio + T.costeFinta);
    return true;
  }
  // Fracción de la carga (0..1 al llegar a la preparación entera)
  carga() { return this.accion === 'preparando' ? Math.min(1, this.tAccion / this.duracion) : 0; }
  // Soltar el botón: el golpe sale ya (o al llegar a la carga mínima) con la fuerza de lo cargado.
  descargar() {
    if (this.accion !== 'preparando' || this.soltado) return false;
    this.soltado = true;
    if (this.tAccion >= this.duracion * T.cargaMinima) this.lanzar();
    return true;
  }
  lanzar() {
    const c = Math.min(1, Math.max(T.cargaMinima, this.tAccion / this.duracion));
    this.calidad = T.fuerzaMinima + (1 - T.fuerzaMinima) * (c - T.cargaMinima) / (1 - T.cargaMinima);
    this.accion = 'lanzando'; this.tAccion = 0; this.duracion = T.vuelo;
  }

  // Parar por un lado (el lado de la pantalla por el que viene el golpe). Se puede cambiar de lado sin soltar y la
  // ventana de parada perfecta empieza de nuevo.
  bloquear(activo, linea) {
    if (this.def.tipo !== 'cuerpo') { this.bloqueando = false; return; }
    if (activo && (this.accion !== 'libre' || this.fuera)) return;
    if (activo && !this.bloqueando) this.tBloqueo = 0;
    // (con escudo no hay lado: cambiarlo no vuelve a abrir la parada perfecta)
    if (activo && !this.def.escudo && this.bloqueando && linea && linea !== this.lineaBloqueo) this.tBloqueo = 0;
    this.bloqueando = activo;
    if (linea) this.lineaBloqueo = linea;
  }
  // ¿Esta parada detiene un golpe normal por esa línea? Con escudo, sin lado: para todo lo que viene de frente (el
  // ángulo lo mira resolverGolpe; valravnx, 31 oct).
  cubre(linea) {
    if (this.fuera) return false;
    return this.bloqueando && this.accion === 'libre' && (!!this.def.escudo || this.lineaBloqueo === ESPEJO[linea]);
  }

  // ¿El escudo levantado para un proyectil que viaja con esta velocidad horizontal (vx, vz)?
  paraConEscudo(vx, vz) {
    if (!this.def.escudo || !this.bloqueando || this.accion !== 'libre' || this.fuera) return false;
    return difAngulo(this.rot, Math.atan2(-vx, -vz)) <= T.anguloEscudo; // viene de frente
  }

  // ---------- Distancia ----------
  empezarTensar() {
    if (!this.puedeActuar() || this.def.tipo !== 'distancia' || this.corriendo) return false;
    this.accion = 'tensando'; this.tAccion = 0; this.tension = 0; this.tTenso = 0;
    return true;
  }
  soltar() {
    if (this.accion !== 'tensando') return null;
    if (this.tension < T.tensionMinima) { this.cancelarTensado('flojo'); return null; }
    const t = { tension: this.tension, tTenso: this.tTenso };
    // sacar y encajar la siguiente flecha (o coger otra piedra)
    this.accion = 'recuperando'; this.tAccion = 0; this.duracion = this.def.recarga ?? 0.35;
    this.cansancio = Math.min(100, this.cansancio + this.def.cansancio);
    return t;
  }

  cancelarTensado(motivo) {
    this.accion = 'libre'; this.tAccion = 0; this.tension = 0; this.tTenso = 0; this.cancelado = motivo;
  }

  // ---------- Curación ----------
  // Por qué no se puede tratar ahora la herida i con ese método (null: se puede)
  motivoNoCurar(i, metodo) {
    const t = Object.hasOwn(TRATAMIENTOS, metodo) ? TRATAMIENTOS[metodo] : null, h = Number.isInteger(i) ? this.heridas[i] : null;
    if (!t || !h) return 'No hay nada que tratar.';
    if (this.fuera) return 'Estás fuera de combate.';
    const m = motivoNoSirve(h, metodo);
    if (m) return m;
    if (t.fuego && !this.cercaFuego) return 'Hace falta un fuego cerca para calentar el hierro.';
    if (t.material && !(this.botiquin[t.material] > 0)) return 'No te quedan.';
    if (this.accion !== 'libre' || this.bloqueando) return 'Ahora no: estás ocupado.';
    if (this.corriendo) return 'No se puede corriendo.';
    return null;
  }
  // Empezar a tratar la herida i. Tarda más con los brazos heridos.
  curar(i, metodo) {
    if (this.motivoNoCurar(i, metodo)) return false;
    this.accion = 'curando'; this.tAccion = 0;
    this.duracion = TRATAMIENTOS[metodo].duracion / this.factorBrazo();
    this.cura = { herida: this.heridas[i], metodo };
    return true;
  }
  // La herida más urgente y lo mejor que se le puede hacer ahora: [i, método] o null
  curaUrgente() {
    const orden = ['cauterizar', 'coser', 'vendar', 'entablillar', 'hierbas'];
    const idx = this.heridas.map((h, i) => i).sort((a, b) => this.heridas[b].sangrado - this.heridas[a].sangrado);
    for (const i of idx) for (const m of orden) if (!this.motivoNoCurar(i, m)) return [i, m];
    return null;
  }
  cortarCura(motivo) {
    if (this.accion !== 'curando') return;
    this.accion = 'libre'; this.tAccion = 0; this.cancelado = motivo; this.cura = null;
  }

  // ---------- Daño ----------
  aturdir(s) {
    if (this.fuera) return;
    if (this.accion === 'curando') this.cancelado = 'herido';
    this.accion = 'aturdido'; this.tAccion = 0; this.duracion = s; this.bloqueando = false; this.imparable = false; this.soltado = true;
  }
  recibirHerida(zona, sev, tipo) {
    const gravedad = gravedadDe(sev);
    let sangrado = { leve: 0.4, grave: zona === 'torso' ? 2.0 : 1.2, 'muy grave': zona === 'torso' ? 6 : 3 }[gravedad];
    if (tipo === 'contundente') sangrado *= 0.3;
    const h = { zona, gravedad, sangrado, tipo };
    this.heridas.push(h);
    if (this.accion === 'curando') this.cortarCura('herido');   // te hieren mientras curas: la cura se pierde
    if (zona === 'cabeza' && gravedad === 'muy grave') this.caer(tipo === 'contundente' ? 'Inconsciente por un golpe en la cabeza' : 'Herida mortal en la cabeza');
    else if (tipo === 'contundente' && gravedad !== 'leve') this.aturdir(zona === 'cabeza' ? 1.5 : 0.6);
    else if (gravedad !== 'leve' && (this.accion === 'preparando' || this.accion === 'lanzando' || this.accion === 'tensando')) this.aturdir(0.4);
    return h;
  }
  caer(motivo) { this.fuera = true; this.motivoFuera = motivo; this.accion = 'caido'; this.bloqueando = false; }

  // ---------- Paso de tiempo ----------
  actualizar(dt, corriendo = false) {
    this.reloj += dt;
    this.corriendo = corriendo;
    if (corriendo && this.accion === 'tensando') this.cancelarTensado('correr'); // no se tensa corriendo
    if (corriendo && this.accion === 'curando') this.cortarCura('dejaCura');
    const ev = [];
    let s = 0;
    for (const h of this.heridas) { s += h.sangrado; if (h.gravedad === 'leve') h.sangrado *= Math.exp(-dt / 20); }
    if (!this.fuera) {
      this.sangre -= s * dt;
      if (this.sangre <= 0) { this.sangre = 0; this.caer('Desangrado'); }
      else this.sanar(dt, s);
    }
    if (this.accion === 'libre' && !this.bloqueando && !corriendo) this.cansancio = Math.max(0, this.cansancio - 12 * dt);
    else if (this.bloqueando) this.cansancio = Math.min(100, this.cansancio + 2 * dt); // mantener la parada cansa
    if (corriendo) this.cansancio = Math.min(100, this.cansancio + 8 * dt);
    if (this.bloqueando) this.tBloqueo += dt;
    if (this.fuera) return ev;
    this.tAccion += dt;
    switch (this.accion) {
      case 'preparando':
        if (this.soltarEn != null && !this.soltado && this.tAccion >= this.duracion * this.soltarEn) this.soltado = true;
        if (this.soltado && this.tAccion >= this.duracion * T.cargaMinima) this.lanzar();
        else if (this.tAccion >= this.duracion) this.cansancio = Math.min(100, this.cansancio + T.cansancioCargado * dt); // cargado del todo
        break;
      case 'lanzando':
        if (this.tAccion >= this.duracion) { this.accion = 'golpeando'; this.tAccion = 0; this.duracion = this.def.golpe; ev.push({ tipo: 'impacto', linea: this.linea }); }
        break;
      case 'golpeando':
        if (this.tAccion >= this.duracion) { this.accion = 'recuperando'; this.tAccion = 0; this.duracion = this.def.recup; this.imparable = false; }
        break;
      case 'tensando':
        this.tension = Math.min(1, this.tAccion / this.def.tensado);
        if (this.tension >= 1) this.tTenso += dt;
        this.cansancio = Math.min(100, this.cansancio + (this.tTenso > 0 ? 6 : 2) * dt);
        break;
      case 'curando':
        if (this.tAccion >= this.duracion) {
          const { herida, metodo } = this.cura || {}, t = TRATAMIENTOS[metodo];
          this.accion = 'libre'; this.tAccion = 0; this.cura = null;
          if (t && this.heridas.includes(herida)) {   // (una copia en línea no sabe qué cura: lo dice el servidor)
            aplicarTratamiento(herida, metodo);
            if (t.material) this.botiquin[t.material]--;
            ev.push({ tipo: 'curado', metodo, zona: herida.zona, gravedad: herida.gravedad });
          }
        }
        break;
      case 'recuperando': case 'aturdido':
        if (this.tAccion >= this.duracion) { this.accion = 'libre'; this.tAccion = 0; }
        break;
    }
    return ev;
  }
  // Descanso: las heridas que ya no sangran bajan de grado con el tiempo (antes con emplasto) y, si nada sangra,
  // la sangre se recupera despacio. Una herida cauterizada sana pero deja secuela (se queda en leve).
  sanar(dt, sangrando) {
    for (const h of this.heridas) {
      if (h.sangrado > SANGRA || (h.secuela && h.gravedad === 'leve')) continue;
      h.sana = (h.sana || 0) + dt * (h.hierbas ? 1.5 : 1) / SANAR[h.gravedad];
      if (h.sana >= 1) { h.sana = 0; h.gravedad = MAS_LEVE[h.gravedad] || null; }
    }
    this.heridas = this.heridas.filter(h => h.gravedad);
    if (sangrando <= SANGRA) this.sangre = Math.min(100, this.sangre + RECUPERAR_SANGRE * dt);
  }
  // Fracción de la preparación en curso (0..1), o null si no está preparando
  progreso() { return this.accion === 'preparando' ? Math.min(1, this.tAccion / this.duracion) : this.accion === 'lanzando' ? 1 : null; }
  // Segundos hasta el impacto del golpe que prepara (mientras se mantiene cargado no se sabe)
  hastaImpacto() {
    if (this.accion === 'lanzando') return this.duracion - this.tAccion;
    if (this.accion !== 'preparando') return Infinity;
    return this.soltado ? Math.max(0, this.duracion * T.cargaMinima - this.tAccion) + T.vuelo : Infinity;
  }
  // Ataca ahora (preparando, lanzando): para quien defiende
  atacando() { return this.accion === 'preparando' || this.accion === 'lanzando'; }
}

// ---------- Geometría ----------
export function angulo(a, b) { return Math.atan2(b.x - a.x, b.z - a.z); }
export function difAngulo(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
export function mira(a, b, lim) { return difAngulo(a.rot, angulo(a, b)) <= lim; }

// ---------- Resolver un golpe cuerpo a cuerpo en el instante del impacto ----------
export function resolverGolpe(at, de, linea, r) {
  const a = at.def;
  if (de.fuera) return { resultado: 'nada' };
  const dist = Math.hypot(de.x - at.x, de.z - at.z);
  const alcance = linea === 'estocada' ? a.alcanceEstocada : a.alcance;
  if (dist > alcance || !mira(at, de, T.anguloAtaque)) {
    at.cansancio = Math.min(100, at.cansancio + T.costeFallo);
    return { resultado: 'fallo' };
  }
  const herir = (factor = 1, nota) => {
    const zona = elegir(ZONAS_POR_LINEA[linea], r);
    const tipo = a.contundente ? 'contundente' : linea === 'estocada' ? 'perforante' : 'corte';
    const sev = a.danio * de.proteccion(zona, tipo) * at.calidad * at.factorBrazo() * (0.8 + 0.4 * r()) * factor;
    const h = de.recibirHerida(zona, sev, tipo);
    return { resultado: 'herida', zona, gravedad: h.gravedad, sev, tipo, nota };
  };
  // de frente: con escudo, lo que entra en su ángulo (ni de lado ni por la espalda)
  const encara = mira(de, at, de.def.escudo ? T.anguloEscudo : T.anguloDefensa);

  // 3. Golpe maestro: el defensor empezó a atacar por el mismo lado, al principio de esta preparación
  if (encara && de.accion === 'preparando' && de.linea === ESPEJO[linea] && de.inicioAtaque > at.inicioAtaque
      && de.inicioAtaque - at.inicioAtaque <= at.prepTotal * T.ventanaMaestro) {
    at.aturdir(T.aturdidoMaestro);
    de.imparable = true;
    de.tAccion = Math.max(de.tAccion, de.duracion * 0.85);
    return { resultado: 'golpe maestro' };
  }
  if (de.cubre(linea) && encara) {
    // 2. Parada perfecta
    if (de.tBloqueo <= T.ventanaPerfecta) {
      at.aturdir(T.aturdidoPerfecta);
      de.contraHasta = de.reloj + T.ventanaContra;
      return { resultado: 'parada perfecta' };
    }
    // un contraataque o un golpe maestro solo se paran con parada perfecta
    if (at.imparable) return herir(0.85, 'imparable');
    // con el cansancio al límite, la parada cede
    if (de.cansancio >= T.guardiaRota) { de.aturdir(0.5); return herir(0.7, 'guardia rota'); }
    // 1. Parada normal
    de.cansancio = Math.min(100, de.cansancio + T.costeParada * (a.contundente ? 1.3 : 1) * (de.def.escudo ? T.factorEscudo : 1));
    return { resultado: 'parada' };
  }
  return herir(1, at.imparable ? 'imparable' : undefined);
}

// ---------- Proyectiles ----------
// Ángulo de elevación (bajo) para alcanzar d metros a velocidad v; null si no llega
export function elevacionPara(d, v, h = T.alturaTiro) {
  // resuelve con la altura de salida aproximando por iteración
  let lo = -0.2, hi = Math.PI / 4;
  const alcance = (th) => {
    const vx = v * Math.cos(th), vy = v * Math.sin(th);
    const disc = vy * vy + 2 * T.g * h;
    if (disc < 0) return -1;
    const t = (vy + Math.sqrt(disc)) / T.g;
    return vx * t;
  };
  if (alcance(hi) < d) return null;
  for (let n = 0; n < 50; n++) { const m = (lo + hi) / 2; if (alcance(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Crea un proyectil hacia un punto apuntado. La elevación se calcula para un tiro a plena tensión:
// si no tensas del todo, la flecha se queda corta. Mantener tenso mucho rato hace temblar el pulso.
// objetivo.y: altura a la que se apunta (0 = suelo; al apuntar a una persona, su pecho).
export function crearProyectil(tirador, objetivo, tiro, r) {
  const a = tirador.def;
  const dx = objetivo.x - tirador.x, dz = objetivo.z - tirador.z;
  const d = Math.hypot(dx, dz);
  const v = a.vMin + (a.vMax - a.vMin) * tiro.tension;
  let elev = elevacionPara(d, a.vMax, T.alturaTiro - (objetivo.y || 0)) ?? Math.PI / 4;
  let rumbo = Math.atan2(dx, dz);
  const extra = Math.max(0, tiro.tTenso - T.temblorDesde) * 2.5;
  const brazo = 1 / tirador.factorBrazo();
  rumbo += (r() * 2 - 1) * (T.temblorRumbo + extra) * Math.PI / 180 * brazo;
  elev += (r() * 2 - 1) * (T.temblorElevacion + extra) * Math.PI / 180 * brazo;
  const ch = Math.cos(elev);
  return {
    arma: tirador.arma, tirador,
    x: tirador.x + Math.sin(rumbo) * 0.4, y: T.alturaTiro, z: tirador.z + Math.cos(rumbo) * 0.4,
    vx: Math.sin(rumbo) * ch * v, vy: Math.sin(elev) * v, vz: Math.cos(rumbo) * ch * v,
    activo: true, tension: tiro.tension, recorrido: 0,
  };
}
// Zona alcanzada según la altura y el lado del impacto respecto al cuerpo
export function zonaPorAltura(l, y, lateral) {
  if (y < 0.85) return lateral < 0 ? 'piernaI' : 'piernaD';
  if (y < 1.5) return Math.abs(lateral) > 0.17 ? (lateral < 0 ? 'brazoI' : 'brazoD') : 'torso';
  return 'cabeza';
}
// Avanza un proyectil; devuelve { tipo: 'suelo' } o { tipo: 'blanco', luchador, zona, ... } o null
// protegido (opcional): (L) → motivo o null. A quien protege, la flecha llega pero no le hiere (se para ahí).
export function moverProyectil(p, dt, blancos, r, dianas = [], protegido = null) {
  if (!p.activo) return null;
  const pasos = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy, p.vz) * dt / 0.15));
  const h = dt / pasos;
  for (let n = 0; n < pasos; n++) {
    p.vy -= T.g * h;
    p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
    p.recorrido += Math.hypot(p.vx, p.vy, p.vz) * h;
    for (const L of blancos) {
      if (L === p.tirador || L.fuera) continue;
      const ex = p.x - L.x, ez = p.z - L.z;
      if (Math.hypot(ex, ez) <= 0.3 && p.y > 0 && p.y < 1.8) {
        p.activo = false;
        const motivo = protegido ? protegido(L) : null;
        if (motivo) return { tipo: 'protegido', luchador: L, motivo };
        if (L.paraConEscudo(p.vx, p.vz)) {
          L.cansancio = Math.min(100, L.cansancio + T.costeParada * T.factorEscudo);
          return { tipo: 'escudo', luchador: L };
        }
        // lado respecto a hacia dónde mira el blanco
        const lateral = ex * Math.cos(L.rot) - ez * Math.sin(L.rot);
        const zona = zonaPorAltura(L, p.y, lateral);
        const a = ARMAS[p.arma];
        const v = Math.hypot(p.vx, p.vy, p.vz);
        const sev = a.danio * (v / a.vMax) * L.proteccion(zona, a.danioTipo) * (0.8 + 0.4 * r());
        const herida = L.recibirHerida(zona, sev, a.danioTipo);
        return { tipo: 'blanco', luchador: L, zona, gravedad: herida.gravedad, sev };
      }
    }
    for (const D of dianas) {
      // diana: disco vertical de radio D.radio centrado en (x, y, z), mirando hacia D.normal
      const ex = p.x - D.x, ey = p.y - D.y, ez = p.z - D.z;
      const prof = ex * D.nx + ez * D.nz;
      if (Math.abs(prof) < 0.12) {
        const lat = ex * D.nz - ez * D.nx;
        const rr = Math.hypot(lat, ey);
        if (rr <= D.radio) {
          p.activo = false;
          const puntos = rr < D.radio * 0.2 ? 10 : rr < D.radio * 0.4 ? 8 : rr < D.radio * 0.6 ? 6 : rr < D.radio * 0.8 ? 4 : 2;
          return { tipo: 'diana', diana: D, puntos, distanciaCentro: rr };
        }
      }
    }
    if (p.y <= 0) { p.y = 0; p.activo = false; return { tipo: 'suelo' }; }
  }
  return null;
}

// ---------- Rival controlado por la máquina ----------
// lectura: probabilidad de leer bien el golpe; perfecta: de intentar parada perfecta en vez de normal;
// maestro: de intentar golpe maestro; finta: de fintar si le paran pronto; reaccion: s hasta reaccionar.
export const DIFICULTAD = {
  aprendiz: { lectura: 0.3,  perfecta: 0.1,  maestro: 0,    finta: 0,    reaccion: 0.35, agresividad: 0.6 },
  normal:   { lectura: 0.55, perfecta: 0.3,  maestro: 0.06, finta: 0.1,  reaccion: 0.25, agresividad: 1.0 },
  realista: { lectura: 0.75, perfecta: 0.55, maestro: 0.15, finta: 0.25, reaccion: 0.18, agresividad: 1.3 },
};
export class IA {
  constructor(bot, dificultad = 'normal', r = azar(7)) {
    this.bot = bot; this.d = DIFICULTAD[dificultad] || DIFICULTAD.normal; this.r = r;
    this.esperaAtaque = 1.0;
    this.visto = null;      // inicioAtaque del golpe rival ya decidido
    this.tVista = 0;
    this.plan = null;       // 'perfecta' | 'normal' | 'nada'
    this.retroceso = 0; this.retrocederTras = false;
    this.carga = false;
    this.tTiro = 0;         // tiempo viendo al rival tensar (para levantar el escudo)
  }
  pensar(dt, rival) {
    const b = this.bot, r = this.r, d = this.d;
    const out = { mx: 0, mz: 0, correr: false };
    if (b.fuera || rival.fuera) { b.bloquear(false); return out; }
    b.rot = angulo(b, rival);
    const dist = Math.hypot(rival.x - b.x, rival.z - b.z);
    const alcance = b.def.alcance;

    // ---- defensa ----
    if (rival.atacando()) {
      // cada golpe (y cada cambio de lado de una finta) se vuelve a leer
      const clave = rival.inicioAtaque + ':' + rival.linea;
      if (this.visto !== clave) { this.visto = clave; this.tVista = 0; this.plan = null; }
      this.tVista += dt;
      if (!this.plan && this.tVista >= d.reaccion) {
        const leeBien = r() < d.lectura;
        // si lo lee bien, para por el lado por el que viene; si no, por otro
        const otros = LINEAS.filter(l => l !== ESPEJO[rival.linea]);
        this.lado = leeBien ? ESPEJO[rival.linea] : otros[Math.floor(r() * otros.length)];
        if (leeBien && b.puedeActuar() && r() < d.maestro && rival.progreso() < T.ventanaMaestro * 0.8 && dist <= alcance) {
          b.cargar(ESPEJO[rival.linea], T.cargaMinima);        // golpe maestro por el mismo lado
          this.plan = 'maestro';
        } else if (leeBien) this.plan = r() < d.perfecta ? 'perfecta' : 'normal';
        else this.plan = r() < 0.4 ? 'normal' : 'nada';
        if (this.plan === 'normal' && b.accion === 'libre') b.bloquear(true, this.lado);
        else if (this.plan === 'nada' && b.bloqueando) b.bloquear(false);
      }
      // la parada perfecta se empieza (o se pone del lado bueno) justo antes del impacto
      if (this.plan === 'perfecta' && b.accion === 'libre' && (!b.bloqueando || b.lineaBloqueo !== this.lado) && rival.hastaImpacto() <= T.ventanaPerfecta * 0.6) b.bloquear(true, this.lado);
      // mientras el rival mantiene la carga no se sabe cuándo llega; se cubre ya ese lado y, al soltar, se vuelve a
      // levantar la parada en el último momento para que sea perfecta
      if (this.plan === 'perfecta' && b.accion === 'libre') {
        if (rival.hastaImpacto() === Infinity && !b.bloqueando) b.bloquear(true, this.lado);
        else if (rival.hastaImpacto() <= T.ventanaPerfecta * 0.6 && b.bloqueando && b.tBloqueo > T.ventanaPerfecta) { b.bloquear(false); b.bloquear(true, this.lado); }
      }
    } else if (b.def.escudo && rival.def.tipo === 'distancia' && (rival.accion === 'tensando' || rival.accion === 'recuperando')) {
      // le apuntan con arco u honda: levanta el escudo en cuanto reacciona y lo mantiene mientras recarga
      this.tTiro += dt;
      if (this.tTiro >= d.reaccion && b.accion === 'libre' && !b.bloqueando) b.bloquear(true);
    } else if (rival.accion !== 'golpeando') {
      if (b.bloqueando) b.bloquear(false);
      this.plan = null; this.tTiro = 0;
    }

    // ---- moverse: acercarse hasta el alcance, retroceder después de golpear ----
    const ideal = alcance * 0.85;
    if (this.retrocederTras && b.accion === 'recuperando') { this.retroceso = 0.5; this.retrocederTras = false; }
    this.retroceso = Math.max(0, this.retroceso - dt);
    let sentido = 0;
    const agotado = b.cansancio > 80;
    if (this.retroceso > 0 || (agotado && dist < ideal + 1)) sentido = -1;
    else if (dist > ideal + 0.15) sentido = 1;
    else if (dist < ideal - 0.4) sentido = -1;
    if (b.accion === 'preparando' || b.accion === 'lanzando' || b.accion === 'golpeando') sentido = 0; // quieto mientras golpea
    if (sentido) { out.mx = Math.sin(b.rot) * sentido; out.mz = Math.cos(b.rot) * sentido; }
    out.correr = this.carga && dist > 6;

    // ---- fintar si el rival para demasiado pronto ----
    if (b.accion === 'preparando' && !b.finta && rival.bloqueando && b.progreso() < T.limiteFinta && r() < d.finta * dt * 8) {
      // cancela el golpe (finta) y empieza otro por un lado que no esté parando
      const otras = LINEAS.filter(l => l !== b.linea && rival.lineaBloqueo !== ESPEJO[l]);
      if (otras.length) {
        const l = otras[Math.floor(r() * otras.length)];
        if (b.fintar()) b.cargar(l, T.cargaMinima + r() * (1 - T.cargaMinima));
      }
    }

    // ---- atacar: contraataque en cuanto se pueda; si no, cuando toque ----
    this.esperaAtaque -= dt * d.agresividad;
    const contra = b.puedeContraatacar();
    if (dist <= alcance && b.puedeActuar() && !b.bloqueando && !agotado && !rival.atacando() && (contra || this.esperaAtaque <= 0)) {
      const linea = LINEAS[Math.floor(r() * LINEAS.length)];
      // unas veces suelta enseguida y otras carga del todo
      const lanza = b.cargar(linea, T.cargaMinima + r() * (1 - T.cargaMinima));
      if (lanza) { this.esperaAtaque = 0.9 + r() * 1.4; this.retrocederTras = r() < 0.4; }
    }
    return out;
  }
}
