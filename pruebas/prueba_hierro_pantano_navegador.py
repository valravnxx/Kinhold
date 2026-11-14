# Prueba en navegador (Chromium sin pantalla) del hierro de pantano (P10, 14 nov). En el mundo de verdad (Whitholm),
# sin servidor, en PC (1280×800) y móvil (390×844):
#   - en la vega del río de cerca de la salida hay una mancha de tierra encharcada con agua rojiza, y se ve: la turba y
#     la juncia (lo que se queda) y los charcos de agua color óxido (lo que se va);
#   - sin la pala de madera y la criba, Usar no saca nada (y lo dice);
#   - con la pala en una mano y la criba en la otra (que se ven en las manos), Usar criba: 1 mineral de hierro que queda
#     en el suelo junto a la mancha, y el montoncito crece con cada pasada;
#   - a la última pasada la mancha se agota: los charcos se van y la turba y la juncia se quedan;
#   - sin errores en la página.
# Capturas de cerca de la mancha (dos vistas), del jugador cribando con la pala y la criba, y de la mancha agotada.
# Uso: python3 pruebas/prueba_hierro_pantano_navegador.py <html> <carpeta_capturas>
# Rota a propósito (14 nov): MUTAR=1 deja los charcos siempre puestos (como si la mancha no se agotara): falla.
import sys, os
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_hierro_pantano'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=184596,46280&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
MANCHA = (-9, -802)   # (escena) la mancha de hierro de pantano más cercana a la salida, en la vega del río (mirado con la lógica)
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

def mirar(pg, x, z, d=3.4, pitch=0.42, yaw=0.6, lejos=1.7):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + {lejos}; k.pj.z = z + 0.6; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); k.cam.dist = {d}; k.cam.pitch = {pitch}; k.cam.yaw = {yaw}; }}', [x, z])
    pg.wait_for_timeout(2500)

VIS = f"(id) => {{ const k = {K}, rec = k.recoleccion, lista = rec.puntos.filter(p => p.tipo === 'hierro_pantano'), i = lista.findIndex(p => p.id === id), m = new k.camara.matrixWorld.constructor(); const r = {{ planta: false, agua: false }}; rec.grupo.children.filter(c => c.name.startsWith('recoger_hierro_pantano')).forEach(c => {{ c.getMatrixAt(i, m); const v = Math.abs(m.determinant()) > 1e-12; if (c.name.endsWith('_planta')) r.planta = r.planta || v; else r.agua = r.agua || v; }}); return r; }}"
MINERAL = f"(([x, z]) => {K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => o.cosa.tipo === 'mineral_hierro' && Math.hypot(o.x - x, o.z - z) < 2).reduce((s, o) => s + o.cosa.n, 0))"

def manos(pg, tipos):
    pg.evaluate(f"(t) => {{ const k = {K}, inv = k.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) inv.sacar(l); if (t[0]) inv.coger(t[0], 1, 'mano:der'); if (t[1]) inv.coger(t[1], 1, 'mano:izq'); k.pintarTodoInventario(); k.vestir(); }}", tipos)

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 3; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }}', list(MANCHA))
    esperar(pg, 4000)
    try: pg.wait_for_function(f"{K}.recoleccion.puntos.some(p => p.tipo === 'hierro_pantano' && Math.hypot(p.x - ({MANCHA[0]}), p.z - ({MANCHA[1]})) < 3)", timeout=240000)
    except Exception: pass
    m = pg.evaluate(f"(() => {{ const l = {K}.recoleccion.puntos.filter(p => p.tipo === 'hierro_pantano').sort((a, b) => Math.hypot(a.x - {MANCHA[0]}, a.z - {MANCHA[1]}) - Math.hypot(b.x - {MANCHA[0]}, b.z - {MANCHA[1]})); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()")
    comprobar(f'{nombre}: en la vega del río hay una mancha de hierro de pantano', bool(m) and abs(m['x'] - MANCHA[0]) < 3, str(m))
    if not m: return
    if MUTAR: pg.evaluate(f"{K}.recoleccion.grupo.children.filter(c => c.name === 'recoger_hierro_pantano').forEach(c => c.name = 'recoger_hierro_pantano_planta')")
    manos(pg, [None, None])
    mirar(pg, m['x'], m['z'])
    v = pg.evaluate(VIS, m['id'])
    comprobar(f'{nombre}: se ven la turba, la juncia y los charcos de agua rojiza', v['planta'] and v['agua'], str(v))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_mancha.png', timeout=180000)
    mirar(pg, m['x'], m['z'], d=6.5, pitch=0.62, yaw=2.4, lejos=2.6)
    pg.screenshot(path=f'{SALIDA}/{pref}_2_mancha_lejos.png', timeout=180000)
    # sin pala ni criba
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.3; k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); }}', [m['x'], m['z']]); pg.wait_for_timeout(600)
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: sin pala ni criba, Usar no saca nada', pg.evaluate(MINERAL, [m['x'], m['z']]) == 0)
    # con la pala y la criba
    manos(pg, ['pala_madera', 'criba'])
    pasadas = 0
    for k in range(8):
        pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.3; k.pj.rot = Math.atan2(x - k.pj.x, z - k.pj.z); }}', [m['x'], m['z']]); pg.wait_for_timeout(500)
        if k == 0:
            pg.evaluate(f'(() => {{ const k = {K}; k.cam.dist = 3.0; k.cam.pitch = 0.3; k.cam.yaw = k.pj.rot + Math.PI * 0.75; }})()'); pg.wait_for_timeout(2000)
            pg.screenshot(path=f'{SALIDA}/{pref}_3_cribando.png', timeout=180000)
        antes = pg.evaluate(MINERAL, [m['x'], m['z']])
        pg.keyboard.press('f'); pg.wait_for_timeout(1500)
        despues = pg.evaluate(MINERAL, [m['x'], m['z']])
        if despues != antes + 1: break
        pasadas += 1
        if pasadas == 1:
            comprobar(f'{nombre}: con la pala y la criba, Usar criba: 1 mineral de hierro junto a la mancha', despues == 1, f'{despues}')
            comprobar(f'{nombre}: y la mancha sigue (le quedan pasadas)', pg.evaluate(VIS, m['id'])['agua'])
    comprobar(f'{nombre}: de 3 a 5 pasadas, el montoncito crece con cada una', 3 <= pasadas <= 5 and pg.evaluate(MINERAL, [m['x'], m['z']]) == pasadas, f'{pasadas}')
    v = pg.evaluate(VIS, m['id'])
    comprobar(f'{nombre}: agotada, los charcos se van y la turba y la juncia se quedan', v['planta'] and not v['agua'], str(v))
    manos(pg, [None, None])
    mirar(pg, m['x'], m['z'])
    pg.screenshot(path=f'{SALIDA}/{pref}_4_mancha_agotada.png', timeout=180000)
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
