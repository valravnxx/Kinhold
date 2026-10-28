// Pruebas del aspecto del personaje (personalización). Ejecutar: node pruebas/prueba_aspecto.mjs
// Con MUTAR=1 se rompe a propósito (la normalización deja pasar números fuera de rango): debe FALLAR.
import { normalizarAspecto, pesosFormas, escalaAltura, colorDe, PALETAS, FORMAS, ASPECTO_INICIAL, PEINADOS, BARBAS, ESCALA_ALTURA } from '../src/logica/aspecto.js';

let ok = 0, mal = 0;
function comprobar(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  OK   ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? ' — ' + detalle : ''}`); }
}
const norm = process.env.MUTAR === '1' ? (a, s) => ({ ...normalizarAspecto(a, s), formas: { ...normalizarAspecto(a, s).formas, ...(a?.formas || {}) } }) : normalizarAspecto;

// los valores por defecto son los colores del taller (vestir_mpfb.py): sin aspecto guardado se ve igual que antes
const h = norm(undefined, 'hombre'), m = norm(null, 'mujer');
comprobar('sin aspecto, el hombre lleva los colores del taller', String(colorDe('piel', h.piel)) === '224,180,152' && String(colorDe('ojos', h.ojos)) === '92,70,48' && String(colorDe('pelo', h.pelo)) === '62,44,30');
comprobar('sin aspecto, la mujer lleva los colores del taller', String(colorDe('piel', m.piel)) === '230,190,165' && String(colorDe('ojos', m.ojos)) === '80,96,104');
comprobar('sin aspecto, todas las formas en 0', Object.values(h.formas).every(v => v === 0) && Object.keys(h.formas).length === Object.keys(FORMAS).length);
comprobar('el hombre empieza con pelo corto y barba corta; la mujer con cofia y sin barba', h.peinado === 'corto' && h.barba === 'corta' && m.peinado === 'cofia' && m.barba === 'ninguna');
// recortes y valores raros (lo que llegue de un guardado viejo o de un cliente tramposo)
const raro = norm({ piel: 'verde', ojos: '__proto__', pelo: 'rubio', peinado: 'cresta', barba: 'bigote', formas: { peso: 7, musculo: -3, nariz: 'x', menton: 0.333, inventada: 1 } }, 'hombre');
comprobar('un color que no existe vuelve al de por defecto', raro.piel === ASPECTO_INICIAL.hombre.piel && raro.ojos === ASPECTO_INICIAL.hombre.ojos);
comprobar('un color que existe se queda', raro.pelo === 'rubio');
comprobar('un peinado que no existe vuelve al de por defecto; la barba elegida se queda', raro.peinado === 'corto' && raro.barba === 'bigote');
comprobar('las formas se recortan a [-1, 1]', raro.formas.peso === 1 && raro.formas.musculo === -1, JSON.stringify(raro.formas));
comprobar('una forma que no es número vale 0; se redondea a centésimas', raro.formas.nariz === 0 && raro.formas.menton === 0.33);
comprobar('una forma inventada no entra', !('inventada' in raro.formas));
comprobar('la mujer no puede llevar barba', norm({ barba: 'corta' }, 'mujer').barba === 'ninguna');
comprobar('un sexo raro cuenta como hombre', norm({}, 'otro').peinado === 'corto');
// pesos de las formas del modelo
const p = pesosFormas(norm({ formas: { peso: 0.5, musculo: -0.25, altura: 1 } }));
comprobar('peso 0,5 → forma «peso_mas» a 0,5 y «peso_menos» a 0', p.peso_mas === 0.5 && p.peso_menos === 0);
comprobar('músculo −0,25 → forma «musculo_menos» a 0,25', p.musculo_menos === 0.25 && p.musculo_mas === 0);
comprobar('la altura no es una forma del modelo', !('altura_mas' in p));
comprobar('altura 1 → escala 1 + ESCALA_ALTURA', Math.abs(escalaAltura(norm({ formas: { altura: 1 } })) - (1 + ESCALA_ALTURA)) < 1e-9);
comprobar('altura −1 → escala 1 − ESCALA_ALTURA', Math.abs(escalaAltura(norm({ formas: { altura: -1 } })) - (1 - ESCALA_ALTURA)) < 1e-9);
// paletas bien formadas
comprobar('todas las paletas tienen nombre y color sRGB', Object.values(PALETAS).every(pl => Object.values(pl).every(([n, c]) => typeof n === 'string' && c.length === 3 && c.every(x => Number.isInteger(x) && x >= 0 && x <= 255))));
comprobar('los valores por defecto existen en sus listas', ['hombre', 'mujer'].every(s => Object.hasOwn(PEINADOS[s], ASPECTO_INICIAL[s].peinado) && Object.hasOwn(BARBAS[s], ASPECTO_INICIAL[s].barba)));
// se puede mandar tal cual (JSON) y vuelve igual
comprobar('el aspecto pasa por JSON sin cambiar', JSON.stringify(norm(JSON.parse(JSON.stringify(raro)), 'hombre')) === JSON.stringify(raro));

console.log(`\nResultado: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
