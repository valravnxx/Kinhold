// Perfiles gráficos (src/posprocesado/perfiles.js). Ejecutar: node pruebas/prueba_perfiles_graficos.mjs
// Comprueba: seis perfiles de móvil básico a PC alto, cada uno con al menos lo del anterior de su familia; nada que
// importe para jugar cambia entre perfiles (la niebla es la misma y el desenfoque nunca está puesto de inicio); la
// gradación de color es suave (no cambia ningún color más de lo que se pide) y deja el gris medio casi igual; el perfil
// de inicio sale razonable para aparatos conocidos; la medida elige el más alto que llega a su objetivo.
// Con MUTAR=1 el móvil básico lleva la niebla más cerca (escondería lo lejano en un perfil): debe FALLAR.
import { PERFILES, COMUN, efectosDe, gradar, GRADACION, rellenarTabla, sugerirPerfil, elegirPorMedida } from '../src/posprocesado/perfiles.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const MUTAR = process.env.MUTAR === '1';
const nieblaDe = (p) => (MUTAR && p.id === 'movil-1' ? [30, 80] : COMUN.niebla);

console.log('Los seis perfiles');
comprobar('son seis, de móvil básico a PC alto', PERFILES.length === 6 && PERFILES[0].id === 'movil-1' && PERFILES[5].id === 'pc-3', PERFILES.map(p => p.id).join(' '));
const AO = [null, 'Performance', 'Low', 'Medium', 'High', 'Ultra'], SUAV = ['ninguno', 'smaa-bajo', 'smaa-medio', 'smaa-alto', 'msaa-4', 'msaa-8'];
for (const fam of ['movil', 'pc']) {
  const l = PERFILES.filter(p => p.id.startsWith(fam));
  let crece = true;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    if (b.res < a.res || b.sombras < a.sombras || AO.indexOf(b.ao) < AO.indexOf(a.ao) || (b.brillo || 0) < (a.brillo || 0) || (b.rayos || 0) < (a.rayos || 0) || SUAV.indexOf(b.suavizado) < SUAV.indexOf(a.suavizado)) crece = false;
  }
  comprobar(`en ${fam === 'movil' ? 'móvil' : 'PC'}, cada perfil lleva al menos lo del anterior`, crece);
}
comprobar('objetivos del GDD: 30 fps en móvil, 60 en PC', PERFILES.every(p => p.objetivo === (p.id.startsWith('movil') ? 30 : 60)));

console.log('Nada que importe para jugar cambia entre perfiles (GDD, apartado 3)');
comprobar('la niebla (lo lejos que se ve) es la misma en los seis', PERFILES.every(p => JSON.stringify(nieblaDe(p)) === JSON.stringify(COMUN.niebla)), PERFILES.map(p => nieblaDe(p).join('–')).join(' '));
comprobar('el desenfoque nunca está puesto de inicio (solo en escenas concretas)', PERFILES.every(p => efectosDe(p).desenfoque === false));
comprobar('el mapeo tonal y la gradación de color van en todos (la identidad del mundo)', PERFILES.every(p => efectosDe(p).tono && efectosDe(p).color));

console.log('Gradación de color');
let max = 0;
for (let r = 0; r <= 1; r += 0.1) for (let g = 0; g <= 1; g += 0.1) for (let b = 0; b <= 1; b += 0.1) {
  const [R, G, B] = gradar(r, g, b); max = Math.max(max, Math.abs(R - r), Math.abs(G - g), Math.abs(B - b));
}
comprobar('es suave: ningún canal cambia más de 0,2 (lo que más, los colores puros, que no salen en la paleta)', max <= 0.2, max.toFixed(3));
const gris = gradar(0.5, 0.5, 0.5);
comprobar('el gris medio queda casi igual', gris.every(v => Math.abs(v - 0.5) < 0.01), gris.map(v => v.toFixed(3)).join(' '));
const [sr, , sb] = gradar(0.15, 0.15, 0.15), [lr, , lb] = gradar(0.85, 0.85, 0.85);
comprobar('sombras algo frías y luces algo cálidas', sb > sr && lr > lb, `sombra r${sr.toFixed(3)} b${sb.toFixed(3)} · luz r${lr.toFixed(3)} b${lb.toFixed(3)}`);
// (12 nov, el aspecto de maqueta: más viva y contrastada que la v5; los verdes, un punto menos que el resto)
const verde = gradar(0.25, 0.55, 0.2), rojo = gradar(0.55, 0.25, 0.2);
comprobar('los colores ganan fuerza, y los verdes menos que los rojos (la hierba no chilla)', rojo[0] - rojo[2] > 0.35 && verde[1] - verde[2] > 0.35 * 0.98 && verde[1] - verde[2] <= rojo[0] - rojo[2] + 1e-9 && GRADACION.satVerdes < GRADACION.sat, `verde ${(verde[1] - verde[2]).toFixed(3)} · rojo ${(rojo[0] - rojo[2]).toFixed(3)}`);
const oscuro = gradar(0.25, 0.25, 0.25), clarito = gradar(0.75, 0.75, 0.75);
comprobar('más contraste: lo oscuro baja y lo claro sube', oscuro[1] < 0.24 && clarito[1] > 0.76, `${oscuro[1].toFixed(3)} y ${clarito[1].toFixed(3)}`);
const t = new Float32Array(4 * 8); for (let i = 0; i < 8; i++) t.set([i / 7, i / 7, i / 7, 1], i * 4);
rellenarTabla(t, 2);
comprobar('la tabla se rellena con la gradación y no toca el canal alfa', t[3] === 1 && Math.abs(t[0] - gradar(0, 0, 0)[0]) < 1e-6);

console.log('Hierba densa');
{
  const { cuantaHierba } = await import('../src/mundo/hierba_densa.js');
  comprobar('el móvil básico no la lleva; los demás, cada uno igual o más lejos que el anterior de su familia', !PERFILES[0].hierba && ['movil', 'pc'].every(f => PERFILES.filter(p => p.id.startsWith(f) && p.hierba).every((p, i, l) => !i || (p.hierba.radio >= l[i - 1].hierba.radio && p.hierba.densidad >= l[i - 1].hierba.densidad))),
    PERFILES.map(p => p.id + ' ' + JSON.stringify(p.hierba)).join(' · '));
  const tri = (p) => Math.PI * p.hierba.radio ** 2 * p.hierba.densidad * 12;
  comprobar('en el móvil, menos de 120 mil triángulos de hierba; en PC, menos de 700 mil', PERFILES.filter(p => p.hierba).every(p => tri(p) < (p.id.startsWith('movil') ? 120e3 : 700e3)), PERFILES.filter(p => p.hierba).map(p => p.id + ' ' + Math.round(tri(p) / 1000) + ' mil').join(' · '));
  comprobar('hay hierba donde el suelo es verde y no donde es tierra, roca, arena o nieve', cuantaHierba(0.2, 0.3, 0.08) === 1 && cuantaHierba(0.25, 0.2, 0.12) === 0 && cuantaHierba(0.3, 0.28, 0.25) === 0 && cuantaHierba(0.5, 0.45, 0.3) === 0 && cuantaHierba(0.8, 0.8, 0.82) === 0);
}

console.log('Desenfoque de maqueta');
{
  const { emborronado, MAQUETA } = await import('../src/posprocesado/maqueta.js');
  comprobar('la franja del centro queda nítida del todo (donde está el personaje)', [0.3, 0.4, 0.46, 0.55, 0.64].every(y => emborronado(y) === 0));
  comprobar('hacia arriba y hacia abajo se emborrona cada vez más', emborronado(0.98) > emborronado(0.85) && emborronado(0.85) > 0 && emborronado(0.75) === 0 && emborronado(0.02) > emborronado(0.15) && emborronado(0.15) > 0);
  comprobar('el emborronado es corto: como mucho un 1,5 % del alto de la pantalla', MAQUETA.fuerza <= 0.015 && MAQUETA.fuerza > 0);
  comprobar('el móvil básico no lo lleva y los demás sí', !PERFILES.find(p => p.id === 'movil-1').desenfoque && PERFILES.filter(p => p.id !== 'movil-1').every(p => p.desenfoque));
}

console.log('Perfil de inicio (antes de medir)');
const casos = [
  [{ tactil: true, memoria: 2, nucleos: 4, grafica: 'Mali-G52' }, 'movil-1', 'móvil barato'],
  [{ tactil: true, memoria: 6, nucleos: 8, grafica: 'Adreno (TM) 642L' }, 'movil-2', 'móvil medio'],
  [{ tactil: true, memoria: 8, nucleos: 8, grafica: 'Adreno (TM) 740' }, 'movil-3', 'móvil alto'],
  [{ tactil: true, memoria: 8, nucleos: 8, grafica: 'Apple GPU' }, 'movil-3', 'iPhone o iPad'],
  [{ tactil: false, grafica: 'ANGLE (Intel, Intel(R) UHD Graphics 620)' }, 'pc-1', 'portátil con gráfica integrada'],
  [{ tactil: false, grafica: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060)' }, 'pc-2', 'PC con gráfica de hace años'],
  [{ tactil: false, grafica: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)' }, 'pc-3', 'PC con gráfica buena'],
  [{ tactil: false, grafica: 'Google SwiftShader' }, 'movil-1', 'sin tarjeta gráfica (las pruebas): lo más barato'],
  [{ tactil: true, memoria: 12, nucleos: 8, grafica: 'Adreno (TM) 825' }, 'movil-3', 'POCO F7 (Adreno 825; Chrome dice como mucho 8 GB)'],
];
for (const [info, esperado, que] of casos) comprobar(`${que} → ${esperado}`, sugerirPerfil(info) === esperado, sugerirPerfil(info));

console.log('Por la medida');
comprobar('PC que hace 60 en el medio pero no en el alto → PC medio', elegirPorMedida({ 'movil-1': 3, 'movil-2': 5, 'movil-3': 7, 'pc-1': 9, 'pc-2': 14, 'pc-3': 22 }) === 'pc-2');
comprobar('móvil que hace 38 fps en el medio (30 con margen) pero no en el alto → móvil medio', elegirPorMedida({ 'movil-1': 18, 'movil-2': 26, 'movil-3': 45, 'pc-1': 50, 'pc-2': 80, 'pc-3': 120 }, true) === 'movil-2');
comprobar('un móvil muy rápido no pasa a los de PC', elegirPorMedida({ 'movil-1': 2, 'movil-2': 3, 'movil-3': 4, 'pc-1': 5, 'pc-2': 6, 'pc-3': 7 }, true) === 'movil-3');
comprobar('si no llega a ninguno, el más bajo', elegirPorMedida({ 'movil-1': 90, 'movil-2': 120 }, true) === 'movil-1');

// la naturaleza de Meshy (valravnx, 11 nov: «¿por qué has dejado el modelo hiperlowpoly en gráficos máximos?»): cada
// perfil lleva su detalle y, en cada familia, el de arriba llega igual o más lejos con el modelo de cerca y el de más detalle
const NAT = globalThis.process?.env?.MUTAR === 'naturaleza' ? PERFILES.map(p => ({ ...p, naturaleza: { cerca: 12, alto: 0 } })) : PERFILES;
for (const fam of ['movil', 'pc']) {
  const l = NAT.filter(p => p.id.startsWith(fam));
  comprobar(`naturaleza en ${fam === 'movil' ? 'móvil' : 'PC'}: cada perfil, igual o más detalle que el anterior, y el más alto más que el más bajo`,
    l.every(p => p.naturaleza && p.naturaleza.cerca > 0) && l.every((p, i) => !i || (p.naturaleza.cerca >= l[i - 1].naturaleza.cerca && p.naturaleza.alto >= l[i - 1].naturaleza.alto))
      && l.at(-1).naturaleza.cerca > l[0].naturaleza.cerca && l.at(-1).naturaleza.alto > l[0].naturaleza.alto, l.map(p => p.id + ' ' + JSON.stringify(p.naturaleza)).join(' · '));
}
comprobar('naturaleza: el PC alto lleva el modelo de cerca hasta 60 m y el de más detalle hasta 30', NAT[5].naturaleza.cerca >= 60 && NAT[5].naturaleza.alto >= 30);

console.log(`\n${ok} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
