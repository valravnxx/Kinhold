# Prueba en navegador (Chromium sin pantalla) de los avisos de las necesidades (P4; src/juego/avisos_necesidades.js).
# En el mundo de verdad (Whitholm), sin servidor: las necesidades se ponen como si llegaran del servidor
# (__kinhold.ponerNecesidades; solo se dibujan y se notan en esta página). En PC (1280×800) y móvil (390×844):
#   - sin necesidades, ningún círculo; con sed 50, hambre 30 y cansancio 80, salen el de la sed y el del cansancio (desde
#     40), el del cansancio en fuerte (desde 75), cada uno con su color; el hambre a 30, no;
#   - los círculos no tapan los botones (los de modo, «Usar», los de arriba) y caben en la pantalla;
#   - al pulsar el de la sed, su ficha: cómo estás (50 %), qué te pasa y cómo se quita (beber del río); se cierra al
#     pulsar fuera;
#   - los efectos: con el cansancio al máximo no se corre (Mayúsculas + W: a paso de andar), sin él sí; con el frío al
#     máximo se anda más despacio (torpe);
#   - beber del río: en la salida no hay agua al lado; en una orilla, con sed, «Usar» bebe y la sed baja;
#   - descansar sentado (8 nov): la ficha del cansancio lleva el botón «Sentarte a descansar»; al pulsarlo se sienta
#     (con su animación, en el suelo) y su estado dice «sentado»; el botón pasa a «Levantarte»; al moverse se levanta.
#     En el PC, también con Z. Capturas del personaje sentado, de cerca, en PC y móvil;
#   - en inglés, la ficha sale en inglés;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_avisos_navegador.py <html> <carpeta_capturas>
# MUTAR=1: los avisos no se pintan nunca: tiene que fallar. MUTAR=2: rendido se sigue corriendo: tiene que fallar.
# MUTAR=3: sin la animación de sentarse (como si no hubiera cargado): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, json
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_avisos'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3', 'taller-dormir-v1', 'taller-sentarse-v1']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR')
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg, extra='&lang=es'):
    pg.goto(BASE + extra)
    pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    if MUTAR == '1': pg.evaluate(f'{K}.avisosNec.pintar = () => {{}}')
    pg.wait_for_timeout(1000)

def poner(pg, n):
    base = {'hambre': 0, 'sed': 0, 'frio': 0, 'cansancio': 0}; base.update(n)
    if MUTAR == '2': base['cansancio'] = min(base['cansancio'], 99)
    pg.evaluate(f'{K}.ponerNecesidades({json.dumps(base)})'); pg.wait_for_timeout(300)

def rect(pg, sel):
    return pg.evaluate(f"""(() => {{ const e = document.querySelector({json.dumps(sel)}); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }})()""")

def pisan(a, b):
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]

def velocidad(pg, teclas):
    for t in teclas: pg.keyboard.down(t)
    pg.wait_for_timeout(2500)
    v = pg.evaluate(f'{K}.pj.vel')
    for t in reversed(teclas): pg.keyboard.up(t)
    pg.wait_for_timeout(800)
    return v

def recorrido(pg, nombre, pref, movil):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    comprobar(f'{nombre}: sin necesidades, ningún círculo', pg.evaluate(f'{K}.avisosNec.visibles.length') == 0)
    poner(pg, {'sed': 50, 'hambre': 30, 'cansancio': 80})
    vis = pg.evaluate(f'{K}.avisosNec.visibles')
    comprobar(f'{nombre}: con sed 50, hambre 30 y cansancio 80 salen la sed y el cansancio (desde 40)', vis == ['sed', 'cansancio'], str(vis))
    fuerte = pg.evaluate("[...document.querySelectorAll('#avisosNec .aviso-nec')].filter(b => !b.hidden).map(b => [b.dataset.que, b.classList.contains('fuerte'), getComputedStyle(b).getPropertyValue('--c').trim()])")
    comprobar(f'{nombre}: el del cansancio, en fuerte (desde 75); cada uno con su color', fuerte == [['sed', False, '#3f7fd0'], ['cansancio', True, '#9a958c']], str(fuerte))
    W, H = pg.evaluate('[innerWidth, innerHeight]')
    circ = pg.evaluate("[...document.querySelectorAll('#avisosNec .aviso-nec')].filter(b => !b.hidden).map(b => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
    botones = pg.evaluate("[...document.querySelectorAll('#modos button, #acciones button, #menu button, #materiales, #btnFabricar')].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 12), [r.left, r.top, r.right, r.bottom]]; })")
    tapan = [b[0] for b in botones for c in circ if pisan(c, b[1])]
    comprobar(f'{nombre}: los círculos no tapan ningún botón y caben en la pantalla', not tapan and all(c[0] >= 0 and c[2] <= W and c[1] >= 0 and c[3] <= H for c in circ), f'tapan {tapan}' if tapan else str(circ))
    # la ficha de la sed
    pg.click('#avisosNec .aviso-nec[data-que="sed"]'); pg.wait_for_timeout(400)
    f = pg.evaluate("(() => { const f = document.getElementById('fichaNec'); return f.hidden ? null : f.textContent; })()")
    rf = rect(pg, '#fichaNec')
    comprobar(f'{nombre}: al pulsar la sed, su ficha: cómo estás, qué te pasa y cómo se quita (beber del río)', bool(f) and '50%' in f and 'beber' in f and 'río' in f, f)
    comprobar(f'{nombre}: la ficha cabe en la pantalla', bool(rf) and rf[0] >= 0 and rf[2] <= W and rf[1] >= 0 and rf[3] <= H, str(rf))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_ficha_sed.png', timeout=180000)
    pg.mouse.click(W * 0.3, H * 0.6); pg.wait_for_timeout(400)
    comprobar(f'{nombre}: se cierra al pulsar fuera', pg.evaluate("document.getElementById('fichaNec').hidden"))
    poner(pg, {'sed': 85, 'hambre': 60, 'frio': 45, 'cansancio': 100})
    pg.screenshot(path=f'{SALIDA}/{pref}_2_cuatro.png', timeout=180000)
    comprobar(f'{nombre}: con las cuatro, los cuatro círculos', pg.evaluate(f'{K}.avisosNec.visibles.length') == 4)
    # descansar sentado (8 nov): el botón de la ficha del cansancio
    if MUTAR == '3': pg.evaluate(f'(() => {{ const a = {K}.jugador.mh && {K}.jugador.mh.acciones; if (a) delete a.sentado; }})()')
    pg.evaluate("document.querySelector('#avisosNec .aviso-nec[data-que=\"cansancio\"]').click()"); pg.wait_for_timeout(400)   # (en fuerte late: nunca está quieto para el clic de Playwright)
    boton = pg.evaluate("(() => { const b = document.querySelector('#fichaNec .sentarse'); return b ? b.textContent : null; })()")
    comprobar(f'{nombre}: la ficha del cansancio lleva el botón para sentarse', bool(boton) and 'Sentarte' in boton, str(boton))
    rb = rect(pg, '#fichaNec .sentarse'); rf = rect(pg, '#fichaNec')
    comprobar(f'{nombre}: el botón cabe dentro de la ficha y la ficha en la pantalla', bool(rb) and bool(rf) and rb[0] >= rf[0] and rb[2] <= rf[2] and rb[3] <= rf[3] and rf[3] <= H and rf[0] >= 0 and rf[2] <= W, f'{rb} en {rf}')
    pg.click('#fichaNec .sentarse'); pg.wait_for_timeout(300)
    pg.evaluate(f"(() => {{ const m = {K}.jugador.mh; if (m) m.mezclador.update(2); }})()"); pg.wait_for_timeout(1500)
    st = pg.evaluate(f"({{ s: !!{K}.estado.sentado, modo: {K}.jugador.modo, boton: (document.querySelector('#fichaNec .sentarse') || {{}}).textContent || '' }})")
    comprobar(f'{nombre}: al pulsarlo se sienta, con su animación (en el suelo), y el botón pasa a «Levantarte»', st['s'] and st['modo'] == 'sentado' and 'Levantarte' in st['boton'], json.dumps(st, ensure_ascii=False))
    pg.screenshot(path=f'{SALIDA}/{pref}_4_sentado_ficha.png', timeout=180000)
    pg.mouse.click(W * 0.3, H * 0.6) if not movil else pg.evaluate("document.getElementById('fichaNec').hidden = true")
    pj = pg.evaluate(f'(() => {{ const k = {K}; return {{ x: k.pj.x, y: k.pj.y, z: k.pj.z, r: k.pj.rot }}; }})()')
    import math
    d = 2.6 if movil else 2.2
    cx, cz = pj['x'] + math.sin(pj['r'] + 0.9) * d, pj['z'] + math.cos(pj['r'] + 0.9) * d
    pg.evaluate(f"(() => {{ const K = {K}; Object.assign(K.camLibre, {{ activa: true, x: {cx}, y: {pj['y'] + 1.15}, z: {cz} }}); K.cam.yaw = {math.atan2(cx - pj['x'], cz - pj['z'])}; K.cam.pitch = 0.3; }})()")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{SALIDA}/{pref}_5_sentado_cerca.png', timeout=180000)
    pg.evaluate(f'{K}.camLibre.activa = false')
    if not movil:
        pg.keyboard.down('w'); pg.wait_for_timeout(500); pg.keyboard.up('w'); pg.wait_for_timeout(500)
        comprobar(f'{nombre}: al moverse se levanta', not pg.evaluate(f'!!{K}.estado.sentado') and pg.evaluate(f'{K}.jugador.modo') != 'sentado')
        pg.keyboard.press('z'); pg.wait_for_timeout(300)
        comprobar(f'{nombre}: con Z se sienta otra vez, y con Z se levanta', pg.evaluate(f'!!{K}.estado.sentado'))
        pg.keyboard.press('z'); pg.wait_for_timeout(300)
        comprobar(f'{nombre}: (levantado)', not pg.evaluate(f'!!{K}.estado.sentado'))
    else:
        pg.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))"); pg.wait_for_timeout(400)
        pg.evaluate("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))"); pg.wait_for_timeout(300)
        comprobar(f'{nombre}: al moverse se levanta', not pg.evaluate(f'!!{K}.estado.sentado'))
    if not movil:
        # los efectos: rendido no corre; descansado sí; helado, más despacio
        v_rendido = velocidad(pg, ['Shift', 'w'])
        poner(pg, {})
        v_corre = velocidad(pg, ['Shift', 'w'])
        v_anda = velocidad(pg, ['w'])
        poner(pg, {'frio': 100})
        v_helado = velocidad(pg, ['w'])
        poner(pg, {})
        comprobar(f'{nombre}: rendido no corre (a paso de andar); descansado, sí', v_corre > 5 and v_rendido < 4 and abs(v_rendido - v_anda) < 0.3, f'rendido {v_rendido:.2f}, descansado {v_corre:.2f}, andando {v_anda:.2f} m/s')
        comprobar(f'{nombre}: helado, anda más despacio', v_helado < v_anda * 0.85, f'{v_helado:.2f} contra {v_anda:.2f} m/s')
    if not movil:
        # beber del río (P4): junto al agua, con sed, «Usar» (la F) bebe; lejos del agua, no hay agua al lado
        comprobar(f'{nombre}: en la salida no hay agua al lado', pg.evaluate(f'{K}.aguaAlLado()') is False)
        o = pg.evaluate(f"""(() => {{ const k = {K}, a = (x, z) => k.mundoJ.aguaEn(x, z);
          for (let r = 5; r < 3000; r += 5) for (let i = 0; i < 48; i++) {{
            const x = Math.cos(i / 48 * 2 * Math.PI) * r, z = Math.sin(i / 48 * 2 * Math.PI) * r;
            if (a(x, z)) continue;
            for (const d of [1.5, 2.5]) for (let j = 0; j < 8; j++) if (a(x + Math.cos(j * Math.PI / 4) * d, z + Math.sin(j * Math.PI / 4) * d)) return {{ x, z }};
          }} return null; }})()""")
        comprobar(f'{nombre}: hay una orilla cerca de la salida', bool(o), str(o))
        if o:
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [o['x'], o['z']])
            pg.wait_for_function(f'{K}.mundoListo', timeout=300000)
            try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
            except Exception: pass
            pg.wait_for_timeout(1500)
            poner(pg, {'sed': 70})
            pg.keyboard.press('f'); pg.wait_for_timeout(600)
            sed = pg.evaluate(f'{K}.necesidades.sed')
            comprobar(f'{nombre}: junto al agua, con sed, «Usar» bebe: la sed baja', abs(sed - 40) < 0.5, f'{sed}')
            pg.screenshot(path=f'{SALIDA}/{pref}_3_beber.png', timeout=180000)
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        recorrido(ctx.new_page(), nombre, pref, movil)
        ctx.close()
    # en inglés
    ctx = nav.new_context(viewport={'width': 1280, 'height': 800})
    pg = ctx.new_page()
    entrar(pg, '&lang=en')
    poner(pg, {'sed': 60})
    pg.click('#avisosNec .aviso-nec[data-que="sed"]'); pg.wait_for_timeout(400)
    f = pg.evaluate("document.getElementById('fichaNec').textContent")
    comprobar('en inglés, la ficha sale en inglés', 'Thirst' in f and 'river' in f, f)
    ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
