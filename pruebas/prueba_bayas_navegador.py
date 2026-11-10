# Prueba en navegador (Chromium sin pantalla) de las bayas y las setas (P4; valravnx, 7 nov: «que los arbustos que
# tengan bayas se vean claramente, y al recolectarlas estas desaparezcan del mismo»). En el mundo de verdad (Whitholm),
# sin servidor, en PC (1280×800) y móvil (390×844):
#   - cerca de la salida (a unos cientos de metros) hay arbustos de bayas y setas;
#   - junto al arbusto más cercano: se ven el arbusto y sus bayas (las dos mallas, con su ejemplar puesto) y en la
#     captura de cerca hay píxeles de baya (rojo vivo) donde está el arbusto;
#   - al cogerlas («Usar»): las bayas van a lo que llevas (de 3 a 6), las bayas del arbusto desaparecen y el arbusto se
#     queda; en la captura ya no hay rojo de baya;
#   - con hambre y bayas encima, «Usar» (sin otra cosa al lado) se come una: el hambre baja y queda una menos;
#   - las setas: al cogerlas desaparecen enteras;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_bayas_navegador.py <html> <carpeta_capturas>
# Rota a propósito (7 nov): con el arbusto sin «siempre» (src/juego/recoleccion.js), se va con las bayas, y falla.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver, json
from playwright.sync_api import sync_playwright
from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_bayas'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3', 'meshy-v2', 'taller-dormir-v1', 'taller-sentarse-v1']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# lo que se ve de un punto: si el ejemplar de cada malla de su tipo está puesto (escala distinta de 0)
VISTO = """([tipo, id]) => { const k = window.__kinhold, rec = k.recoleccion, lista = rec.puntos.filter(p => p.tipo === tipo), i = lista.findIndex(p => p.id === id);
  const m = new k.camara.matrixWorld.constructor(), r = {};
  rec.grupo.children.filter(c => c.name.startsWith('recoger_' + tipo)).forEach(c => { c.getMatrixAt(i, m); r[c.name] = (r[c.name] || false) || Math.abs(m.determinant()) > 1e-9; });
  return r; }"""

def entrar(pg):
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=180000)
    except Exception: pass
    pg.wait_for_timeout(1000)

def cercano(pg, tipo):
    return pg.evaluate(f"(() => {{ const k = {K}; const l = k.recoleccion.puntos.filter(p => p.tipo === '{tipo}' && !p.tapado).sort((a, b) => Math.hypot(a.x - k.pj.x, a.z - k.pj.z) - Math.hypot(b.x - k.pj.x, b.z - k.pj.z)); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, n: l.length }} : null; }})()")

def buscar(pg, tipo):
    """el punto de ese tipo más cercano; si no hay cargados, anda (salta) en espiral hasta dar con uno"""
    for dx, dz in [(0, 0), (120, 0), (0, 120), (-120, 0), (0, -120), (240, 0), (0, 240), (-240, 0), (0, -240), (240, 240), (-240, -240), (360, 0), (0, 360)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            pg.wait_for_timeout(1500)
            try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=120000)
            except Exception: pass
        q = cercano(pg, tipo)
        if q: return q
    return None

def ir(pg, p, dist=4.5, pitch=0.42):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.8; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = Math.atan2(0.9, 0.8) + 0.45; }}', [p['x'], p['z']])
    pg.wait_for_timeout(1500)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(2500)

def rojo_baya(pg, p):
    """los píxeles de baya roja alrededor de donde sale el arbusto en la pantalla"""
    c = pg.evaluate(f"""([x, z]) => {{ const k = {K}, c = k.camara, v = c.position.clone().set(x, k.alturaSuelo(x, z) + 0.5, z).project(c); return [(v.x + 1) / 2, (1 - v.y) / 2]; }}""", [p['x'], p['z']])
    im = Image.open(io.BytesIO(pg.screenshot(timeout=180000))).convert('RGB'); W, H = im.size
    cx, cy, r = int(c[0] * W), int(c[1] * H), int(min(W, H) * 0.2)
    caja = im.crop((max(0, cx - r), max(0, cy - r), min(W, cx + r), min(H, cy + r))); px = caja.load(); n = 0
    for yy in range(caja.size[1]):
        for xx in range(caja.size[0]):
            R, G, B = px[xx, yy]
            if R > 120 and R > G * 2.2 and R > B * 1.8: n += 1
    return n

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    b = buscar(pg, 'bayas')
    comprobar(f'{nombre}: hay arbustos de bayas en el mundo (cerca de la salida)', bool(b), str(b))
    if not b: return
    ir(pg, b)
    v = pg.evaluate(VISTO, ['bayas', b['id']])
    comprobar(f'{nombre}: se ven el arbusto y sus bayas', v.get('recoger_bayas_planta') is True and v.get('recoger_bayas') is True, str(v))
    rojo0 = rojo_baya(pg, b)
    pg.screenshot(path=f'{SALIDA}/{pref}_1_arbusto_con_bayas.png', timeout=180000)
    comprobar(f'{nombre}: de cerca, las bayas se ven (rojo de baya en el arbusto)', rojo0 > 40, f'{rojo0} px')
    pg.keyboard.press('f'); pg.wait_for_timeout(2500)
    n = pg.evaluate(f"{K}.inventario ? {K}.inventario.cuantos('bayas') : null")
    v = pg.evaluate(VISTO, ['bayas', b['id']])
    rojo1 = rojo_baya(pg, b)
    pg.screenshot(path=f'{SALIDA}/{pref}_2_arbusto_sin_bayas.png', timeout=180000)
    comprobar(f'{nombre}: al cogerlas van a lo que llevas (de 3 a 6)', n is not None and 3 <= n <= 6, str(n))
    comprobar(f'{nombre}: las bayas desaparecen del arbusto y el arbusto se queda', v.get('recoger_bayas') is False and v.get('recoger_bayas_planta') is True, str(v))
    comprobar(f'{nombre}: en la captura ya no hay rojo de baya', rojo1 < rojo0 * 0.2, f'{rojo0} → {rojo1} px')
    # comer: con hambre, «Usar» junto al arbusto ya vacío (no hay otra cosa) se come una
    pg.evaluate(f'{K}.ponerNecesidades({{ hambre: 60, sed: 0, frio: 0, cansancio: 0 }})')
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    h = pg.evaluate(f'{K}.necesidades.hambre'); n2 = pg.evaluate(f"{K}.inventario.cuantos('bayas')")
    comprobar(f'{nombre}: con hambre, «Usar» se come una: el hambre baja y queda una menos', h < 60 and n2 == (n or 0) - 1, f'hambre {h}, bayas {n} → {n2}')
    s = buscar(pg, 'setas')
    comprobar(f'{nombre}: hay setas en el mundo (cerca de la salida)', bool(s), str(s))
    if s:
        ir(pg, s, dist=3.5, pitch=0.5)
        pg.screenshot(path=f'{SALIDA}/{pref}_3_setas.png', timeout=180000)
        v0 = pg.evaluate(VISTO, ['setas', s['id']])
        pg.keyboard.press('f'); pg.wait_for_timeout(2500)
        v1 = pg.evaluate(VISTO, ['setas', s['id']])
        ns = pg.evaluate(f"{K}.inventario.cuantos('setas')")
        comprobar(f'{nombre}: las setas se ven y al cogerlas desaparecen enteras', v0.get('recoger_setas') is True and v1.get('recoger_setas') is False and ns >= 3, f'{v0} → {v1}, {ns} setas')
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        recorrido(ctx.new_page(), nombre, pref)
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
