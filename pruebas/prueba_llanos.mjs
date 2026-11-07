// Sin llanos pelados a ras del mar tierra adentro (valravnx, 7 nov: «hay tramos que no aparece vegetacion ni nada en la
// estepa, y con freecam coincide con que a momentos aparece un manto azul sobre ese mismo sitio… es una pradera que
// deberia tener todo como el resto»). Antes, lo que quedaba por debajo del mar se ponía a 0,4 m justos y salían llanos
// de kilómetros completamente planos, sin hierba ni árboles (piden 1 y 1,5 m sobre el mar) y que de lejos perdían contra
// el mar de lejos. Comprueba, en toda Whitholm cada 400 m, que tierra adentro (lejos de la costa y del río) casi nada
// queda por debajo de 1 m; que en tres de aquellos llanos ahora hay relieve, hierba y matas; y que la costa (la playa)
// sigue igual.
// Uso: node pruebas/prueba_llanos.mjs        MUTAR=1 → los llanos de antes (tiene que fallar)
if (process.env.MUTAR === '1') globalThis.__llanosViejos = true;
const { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } = await import('../src/logica/mapa.js');
const { crearPaisaje } = await import('../src/logica/paisaje.js');
const { ISLA, alturaMundo } = await import('../src/logica/whitholm.js');
const { vegetacionEn } = await import('../src/logica/vegetacion.js');

let bien = 0, mal = 0;
const ok = (t, c, d = '') => { if (c) bien++; else mal++; console.log(`${c ? '  OK   ' : '  FALLA'} ${t}${d ? ' — ' + d : ''}`); };
const p = crearPaisaje(generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }));
const alt = alturaMundo(p);

// toda la isla cada 400 m: lo de tierra adentro (la forma grande, a más de 12: lejos de la costa) y lejos de los ríos
let dentro = 0, bajos = 0, planos = 0;
const P = 400;
for (let z = ISLA.z0; z < ISLA.z1; z += P) for (let x = ISLA.x0; x < ISLA.x1; x += P) {
  if (p.grande(x, z).f < 12) continue;
  const tr = p.riosEn(x - 5, z - 5, x + 5, z + 5);
  if (p.rioCerca(x, z, tr).dm < 600) continue;
  dentro++;
  const y = p.altura(x, z, tr);
  if (y < 1) bajos++;
  if (Math.abs(y - 0.4) < 1e-6) planos++;
}
ok('tierra adentro, casi nada a menos de 1 m sobre el mar (antes, llanos de kilómetros a 0,4 m)', bajos / dentro < 0.005, `${bajos} de ${dentro} puntos (${(100 * bajos / dentro).toFixed(2)} %)`);
ok('y ningún punto justo a 0,4 m (el suelo plano de antes)', planos === 0, `${planos}`);

// tres de los llanos que estaban pelados: ahora con relieve y con lo que crece en su bioma
for (const [x, z] of [[206500, 60000], [200500, 64000], [210000, 27000]]) {
  const c = { x0: x, z0: z, x1: x + 64, z1: z + 64 };
  const v = vegetacionEn(p, alt, 1, c, c);
  let lo = Infinity, hi = -Infinity; for (let i = 0; i <= 64; i += 8) for (let j = 0; j <= 64; j += 8) { const y = alt(x + i, z + j); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  ok(`el llano de (${x}, ${z}): sobre el mar, con relieve, hierba y matas`, lo > 1.5 && hi - lo > 0.3 && v.hierba.length > 1000 && v.matas.length > 5, `de ${lo.toFixed(2)} a ${hi.toFixed(2)} m · hierba ${v.hierba.length} · matas ${v.matas.length}`);
}

// la costa no cambia: lo de menos de 3 en la forma grande (la playa y su rampa) sale igual que con lo de antes
{
  const ahora = [], antes = [];
  for (let z = ISLA.z0; z < ISLA.z1; z += 1500) for (let x = ISLA.x0; x < ISLA.x1; x += 1500) { const f = p.grande(x, z).f; if (f >= 0 && f < 3) ahora.push([x, z, p.altura(x, z)]); }
  globalThis.__llanosViejos = true;
  for (const [x, z] of ahora) antes.push(p.altura(x, z));
  globalThis.__llanosViejos = process.env.MUTAR === '1';
  const distinta = ahora.filter(([, , y], i) => Math.abs(y - antes[i]) > 1e-9).length;
  ok('la costa (la playa) sigue igual', ahora.length > 20 && distinta === 0, `${distinta} de ${ahora.length} puntos cambian`);
}

console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
