// Mide los modelos de muro: todos deben llegar exactamente a la altura de planta,
// y los huecos de puerta y ventana deben quedar limpios.
import * as THREE from 'three';
import { modeloPieza, rellenoTejado, mojon, decoracion, P } from '../src/juego/modelos.js';
import { PIEZAS, DECORACION, ALTURA, MODULO } from '../src/logica/piezas.js';

let ok = 0, mal = 0;
// MUTAR=1 mete un tablón en el hueco de la puerta: la prueba de huecos tiene que fallar
if (process.env.MUTAR) P.anchoPuerta = 0.6;
const comprobar = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? 'OK  ' : 'FALLA'} ${n}${d ? ' — ' + d : ''}`); };
const caja = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const r3 = (x) => x.toFixed(3);

const muros = Object.entries(PIEZAS).filter(([, d]) => d.cat === 'muro');
console.log('Altura de cada muro');
for (const [tipo, def] of muros) {
  const b = caja(modeloPieza(tipo));
  const objetivo = def.medio ? ALTURA / 2 : ALTURA;
  comprobar(`${def.nombre}: arriba a ${objetivo} m`, Math.abs(b.max.y - objetivo) < 0.005, `arriba=${r3(b.max.y)} abajo=${r3(b.min.y)}`);
  comprobar(`${def.nombre}: abajo a 0 m`, Math.abs(b.min.y) < 0.005);
}

console.log('Huecos limpios');
// triángulos que se meten en el hueco (las piezas del estilo v5 van juntas en una malla por textura: se mira cada triángulo)
function hueco(tipo, x0, x1, y0, y1) {
  const g = modeloPieza(tipo); g.updateMatrixWorld(true);
  const dentro = [], v = new THREE.Vector3();
  g.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const b = new THREE.Box3();
      for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(p, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld));
      if (b.max.x > x0 + 0.02 && b.min.x < x1 - 0.02 && b.max.y > y0 + 0.02 && b.min.y < y1 - 0.02) dentro.push(`${o.name} ${r3(b.min.x)},${r3(b.min.y)}..${r3(b.max.x)},${r3(b.max.y)}`);
    }
  });
  return dentro.slice(0, 4);
}
const a = P.anchoPuerta / 2;
for (const t of ['muro_tronco_puerta', 'muro_tabla_puerta']) {
  const d = hueco(t, -a, a, 0, P.altoPuerta);
  comprobar(`${PIEZAS[t].nombre}: hueco de puerta libre hasta ${P.altoPuerta} m`, d.length === 0, d.join(' '));
}
const v = P.anchoVentana / 2;
const dv = hueco('muro_tronco_ventana', -v, v, P.bajoVentana + 0.05, P.altoVentana);
comprobar(`Muro con ventana: hueco libre de ${P.bajoVentana} a ${P.altoVentana} m`, dv.length === 0, dv.join(' '));

console.log('Hiladas alineadas entre muros de troncos');
function alturasTroncos(tipo) { return new Set(modeloPieza(tipo).userData.hiladas || []); }
const lisas = alturasTroncos('muro_tronco');
comprobar('Muro de troncos: diez hiladas', lisas.size === 10, [...lisas].join(' '));
for (const t of ['muro_tronco_puerta', 'muro_tronco_ventana']) {
  const otras = [...alturasTroncos(t)];
  comprobar(`${PIEZAS[t].nombre}: cada tronco a la misma altura que en el muro liso`, otras.every(y => lisas.has(y)), otras.filter(y => !lisas.has(y)).join(' '));
}

console.log('Cimientos, suelos y escaleras con el estilo v5');
// la superficie que se pisa queda donde dice la lógica y nada sale de la casilla más de 5 cm
const esperado = { cim_piedra: P.superficieCimiento, cim_tronco: P.superficieCimiento, suelo_tronco: P.superficieSuelo, suelo_tabla: P.superficieSuelo };
// MUTAR_SUELO=1 sube las piezas 5 cm: la prueba tiene que fallar
if (process.env.MUTAR_SUELO) { P.superficieCimiento += 0.05; P.superficieSuelo += 0.05; }
for (const [tipo, sup] of Object.entries(esperado)) {
  const b = caja(modeloPieza(tipo));
  comprobar(`${PIEZAS[tipo].nombre}: se pisa a ${sup} m`, Math.abs(b.max.y - sup) < 0.01, `arriba=${r3(b.max.y)}`);
  const sale = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) - 1;
  comprobar(`${PIEZAS[tipo].nombre}: no sale de la casilla`, sale < 0.05, `sale ${r3(sale)} m`);
}
for (const tipo of [...Object.keys(esperado), 'escalera_mano', 'escalera_tabla', 'andamio', 'polea']) {
  const nombres = []; modeloPieza(tipo).traverse(o => { if (o.isMesh) nombres.push(o.name); });
  comprobar(`${PIEZAS[tipo].nombre}: hecha con el estilo v5 (mallas por textura)`, nombres.length > 0 && nombres.every(n => n.startsWith('estilo_')), nombres.join(' '));
}

// el andamio: su plataforma se pisa a la altura del suelo de la planta de encima (donde la lógica pone al jugador);
// por dentro (lejos de la barandilla y de los pies), lo más alto es la plataforma
{
  let arriba = -1;
  modeloPieza('andamio').traverse(o => {
    if (!o.isMesh) return; const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getZ(i)) < 0.6) arriba = Math.max(arriba, pos.getY(i));
  });
  const esperadoA = ALTURA + P.superficieSuelo + (process.env.MUTAR_SUELO ? -0.05 : 0);
  comprobar('Andamio: la plataforma se pisa a la altura del suelo de la planta de encima', Math.abs(arriba - esperadoA) < 0.015, `arriba=${r3(arriba)} (suelo ${r3(esperadoA)})`);
}

console.log('Tejados y rellenos bajo el tejado con el estilo v5');
{
  // MUTAR_TEJADO=1 hace que los tramos de paja monten sobre el de al lado: vuelve el surco y la prueba tiene que fallar
  if (process.env.MUTAR_TEJADO) P.juntaPaja = 0.03;
  const S = MODULO, sub = P.subidaTejado;
  for (const tipo of ['tejado_paja', 'tejado_tablilla']) {
    const nombres = []; modeloPieza(tipo).traverse(o => { if (o.isMesh) nombres.push(o.name); });
    comprobar(`${PIEZAS[tipo].nombre}: hecho con el estilo v5 (mallas por textura)`, nombres.length > 0 && nombres.every(n => n.startsWith('estilo_')), nombres.join(' '));
    // el tejado se apoya en lo alto de los muros: por dentro de la casilla, nada queda por debajo del plano del tejado
    let bajo = 0;
    modeloPieza(tipo).traverse(o => {
      if (!o.isMesh) return; const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (Math.abs(x) < S / 2 - 0.05 && z > -S / 2 + 0.05 && z < S / 2 - 0.05) bajo = Math.max(bajo, (z + S / 2) / S * sub - y);
      }
    });
    comprobar(`${PIEZAS[tipo].nombre}: nada asoma por debajo del plano del tejado dentro de la casilla`, bajo < 0.01, `asoma ${r3(bajo)} m`);
  }
  // paja: un tramo con vecinos a los dos lados acaba justo en la casilla (lados planos que se tocan: sin surco ni solape)
  const medio = caja(modeloPieza('tejado_paja', { extremos: [], cumbrera: false, par: 0 }));
  comprobar('Tejado de paja: entre tramos vecinos, lados planos que se tocan', Math.abs(medio.min.x + S / 2) < 0.005 && Math.abs(medio.max.x - S / 2) < 0.005, `x de ${r3(medio.min.x)} a ${r3(medio.max.x)}`);
  const suelto = caja(modeloPieza('tejado_paja')), conCumbrera = caja(modeloPieza('tejado_paja', { extremos: [1, -1], cumbrera: true, par: 0 }));
  comprobar('Tejado de paja: vuela 20 cm por los lados sueltos', Math.abs(suelto.max.x - S / 2 - 0.2) < 0.005, `x hasta ${r3(suelto.max.x)}`);
  comprobar('Tejado de paja: la cumbrera redonda solo si se pide', conCumbrera.max.y > suelto.max.y + 0.1, `${r3(suelto.max.y)} → ${r3(conCumbrera.max.y)}`);
  // rellenos: cierran del muro al tejado y no lo atraviesan
  for (const muro of ['muro_tronco', 'muro_tabla', 'muro_zarzo', 'muro_entramado']) {
    const r = rellenoTejado({ tipo: 'lado', lado: 1, muro, hBajo: 0, hAlto: 1 }, 0);
    const b = caja(r); let fuera = 0;
    r.traverse(o => { if (!o.isMesh) return; const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) fuera = Math.max(fuera, pos.getY(i) - ((pos.getZ(i) + S / 2) / S * sub + 0.03)); });
    const nombres = []; r.traverse(o => { if (o.isMesh) nombres.push(o.name); });
    comprobar(`relleno bajo el tejado (${PIEZAS[muro].nombre}): del muro al tejado, sin atravesarlo, con el estilo v5`,
      Math.abs(b.min.y) < 0.01 && b.max.y > sub - 0.06 && fuera < 0.005 && nombres.every(n => n.startsWith('estilo_')), `y de ${r3(b.min.y)} a ${r3(b.max.y)}, atraviesa ${r3(fuera)}`);
  }
}

console.log('Puertas, cercas, portillo, empalizada y mojón con el estilo v5');
{
  // MUTAR_PUERTA=1 ensancha la hoja de las puertas 20 cm: no cabe en el hueco y la prueba tiene que fallar
  const nombresDe = (o) => { const n = []; o.traverse(m => { if (m.isMesh) n.push(m.name); }); return n; };
  const conHoja = ['puerta_varas', 'puerta_tabla', 'cerca_portillo', 'empalizada_puerta'];
  for (const tipo of [...conHoja, 'cerca', 'empalizada']) {
    const o = modeloPieza(tipo), n = nombresDe(o);
    comprobar(`${PIEZAS[tipo].nombre}: hecha con el estilo v5 (mallas por textura)`, n.length > 0 && n.every(x => x.startsWith('estilo_')), n.join(' '));
    if (conHoja.includes(tipo)) {
      const h = o.getObjectByName('hoja');
      comprobar(`${PIEZAS[tipo].nombre}: la hoja que se abre va aparte`, !!h && nombresDe(h).length > 0);
    }
  }
  const nm = nombresDe(mojon());
  comprobar('Mojón: hecho con el estilo v5 (mallas por textura)', nm.length > 0 && nm.every(x => x.startsWith('estilo_')), nm.join(' '));
  // la hoja de la puerta cabe en el hueco del muro (entre las jambas) y por debajo del dintel, cerrada y abierta
  for (const tipo of ['puerta_varas', 'puerta_tabla']) {
    const o = modeloPieza(tipo);
    if (process.env.MUTAR_PUERTA) o.getObjectByName('hoja').scale.x = 1.2;
    const b = caja(o), a = P.anchoPuerta / 2;
    comprobar(`${PIEZAS[tipo].nombre}: cabe en el hueco del muro`, b.min.x >= -a - 0.005 && b.max.x <= a + 0.005 && b.min.y >= -0.005 && b.max.y <= P.altoPuerta, `x de ${r3(b.min.x)} a ${r3(b.max.x)}, y hasta ${r3(b.max.y)}`);
    o.getObjectByName('hoja').rotation.y = -Math.PI / 2;
    const bA = caja(o);
    comprobar(`${PIEZAS[tipo].nombre}: abierta, deja libre el hueco`, bA.max.x <= -a + 0.12, `llega a x=${r3(bA.max.x)}`);
  }
  // las cercas seguidas se juntan: las varas llegan al borde de la casilla sin pasarse
  const bc = caja(modeloPieza('cerca'));
  comprobar('Cerca de varas: las varas llegan al borde de la casilla', bc.min.x > -MODULO / 2 - 0.05 && bc.min.x < -MODULO / 2 + 0.01 && bc.max.x < MODULO / 2 + 0.05, `x de ${r3(bc.min.x)} a ${r3(bc.max.x)}`);
  const be = caja(modeloPieza('empalizada'));
  comprobar(`Empalizada: unos ${P.altoEmpalizada} m de alto con las puntas`, be.max.y > P.altoEmpalizada && be.max.y < P.altoEmpalizada + 0.6 && Math.abs(be.min.y) < 0.02, `y de ${r3(be.min.y)} a ${r3(be.max.y)}`);
}

console.log('Muebles con el estilo v5');
{
  // cada mueble: hecho con el estilo v5 (mallas por textura; la llama de la antorcha aparte), apoyado en el suelo y sin
  // ocupar más que su sitio (ancho en x, fondo en z), como antes de pasarlo al estilo
  const SITIO = { cama_paja: [1.1, 2.1], cama_madera: [1.2, 2.2], mesa: [1.5, 0.9], banco: [1.3, 0.4], taburete: [0.5, 0.5], arcon: [1.1, 0.65],
    barril: [0.7, 0.7], estanteria: [1.1, 0.45], candil: [0.5, 0.5], alfombra: [1.5, 1.5], estandarte: [0.9, 0.5] };
  comprobar('Todos los muebles del juego tienen su medida en la prueba', Object.keys(DECORACION).every(t => SITIO[t]), Object.keys(DECORACION).filter(t => !SITIO[t]).join(' '));
  for (const tipo of Object.keys(DECORACION)) {
    const o = decoracion(tipo);
    // MUTAR_MUEBLE=1 le añade a la mesa una caja de color plano (el aspecto inicial): la prueba tiene que fallar
    if (process.env.MUTAR_MUEBLE && tipo === 'mesa') o.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2)));
    const n = []; o.traverse(m => { if (m.isMesh) n.push(m.name); });
    const nombre = DECORACION[tipo].nombre;
    comprobar(`${nombre}: hecho con el estilo v5 (mallas por textura)`, n.some(x => x.startsWith('estilo_')) && n.every(x => x.startsWith('estilo_') || x === 'llama'), n.join(' '));
    const b = caja(o), [ax, az] = SITIO[tipo];
    comprobar(`${nombre}: apoyado en el suelo y dentro de su sitio`, Math.abs(b.min.y) < 0.02 && b.max.x - b.min.x <= ax && b.max.z - b.min.z <= az,
      `y desde ${r3(b.min.y)}, ${r3(b.max.x - b.min.x)} × ${r3(b.max.z - b.min.z)} m`);
  }
  const ll = []; decoracion('candil').traverse(m => { if (m.name === 'llama') ll.push(m); });
  comprobar('Antorcha de pie: la llama brilla y no da sombra', ll.length > 0 && ll.every(m => m.material.emissiveIntensity > 0 && !m.castShadow));
}

console.log('Armas, herramientas y objetos del duelo con el estilo v5');
{
  const { modeloArma, modeloEscudo, modeloFlecha, modeloPiedra, modeloPoste, modeloDiana } = await import('../src/combate/modelos.js');
  const { modeloHacha } = await import('../src/juego/personaje.js');
  const lista = [['Espada larga', modeloArma('espada_larga')], ['Espada de una mano', modeloArma('espada_escudo')], ['Palo', modeloArma('palo')],
    ['Arco', modeloArma('arco')], ['Piedra en la mano', modeloArma('piedras')], ['Escudo', modeloEscudo()], ['Flecha', modeloFlecha()],
    ['Piedra lanzada', modeloPiedra()], ['Poste de práctica', modeloPoste()], ['Diana', modeloDiana()], ['Hacha de talar', modeloHacha()]];
  // MUTAR_ARMA=1 le añade a la espada larga una caja de color plano (el aspecto inicial): la prueba tiene que fallar
  if (process.env.MUTAR_ARMA) lista[0][1].add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.01)));
  for (const [nombre, o] of lista) {
    const n = []; o.traverse(m => { if (m.isMesh) n.push(m.name); else if (m.isLine) n.push('linea:' + m.name); });
    comprobar(`${nombre}: hecho con el estilo v5 (mallas por textura)`, n.some(x => x.startsWith('estilo_')) && n.every(x => x.startsWith('estilo_') || x === 'linea:cuerda'), n.join(' '));
  }
  // la hoja llega a la punta que marca el arma (de ahí sale el rastro del golpe y el alcance que se ve)
  for (const [nombre, tipo] of [['Espada larga', 'espada_larga'], ['Espada de una mano', 'espada_escudo'], ['Palo', 'palo']]) {
    const o = modeloArma(tipo), b = caja(o), punta = o.getObjectByName('punta').position.y;
    comprobar(`${nombre}: llega hasta su punta (${punta} m) y no más`, Math.abs(b.max.y - punta) < 0.04, `hasta ${r3(b.max.y)} m`);
  }
  // las tablas (la malla con veta) llenan el círculo de lado a lado, dentro del canto de cuero
  const tablas = new THREE.Box3().setFromBufferAttribute(modeloEscudo().getObjectByName('estilo_veta').geometry.attributes.position);
  const at = tablas.max.x - tablas.min.x, ht = tablas.max.y - tablas.min.y;
  comprobar('Escudo: las tablas llenan el círculo de 0,64 m de lado a lado', Math.abs(at - 0.636) < 0.012 && Math.abs(ht - 0.636) < 0.012, `${r3(at)} × ${r3(ht)} m`);
  const bh = caja(modeloHacha());
  comprobar('Hacha de talar: unos 75 cm de largo, con la cabeza arriba y el filo hacia +z', bh.max.y - bh.min.y > 0.7 && bh.max.y - bh.min.y < 0.85 && bh.max.z > 0.14, `${r3(bh.max.y - bh.min.y)} m, filo a ${r3(bh.max.z)} m`);
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
