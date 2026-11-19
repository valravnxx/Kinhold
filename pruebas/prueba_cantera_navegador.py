# Prueba en navegador (Chromium sin pantalla) de la cantera (P10, 19 nov): las rocas grandes del mundo (las de más de
# 1,1 m, las que el mazo no puede) se rompen con el pico. En el mundo de verdad (Whitholm), sin servidor, en PC
# (1280×800) y móvil (390×844):
#   - cerca de la salida hay una roca grande (de las de la vegetación), se ve en la malla y estorba;
#   - con el mazo de piedra en la mano, Usar no la rompe (dice que hace falta el pico);
#   - con el pico en la mano (se ve en la mano), Usar la rompe a golpes (los anima como al talar): la roca desaparece
#     (ni en la malla ni estorbando), quedan sus cascotes y, en el suelo, sus bloques de piedra en bruto (en un montón a
#     un lado, que se ve) y sus piedras sueltas;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_cantera_navegador.py <html> <carpeta_capturas>
# Rota a propósito (19 nov): con MUTAR=1 la vegetación no mira lo roto (decorado.rocaEnPie siempre true), y falla.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_cantera'
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
    pg.wait_for_timeout(1000)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(1500)

# una roca grande (de más de 1,1 m) en pie sin árboles a menos de 5 m ni nada que se recoja o se desbroce al lado, en
# llano (para la cámara)
ROCA = f"""(() => {{ const k = {K}, d = k.decorado; const l = d.rocasCerca(k.pj.x, k.pj.z, 60).filter(r => r.tam * 2.2 > 1.1 && r.tam < 0.9 && Math.abs(k.alturaSuelo(r.x + 3, r.z) - k.alturaSuelo(r.x - 3, r.z)) < 1.2 && !d.obstaculos.some(o => o.arbol && Math.hypot(o.x - r.x, o.z - r.z) < 5) && !k.recoleccion.puntos.some(p => Math.hypot(p.x - r.x, p.z - r.z) < 3.5) && !(d.matasCerca(r.x, r.z, 3).length) && !d.rocasCerca(r.x, r.z, 3).some(q => q.id !== r.id)).sort((a, b) => a.tam - b.tam);   // (la más chica de las grandes: menos golpes)
  return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z, tam: l[0].tam }} : null; }})()"""
def buscar_roca(pg):
    for dx, dz in [(0, 0), (60, 0), (0, 60), (-60, 0), (0, -60), (120, 0), (0, 120), (-120, 0), (0, -120)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            esperar(pg)
        r = pg.evaluate(ROCA)
        if r: return r
    return None

def ir(pg, p, dist=4.6, pitch=0.45):
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

def tener(pg, tipo):
    return pg.evaluate(f"(() => {{ const i = {K}.inventario; i.sacar('mano:der'); const r = i.coger('{tipo}', 1, 'mano:der'); {K}.pintarTodoInventario(); return r; }})()")

def en_mano(pg, tipo):
    return pg.evaluate(f"(() => {{ let v = false; {K}.jugador.raiz.traverse(o => {{ if (o.name === '{tipo}' && o.visible) v = true; }}); return v; }})()")

BLOQUES_SE_VEN = f"([x, z]) => {K}.sueloObjetos.grupo.children.filter(o => o.name === 'suelo_bloque_piedra' && Math.hypot(o.position.x - x, o.position.z - z) < 3).length"

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    if MUTAR: pg.evaluate(f'{K}.decorado.rocaEnPie = () => true')
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    r = buscar_roca(pg)
    comprobar(f'{nombre}: hay una roca grande cerca de la salida', bool(r), str(r))
    if not r: return
    ir(pg, r)
    xz = [r['x'], r['z']]
    comprobar(f'{nombre}: junto a ella, se ve en la malla y estorba', pg.evaluate(EN_MALLA, xz + ['rocas']) == 1 and pg.evaluate(ESTORBA, xz))
    res = tener(pg, 'mazo_piedra'); esperar(pg, 800)
    pg.keyboard.press('f'); pg.wait_for_timeout(800)
    comprobar(f'{nombre}: con el mazo, Usar no la rompe (es grande)', res.get('ok') and not pg.evaluate(ROMPIENDO) and pg.evaluate(EN_MALLA, xz + ['rocas']) == 1, str(res))
    res = tener(pg, 'pico')
    comprobar(f'{nombre}: (el pico en la mano)', res.get('ok'), str(res))
    esperar(pg, 1500)
    comprobar(f'{nombre}: el pico se ve en la mano', en_mano(pg, 'pico'))
    rc = pg.evaluate(f'{K}.rocaCercana()')
    comprobar(f'{nombre}: es la roca que se rompe al lado', bool(rc) and rc['id'] == r['id'], str(rc))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_roca_grande_y_pico.png', timeout=180000)
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: con el pico, Usar se pone a romperla (a golpes, como al talar)', pg.evaluate(ROMPIENDO))
    pg.screenshot(path=f'{SALIDA}/{pref}_2_rompiendo.png', timeout=180000)
    try: pg.wait_for_function(f'!({ROMPIENDO})', timeout=1500000)   # (sin tarjeta gráfica, cada golpe tarda)
    except Exception: pass
    esperar(pg, 2000)
    piedras, bloques = pg.evaluate(EN_SUELO.replace('< 1)', '< 3)'), xz + ['piedra']), pg.evaluate(EN_SUELO.replace('< 1)', '< 3)'), xz + ['bloque_piedra'])
    comprobar(f'{nombre}: la roca desaparece (ni en la malla ni estorbando)', pg.evaluate(EN_MALLA, xz + ['rocas']) == 0 and not pg.evaluate(ESTORBA, xz))
    comprobar(f'{nombre}: quedan sus cascotes', pg.evaluate(EN_MALLA, xz + ['cascotes']) >= 7)
    comprobar(f'{nombre}: y en el suelo, sus bloques de piedra en bruto (de 1 a 4) y sus piedras (de 10 a 30)', 1 <= bloques <= 4 and 10 <= piedras <= 30, f'{bloques} bloques, {piedras} piedras')
    v = pg.evaluate(BLOQUES_SE_VEN, xz)
    comprobar(f'{nombre}: los bloques se ven en el suelo (su montón)', v == 1, str(v))
    pg.screenshot(path=f'{SALIDA}/{pref}_3_roca_rota.png', timeout=180000)
    # de cerca, el montón de bloques
    b = pg.evaluate(f"([x, z]) => {{ const o = {K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'bloque_piedra' && Math.hypot(o.x - x, o.z - z) < 3); return o ? [o.x, o.z] : null; }}", xz)
    if b:
        pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 1.6; k.pj.z = z + 0.4; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.cam.dist = 2.4; k.cam.pitch = 0.5; k.cam.yaw = Math.PI / 2 + 0.6; }}', b)
        esperar(pg, 1500)
        pg.screenshot(path=f'{SALIDA}/{pref}_4_bloques_de_cerca.png', timeout=180000)
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
