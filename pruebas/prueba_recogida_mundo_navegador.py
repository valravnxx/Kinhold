# Prueba en navegador (Chromium sin pantalla): lo que se recoge en el mundo de verdad (Whitholm) sale del sitio
# (src/logica/recogida_mundo.js): ramas en el bosque, sílex en la caliza, piedra en las laderas y los ríos (y algo de las dos en el claro), fibra en los
# claros y las riberas. En PC (1280×800) y móvil (390×844) comprueba:
#  - que alrededor de la salida hay puntos, cada uno en una zona suya del documento, y los mismos que da la lógica en
#    node para ese trozo del mundo (siempre en el mismo sitio)
#  - que junto a un punto de cada tipo que haya cerca, Usar lo recoge (al inventario, con su autor) y el punto se va
#  - que lo que se recoge sigue al jugador: lejos (400 m) hay puntos alrededor de donde está y los de la salida se
#    sueltan, sin fotogramas largos; y al volver, lo recogido sigue recogido
# En PC, en el sitio de salida con más tipos cerca (para verlos todos); en el móvil, en otro fijo con bastantes puntos.
# Capturas de cerca de cada tipo, antes y después.
# Y (P11) las semillas silvestres junto a la orilla: cebada y habas en el claro, col y nabo en la ribera.
# Uso: python3 pruebas/prueba_recogida_mundo_navegador.py <html de la demo> <carpeta_capturas>   (MUTAR=2: como si no las hubiera: tiene que fallar)
# MUTAR=1: lo que se recoge, con otra semilla (no sale donde dice la lógica): tiene que fallar.
import sys, os, re, json, shutil, subprocess, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_recogida_mundo'
os.makedirs(SALIDA, exist_ok=True)
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
MUTAR = os.environ.get('MUTAR', '')
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
TIPOS = ['ramas', 'piedra', 'silex', 'ortiga', 'hierba_larga']
DA = {'ramas': 'rama', 'piedra': 'piedra', 'silex': 'silex', 'ortiga': 'fibra', 'hierba_larga': 'fibra'}
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# lo que dice la lógica en node para los trozos de un cuadro del mundo (los ids)
def esperados(x0, z0, x1, z1):
    js = f"""import {{ generarMapa, SEMILLA_MUNDO, LADO_MUNDO }} from './src/logica/mapa.js';
import {{ crearPaisaje }} from './src/logica/paisaje.js'; import {{ alturaMundo }} from './src/logica/whitholm.js';
import {{ recogidaEn }} from './src/logica/recogida_mundo.js';
const m = generarMapa(SEMILLA_MUNDO, {{ lado: LADO_MUNDO }}), p = crearPaisaje(m);
console.log(JSON.stringify(recogidaEn(p, alturaMundo(p), m.semilla, {{ x0: {x0}, z0: {z0}, x1: {x1}, z1: {z1} }}).map(q => q.id)));"""
    r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=300)
    return set(json.loads(r.stdout.strip().splitlines()[-1]))

# el sitio de la salida con más tipos a menos de 30 m, en redondo (para la vista de PC; en un cuadro de 100 m, lo de las esquinas
# quedaba a más de los 60 m a los que se busca en la página: 5 nov) y, para la del móvil, uno fijo con bastantes
# puntos (antes era al azar y en algunos sitios no llegaba a los 20 puntos: la prueba fallaba según la suerte, 5 nov)
def sitio_con_todo():
    js = """import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from './src/logica/mapa.js';
import { crearPaisaje } from './src/logica/paisaje.js'; import { alturaMundo, SALIDAS } from './src/logica/whitholm.js';
import { recogidaEn } from './src/logica/recogida_mundo.js';
const TIPOS = """ + json.dumps(TIPOS) + """;   // (las bayas y las setas, en su prueba)
const m = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), p = crearPaisaje(m), a = alturaMundo(p); let mejor = [0, 0];
for (let k = 0; k < SALIDAS.length && mejor[0] < 5; k++) { const [x, z] = SALIDAS[k];
  const n = new Set(recogidaEn(p, a, m.semilla, { x0: x - 50, z0: z - 50, x1: x + 50, z1: z + 50 }).filter(q => Math.hypot(q.x - x, q.z - z) < 30 && TIPOS.includes(q.tipo)).map(q => q.tipo)).size; if (n > mejor[0]) mejor = [n, k]; }
// para el móvil, la primera salida (otra que la de PC) con al menos 30 puntos a menos de 48 m: siempre la misma
let km = -1;
for (let k = 0; k < SALIDAS.length && km < 0; k++) { if (k === mejor[1]) continue; const [x, z] = SALIDAS[k];
  if (recogidaEn(p, a, m.semilla, { x0: x - 48, z0: z - 48, x1: x + 48, z1: z + 48 }).length >= 30) km = k; }
console.log(JSON.stringify([...mejor, km]));"""
    r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=600)
    return json.loads(r.stdout.strip().splitlines()[-1])
TODO = sitio_con_todo()
print('  sitio de salida con más tipos cerca:', TODO[:2], '· el del móvil:', TODO[2])

DONDE = {'ramas': ['bosque'], 'piedra': ['rio', 'ladera', 'claro'], 'silex': ['caliza', 'rio', 'claro'], 'ortiga': ['claro', 'ribera'], 'hierba_larga': ['claro', 'ribera'],
         'juncos': ['rio', 'ribera'], 'barro': ['rio', 'ribera'], 'yesquero': ['bosque'],
         'bayas': ['bosque', 'claro'], 'setas': ['bosque'], 'mimbre': ['rio', 'ribera'],
         'cebada_silvestre': ['claro'], 'habas_silvestres': ['claro'], 'col_silvestre': ['ribera'], 'nabo_silvestre': ['ribera']}
# la orilla del río más cercano a la salida común (unos 850 m al norte; en metros del mundo): juncos, barro y yesqueros
ORILLA = (184590, 45420)
CON = {'juncos': ('lasca_silex', 'cuchillo'), 'barro': ('palo_cavador', 'palo cavador'), 'yesquero': (None, None)}
DA_ORILLA = {'juncos': 'junco', 'barro': 'barro', 'yesquero': 'yesca'}
# (P11) las semillas silvestres: la mata de cada una más cercana a la orilla (en metros del mundo), de la lógica
SEMILLAS = {'cebada_silvestre': 'semilla_cebada', 'habas_silvestres': 'habas', 'col_silvestre': 'semilla_col', 'nabo_silvestre': 'semilla_nabo'}
def semillas_cerca():
    js = """import { generarMapa, SEMILLA_MUNDO, LADO_MUNDO } from './src/logica/mapa.js';
import { crearPaisaje } from './src/logica/paisaje.js'; import { alturaMundo } from './src/logica/whitholm.js';
import { recogidaEn } from './src/logica/recogida_mundo.js';
const m = generarMapa(SEMILLA_MUNDO, { lado: LADO_MUNDO }), p = crearPaisaje(m), a = alturaMundo(p);
const [X, Z] = """ + json.dumps(list(ORILLA)) + """, R = 300, ps = recogidaEn(p, a, m.semilla, { x0: X - R, z0: Z - R, x1: X + R, z1: Z + R }), r = {};
for (const t of """ + json.dumps(list(SEMILLAS)) + """) { const q = ps.filter(q => q.tipo === t).sort((u, v) => Math.hypot(u.x - X, u.z - Z) - Math.hypot(v.x - X, v.z - Z))[0]; if (q) r[t] = [q.x, q.z, q.id]; }
console.log(JSON.stringify(r));"""
    r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=300)
    return json.loads(r.stdout.strip().splitlines()[-1])
SEM = semillas_cerca()
print('  semillas silvestres junto a la orilla:', json.dumps(SEM))
LISTO = f"{K}.mundoListo && {K}.recoleccion.listo && {K}.decorado.pendientes === 0"

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        if MUTAR == '1': ctx.add_init_script('window.__mutarRecogida = true')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL + f'&salida={TODO[2] if movil else TODO[1]}')
        pg.wait_for_function('window.__kinhold !== undefined && window.__kinhold.mundoJ', timeout=240000)
        pg.evaluate(f"localStorage.removeItem('kinhold.recoleccion.mundo'); {K}.recoleccion.rec.estado = {{}}; {K}.recoleccion.refrescar()")
        pg.wait_for_function(LISTO, timeout=240000)
        # 1) alrededor de la salida, y cada punto en su zona
        r = pg.evaluate(f"""(() => {{ const k = {K}, ps = k.recoleccion.puntos, c = {{}}, O = k.mundoJ.salida;
          for (const q of ps) c[q.tipo] = (c[q.tipo] || 0) + 1;
          return {{ cuenta: c, n: ps.length, trozos: k.recoleccion.cuenta.trozos, O, pj: [k.pj.x, k.pj.z],
            malos: ps.filter(q => !({json.dumps(DONDE)})[q.tipo].some(z => q.zonas.includes(z))).map(q => q.id),
            ids: ps.filter(q => Math.abs(q.x - k.pj.x) < 40 && Math.abs(q.z - k.pj.z) < 40).map(q => q.id) }}; }})()""")
        print('  alrededor de la salida:', json.dumps(r['cuenta']), r['n'], 'puntos en', r['trozos'], 'trozos')
        comprobar('alrededor de la salida hay cosas que recoger', r['n'] > 20, str(r['n']))
        comprobar('cada punto, en una zona suya del documento', not r['malos'], ', '.join(r['malos'][:4]))
        O, P = r['O'], r['pj']
        # los de la lógica en el cuadro de 80 m alrededor del jugador (en metros del mundo)
        cx, cz = O['x'] + P[0], O['z'] + P[1]
        esp = esperados(cx - 40, cz - 40, cx + 40, cz + 40)
        ids = set(r['ids'])
        comprobar('son los mismos puntos que da la lógica para ese sitio del mundo', esp and ids == esp, f'{len(ids)} en la página, {len(esp)} en la lógica, {len(ids ^ esp)} distintos')
        # 2) recoger uno de cada tipo que haya cerca
        cogidos = []
        for tipo in TIPOS:
            pt = pg.evaluate(f"""(() => {{ const k = {K}, P = k.pj;
              const q = k.recoleccion.cercanos(P.x, P.z, 60).filter(q => q.tipo === '{tipo}')[0]; if (!q) return null;
              k.pj.x = q.x + 0.2; k.pj.z = q.z + 0.9; k.pj.rot = Math.PI; k.cam.dist = 3.2; k.cam.pitch = 0.42; k.cam.yaw = -Math.PI / 2 + 0.3;
              return q; }})()""")
            if not pt:
                print(f'  ({tipo}: no hay a menos de 60 m)'); continue
            pg.wait_for_timeout(600); pg.evaluate(f"{K}.render()")
            pg.screenshot(path=f'{SALIDA}/{nombre}_{tipo}_antes.png')
            antes = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
            if movil: pg.locator('#btnUsar').tap()
            else: pg.evaluate(f"{K}.usar()")
            pg.wait_for_timeout(400)
            despues = pg.evaluate(f"{K}.inventario.cuantos('{DA[tipo]}')")
            aviso = pg.evaluate("document.getElementById('aviso').textContent")
            comprobar(f'{tipo} ({", ".join(pt["zonas"])}): Usar lo recoge y va al inventario', despues > antes, f'{antes} → {despues} · «{aviso}»')
            comprobar(f'{tipo}: el punto ya no está', not pg.evaluate(f"{K}.recoleccion.rec.disponible('{pt['id']}', Date.now())"))
            ent = pg.evaluate(f"{K}.registroAcciones.entradas.at(-1)")
            comprobar(f'{tipo}: queda en el registro con autor', bool(ent and ent['tipo'] == 'recoger' and ent['autor'] and ent['ok']))
            pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}_{tipo}_despues.png')
            cogidos.append(pt['id'])
            pg.evaluate(f"(() => {{ const i = {K}.inventario; i.lugares['mano:der'] = null; i.lugares['mano:izq'] = null; }})()")
        if movil: comprobar(f'cerca de la salida {TODO[2]} se ha podido recoger algo', len(cogidos) >= 1, ', '.join(cogidos))
        else: comprobar(f'junto al sitio de salida {TODO[1]} se recogen los {TODO[0]} tipos que hay cerca', len(cogidos) >= TODO[0] >= 4, ', '.join(cogidos))
        # 2b) en la orilla del río: juncos (con cuchillo), barro (con palo cavador, no se agota) y hongos yesqueros
        pg.evaluate(f"([x, z]) => {{ const k = {K}, O = k.mundoJ.salida; k.pj.x = x - O.x; k.pj.z = z - O.z; }}", list(ORILLA))
        pg.wait_for_timeout(500)
        try: pg.wait_for_function(LISTO, timeout=240000)
        except Exception: print('  (la orilla no llegó a tiempo)')
        for tipo, (herr, dice) in CON.items():
            pt = pg.evaluate(f"""(() => {{ const k = {K}, P = k.pj;
              const q = k.recoleccion.cercanos(P.x, P.z, 90).filter(q => q.tipo === '{tipo}')[0]; if (!q) return null;
              k.pj.x = q.x + 0.2; k.pj.z = q.z + 0.9; k.pj.rot = Math.PI; k.cam.dist = 3.2; k.cam.pitch = 0.42; k.cam.yaw = -Math.PI / 2 + 0.3;
              return q; }})()""")
            comprobar(f'en la orilla del río hay {tipo} (a menos de 90 m)', bool(pt))
            if not pt: continue
            pg.wait_for_timeout(600); pg.evaluate(f"{K}.render()")
            pg.screenshot(path=f'{SALIDA}/{nombre}_orilla_{tipo}.png')
            usar = (lambda: pg.locator('#btnUsar').tap()) if movil else (lambda: pg.evaluate(f"{K}.usar()"))
            cuantos = lambda: pg.evaluate(f"{K}.inventario.cuantos('{DA_ORILLA[tipo]}')")
            if herr:
                antes = cuantos(); usar(); pg.wait_for_timeout(400)
                aviso = pg.evaluate("document.getElementById('aviso').textContent")
                comprobar(f'{tipo}: sin {dice} no se puede, y lo dice', cuantos() == antes and dice in aviso, f'«{aviso}»')
                pg.evaluate(f"{K}.inventario.meter('mano:izq', {{ tipo: '{herr}', n: 1 }})")
            antes = cuantos(); usar(); pg.wait_for_timeout(400)
            aviso = pg.evaluate("document.getElementById('aviso').textContent")
            comprobar(f'{tipo} ({", ".join(pt["zonas"])}): Usar lo {"cava" if tipo == "barro" else "corta" if tipo == "juncos" else "recoge"} y va al inventario', cuantos() > antes, f'{antes} → {cuantos()} · «{aviso}»')
            sigue = pg.evaluate(f"{K}.recoleccion.rec.disponible('{pt['id']}', Date.now())")
            if tipo == 'barro': comprobar('barro: no se agota (el sitio sigue ahí)', sigue)
            else: comprobar(f'{tipo}: el punto ya no está', not sigue)
            pg.evaluate(f"(() => {{ const i = {K}.inventario; i.lugares['mano:der'] = null; i.lugares['mano:izq'] = null; }})()")
        pg.evaluate(f"(() => {{ const k = {K}; k.cam.dist = 7; k.cam.pitch = 0.45; }})()"); pg.wait_for_timeout(600); pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/{nombre}_orilla.png')
        # 2c) (P11) las semillas silvestres: cebada y habas en el claro, col y nabo en la ribera; con las manos, la planta se queda
        for tipo, da in SEMILLAS.items():
            comprobar(f'cerca de la orilla hay {tipo} (a menos de 300 m)', MUTAR != '2' and tipo in SEM)
            if tipo not in SEM: continue
            x, z, pid = SEM[tipo]
            # la planta, delante de la cámara, un metro más allá de ti y algo a la derecha: en el móvil (pantalla estrecha) queda
            # en el centro y no detrás del mando ni fuera de cuadro
            pg.evaluate(f"""([x, z]) => {{ const k = {K}, O = k.mundoJ.salida, Y = -Math.PI / 2 + 0.3, fx = -Math.sin(Y), fz = -Math.cos(Y), rx = -fz, rz = fx;
                const px = x - O.x - fx * 1.0 - rx * 0.4, pz = z - O.z - fz * 1.0 - rz * 0.4;
                k.pj.x = px; k.pj.z = pz; k.pj.rot = Math.atan2(x - O.x - px, z - O.z - pz); k.cam.dist = 2.6; k.cam.pitch = 0.38; k.cam.yaw = Y; }}""", [x, z])
            pg.wait_for_timeout(500)
            try: pg.wait_for_function(LISTO, timeout=240000)
            except Exception: print(f'  ({tipo}: no llegó a tiempo)')
            pt = pg.evaluate(f"(() => {{ const k = {K}, P = k.pj; return k.recoleccion.cercanos(P.x, P.z, 3).find(q => q.id === '{pid}') || null; }})()")
            comprobar(f'{tipo}: la página la tiene donde dice la lógica', bool(pt))
            if not pt: continue
            pg.wait_for_timeout(600); pg.evaluate(f"{K}.render()")
            pg.screenshot(path=f'{SALIDA}/{nombre}_semilla_{tipo}_antes.png')
            antes = pg.evaluate(f"{K}.inventario.cuantos('{da}')")
            if movil: pg.locator('#btnUsar').tap()
            else: pg.evaluate(f"{K}.usar()")
            pg.wait_for_timeout(400)
            despues = pg.evaluate(f"{K}.inventario.cuantos('{da}')")
            aviso = pg.evaluate("document.getElementById('aviso').textContent")
            comprobar(f'{tipo} ({", ".join(pt["zonas"])}): Usar lo recoge con las manos y va al inventario', despues > antes, f'{antes} → {despues} · «{aviso}»')
            v = pg.evaluate(f"[{K}.recoleccion.rec.disponible('{pid}', Date.now()), {K}.recoleccion.rec.enPie('{pid}', Date.now())]")
            comprobar(f'{tipo}: se va lo que tiene la semilla y la planta se queda', not v[0] and v[1], json.dumps(v))
            pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}_semilla_{tipo}_despues.png')
            pg.evaluate(f"(() => {{ const i = {K}.inventario; i.lugares['mano:der'] = null; i.lugares['mano:izq'] = null; }})()")
        pg.evaluate(f"([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; }}", [O['x'] + P[0] - O['x'], P[1]])
        pg.wait_for_timeout(500)
        try: pg.wait_for_function(LISTO, timeout=240000)
        except Exception: print('  (no volvió a tiempo)')
        # 3) lejos y de vuelta
        x0, z0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
        pg.evaluate(f"{K}.recoleccion.cuenta.msMax = 0")
        pg.evaluate(f"(() => {{ const k = {K}; k.pj.x += 400; }})()")
        pg.wait_for_timeout(500)
        try: pg.wait_for_function(LISTO, timeout=240000)
        except Exception: print('  (no llegó a tiempo)')
        l = pg.evaluate(f"""(() => {{ const k = {K}, ps = k.recoleccion.puntos, P = k.pj;
          return {{ n: ps.length, lejos: Math.max(0, ...ps.map(q => Math.max(Math.abs(q.x - P.x), Math.abs(q.z - P.z)))), cerca: ps.filter(q => Math.hypot(q.x - P.x, q.z - P.z) < 60).length,
            ms: k.recoleccion.cuenta.msMax, siguen: {json.dumps(cogidos)}.filter(id => k.recoleccion.rec.porId.has(id)).length }}; }})()""")
        print('  a 400 m:', json.dumps(l))
        comprobar('lejos, los puntos están alrededor de donde estás y los de la salida se sueltan', l['siguen'] == 0 and l['lejos'] <= (48 if movil else 64) + 2 * 32 + 32, json.dumps(l))
        comprobar('hacer lo de alrededor no pide fotogramas largos (menos de 20 ms)', l['ms'] < 20, f"{l['ms']:.1f} ms")
        pg.evaluate(f"([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; }}", [x0, z0])
        pg.wait_for_timeout(500)
        try: pg.wait_for_function(LISTO, timeout=240000)
        except Exception: print('  (no llegó a tiempo)')
        v = pg.evaluate(f"(ids) => ids.map(id => [{K}.recoleccion.rec.porId.has(id), {K}.recoleccion.rec.disponible(id, Date.now())])", cogidos)
        comprobar('al volver, lo recogido sigue recogido', bool(cogidos) and all(h and not d for h, d in v), json.dumps(v))
        # vista de lejos para valravnx
        pg.evaluate(f"(() => {{ const k = {K}; k.cam.dist = 9; k.cam.pitch = 0.5; }})()"); pg.wait_for_timeout(600); pg.evaluate(f"{K}.render()")
        pg.screenshot(path=f'{SALIDA}/{nombre}_alrededor.png')
        comprobar(f'sin errores en la página ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()

srv.shutdown()
print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
