# Prueba en navegador (Chromium sin pantalla) de las vetas de hierro en la roca (P10, 19 nov). En el mundo de verdad
# (Whitholm), sin servidor, empezando a 8 m de la veta pequeña de hierro de la pradera de Motdale (la de 51 m de alto,
# src/logica/vetas_hierro.js), en PC (1280×800) y móvil (390×844):
#   - la veta se ve: el afloramiento de roca rojiza (con su suelo de óxido) y los terrones de mineral al pie; estorba;
#   - sin pico en la mano no sale nada que hacer con ella; con el pico en la mano (se ve), Usar la pica a golpes (con
#     el gesto de talar) y cada 5 golpes suelta 1 mineral de hierro al suelo, junto a la veta, que se ve;
#   - agotada, los terrones se van y el afloramiento se queda;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_veta_hierro_navegador.py <html> <carpeta_capturas>
# Rota a propósito (19 nov): con MUTAR=1 la veta no se encuentra al lado (vetasCerca siempre vacío), y falla.
import sys, os
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_veta'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
VETA = (196434, 57418)   # (la veta de la pradera de Motdale; la salida, 8 m al oeste)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida={VETA[0] - 8},{VETA[1]}&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
GIRO = [0.75]
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

LA_VETA = f"(() => {{ const p = {K}.recoleccion.puntos.find(p => p.tipo === 'veta_hierro'); return p ? {{ id: p.id, x: p.x, z: p.z }} : null; }})()"
# los ejemplares que se ven de una malla de la recolección cerca de (x, z)
SE_VE = f"""([x, z, nombre]) => {{ const k = {K}; const g = k.recoleccion.grupo; let n = 0;
  const m = new k.camara.matrixWorld.constructor(), v = new k.camara.position.constructor();
  for (const im of g.children.filter(c => c.name === nombre)) for (let i = 0; i < im.count; i++) {{ im.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-12) continue; v.setFromMatrixPosition(m); if (Math.hypot(v.x - x, v.z - z) < 0.5) n++; }}
  return n; }}"""
ESTORBA = f"([x, z]) => {K}.decorado.obstaculos.some(o => o.vetaHierro && Math.hypot(o.x - x, o.z - z) < 0.05)"
EN_SUELO = f"([x, z]) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'mineral_hierro' && Math.hypot(o.x - x, o.z - z) < 2.5).reduce((n, o) => n + o.cosa.n, 0)"
MINERAL_SE_VE = f"([x, z]) => {K}.sueloObjetos.grupo.children.filter(o => o.name === 'suelo_mineral_hierro' && Math.hypot(o.position.x - x, o.position.z - z) < 2.5).length"
PICANDO = f'!!({K}.estado.talando && {K}.estado.talando.picado)'

def tener(pg, tipo):
    return pg.evaluate(f"(() => {{ const i = {K}.inventario; i.sacar('mano:der'); const r = i.coger('{tipo}', 1, 'mano:der'); {K}.pintarTodoInventario(); return r; }})()")
def soltar_mano(pg):
    pg.evaluate(f"(() => {{ const i = {K}.inventario; i.sacar('mano:der'); {K}.pintarTodoInventario(); }})()")
def en_mano(pg, tipo):
    return pg.evaluate(f"(() => {{ let v = false; {K}.jugador.raiz.traverse(o => {{ if (o.name === '{tipo}' && o.visible) v = true; }}); return v; }})()")

def ir(pg, v, dist=5.2, pitch=0.42, lado=2.45, giro=None):
    g = GIRO[0] if giro is None else giro
    pg.evaluate(f'([x, z, d]) => {{ const k = {K}; k.pj.x = x + d; k.pj.z = z; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = Math.PI / 2 + {g}; }}', [v['x'], v['z'], lado])
    esperar(pg)

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    if MUTAR: pg.evaluate(f'{K}.recoleccion.vetasCerca = () => []')
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    v = pg.evaluate(LA_VETA)
    comprobar(f'{nombre}: la veta de hierro está en el mundo, a unos 8 m de la salida', bool(v) and 6 < (v['x'] ** 2 + v['z'] ** 2) ** 0.5 < 10, str(v))
    if not v: return
    xz = [v['x'], v['z']]
    ir(pg, v, dist=7.5, pitch=0.38, lado=4.5)
    pg.screenshot(path=f'{SALIDA}/{pref}_1_veta_de_lejos.png', timeout=180000)
    ir(pg, v)
    roca, terrones = pg.evaluate(SE_VE, xz + ['recoger_veta_hierro_planta']), pg.evaluate(SE_VE, xz + ['recoger_veta_hierro'])
    comprobar(f'{nombre}: se ve el afloramiento rojizo (y su suelo de óxido) y los terrones de mineral', roca >= 2 and terrones >= 1, f'{roca} piezas del afloramiento, {terrones} de terrones')
    comprobar(f'{nombre}: el afloramiento estorba (no se atraviesa)', pg.evaluate(ESTORBA, xz))
    soltar_mano(pg); esperar(pg, 600)
    pg.keyboard.press('f'); pg.wait_for_timeout(800)
    comprobar(f'{nombre}: sin pico en la mano, Usar no la pica', not pg.evaluate(PICANDO))
    pg.evaluate(f"(() => {{ const k = {K}; k.estado.talando = null; }})()")
    res = tener(pg, 'pico'); esperar(pg, 1500)
    comprobar(f'{nombre}: (el pico en la mano, y se ve)', res.get('ok') and en_mano(pg, 'pico'), str(res))
    vc = pg.evaluate(f'{K}.vetaCercana()')
    comprobar(f'{nombre}: con el pico, la veta de al lado es la que se pica', bool(vc) and vc['id'] == v['id'], str(vc))
    pg.screenshot(path=f'{SALIDA}/{pref}_2_veta_y_pico.png', timeout=180000)
    pg.keyboard.press('f'); pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: Usar se pone a picarla (a golpes, como al talar)', pg.evaluate(PICANDO))
    pg.screenshot(path=f'{SALIDA}/{pref}_3_picando.png', timeout=180000)
    try: pg.wait_for_function(f'{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === "mineral_hierro")', timeout=900000)
    except Exception: pass
    esperar(pg, 1500)
    n = pg.evaluate(EN_SUELO, xz)
    comprobar(f'{nombre}: a los 5 golpes suelta 1 mineral de hierro al suelo, junto a la veta, y sigue picando', n == 1 and pg.evaluate(PICANDO), str(n))
    comprobar(f'{nombre}: el mineral se ve en el suelo', pg.evaluate(MINERAL_SE_VE, xz) == 1)
    pg.evaluate(f"(() => {{ const k = {K}; k.estado.talando = null; }})()")
    pg.screenshot(path=f'{SALIDA}/{pref}_4_mineral_suelto.png', timeout=180000)
    # agotarla: lo que le queda, de una vez (las pasadas, de 30 a 40, tardarían demasiado sin tarjeta gráfica)
    pg.evaluate(f"""(id) => {{ const k = {K}, r = k.recoleccion.rec; r.estado[id] = {{ vuelve: Date.now() + 90 * 864e5, veces: 1 }}; k.recoleccion.refrescar(); }}""", v['id'])
    esperar(pg, 1000)
    roca2, terrones2 = pg.evaluate(SE_VE, xz + ['recoger_veta_hierro_planta']), pg.evaluate(SE_VE, xz + ['recoger_veta_hierro'])
    comprobar(f'{nombre}: agotada, los terrones se van y el afloramiento se queda', roca2 == roca and terrones2 == 0, f'{roca2}, {terrones2}')
    pg.keyboard.press('f'); pg.wait_for_timeout(800)
    comprobar(f'{nombre}: y agotada no se pica', not pg.evaluate(PICANDO))
    ir(pg, v, dist=4.2, pitch=0.5, lado=2.45)
    pg.screenshot(path=f'{SALIDA}/{pref}_5_agotada.png', timeout=180000)
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        GIRO[0] = 0.3 if movil else 0.75
        recorrido(ctx.new_page(), nombre, pref)
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
