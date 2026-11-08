# Prueba en navegador (Chromium sin pantalla) de de dónde salen el mimbre, la corteza y la resina (tarea del hito
# crafting, 8 nov). En el mundo de verdad (Whitholm), sin servidor, en PC (1280×800) y móvil (390×844):
#   - en la ribera del río de cerca de la salida hay mimbreras, y junto a una se ven su cepa y sus varas;
#   - con la lasca de sílex, Usar corta sus varas: un haz de mimbre; las varas se van y la cepa se queda;
#   - junto a un árbol, sin hacha en la mano y con la lasca, Usar lo descorteza (1 o 2 cortezas) y el menú ya no lo ofrece;
#   - junto a un pino (a unos 4 km), Usar le hace el corte; cuando la resina está lista, Usar la coge (1 resina);
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_materiales_navegador.py <html> <carpeta_capturas>
# Rota a propósito (8 nov): MUTAR=1 deja las varas de la mimbrera siempre puestas (como si no se cortaran): falla.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_materiales'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=184596,46280&lang=es'   # (la salida en línea: las coordenadas de abajo son de su escena)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
MIMBRERA = (-12, -850)   # (escena) la mimbrera más cercana a la salida, en la ribera del río del sur (mirado con la lógica)
PINAR = (2854, 3070)     # (escena) un sitio con pinos o abetos: los más cercanos a la salida
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    for cond in [f'{K}.decorado.pendientes === 0', f'{K}.recoleccion.listo']:
        try: pg.wait_for_function(cond, timeout=180000)
        except Exception: pass
    pg.wait_for_timeout(1500)

def ir(pg, x, z):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [x, z])
    esperar(pg, 4000)

def mirar(pg, x, z, d=3.2, pitch=0.35, yaw=0.6):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 1.1; k.pj.z = z + 0.4; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); k.cam.dist = {d}; k.cam.pitch = {pitch}; k.cam.yaw = {yaw}; }}', [x, z])
    pg.wait_for_timeout(2500)

def poner_lasca(pg):
    pg.evaluate(f"(() => {{ const k = {K}, inv = k.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l); inv.coger('lasca_silex', 1, 'mano:izq'); k.pintarTodoInventario(); }})()")

VIS_MIMBRE = f"(id) => {{ const k = {K}, rec = k.recoleccion, lista = rec.puntos.filter(p => p.tipo === 'mimbre'), i = lista.findIndex(p => p.id === id), m = new k.camara.matrixWorld.constructor(); const r = {{}}; rec.grupo.children.filter(c => c.name.startsWith('recoger_mimbre')).forEach(c => {{ c.getMatrixAt(i, m); r[c.name] = Math.abs(m.determinant()) > 1e-12; }}); return r; }}"

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    # la mimbrera
    ir(pg, MIMBRERA[0] + 3, MIMBRERA[1])
    try: pg.wait_for_function(f"{K}.recoleccion.puntos.some(p => p.tipo === 'mimbre' && Math.hypot(p.x - ({MIMBRERA[0]}), p.z - ({MIMBRERA[1]})) < 3)", timeout=240000)
    except Exception: pass
    m = pg.evaluate(f"(() => {{ const k = {K}, l = k.recoleccion.puntos.filter(p => p.tipo === 'mimbre').sort((a, b) => Math.hypot(a.x - {MIMBRERA[0]}, a.z - {MIMBRERA[1]}) - Math.hypot(b.x - {MIMBRERA[0]}, b.z - {MIMBRERA[1]})); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()")
    comprobar(f'{nombre}: en la ribera del río del sur hay una mimbrera', bool(m) and abs(m['x'] - MIMBRERA[0]) < 3, str(m))
    if not m: return
    if MUTAR: pg.evaluate(f"{K}.recoleccion.grupo.children.filter(c => c.name === 'recoger_mimbre').forEach(c => c.name = 'recoger_mimbre_planta')")
    mirar(pg, m['x'], m['z'])
    antes = pg.evaluate(VIS_MIMBRE, m['id'])
    comprobar(f'{nombre}: se ven su cepa y sus varas', antes.get('recoger_mimbre_planta') and antes.get('recoger_mimbre'), str(antes))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_mimbrera.png', timeout=180000)
    poner_lasca(pg)
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.5; k.pj.z = z + 0.2; }}', [m['x'], m['z']]); pg.wait_for_timeout(600)
    pg.keyboard.press('f'); pg.wait_for_timeout(2500)
    despues = pg.evaluate(VIS_MIMBRE, m['id'])
    n = pg.evaluate(f"{K}.inventario.cuantos('mimbre')")
    comprobar(f'{nombre}: con la lasca, Usar corta sus varas: un haz de mimbre', n == 1, f'{n}')
    comprobar(f'{nombre}: las varas se van y la cepa se queda', despues.get('recoger_mimbre_planta') and not despues.get('recoger_mimbre'), str(despues))
    mirar(pg, m['x'], m['z'])
    pg.screenshot(path=f'{SALIDA}/{pref}_2_mimbrera_cortada.png', timeout=180000)
    # un árbol de cerca: se descorteza
    poner_lasca(pg)
    a = pg.evaluate(f"(() => {{ const k = {K}; const l = k.obstaculos.filter(o => o.arbol && k.talaV.enPie(o)).sort((p, q) => Math.hypot(p.x - k.pj.x, p.z - k.pj.z) - Math.hypot(q.x - k.pj.x, q.z - k.pj.z)); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, r: l[0].r, especie: l[0].especie }} : null; }})()")
    comprobar(f'{nombre}: hay un árbol cerca', bool(a), str(a))
    if a:
        pg.evaluate(f'([x, z, r]) => {{ const k = {K}; k.pj.x = x + r + 0.5; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }}', [a['x'], a['z'], a['r']]); pg.wait_for_timeout(800)
        pg.keyboard.press('f'); pg.wait_for_timeout(2000)
        c = pg.evaluate(f"{K}.inventario.cuantos('corteza')")
        comprobar(f'{nombre}: sin hacha y con la lasca, Usar descorteza el {a["especie"]} (1 o 2 cortezas)', 1 <= c <= 2, f'{c}')
        comprobar(f'{nombre}: y ya no se ofrece descortezarlo', not pg.evaluate(f"{K}.talaV.usos({K}.arbolCercano()).descortezar"))
    # un pino: la resina
    ir(pg, *PINAR)
    try: pg.wait_for_function(f"{K}.obstaculos.some(o => o.arbol && (o.especie === 'pino' || o.especie === 'abeto') && Math.hypot(o.x - {K}.pj.x, o.z - {K}.pj.z) < 60)", timeout=240000)
    except Exception: pass
    p = pg.evaluate(f"(() => {{ const k = {K}; const l = k.obstaculos.filter(o => o.arbol && (o.especie === 'pino' || o.especie === 'abeto') && k.talaV.enPie(o)).sort((p, q) => Math.hypot(p.x - k.pj.x, p.z - k.pj.z) - Math.hypot(q.x - k.pj.x, q.z - k.pj.z)); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, r: l[0].r, especie: l[0].especie }} : null; }})()")
    comprobar(f'{nombre}: en el pinar hay pinos o abetos', bool(p), str(p))
    if p:
        poner_lasca(pg)
        pg.evaluate(f'([x, z, r]) => {{ const k = {K}; k.pj.x = x + r + 0.5; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.cam.dist = 4; k.cam.pitch = 0.3; k.cam.yaw = Math.PI / 2 + 0.6; }}', [p['x'], p['z'], p['r']]); pg.wait_for_timeout(1500)
        # (primero lo descorteza: Usar hace lo primero que se puede; luego le hace el corte)
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        pg.evaluate(f"(() => {{ const inv = {K}.inventario; for (const l of ['mano:der']) if (inv.lugares[l]) inv.sacar(l); }})()")
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        u = pg.evaluate(f"{K}.talaV.usos({K}.arbolCercano())")
        comprobar(f'{nombre}: Usar le hace el corte al {p["especie"]} (la resina, sangrando)', u.get('resina') == 'sangrando', str(u))
        pg.screenshot(path=f'{SALIDA}/{pref}_3_pino_sangrado.png', timeout=180000)
        pg.evaluate(f"(id) => {{ {K}.talaV.tala.estado[id].resina = Date.now() - 1; }}", p['id'])   # (como si hubieran pasado las 4 h)
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        r = pg.evaluate(f"{K}.inventario.cuantos('resina')")
        comprobar(f'{nombre}: cuando sale, Usar coge la resina (1)', r == 1, f'{r}')
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as pw:
    nav = pw.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        recorrido(ctx.new_page(), nombre, pref)
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
