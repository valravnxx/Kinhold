import { WebSocketServer } from 'ws';
const w = new WebSocketServer({ port: 18099 });
w.on('connection', (ws) => ws.send(JSON.stringify({ tipo: 'bienvenida', autor: 'jugador:viejo', entradas: [] })));
console.log('listo');
