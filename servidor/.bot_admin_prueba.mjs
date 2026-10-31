import { WebSocket } from 'ws';
const ws = new WebSocket('ws://127.0.0.1:38861');
ws.on('open', () => setInterval(() => ws.send(JSON.stringify({ tipo: 'estado', x: 30.0, y: 3, z: 25.0, giro: 0.4, anim: 'quieto' })), 200));
ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') console.log(m.autor); });