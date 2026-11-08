# Prueba en navegador (Chromium sin pantalla) de desbrozar (valravnx, 8 nov: «los arbustos… si te molestan o te hacen
# falta ramas, pues los puedas destruir con un hacha»). En el mundo de verdad (Whitholm), sin servidor, en PC
# (1280×800) y móvil (390×844):
#   - cerca de la salida hay matorrales (de los de la vegetación), y junto a uno se ve su ejemplar en la malla;
#   - sin hacha ni lasca, Usar no lo desbroza (y el menú del clic derecho lo ofrece igual, con el aviso de qué falta);
#   - con el hacha de piedra en la mano, Usar da unos golpes (los anima como al talar) y el matorral desaparece: ya no
#     está en la malla ni estorba, y en el suelo, donde estaba, quedan de 2 a 4 ramas (y a veces una vara);
#   - lo desbrozado se queda desbrozado al recargar la página (guardado en el navegador);
#   - un arbusto de bayas también se desbroza: se van el arbusto y sus bayas;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_desbroce_navegador.py <html> <carpeta_capturas>
# Rota a propósito (8 nov): con la vegetación sin mirar lo desbrozado (decorado.mataEnPie siempre true), falla.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_desbroce'
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
    pg.wait_for_timeout(1000)

# un matorral en pie con ningún árbol a menos de 3,5 m (así Usar no tala) ni nada que se recoja al lado
MATA = f"""(() => {{ const k = {K}, d = k.decorado; const l = d.matasCerca(k.pj.x, k.pj.z, 60).filter(m => !d.obstaculos.some(o => o.arbol && Math.hypot(o.x - m.x, o.z - m.z) < 3.5) && !k.recoleccion.puntos.some(p => Math.hypot(p.x - m.x, p.z - m.z) < 2.5));
  return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()"""
def buscar_mata(pg):
    for dx, dz in [(0, 0), (60, 0), (0, 60), (-60, 0), (0, -60), (120, 0), (0, 120), (-120, 0), (0, -120)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            pg.wait_for_timeout(2500)
            try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
            except Exception: pass
            pg.wait_for_timeout(1500)
        m = pg.evaluate(MATA)
        if m: return m
    return None

def ir(pg, p, dist=3.6, pitch=0.45):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.7; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = Math.atan2(0.9, 0.7) + 0.5; }}', [p['x'], p['z']])
    pg.wait_for_timeout(1500)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(2500)

# si hay un ejemplar de la malla de los matorrales puesto en (x, z)
EN_MALLA = f"""([x, z]) => {{ const k = {K}; const im = k.decorado.raiz.children.find(c => c.name === 'matorrales'); if (!im) return false;
  const m = new k.camara.matrixWorld.constructor(), v = new k.camara.position.constructor();
  for (let i = 0; i < im.count; i++) {{ im.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-9) continue; v.setFromMatrixPosition(m); if (Math.hypot(v.x - x, v.z - z) < 0.05) return true; }}
  return false; }}"""
ESTORBA = f"([x, z]) => {K}.decorado.obstaculos.some(o => o.mata && !o.oculto && Math.hypot(o.x - x, o.z - z) < 0.05)"
EN_SUELO = f"([x, z, t]) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t && Math.hypot(o.x - x, o.z - z) < 1).reduce((n, o) => n + o.cosa.n, 0)"

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    m = buscar_mata(pg)
    comprobar(f'{nombre}: hay matorrales cerca de la salida', bool(m), str(m))
    if not m: return
    ir(pg, m)
    xz = [m['x'], m['z']]
    comprobar(f'{nombre}: junto a uno, se ve en la malla y estorba', pg.evaluate(EN_MALLA, xz) and pg.evaluate(ESTORBA, xz))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_matorral.png', timeout=180000)
    # sin herramienta
    pg.evaluate(f'{K}.usar()'); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: sin hacha ni lasca, Usar no lo desbroza', not pg.evaluate(f'!!({K}.estado.talando && {K}.estado.talando.desbroce)') and pg.evaluate(EN_MALLA, xz))
    db = pg.evaluate(f'{K}.desbrozableCercano()')
    comprobar(f'{nombre}: es lo que se desbroza al lado', bool(db) and db['id'] == m['id'], str(db))
    # con el hacha de piedra en la mano
    r = pg.evaluate(f"{K}.inventario.coger('hacha_piedra', 1, 'mano:der')")
    comprobar(f'{nombre}: (un hacha de piedra en la mano)', r.get('ok'), str(r))
    pg.keyboard.press('f'); pg.wait_for_timeout(700)
    golpeando = pg.evaluate(f'!!({K}.estado.talando && {K}.estado.talando.desbroce)')
    pg.screenshot(path=f'{SALIDA}/{pref}_2_desbrozando.png', timeout=180000)
    comprobar(f'{nombre}: con el hacha, Usar se pone a desbrozar (a golpes, como al talar)', golpeando)
    try: pg.wait_for_function(f'!({K}.estado.talando && {K}.estado.talando.desbroce)', timeout=150000)   # (sin tarjeta gráfica, en PC, cada golpe tarda unos segundos)
    except Exception: pass
    pg.wait_for_timeout(2500)
    ramas, varas = pg.evaluate(EN_SUELO, xz + ['rama']), pg.evaluate(EN_SUELO, xz + ['vara'])
    comprobar(f'{nombre}: el matorral desaparece (ni en la malla ni estorbando)', not pg.evaluate(EN_MALLA, xz) and not pg.evaluate(ESTORBA, xz))
    comprobar(f'{nombre}: y donde estaba quedan de 2 a 4 ramas (y como mucho una vara)', 2 <= ramas <= 4 and varas <= 1, f'{ramas} ramas, {varas} varas')
    pg.screenshot(path=f'{SALIDA}/{pref}_3_desbrozado.png', timeout=180000)
    # lo desbrozado se queda al recargar
    entrar(pg)
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.7; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }}', xz)
    pg.wait_for_timeout(2500)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: al recargar la página sigue desbrozado', not pg.evaluate(EN_MALLA, xz))
    # el arbusto de bayas
    b = None
    for dx, dz in [(0, 0), (60, 0), (0, 60), (-60, 0), (0, -60), (120, 0), (0, 120), (-120, 0), (0, -120), (180, 0)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            pg.wait_for_timeout(2000)
            try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=120000)
            except Exception: pass
        b = pg.evaluate(f"(() => {{ const k = {K}; const l = k.recoleccion.arbustosCerca(k.pj.x, k.pj.z, 200); return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()")
        if b: break
    if b:
        ir(pg, b)
        VIS = f"(id) => {{ const k = {K}, rec = k.recoleccion, lista = rec.puntos.filter(p => p.tipo === 'bayas'), i = lista.findIndex(p => p.id === id), m = new k.camara.matrixWorld.constructor(); const r = {{}}; rec.grupo.children.filter(c => c.name.startsWith('recoger_bayas')).forEach(c => {{ c.getMatrixAt(i, m); r[c.name] = Math.abs(m.determinant()) > 1e-9; }}); return r; }}"
        antes = pg.evaluate(VIS, b['id'])
        pg.evaluate(f"(b) => {K}.empezarDesbroce({{ ...b, tipo: 'bayas' }})", b)
        try: pg.wait_for_function(f'!({K}.estado.talando && {K}.estado.talando.desbroce)', timeout=150000)   # (sin tarjeta gráfica, en PC, cada golpe tarda unos segundos)
        except Exception: pass
        pg.wait_for_timeout(1500)
        despues = pg.evaluate(VIS, b['id'])
        comprobar(f'{nombre}: un arbusto de bayas también se desbroza: se van el arbusto y sus bayas', antes.get('recoger_bayas_planta') and not any(despues.values()), f'{antes} → {despues}')
        pg.screenshot(path=f'{SALIDA}/{pref}_4_arbusto_bayas_desbrozado.png', timeout=180000)
    else:
        comprobar(f'{nombre}: hay un arbusto de bayas cerca', False)
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
