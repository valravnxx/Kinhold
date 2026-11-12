# Prueba en navegador (Chromium sin pantalla) del mazo de piedra y romper rocas (valravnx, 8 nov: «imagínate construir
# un castillo corriendo por ahí, rebuscando entre piedrecitas del suelo»). En el mundo de verdad (Whitholm), sin
# servidor, en PC (1280×800) y móvil (390×844):
#   - cerca de la salida hay rocas medianas (de las de la vegetación) y junto a una se ve en la malla y estorba;
#   - sin el mazo, Usar no la rompe; con el mazo de piedra en la mano, se ve en la mano y Usar la rompe a golpes (los
#     anima como al talar): la roca desaparece (ni en la malla ni estorbando), quedan sus cascotes y, en el suelo donde
#     estaba, sus piedras sueltas (de 6 a 25);
#   - lo roto se queda roto al recargar la página (guardado en el navegador);
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_rocas_navegador.py <html> <carpeta_capturas>
# Rota a propósito (8 nov): con la vegetación sin mirar lo roto (decorado.rocaEnPie siempre true), falla.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_rocas'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg):
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=180000)
    except Exception: pass
    if MUTAR: pg.evaluate(f'{K}.decorado.rocaEnPie = () => true')
    pg.wait_for_timeout(1000)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(1500)

# una roca mediana en pie sin árboles a menos de 4 m ni nada que se recoja o se desbroce al lado
ROCA = f"""(() => {{ const k = {K}, d = k.decorado; const l = d.rocasCerca(k.pj.x, k.pj.z, 60).filter(r => !d.obstaculos.some(o => o.arbol && Math.hypot(o.x - r.x, o.z - r.z) < 4) && !k.recoleccion.puntos.some(p => Math.hypot(p.x - r.x, p.z - r.z) < 3) && !(d.matasCerca(r.x, r.z, 2.5).length)).sort((a, b) => a.tam - b.tam);   // (la más chica: menos golpes, que sin tarjeta gráfica tardan)
  return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, tam: l[0].tam }} : null; }})()"""
def buscar_roca(pg):
    for dx, dz in [(0, 0), (60, 0), (0, 60), (-60, 0), (0, -60), (120, 0), (0, 120), (-120, 0), (0, -120)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            esperar(pg)
        r = pg.evaluate(ROCA)
        if r: return r
    return None

def ir(pg, p, dist=3.4, pitch=0.42):
    d = p['tam'] * 1.1 + 0.55
    pg.evaluate(f'([x, z, d]) => {{ const k = {K}; k.pj.x = x + d; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = Math.PI / 2 + 0.75; }}', [p['x'], p['z'], d])
    esperar(pg)

EN_MALLA = f"""([x, z, nombre]) => {{ const k = {K}; const im = k.decorado.raiz.children.find(c => c.name === nombre); if (!im) return 0;
  const m = new k.camara.matrixWorld.constructor(), v = new k.camara.position.constructor(); let n = 0;
  for (let i = 0; i < im.count; i++) {{ im.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-12) continue; v.setFromMatrixPosition(m); if (Math.hypot(v.x - x, v.z - z) < (nombre === 'rocas' ? 0.05 : 1.2)) n++; }}
  return n; }}"""
ESTORBA = f"([x, z]) => {K}.decorado.obstaculos.some(o => o.veg && !o.arbol && !o.mata && Math.hypot(o.x - x, o.z - z) < 0.05)"
EN_SUELO = f"([x, z, t]) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t && Math.hypot(o.x - x, o.z - z) < 1).reduce((n, o) => n + o.cosa.n, 0)"
ROMPIENDO = f'!!({K}.estado.talando && {K}.estado.talando.rotura)'

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    r = buscar_roca(pg)
    comprobar(f'{nombre}: hay rocas medianas cerca de la salida', bool(r), str(r))
    if not r: return
    ir(pg, r)
    xz = [r['x'], r['z']]
    comprobar(f'{nombre}: junto a una, se ve en la malla y estorba', pg.evaluate(EN_MALLA, xz + ['rocas']) == 1 and pg.evaluate(ESTORBA, xz))
    pg.evaluate(f'{K}.usar()'); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: sin el mazo, Usar no la rompe', not pg.evaluate(ROMPIENDO) and pg.evaluate(EN_MALLA, xz + ['rocas']) == 1)
    rc = pg.evaluate(f'{K}.rocaCercana()')
    comprobar(f'{nombre}: es la roca que se rompe al lado', bool(rc) and rc['id'] == r['id'], str(rc))
    res = pg.evaluate(f"(() => {{ const r = {K}.inventario.coger('mazo_piedra', 1, 'mano:der'); {K}.pintarTodoInventario(); return r; }})()")
    comprobar(f'{nombre}: (el mazo de piedra en la mano)', res.get('ok'), str(res))
    esperar(pg, 1500)
    comprobar(f'{nombre}: el mazo se ve en la mano', pg.evaluate(f"(() => {{ let v = false; {K}.jugador.raiz.traverse(o => {{ if (o.name === 'mazo_piedra' && o.visible) v = true; }}); return v; }})()"))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_roca_y_mazo.png', timeout=180000)
    # de cerca, el mazo en la mano
    pg.evaluate(f'{K}.cam.dist = 1.6; {K}.cam.pitch = 0.2;'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SALIDA}/{pref}_2_mazo_de_cerca.png', timeout=180000)
    pg.evaluate(f'{K}.cam.dist = 3.4; {K}.cam.pitch = 0.42;')
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: con el mazo, Usar se pone a romperla (a golpes, como al talar)', pg.evaluate(ROMPIENDO))
    pg.screenshot(path=f'{SALIDA}/{pref}_3_rompiendo.png', timeout=180000)
    try: pg.wait_for_function(f'!({ROMPIENDO})', timeout=900000)   # (sin tarjeta gráfica, cada golpe tarda)
    except Exception: pass
    esperar(pg, 2000)
    piedras = pg.evaluate(EN_SUELO, xz + ['piedra'])
    comprobar(f'{nombre}: la roca desaparece (ni en la malla ni estorbando)', pg.evaluate(EN_MALLA, xz + ['rocas']) == 0 and not pg.evaluate(ESTORBA, xz))
    comprobar(f'{nombre}: quedan sus cascotes', pg.evaluate(EN_MALLA, xz + ['cascotes']) >= 7)
    comprobar(f'{nombre}: y donde estaba, sus piedras sueltas (de 6 a 25)', 6 <= piedras <= 25, f'{piedras} piedras')
    pg.screenshot(path=f'{SALIDA}/{pref}_4_roca_rota.png', timeout=180000)
    entrar(pg)
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 1.5; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }}', xz)
    esperar(pg)
    comprobar(f'{nombre}: al recargar la página sigue rota', pg.evaluate(EN_MALLA, xz + ['rocas']) == 0 and pg.evaluate(EN_MALLA, xz + ['cascotes']) >= 7)
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
