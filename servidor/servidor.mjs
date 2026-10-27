// Servidor mínimo de la prueba online (hito 1f). Node + paquete ws.
//
// - Cada conexión recibe un autor que pone el servidor («jugador:…»). Lo que diga el cliente como
//   autor se ignora siempre: el servidor lo sobrescribe antes de ejecutar.
// - Las acciones de construcción pasan por la lógica pura (ejecutar, src/logica/acciones.js), igual que
//   en el navegador. Las que salen bien se reparten a todos los conectados.
// - Todas las acciones (bien o mal) se guardan en un archivo, una por línea (JSON), para poder auditarlas.
//   Al arrancar, el mundo se rehace con reproducir a partir de ese archivo.
//
// Mensajes (JSON):
//   cliente → servidor   { tipo: 'accion', id, accion: { tipo, ...datos } }
//   servidor → cliente   { tipo: 'bienvenida', autor, entradas }       al conectar: lo que ha salido bien hasta ahora
//                        { tipo: 'resultado', id, ok, motivo? }         respuesta al que la mandó
//                        { tipo: 'accion', entrada }                    a todos, cuando una acción sale bien
//                        { tipo: 'error', motivo }                      mensaje que no se entiende
//
// Uso: node servidor/servidor.mjs [puerto] [archivo]   (por defecto 8080 y servidor/mundo.jsonl)
import { WebSocketServer } from 'ws';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { RegistroAcciones, ejecutar, reproducir } from '../src/logica/acciones.js';

// Lee el archivo del mundo. Una línea cortada al final (el servidor se apagó a mitad) se descarta.
export function leerArchivo(archivo) {
  if (!existsSync(archivo)) return [];
  const entradas = [];
  for (const linea of readFileSync(archivo, 'utf8').split('\n')) {
    if (!linea.trim()) continue;
    try { entradas.push(JSON.parse(linea)); } catch (e) { console.warn('Línea del mundo no válida, se descarta:', linea.slice(0, 80)); }
  }
  return entradas;
}

export function crearServidor({ puerto = 8080, archivo = 'servidor/mundo.jsonl', registrar = () => {} } = {}) {
  archivo = resolve(archivo);
  mkdirSync(dirname(archivo), { recursive: true });
  const previas = leerArchivo(archivo);
  // si quedó una línea a medias, lo nuevo empieza en una línea aparte
  if (existsSync(archivo)) { const t = readFileSync(archivo, 'utf8'); if (t && !t.endsWith('\n')) appendFileSync(archivo, '\n'); }
  const mundo = reproducir(previas);
  const registro = new RegistroAcciones();
  registro.total = previas.reduce((m, e) => Math.max(m, e.n || 0), 0);
  const hechas = previas.filter(e => e.ok);   // lo que se manda a cada cliente nuevo

  const wss = new WebSocketServer({ port: puerto });
  const clientes = new Map();   // ws → autor

  const enviar = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

  wss.on('connection', (ws) => {
    const autor = 'jugador:' + randomUUID().slice(0, 8);
    clientes.set(ws, autor);
    registrar(`entra ${autor}`);
    enviar(ws, { tipo: 'bienvenida', autor, entradas: hechas });

    ws.on('message', (datos) => {
      let msg;
      try { msg = JSON.parse(datos.toString()); } catch (e) { return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' }); }
      if (!msg || msg.tipo !== 'accion' || !msg.accion || typeof msg.accion !== 'object' || Array.isArray(msg.accion))
        return enviar(ws, { tipo: 'error', motivo: 'Mensaje no válido.' });
      // el autor lo pone el servidor; el que traiga el cliente se pisa
      const accion = { ...msg.accion, autor };
      const r = ejecutar(mundo, registro, accion);
      const entrada = registro.entradas[registro.entradas.length - 1];
      registro.entradas.length = 0;   // lo guardado va al archivo; en memoria basta con «hechas»
      appendFileSync(archivo, JSON.stringify(entrada) + '\n');
      enviar(ws, { tipo: 'resultado', id: msg.id, ok: !!r.ok, ...(r.ok ? {} : { motivo: r.motivo }) });
      if (r.ok) {
        hechas.push(entrada);
        for (const otro of clientes.keys()) enviar(otro, { tipo: 'accion', entrada });
      }
    });
    ws.on('close', () => { clientes.delete(ws); registrar(`sale ${autor}`); });
  });

  return {
    wss, mundo, archivo,
    listo: new Promise(r => wss.on('listening', () => r(wss.address().port))),
    cerrar: () => new Promise(r => { for (const ws of clientes.keys()) ws.terminate(); wss.close(() => r()); }),
  };
}

// Arranque desde la línea de órdenes
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.argv[2]) || 8080;
  const archivo = process.argv[3] || 'servidor/mundo.jsonl';
  const s = crearServidor({ puerto, archivo, registrar: t => console.log(new Date().toISOString(), t) });
  s.listo.then(p => console.log(`Servidor de Kinhold en el puerto ${p} · mundo en ${s.archivo} · ${s.mundo.construcciones.length} construcciones`));
}
