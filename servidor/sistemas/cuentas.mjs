// Las cuentas del servidor (partido de servidor/servidor.mjs, 12 nov): las fichas, las cuentas y su correo, el admin,
// el registro de seguridad, lo que se apunta de quién entra (para la tierra que vuelve al rey) y los mensajes
// { tipo: 'cuenta', … }. Todo lo comparte por S, el estado del servidor (servidor/servidor.mjs, crearServidor).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID, createHash, randomInt } from 'crypto';
import { esCorreoAdmin, MODOS_INICIALES } from '../../src/logica/admin.js';
import { Cuentas, validarPeticionCuenta, claveDeUsuario, claveDeOrigen, Contador, motivoClave } from '../../src/logica/cuentas.js';
import { claveDeCorreo, Verificaciones, enmascarar, CODIGO_CIFRAS, RECUPERAR_ORIGEN } from '../../src/logica/correo.js';
import { crearCartero } from '../correo.mjs';
import { Fichas } from '../../src/logica/fichas.js';
import * as claves from '../claves.mjs';
import { Abandono } from '../../src/logica/abandono.js';
import { leerArchivo, reemplazar } from '../guardado.mjs';

export const resumen = (ficha) => createHash('sha256').update(ficha).digest('hex').slice(0, 32);
export const fichaValida = (f) => typeof f === 'string' && /^[0-9a-f]{32}$/.test(f);
export const SIN_CORREO = 'Confirma tu correo para entrar en el mundo.';

export function instalarCuentas(S) {
  const { registrar, archivoSeguridad, archivoFichas, archivoCuentas, archivoAbandono, archivoTierras, parametrosClave, vidaFicha, altas, admins } = S;
  // los recortes del movimiento (quien se salta metros que no puede andar): al registro de seguridad, como mucho uno
  // por jugador cada 10 s con lo que se ha recortado entre medias (un tramposo manda 10 estados por segundo)
  const recortes = new Map();   // autor → { desde, n, metros }
  const anotarRecorte = (autor, metros) => {
    const r = recortes.get(autor) || { desde: -Infinity, n: 0, metros: 0 };
    r.n++; r.metros += metros; recortes.set(autor, r);
    if (Date.now() - r.desde < 10000) return;
    seguridad({ que: 'movimiento_recortado', autor, cuenta: usuarioDe(autor), veces: r.n, metros: Math.round(r.metros * 10) / 10 });
    r.desde = Date.now(); r.n = 0; r.metros = 0;
  };
  const seguridad = (e) => { try { appendFileSync(archivoSeguridad, JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'); } catch (x) { registrar(`no se pudo apuntar en seguridad.jsonl: ${x && x.message}`); } };

  // fichas: resumen (sha256) → autor
  // (caducan a los vidaFicha ms si su personaje tiene cuenta; «salir en todos los aparatos»: src/logica/fichas.js)
  const fichas = new Fichas({ vida: vidaFicha, conCuenta: (a) => !!cuentas.deAutor(a), lineas: leerArchivo(archivoFichas), ahora: Date.now() });
  if (existsSync(archivoFichas)) { const t = readFileSync(archivoFichas, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivoFichas, '\n'); }

  // cuentas: usuario → su personaje (autor), con la contraseña resumida (scrypt con sal); nunca en claro
  if (existsSync(archivoCuentas)) { const t = readFileSync(archivoCuentas, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivoCuentas, '\n'); }
  const cuentas = new Cuentas({ resumir: (c, s) => claves.resumir(c, s, parametrosClave), sal: claves.sal, iguales: claves.iguales, previas: leerArchivo(archivoCuentas), altas });
  const usuarioDe = (autor) => (cuentas.deAutor(autor) || {}).usuario || null;
  let abandono = new Abandono();
  if (existsSync(archivoAbandono)) {
    try { abandono = new Abandono(JSON.parse(readFileSync(archivoAbandono, 'utf8'))); } catch (e) { registrar(`abandono.json no válido, se empieza de cero: ${e && e.message}`); }
  }
  S.abandonoCambiado = false;
  const guardarAbandono = () => {
    if (!S.abandonoCambiado) return;
    S.abandonoCambiado = false;
    writeFileSync(archivoAbandono + '.tmp', JSON.stringify(abandono.exportar())); reemplazar(archivoAbandono + '.tmp', archivoAbandono);
  };
  // está en el mundo (si su cuenta puede entrar: con el correo confirmado); se apunta con un minuto de precisión
  const apuntarVisto = (a, t = Date.now()) => {
    if (cuentas.sinConfirmar(a)) return;
    if (!(t - (abandono.vistos[a] || 0) < 60000)) { abandono.visto(a, t); S.abandonoCambiado = true; }
  };
  const anotarTierra = (e) => { try { appendFileSync(archivoTierras, JSON.stringify({ t: new Date().toISOString(), ...e }) + '\n'); } catch (x) { registrar(`no se pudo apuntar en tierras.jsonl: ${x && x.message}`); } };
  // el correo: los códigos pendientes (en memoria, resumidos) y quien los manda
  const verificaciones = new Verificaciones({ azar: () => randomInt(0, 10 ** CODIGO_CIFRAS), resumir: (x) => createHash('sha256').update(x).digest('hex') });
  if (!S.cartero) S.cartero = crearCartero({ registrar });
  const cartero = S.cartero;
  const estadoCorreo = (autor) => { const e = cuentas.correoDe(autor); return e ? { correo: e.correo ? enmascarar(e.correo) : null, verificado: e.verificado } : null; };
  // un código nuevo para la cuenta de ese personaje, y a mandarlo. Promise<{ ok, motivo? }>
  const mandarCodigo = async (autor, origen, idioma) => {
    const e = cuentas.correoDe(autor);
    if (!e || !e.correo) return { ok: false, motivo: 'Falta el correo.' };
    if (e.verificado) return { ok: false, motivo: 'El correo de esta cuenta ya está confirmado.' };
    const k = claveDeUsuario(e.usuario), r = verificaciones.pedir(k, e.correo, Date.now());
    if (!r.ok) { seguridad({ que: 'codigo', ok: false, usuario: e.usuario, autor, origen, motivo: r.motivo }); return r; }
    const s = await cartero.enviar({ para: e.correo, usuario: e.usuario, codigo: r.codigo, idioma });
    seguridad({ que: 'codigo', ok: !!s.ok, usuario: e.usuario, autor, origen, correo: enmascarar(e.correo), ...(s.ok ? {} : { motivo: s.motivo }) });
    if (!s.ok) verificaciones.olvidar(k);
    return s.ok ? { ok: true } : { ok: false, motivo: s.motivo };
  };
  const esAdmin = (autor) => esCorreoAdmin(cuentas.correoDe(autor), admins);
  // los modos de la herramienta del admin (src/logica/admin.js): de su conexión, en memoria; se apagan al desconectarse
  const modosAdmin = new Map();
  const modosDe = (autor) => (esAdmin(autor) && modosAdmin.get(autor)) || MODOS_INICIALES;
  const arranque = Date.now();
  // recuperar la contraseña: sus códigos aparte de los del correo, y cuántas peticiones por dirección
  const recuperaciones = new Verificaciones({ azar: () => randomInt(0, 10 ** CODIGO_CIFRAS), resumir: (x) => createHash('sha256').update('rec:' + x).digest('hex') });
  const recuperarOrigen = new Contador(RECUPERAR_ORIGEN, 60 * 60 * 1000);
  // avisa por correo (si no sale, solo se apunta: el cambio ya está hecho)
  const avisarCorreo = (para, usuario, tipo, idioma, nuevo = '') => cartero.enviar({ para, usuario, tipo, idioma, nuevo })
    .then((s) => { if (!s.ok) registrar(`no ha salido el aviso (${tipo}) a «${usuario}»`); }).catch(() => registrar(`no ha salido el aviso (${tipo}) a «${usuario}»`));
  // todas las fichas de ese personaje dejan de valer y se cierran sus conexiones (menos la de `salvo`)
  const cerrarSesiones = (autor, salvo = null) => {
    const n = fichas.fuera(autor);
    appendFileSync(archivoFichas, JSON.stringify({ fuera: autor, t: Date.now() }) + '\n');
    for (const [w, a] of S.clientes) if (a === autor && w !== salvo) setTimeout(() => { try { w.close(4002, 'Sesión cerrada'); } catch (e) { /* ya cerrada */ } }, 100);
    return n;
  };
  // una ficha nueva para un autor (al entrar con la cuenta: con ella vuelve a conectar y es su personaje)
  const fichaPara = (autor) => {
    const f = randomUUID().replace(/-/g, '');
    const t = Date.now();
    fichas.poner(resumen(f), autor, t);
    appendFileSync(archivoFichas, JSON.stringify({ h: resumen(f), autor, t }) + '\n');
    return f;
  };
  Object.assign(S, { anotarRecorte, seguridad, fichas, cuentas, usuarioDe, abandono, guardarAbandono, apuntarVisto, anotarTierra, verificaciones, estadoCorreo, mandarCodigo,
    esAdmin, modosAdmin, modosDe, arranque, recuperaciones, recuperarOrigen, avisarCorreo, cerrarSesiones, fichaPara });
}

// { tipo: 'cuenta', que, … } de la conexión c ({ ws, autor, origen })
export function atenderCuenta(S, c, msg) {
  const { ws, autor, origen } = c;
  const { enviar, usuarioDe, seguridad, fichas, archivoFichas, archivoCuentas, registrar, clientes, abandono, verificaciones, cuentas, avisarCorreo, esAdmin, estadoCorreo,
    mandarCodigo, recuperarOrigen, recuperaciones, cartero, cerrarSesiones, fichaPara } = S;
  const id = Number.isSafeInteger(msg.id) ? msg.id : null, que = ['crear', 'entrar', 'salir_todos', 'correo', 'reenviar', 'verificar', 'recuperar', 'restablecer', 'cambiar_clave', 'cambiar_correo'].includes(msg.que) ? msg.que : null;
  const responder = (r) => enviar(ws, { tipo: 'cuenta', id, que, ...r });
  // salir en todos los aparatos: todas las fichas de este personaje dejan de valer y se cierran sus conexiones
  // (también esta: se vuelve a entrar con usuario y contraseña)
  if (que === 'salir_todos') {
    const usuario = usuarioDe(autor);
    if (!usuario) { seguridad({ que, ok: false, autor, origen, motivo: 'sin cuenta' }); return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' }); }
    const n = fichas.fuera(autor);
    appendFileSync(archivoFichas, JSON.stringify({ fuera: autor, t: Date.now() }) + '\n');
    seguridad({ que, ok: true, usuario, autor, origen, fichas: n });
    registrar(`sale en todos los aparatos «${usuario}» (${n} fichas)`);
    responder({ ok: true });
    for (const [w, a] of clientes) if (a === autor) setTimeout(() => { try { w.close(4002, 'Sesión cerrada'); } catch (e) { /* ya cerrada */ } }, 100);
    return;
  }
  // una a la vez por conexión (resumir la contraseña cuesta): la que llega mientras, se rechaza
  if (ws.cuentaEnCurso) return responder({ ok: false, motivo: 'Espera a la respuesta anterior.' });
  const idioma = ['es', 'en', 'ru'].includes(msg.idioma) ? msg.idioma : 'es';
  if (abandono.idiomas[autor] !== idioma && ['es', 'en', 'ru'].includes(msg.idioma)) { abandono.idiomas[autor] = idioma; S.abandonoCambiado = true; }
  // el correo: ponerlo o cambiarlo (sin confirmar), pedir otro código, confirmarlo
  if (que === 'correo' || que === 'reenviar' || que === 'verificar') {
    const usuario = usuarioDe(autor);
    if (!usuario) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
    if (que === 'verificar') {
      const r = verificaciones.comprobar(claveDeUsuario(usuario), typeof msg.codigo === 'string' ? msg.codigo.slice(0, 20) : '', Date.now());
      // con el correo ya confirmado, el código es el del correo nuevo (cambiar el correo desde el menú)
      const antes = cuentas.correoDe(autor);
      if (r.ok && antes.verificado) {
        const c = cuentas.cambiarCorreo(autor, r.correo, Date.now());
        seguridad({ que: 'cambiar_correo', ok: c.ok, usuario, autor, origen, ...(c.ok ? { correo: enmascarar(r.correo) } : { motivo: c.motivo }) });
        if (!c.ok) return responder({ ok: false, motivo: c.motivo });
        appendFileSync(archivoCuentas, JSON.stringify(c.linea) + '\n');
        registrar(`correo cambiado de «${usuario}»`);
        if (c.antes) avisarCorreo(c.antes, usuario, 'aviso_correo', idioma, r.correo);
        return responder({ ok: true, cambiado: true, admin: esAdmin(autor), correo: estadoCorreo(autor) });
      }
      const c = r.ok ? cuentas.confirmarCorreo(autor, r.correo, Date.now()) : r;
      seguridad({ que: 'verificar', ok: c.ok, usuario, autor, origen, ...(c.ok ? {} : { motivo: c.motivo }) });
      if (!c.ok) return responder({ ok: false, motivo: c.motivo });
      appendFileSync(archivoCuentas, JSON.stringify(c.linea) + '\n');
      registrar(`correo confirmado de «${usuario}»`);
      return responder({ ok: true, admin: esAdmin(autor), correo: estadoCorreo(autor) });
    }
    if (que === 'correo') {
      const m = cuentas.motivoCorreoDe(autor, typeof msg.correo === 'string' ? msg.correo : null);
      if (m) { seguridad({ que: 'correo', ok: false, usuario, autor, origen, motivo: m }); return responder({ ok: false, motivo: m }); }
      // antes de cambiarlo, que se pueda mandar el código (si no, se cambiaría de correo sin espera)
      const e = cuentas.correoDe(autor);
      if (e.correo && verificaciones.falta(claveDeUsuario(usuario), msg.correo, Date.now()) > 0) {
        const r = verificaciones.pedir(claveDeUsuario(usuario), msg.correo, Date.now());
        return responder({ ok: false, motivo: r.motivo });
      }
      const r = cuentas.ponerCorreo(autor, msg.correo, Date.now());
      appendFileSync(archivoCuentas, JSON.stringify(r.linea) + '\n');
      verificaciones.olvidar(claveDeUsuario(usuario));
    }
    ws.cuentaEnCurso = true;
    mandarCodigo(autor, origen, idioma)
      .then((r) => responder({ ...r, correo: estadoCorreo(autor) }))
      .catch((e) => { registrar(`error con el correo: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
      .finally(() => { ws.cuentaEnCurso = false; });
    return;
  }
  // recuperar la contraseña: el código va al correo confirmado de esa cuenta (la respuesta, la misma si no existe)
  if (que === 'recuperar') {
    const MISMO = 'Si hay una cuenta con ese usuario o correo, y su correo está confirmado, le llegará un código.';
    const ahora = Date.now(), o = claveDeOrigen(origen);
    if (typeof msg.quien !== 'string' || !msg.quien.trim()) return responder({ ok: false, motivo: 'Escribe tu usuario o tu correo.' });
    if (recuperarOrigen.lleno(o, ahora)) { seguridad({ que, ok: false, autor, origen, motivo: 'demasiadas' }); return responder({ ok: false, motivo: `Demasiados intentos; prueba dentro de ${Math.max(1, Math.ceil(recuperarOrigen.falta(o, ahora) / 60000))} min.` }); }
    recuperarOrigen.sumar(o, ahora);
    const c = cuentas.buscar(msg.quien);
    if (!c || !c.verificado || typeof c.correo !== 'string') { seguridad({ que, ok: false, autor, origen, motivo: c ? 'sin correo confirmado' : 'no existe' }); return responder({ ok: true, motivo: MISMO }); }
    const r = recuperaciones.pedir(claveDeUsuario(c.usuario), c.correo, ahora);
    if (!r.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: r.motivo }); return responder({ ok: true, motivo: MISMO }); }
    ws.cuentaEnCurso = true;
    cartero.enviar({ para: c.correo, usuario: c.usuario, codigo: r.codigo, idioma, tipo: 'recuperar' })
      .then((e) => {
        seguridad({ que, ok: !!e.ok, usuario: c.usuario, autor, origen, correo: enmascarar(c.correo), ...(e.ok ? {} : { motivo: e.motivo }) });
        if (!e.ok) { recuperaciones.olvidar(claveDeUsuario(c.usuario)); return responder({ ok: false, motivo: e.motivo }); }
        responder({ ok: true, motivo: MISMO });
      })
      .catch((e) => { registrar(`error al recuperar: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
      .finally(() => { ws.cuentaEnCurso = false; });
    return;
  }
  // la contraseña nueva con el código; o, desde el menú, con la actual
  if (que === 'restablecer' || que === 'cambiar_clave') {
    const ahora = Date.now();
    let c = null;
    if (que === 'restablecer') {
      const o = claveDeOrigen(origen), f = cuentas.fallosOrigen.falta(o, ahora);
      if (f > 0) return responder({ ok: false, motivo: `Demasiados intentos; prueba dentro de ${Math.max(1, Math.ceil(f / 60000))} min.` });
      c = cuentas.buscar(msg.quien);
      const mc = motivoClave(msg.clave, c ? c.usuario : msg.quien);
      if (mc) return responder({ ok: false, motivo: mc });
      const r = c ? recuperaciones.comprobar(claveDeUsuario(c.usuario), typeof msg.codigo === 'string' ? msg.codigo.slice(0, 20) : '', ahora) : { ok: false, motivo: 'El código no es correcto.' };
      if (r.ok && claveDeCorreo(r.correo) !== claveDeCorreo(c.correo || '')) r.ok = false, r.motivo = 'El correo ha cambiado; pide otro código.';
      if (!r.ok) {
        cuentas.fallosOrigen.sumar(o, ahora);
        seguridad({ que, ok: false, ...(c ? { usuario: c.usuario } : {}), autor, origen, motivo: r.motivo });
        return responder({ ok: false, motivo: c ? r.motivo : 'El código no es correcto.' });
      }
    } else {
      c = cuentas.deAutor(autor);
      if (!c) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
      const mc = motivoClave(msg.clave, c.usuario);
      if (mc) return responder({ ok: false, motivo: mc });
    }
    ws.cuentaEnCurso = true;
    (que === 'cambiar_clave' ? cuentas.comprobarClave(autor, msg.actual, origen, ahora) : Promise.resolve({ ok: true }))
      .then(async (v) => {
        if (!v.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: v.motivo, ...(v.bloqueado ? { bloqueado: true } : {}) }); return responder({ ok: false, motivo: v.motivo }); }
        const r = await cuentas.cambiarClave(c.usuario, msg.clave, ahora);
        if (!r.ok) return responder({ ok: false, motivo: r.motivo });
        appendFileSync(archivoCuentas, JSON.stringify(r.linea) + '\n');
        // fuera la sesión en todos los aparatos de ese personaje; este sigue con una ficha nueva
        const n = cerrarSesiones(c.autor, ws);
        const ficha = fichaPara(c.autor);
        seguridad({ que, ok: true, usuario: c.usuario, autor, origen, fichas: n });
        registrar(`contraseña cambiada de «${c.usuario}» (${que}; ${n} fichas fuera)`);
        if (c.verificado && typeof c.correo === 'string') avisarCorreo(c.correo, c.usuario, 'aviso_clave', idioma);
        responder({ ok: true, usuario: c.usuario, autor: c.autor, ficha });
      })
      .catch((e) => { registrar(`error al cambiar la contraseña: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
      .finally(() => { ws.cuentaEnCurso = false; });
    return;
  }
  // cambiar el correo desde el menú (con el de ahora confirmado): pide la contraseña y manda el código al nuevo
  if (que === 'cambiar_correo') {
    const c = cuentas.deAutor(autor);
    if (!c) return responder({ ok: false, motivo: 'Este personaje no tiene cuenta.' });
    if (!c.verificado) return responder({ ok: false, motivo: 'Confirma primero el correo de tu cuenta.' });
    const nuevo = typeof msg.correo === 'string' ? msg.correo.trim().normalize('NFC') : null;
    const m = cuentas.motivoCorreoNuevo(autor, nuevo);
    if (m) return responder({ ok: false, motivo: m });
    const ahora = Date.now(), k = claveDeUsuario(c.usuario);
    ws.cuentaEnCurso = true;
    cuentas.comprobarClave(autor, msg.actual, origen, ahora)
      .then(async (v) => {
        if (!v.ok) { seguridad({ que, ok: false, usuario: c.usuario, autor, origen, motivo: v.motivo }); return responder({ ok: false, motivo: v.motivo }); }
        const r = verificaciones.pedir(k, nuevo, ahora);
        if (!r.ok) return responder({ ok: false, motivo: r.motivo });
        const e = await cartero.enviar({ para: nuevo, usuario: c.usuario, codigo: r.codigo, idioma });
        seguridad({ que: 'codigo', ok: !!e.ok, usuario: c.usuario, autor, origen, correo: enmascarar(nuevo), para: 'cambiar_correo' });
        if (!e.ok) { verificaciones.olvidar(k); return responder({ ok: false, motivo: e.motivo }); }
        responder({ ok: true, pendiente: enmascarar(nuevo) });
      })
      .catch((e) => { registrar(`error al cambiar el correo: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
      .finally(() => { ws.cuentaEnCurso = false; });
    return;
  }
  const p = validarPeticionCuenta(msg);
  if (p.motivo) { seguridad({ que: que === 'crear' ? 'alta' : 'entrar', ok: false, autor, origen, motivo: p.motivo }); return responder({ ok: false, motivo: p.motivo }); }
  ws.cuentaEnCurso = true;
  const ahora = Date.now();
  (p.que === 'crear' ? cuentas.crear({ usuario: p.usuario, clave: p.clave, correo: p.correo, autor, origen, ahora }) : cuentas.entrar({ usuario: p.usuario, clave: p.clave, origen, ahora }))
    .then((r) => {
      if (p.que === 'crear' && r.ok) {
        appendFileSync(archivoCuentas, JSON.stringify(r.cuenta) + '\n');
        registrar(`cuenta nueva «${r.cuenta.usuario}» para ${autor} (desde ${origen})`);
        seguridad({ que: 'alta', ok: true, usuario: r.cuenta.usuario, autor, origen, correo: enmascarar(r.cuenta.correo) });
        // y el código para confirmar el correo (si no sale, se pide otro desde la pantalla)
        return mandarCodigo(autor, origen, idioma).then((m) =>
          responder({ ok: true, usuario: r.cuenta.usuario, autor, admin: esAdmin(autor), correo: estadoCorreo(autor), ...(m.ok ? {} : { aviso: m.motivo }) }));
      }
      if (p.que === 'entrar' && r.ok) {
        registrar(`entra con la cuenta «${r.usuario}» → ${r.autor} (desde ${origen})`);
        seguridad({ que: 'entrar', ok: true, usuario: r.usuario, autor: r.autor, origen });
        return responder({ ok: true, usuario: r.usuario, autor: r.autor, ficha: fichaPara(r.autor) });
      }
      registrar(`cuenta: ${p.que} «${p.usuario}» rechazado (${r.motivo}) desde ${origen}`);
      seguridad({ que: p.que === 'crear' ? 'alta' : 'entrar', ok: false, usuario: p.usuario, autor, origen, motivo: r.motivo, ...(r.bloqueado ? { bloqueado: true } : {}) });
      responder({ ok: false, motivo: r.motivo });
    })
    .catch((e) => { registrar(`error con la cuenta: ${e && e.message}`); responder({ ok: false, motivo: 'Error del servidor.' }); })
    .finally(() => { ws.cuentaEnCurso = false; });
}
