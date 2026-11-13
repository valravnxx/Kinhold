import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from '../src/logica/mapa.js';
import { crearPaisaje } from '../src/logica/paisaje.js';
import { alturaMundo, SALIDA } from '../src/logica/whitholm.js';
import { recogidaEn } from '../src/logica/recogida_mundo.js';
const mapa = generarMapa(SEMILLA_MUNDO,{lado:LADO_MUNDO}); const pai = crearPaisaje(mapa), alt = alturaMundo(pai), sem=mapa.semilla;
const O=SALIDA; let rio=null;
for (let r = 0; r < 3000 && !rio; r += 25) for (let k = 0; k < 96; k++) {
  const X = Math.cos(k / 96 * 2 * Math.PI) * r + O.x, Z = Math.sin(k / 96 * 2 * Math.PI) * r + O.z;
  const { dm, ancho } = pai.rioCerca(X, Z, pai.riosEn(X - 20, Z - 20, X + 20, Z + 20));
  if (dm - ancho / 2 < 4 && alt(X, Z) > 0.5) { rio = { X, Z, r }; break; } }
console.log('rio a', rio.r);
const ps = recogidaEn(pai, alt, sem, {x0:rio.X-150,z0:rio.Z-150,x1:rio.X+150,z1:rio.Z+150});
const c={}; for(const p of ps) c[p.tipo]=(c[p.tipo]||0)+1; console.log(c);
for (const t of ['col_silvestre','nabo_silvestre','juncos']) console.log(t, ps.filter(p=>p.tipo===t).map(p=>Math.round(Math.hypot(p.x-rio.X,p.z-rio.Z))).sort((a,b)=>a-b).slice(0,3));
