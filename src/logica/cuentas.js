// Cuentas (revisión del 1 nov con valravnx: «cuentas antes que nada»; usuario y contraseña).
// Lógica pura (sin three.js ni crypto): el servidor le da la forma de resumir la contraseña (servidor/claves.mjs, scrypt
// con sal) y la hora; aquí se decide qué usuario y qué contraseña valen, quién es quién y cuándo hay demasiados intentos.
//
// - Cada cuenta tiene su personaje: su autor («jugador:…»), el que firma todo lo que hace en el mundo. Al crear la cuenta,
//   el autor es el de la conexión (el personaje que ya llevas pasa a tu cuenta); al entrar con ella, vuelves a ese autor.
// - La contraseña nunca se guarda ni se apunta en claro: solo su resumen lento con su sal.
// - El usuario se compara sin mayúsculas (Ana y ana son la misma cuenta) y se guarda tal como lo escribió.
// - Demasiados intentos: tras FALLOS_USUARIO contraseñas mal seguidas a una cuenta, esa cuenta no deja probar más durante
//   ESPERA ms; tras FALLOS_ORIGEN fallos desde la misma dirección (a cualquier cuenta) en ESPERA ms, esa dirección tampoco.
//   Crear cuentas: como mucho ALTAS_ORIGEN por dirección en ALTAS_VENTANA ms. (Números provisionales: registro en el diario.)
// - Un personaje, una cuenta: un autor que ya tiene cuenta no puede crear otra.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'cuenta', id, que: 'crear' | 'entrar', usuario, clave }
//   servidor → cliente   { tipo: 'cuenta', id, que, ok: true, usuario, autor, ficha }   (entrar: con esa ficha el cliente
//                                                                                         vuelve a conectar y es su personaje)
//                        { tipo: 'cuenta', id, que, ok: false, motivo }

export const USUARIO_MIN = 3, USUARIO_MAX = 20;
export const CLAVE_MIN = 8, CLAVE_MAX = 128;
export const FALLOS_USUARIO = 5;
export const FALLOS_ORIGEN = 20;
export const ESPERA = 15 * 60 * 1000;
export const ALTAS_ORIGEN = 5;
export const ALTAS_VENTANA = 60 * 60 * 1000;

// Letras (también con tilde y ñ), números, guion y guion bajo.
const FORMA_USUARIO = /^[\p{L}\p{N}_-]+$/u;

// La forma de comparar usuarios: sin mayúsculas y con las tildes en una sola forma (NFC).
export const claveDeUsuario = (u) => u.normalize('NFC').toLowerCase();

// Devuelve null si vale, o el motivo.
export function motivoUsuario(u) {
  if (typeof u !== 'string') return 'Falta el usuario.';
  const n = [...u.normalize('NFC')].length;
  if (n < USUARIO_MIN || n > USUARIO_MAX) return `El usuario tiene que tener de ${USUARIO_MIN} a ${USUARIO_MAX} letras.`;
  if (!FORMA_USUARIO.test(u)) return 'El usuario solo puede llevar letras, números, - y _.';
  return null;
}

export function motivoClave(c, usuario) {
  if (typeof c !== 'string') return 'Falta la contraseña.';
  const n = [...c].length;
  if (n < CLAVE_MIN) return `La contraseña tiene que tener al menos ${CLAVE_MIN} caracteres.`;
  if (n > CLAVE_MAX) return `La contraseña no puede pasar de ${CLAVE_MAX} caracteres.`;
  if (typeof usuario === 'string' && c.normalize('NFC').toLowerCase() === claveDeUsuario(usuario)) return 'La contraseña no puede ser el usuario.';
  return null;
}

// Comprueba la petición (sin mirar si la cuenta existe). Devuelve { que, usuario, clave } o { motivo }.
export function validarPeticionCuenta(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || (m.que !== 'crear' && m.que !== 'entrar')) return { motivo: 'Petición de cuenta no válida.' };
  const mu = motivoUsuario(m.usuario);
  if (mu) return { motivo: mu };
  if (m.que === 'crear') { const mc = motivoClave(m.clave, m.usuario); if (mc) return { motivo: mc }; }
  else if (typeof m.clave !== 'string' || !m.clave || m.clave.length > CLAVE_MAX * 4) return { motivo: 'Usuario o contraseña incorrectos.' };
  return { que: m.que, usuario: m.usuario.normalize('NFC'), clave: m.clave };
}

// Cuenta los intentos fallidos (o las altas) de una clave en una ventana de tiempo.
export class Contador {
  constructor(maximo, ventana) { this.maximo = maximo; this.ventana = ventana; this.marcas = new Map(); }
  _vivas(k, ahora) {
    const l = (this.marcas.get(k) || []).filter(t => ahora - t < this.ventana);
    if (l.length) this.marcas.set(k, l); else this.marcas.delete(k);
    return l;
  }
  lleno(k, ahora) { return this._vivas(k, ahora).length >= this.maximo; }
  sumar(k, ahora) { const l = this._vivas(k, ahora); l.push(ahora); this.marcas.set(k, l); }
  borrar(k) { this.marcas.delete(k); }
  // ms que faltan para poder volver a probar (0 si ya se puede)
  falta(k, ahora) { const l = this._vivas(k, ahora); return l.length >= this.maximo ? Math.max(0, l[l.length - this.maximo] + this.ventana - ahora) : 0; }
}

const minutos = (ms) => Math.max(1, Math.ceil(ms / 60000));

// El registro de cuentas. resumir(clave, sal) → Promise<texto> (lento); sal() → texto nuevo; iguales(a, b) → compara en
// tiempo fijo. Lo que se guarda de cada cuenta: { usuario, autor, sal, hash, t } (nunca la contraseña).
export class Cuentas {
  constructor({ resumir, sal, iguales = (a, b) => a === b, previas = [] }) {
    this.resumir = resumir; this.sal = sal; this.iguales = iguales;
    this.porUsuario = new Map(); this.porAutor = new Map();
    this.fallosUsuario = new Contador(FALLOS_USUARIO, ESPERA);
    this.fallosOrigen = new Contador(FALLOS_ORIGEN, ESPERA);
    this.altas = new Contador(ALTAS_ORIGEN, ALTAS_VENTANA);
    this.ocupados = new Set();   // usuarios con un alta a medias (resumir tarda): nadie más puede cogerlos
    this.falsa = null;           // una cuenta de mentira, para tardar lo mismo con un usuario que no existe
    for (const c of previas) this._poner(c);
  }
  _poner(c) {
    if (!c || typeof c.usuario !== 'string' || typeof c.autor !== 'string' || typeof c.sal !== 'string' || typeof c.hash !== 'string') return false;
    const k = claveDeUsuario(c.usuario);
    if (this.porUsuario.has(k) || this.porAutor.has(c.autor)) return false;
    this.porUsuario.set(k, c); this.porAutor.set(c.autor, c);
    return true;
  }
  get total() { return this.porUsuario.size; }
  deAutor(autor) { return this.porAutor.get(autor) || null; }

  // Crea la cuenta para el personaje de esa conexión. Devuelve { ok, cuenta } (la cuenta, para guardarla) o { ok: false, motivo }.
  async crear({ usuario, clave, autor, origen = '?', ahora }) {
    const mu = motivoUsuario(usuario) || motivoClave(clave, usuario);
    if (mu) return { ok: false, motivo: mu };
    usuario = usuario.normalize('NFC');
    const k = claveDeUsuario(usuario);
    if (this.porAutor.has(autor)) return { ok: false, motivo: 'Este personaje ya tiene cuenta.' };
    if (this.porUsuario.has(k) || this.ocupados.has(k)) return { ok: false, motivo: 'Ese usuario ya existe.' };
    if (this.altas.lleno(origen, ahora)) return { ok: false, motivo: `Demasiadas cuentas nuevas desde aquí; prueba dentro de ${minutos(this.altas.falta(origen, ahora))} min.` };
    this.altas.sumar(origen, ahora);
    this.ocupados.add(k);
    try {
      const sal = this.sal(), hash = await this.resumir(clave, sal);
      // mientras se resumía, el mismo personaje pudo crear otra (desde otra pestaña con su ficha)
      if (this.porAutor.has(autor)) return { ok: false, motivo: 'Este personaje ya tiene cuenta.' };
      const cuenta = { usuario, autor, sal, hash, t: ahora };
      this._poner(cuenta);
      return { ok: true, cuenta };
    } finally { this.ocupados.delete(k); }
  }

  // Entra con usuario y contraseña. Devuelve { ok, autor, usuario } o { ok: false, motivo }. Mal el usuario o mal la
  // contraseña dan el mismo motivo y tardan lo mismo (no se puede saber qué cuentas existen probando).
  async entrar({ usuario, clave, origen = '?', ahora }) {
    const MAL = 'Usuario o contraseña incorrectos.';
    if (typeof usuario !== 'string' || typeof clave !== 'string' || !clave || motivoUsuario(usuario)) return { ok: false, motivo: MAL };
    const k = claveDeUsuario(usuario);
    const espera = Math.max(this.fallosUsuario.falta(k, ahora), this.fallosOrigen.falta(origen, ahora));
    if (espera > 0) return { ok: false, motivo: `Demasiados intentos; prueba dentro de ${minutos(espera)} min.`, bloqueado: true };
    let c = this.porUsuario.get(k);
    if (!c) { if (!this.falsa) { const sal = this.sal(); this.falsa = { sal, hash: await this.resumir(this.sal(), sal) }; } }
    const ref = c || this.falsa;
    const hash = await this.resumir(clave, ref.sal);
    if (c && this.iguales(hash, c.hash)) { this.fallosUsuario.borrar(k); return { ok: true, autor: c.autor, usuario: c.usuario }; }
    this.fallosUsuario.sumar(k, ahora); this.fallosOrigen.sumar(origen, ahora);
    return { ok: false, motivo: MAL };
  }
}
