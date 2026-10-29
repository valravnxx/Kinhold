// Mide los modelos de muro: todos deben llegar exactamente a la altura de planta,
// y los huecos de puerta y ventana deben quedar limpios.
import * as THREE from 'three';
import { modeloPieza, rellenoTejado, mojon, decoracion, P, colgarPolipasto, tornoSuelto, POLIPASTO } from '../src/juego/modelos.js';
import { PIEZAS, DECORACION, ALTURA, MODULO } from '../src/logica/piezas.js';
import { HOGAR } from '../src/logica/construccion.js';

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
for (const t of ['muro_tronco_ventana', 'muro_tabla_ventana']) {
  const dv = hueco(t, -v, v, P.bajoVentana + 0.05, P.altoVentana);
  comprobar(`${PIEZAS[t].nombre}: hueco libre de ${P.bajoVentana} a ${P.altoVentana} m`, dv.length === 0, dv.join(' '));
}

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
for (const tipo of [...Object.keys(esperado), 'escalera_mano', 'escalera_tabla', 'andamio', 'polea', 'polipasto']) {
  const nombres = []; modeloPieza(tipo).traverse(o => { if (o.isMesh) nombres.push(o.name); });
  comprobar(`${PIEZAS[tipo].nombre}: hecha con el estilo v5 (mallas por textura)`, nombres.length > 0 && nombres.every(n => n.startsWith('estilo_')), nombres.join(' '));
}

// el polipasto: el motón de abajo baja con colgarPolipasto() hasta la carga (y los ramales se estiran con él); el
// torno está hecho con el estilo v5 y su tambor gira aparte
{
  const g = modeloPieza('polipasto');
  const bajo = g.getObjectByName('moton_bajo'), ramales = g.getObjectByName('ramales');
  const y0 = bajo.position.y, l0 = ramales.scale.y;
  colgarPolipasto(g, -3, 0.2);
  comprobar('polipasto: el motón de abajo baja hasta la carga y los ramales se alargan con él', bajo.position.y === -3 && ramales.scale.y > l0 + 2.5, `de ${r3(y0)} a ${r3(bajo.position.y)}; ramales ${r3(l0)} → ${r3(ramales.scale.y)}`);
  comprobar('polipasto: recogido, cuelga bajo la viga sin llegar al suelo de su planta', y0 > 1 && y0 < POLIPASTO.yEje, `${r3(y0)} m`);
  const t = tornoSuelto(); const nt = []; t.traverse(o => { if (o.isMesh) nt.push(o.name); });
  comprobar('torno: hecho con el estilo v5 y con su tambor aparte', nt.length > 0 && nt.every(n => n.startsWith('estilo_')) && !!t.getObjectByName('tambor'), nt.join(' '));
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
  for (const tipo of ['tejado_paja', 'tejado_tablilla', 'tejado_teja']) {
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
  // teja: el dibujo de canales y cobijas sigue de un tramo al de al lado sin que dos tejas caigan en el mismo sitio
  {
    const tri = (o) => { let n = 0; o.traverse(m => { if (m.isMesh) n += m.geometry.attributes.position.count / 3; }); return n; };
    const medioT = caja(modeloPieza('tejado_teja', { extremos: [], cumbrera: false, par: 0 }));
    // sin lados sueltos pone la cobija de su lado izquierdo (la del derecho la pone el vecino): asoma por la izquierda
    // lo que mide media cobija y por la derecha, nada fuera de la junta
    comprobar('Tejado de teja: entre tramos vecinos, cada uno pone la cobija de su izquierda y no la de la derecha',
      Math.abs(medioT.min.x + S / 2 + 0.07) < 0.01 && medioT.max.x <= S / 2 + 0.031, `x de ${r3(medioT.min.x)} a ${r3(medioT.max.x)}`);
    const sueltoT = caja(modeloPieza('tejado_teja')), cumbT = caja(modeloPieza('tejado_teja', { extremos: [1, -1], cumbrera: true, par: 0 }));
    comprobar('Tejado de teja: vuela por los lados sueltos, con tabla de remate', sueltoT.max.x > S / 2 + 0.2 && sueltoT.min.x < -S / 2 - 0.2, `x de ${r3(sueltoT.min.x)} a ${r3(sueltoT.max.x)}`);
    comprobar('Tejado de teja: el caballete de la cumbrera solo si se pide', cumbT.max.y > sueltoT.max.y + 0.08, `${r3(sueltoT.max.y)} → ${r3(cumbT.max.y)}`);
    const tp = tri(modeloPieza('tejado_paja')), tt = tri(modeloPieza('tejado_teja'));
    comprobar('Tejado de teja: ligero para el móvil (como mucho 2,5 veces los triángulos de la paja)', tt <= tp * 2.5 * (process.env.MUTAR_TEJA ? 0.5 : 1), `${Math.round(tp)} → ${Math.round(tt)} triángulos`);
  }
  // remates (esquinas): las dos mitades cortadas por la diagonal siguen la forma que les toca (limatesa: el menor de los
  // dos planos; limahoya: el mayor), nada asoma por debajo y no pesan más que un tramo en el móvil
  {
    const tri = (o) => { let n = 0; o.traverse(m => { if (m.isMesh) n += m.geometry.attributes.position.count / 3; }); return n; };
    for (const [tipo, tramo] of [['remate_paja', 'tejado_paja'], ['remate_tablilla', 'tejado_tablilla'], ['remate_teja', 'tejado_teja']]) {
      for (const forma of ['tesa', 'hoya']) {
        const g = modeloPieza(tipo, { forma, par: 0 });
        const plano = (x, z) => { const a = (z + S / 2) / S * sub, b = (x + S / 2) / S * sub; return forma === 'tesa' ? Math.min(a, b) : Math.max(a, b); };
        let bajo = 0, sobra = 0;
        g.traverse(o => {
          if (!o.isMesh) return; const pos = o.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            if (Math.abs(x) > S / 2 - 0.05 || Math.abs(z) > S / 2 - 0.05) continue;
            bajo = Math.max(bajo, plano(x, z) - y);
            // lejos de la diagonal (donde va la limatesa o la limahoya), el tejado no se aparta de su plano más que su grueso
            if (Math.abs(x - z) > 0.6) sobra = Math.max(sobra, y - plano(x, z));
          }
        });
        comprobar(`${PIEZAS[tipo].nombre} (${forma}): nada asoma por debajo de su forma`, bajo < 0.01, `asoma ${r3(bajo)} m`);
        comprobar(`${PIEZAS[tipo].nombre} (${forma}): cada mitad se queda en su lado de la diagonal`, sobra < 0.5, `sobresale ${r3(sobra)} m`);
      }
      const tr = tri(modeloPieza(tipo, { forma: 'tesa', par: 0 })), tt = tri(modeloPieza(tramo));
      comprobar(`${PIEZAS[tipo].nombre}: ligero para el móvil (como mucho el doble que su tramo: tiene dos aleros)`, tr <= tt * 2, `${Math.round(tt)} → ${Math.round(tr)} triángulos`);
    }
  }
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

console.log('Contraventana y trampilla con el estilo v5');
{
  // MUTAR_CONTRAVENTANA=1 mete las hojas de la contraventana en el muro: la prueba tiene que fallar
  const nombresDe = (o) => { const n = []; o.traverse(m => { if (m.isMesh) n.push(m.name); }); return n; };
  const hojas = (o) => { const h = []; o.traverse(m => { if (m.name === 'hoja') h.push(m); }); return h; };
  const abrir = (o, si) => { for (const h of hojas(o)) h.rotation[h.userData.abre.eje] = si ? h.userData.abre.ang : 0; };
  // lo más salido del muro (z) entre y0 e y1 y entre x0 y x1, triángulo a triángulo
  const caraMuro = (tipo, x0, x1, y0, y1) => {
    const g = modeloPieza(tipo); g.updateMatrixWorld(true);
    let max = -Infinity; const w = new THREE.Vector3();
    g.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let n = 0; n < p.count; n++) { w.fromBufferAttribute(p, n).applyMatrix4(o.matrixWorld); if (w.x > x0 && w.x < x1 && w.y > y0 && w.y < y1) max = Math.max(max, w.z); }
    });
    return max;
  };
  for (const muro of ['muro_tronco_ventana', 'muro_tabla_ventana']) {
    const o = modeloPieza('contraventana', { muro }), n = nombresDe(o);
    if (process.env.MUTAR_CONTRAVENTANA) for (const h of hojas(o)) h.position.z = 0;
    comprobar(`Contraventana (${PIEZAS[muro].nombre}): con el estilo v5 y dos hojas que se abren`, n.length > 0 && n.every(x => x.startsWith('estilo_')) && hojas(o).length === 2 && hojas(o).every(h => h.userData.abre));
    const b = caja(o), a = P.anchoVentana / 2;
    comprobar(`Contraventana (${PIEZAS[muro].nombre}): cerrada tapa la ventana`, b.min.x <= -a && b.max.x >= a && b.min.y <= P.bajoVentana + 0.05 && b.max.y >= P.altoVentana, `x de ${r3(b.min.x)} a ${r3(b.max.x)}, y de ${r3(b.min.y)} a ${r3(b.max.y)}`);
    const cara = caraMuro(muro, b.min.x, b.max.x, b.min.y, b.max.y);
    comprobar(`Contraventana (${PIEZAS[muro].nombre}): cerrada queda por fuera del muro, sin meterse en él`, b.min.z >= cara - 0.005, `hoja desde z=${r3(b.min.z)}, muro hasta z=${r3(cara)}`);
    abrir(o, true);
    for (const h of hojas(o)) {
      const bh = new THREE.Box3().setFromObject(h);
      const caraH = caraMuro(muro, bh.min.x, bh.max.x, bh.min.y, bh.max.y);
      comprobar(`Contraventana (${PIEZAS[muro].nombre}): abierta, cada hoja deja libre la ventana y queda pegada al muro, por fuera`,
        (bh.max.x <= -a + 0.01 || bh.min.x >= a - 0.01) && bh.min.x > -MODULO / 2 - 0.15 && bh.max.x < MODULO / 2 + 0.15 && bh.min.z >= caraH - 0.005 && bh.max.z < caraH + 0.12,
        `x de ${r3(bh.min.x)} a ${r3(bh.max.x)}, z de ${r3(bh.min.z)} a ${r3(bh.max.z)} (muro hasta ${r3(caraH)})`);
    }
  }
  const of = modeloPieza('contraventana', { muro: 'muro_tronco_ventana', fuera: -1 });
  of.rotation.y = 0; // como hace la rejilla al ponerla en un muro a lo largo de x: el giro de dentro tiene que seguir
  const bf = caja(of);
  comprobar('Contraventana: va por el lado de fuera del muro (el que no da al suelo de la casa)', bf.max.z < -0.15 && bf.min.z < -0.15, `z de ${r3(bf.min.z)} a ${r3(bf.max.z)}`);
  const t = modeloPieza('trampilla'), nt = nombresDe(t);
  comprobar('Trampilla: con el estilo v5 y una hoja que se abre', nt.length > 0 && nt.every(x => x.startsWith('estilo_')) && hojas(t).length === 1);
  const bt = caja(t);
  comprobar('Trampilla: cerrada, a ras del suelo y tapando el hueco de la casilla', Math.abs(bt.max.y - P.superficieSuelo) < 0.03 && bt.min.x <= -MODULO / 2 + 0.05 && bt.max.x >= MODULO / 2 - 0.05 && bt.min.z <= -MODULO / 2 + 0.05 && bt.max.z >= MODULO / 2 - 0.05 && bt.max.x <= MODULO / 2 + 0.02, `y hasta ${r3(bt.max.y)}, x de ${r3(bt.min.x)} a ${r3(bt.max.x)}, z de ${r3(bt.min.z)} a ${r3(bt.max.z)}`);
  abrir(t, true);
  const ba = caja(t);
  comprobar('Trampilla: abierta, de pie en el borde del arranque de la escalera (deja libre el hueco)', ba.max.y > 1.8 && ba.min.z > -MODULO / 2 - 0.1 && ba.max.z < -MODULO / 2 + 0.2, `y hasta ${r3(ba.max.y)}, z de ${r3(ba.min.z)} a ${r3(ba.max.z)}`);
}

console.log('Chimenea con el estilo v5');
{
  // MUTAR_CHIMENEA=1 deja el cañón a la altura de siempre (sin mirar el tejado): la prueba tiene que fallar
  const nombres = (o) => { const n = []; o.traverse(m => { if (m.isMesh) n.push(m.name); }); return n; };
  const H = HOGAR;
  for (const alto of [3.25, 6.15]) {
    const o = modeloPieza('hogar', { alto: process.env.MUTAR_CHIMENEA ? 3.25 : alto, encendido: false }), b = caja(o), n = nombres(o);
    comprobar(`Chimenea (cañón hasta ${alto} m): con el estilo v5, apagada, sin llamas ni humo`, n.length > 0 && n.every(x => x.startsWith('estilo_') || x === 'ceniza'), n.join(' '));
    comprobar(`Chimenea (cañón hasta ${alto} m): el cañón acaba donde dice la lógica`, Math.abs(b.max.y - alto) < 0.03, `arriba=${r3(b.max.y)}`);
    comprobar(`Chimenea (cañón hasta ${alto} m): dentro de lo que ocupa (pegada al muro de +z, dentro de su casilla)`, b.min.x >= -H.ancho / 2 - 0.05 && b.max.x <= H.ancho / 2 + 0.05 && b.min.z >= H.fondo0 - 0.05 && b.max.z <= H.fondo1 + 0.08 && b.min.y > -0.05,
      `x de ${r3(b.min.x)} a ${r3(b.max.x)}, z de ${r3(b.min.z)} a ${r3(b.max.z)}, y desde ${r3(b.min.y)}`);
  }
  // por encima de la campana, solo el cañón (más estrecho, pegado al muro)
  const o = modeloPieza('hogar', { alto: 6, encendido: true }); o.updateMatrixWorld(true);
  let fuera = 0; const w = new THREE.Vector3();
  o.traverse(m => {
    if (!m.isMesh || !m.name.startsWith('estilo_')) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { w.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (w.y > 2.5 && (Math.abs(w.x) > H.canonAncho / 2 + 0.1 || w.z < H.canon0 - 0.1)) fuera++; }
  });
  comprobar('Chimenea: por encima de la campana solo sube el cañón', fuera === 0, `${fuera} vértices fuera`);
  const n = nombres(o), llamas = n.filter(x => x === 'llama').length, humo = n.filter(x => x === 'humo').length;
  comprobar('Chimenea encendida: llamas, brasas y humo', llamas >= 4 && humo >= 5, `llamas=${llamas} humo=${humo}`);
  comprobar('Chimenea encendida: dice dónde alumbra el fuego (en el hogar) y de dónde sale el humo (la boca del cañón)', o.userData.fuego && o.userData.fuego.y < 1.2 && o.userData.humo && Math.abs(o.userData.humo.y - 6) < 0.01);
  let tri = 0; o.traverse(m => { if (m.isMesh) tri += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
  comprobar('Chimenea: menos de 10 000 triángulos con un cañón de 6 m (tiene que aguantar en el móvil)', tri < 10000, `${Math.round(tri)} triángulos`);
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

console.log('Suelos y cimientos de troncos seguidos (se juntan de una)');
{
  // triángulos de testa (la textura de anillos) cerca de un borde de la casilla
  const testas = (g, cond) => {
    g.updateMatrixWorld(true); let n = 0; const v = new THREE.Vector3();
    g.traverse(o => {
      if (!o.isMesh || o.name !== 'estilo_anillos') return;
      const p = o.geometry.attributes.position, idx = o.geometry.index, cnt = idx ? idx.count : p.count;
      for (let t = 0; t < cnt; t += 3) {
        const b = new THREE.Box3();
        for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(p, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld));
        if (cond(b)) n++;
      }
    });
    return n;
  };
  // rayos de arriba abajo a 5 mm del borde, a lo largo de los cuatro lados: ¿cuántos no chocan con nada (rendija)?
  const rendijas = (g) => {
    g.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), abajo = new THREE.Vector3(0, -1, 0), m = MODULO / 2 - 0.005; let n = 0;
    for (let t = -0.95; t <= 0.95; t += 0.05) for (const [x, z] of [[m, t], [-m, t], [t, m], [t, -m]]) {
      ray.set(new THREE.Vector3(x, 5, z), abajo);
      if (!ray.intersectObject(g, true).length) n++;
    }
    return n;
  };
  const todos = { xn: true, xp: true, zn: true, zp: true };
  const bordeX = (b) => b.max.x > MODULO / 2 - 0.04 || b.min.x < -MODULO / 2 + 0.04;
  for (const [tipo, nombre] of [['suelo_tronco', 'Suelo de troncos'], ['cim_tronco', 'Cimiento de troncos']]) {
    const solo = modeloPieza(tipo), junto = modeloPieza(tipo, { vecinos: todos });
    comprobar(`${nombre} solo: testas en los bordes`, testas(solo, bordeX) > 0);
    comprobar(`${nombre} entre vecinos iguales: sin testas en las juntas`, testas(junto, bordeX) === 0, `${testas(junto, bordeX)} triángulos de testa`);
    comprobar(`${nombre} entre vecinos: ninguna rendija en el borde (se ve madera, no hierba)`, rendijas(junto) === 0, `${rendijas(junto)} rayos sin madera`);
    comprobar(`${nombre} solo: hacia fuera conserva su margen (control de la prueba de rendijas)`, rendijas(solo) > 0, `${rendijas(solo)} rayos sin madera`);
    const unLado = modeloPieza(tipo, { vecinos: { xn: false, xp: true, zn: false, zp: false } });
    comprobar(`${nombre} con vecino a un lado: testas solo hacia fuera`, testas(unLado, b => b.max.x > MODULO / 2 - 0.04) === 0 && testas(unLado, b => b.min.x < -MODULO / 2 + 0.04) > 0);
  }
}

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
