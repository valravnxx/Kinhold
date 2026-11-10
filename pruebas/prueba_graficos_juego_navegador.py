# Prueba en navegador (Chromium sin pantalla) del perfil gráfico y el posprocesado en el juego (valravnx, 5 nov).
# En el mundo de verdad (Whitholm), sin servidor: el juego arranca con el perfil que sugiere el aparato (aquí, sin
# tarjeta gráfica, el más barato); el cielo de la página se sigue viendo (el lienzo sigue transparente arriba); el
# panel de rendimiento enseña el perfil y deja cambiarlo; el cambio se guarda y vale al volver a entrar; ?graficos=
# fuerza uno; cada perfil monta su cadena; el rendimiento cuenta un fotograma por dibujo del mundo (no uno por pasada)
# y sus triángulos son los del mundo. Capturas del mismo sitio con Móvil básico, Móvil alto y PC alto, en PC y móvil.
# El horizonte (valravnx, 5 nov: ver las montañas de lejos): el más barato no lo lleva; el PC alto sí, entero (la isla
# cada 100 m) y cambia de verdad lo que se ve en la franja del horizonte (las montañas, en vez del cielo).
# Uso: python3 pruebas/prueba_graficos_juego_navegador.py <html> <carpeta_capturas>
# MUTAR=1: el juego dibuja sin posprocesado y sin horizonte (como antes): la prueba tiene que fallar.
# MUTAR=2: lo lejano con el color en los vértices (sin sus texturas, como antes): tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_graficos'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3', 'meshy-v1', 'taller-dormir-v1', 'taller-sentarse-v1']:
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
MUTAR = os.environ.get('MUTAR') == '1'
MUTAR2 = os.environ.get('MUTAR') == '2'
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg, extra=''):
    pg.goto(BASE + extra)
    pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    if MUTAR2: pg.evaluate('globalThis.__mutarTexturaLejos = true')
    if MUTAR: pg.evaluate("(() => { window.__graficos.dibujar = () => window.__kinhold.renderer.render(window.__kinhold.escena, window.__kinhold.camara); if (window.__graficos.horizonte) window.__graficos.horizonte.malla.visible = false, window.__graficos.horizonte.poner = () => {}; })()")
    pg.wait_for_timeout(1500)

def cielo(pg):
    """lo de arriba del todo (el cielo), con la cámara casi a ras de suelo para que se vea el horizonte: con el lienzo
    transparente se ve el degradado de la página (claro); si el posprocesado tapara el cielo, saldría negro u opaco"""
    pg.evaluate('(() => { window.__camAntes = { ...window.__kinhold.cam }; window.__kinhold.cam.pitch = 0.07; })()'); pg.wait_for_timeout(2500)
    alto = pg.evaluate('innerHeight')   # por debajo de los botones de arriba (en el móvil ocupan más filas)
    im = Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': round(alto * 0.27), 'width': 120, 'height': 24}, timeout=180000))).convert('RGB')
    r = [round(x) for x in ImageStat.Stat(im).mean]
    pg.evaluate('Object.assign(window.__kinhold.cam, window.__camAntes)'); pg.wait_for_timeout(1500)
    return r

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    pg.evaluate('localStorage.removeItem("kinhold_graficos")'); entrar(pg)
    G = 'window.__graficos'
    comprobar(f'{nombre}: el juego tiene perfil gráfico', pg.evaluate(f'!!{G}'))
    comprobar(f'{nombre}: sin tarjeta gráfica arranca con el más barato (Móvil básico)', pg.evaluate(f'{G}.perfil') == 'movil-1' and pg.evaluate(f'{G}.sugerido') == 'movil-1', pg.evaluate(f'{G}.perfil'))
    comprobar(f'{nombre}: el más barato no lleva horizonte', pg.evaluate(f'!!{G}.horizonte && !{G}.horizonte.activo'))
    comprobar(f'{nombre}: dibuja con posprocesado (2 pasadas en el más barato)', pg.evaluate(f'{G}.pasadas') == 2, str(pg.evaluate(f'{G}.pasadas')))
    # el rendimiento: un fotograma por dibujo del mundo y los triángulos del mundo
    pg.wait_for_timeout(2500)
    m = pg.evaluate('window.__rendimiento.medida()')
    comprobar(f'{nombre}: el rendimiento cuenta los triángulos del mundo (no los de la última pasada)', m and m['triangulos'] > 5000, str(m and m['triangulos']))
    cuenta = pg.evaluate("(() => { let n = 0; const r = window.__kinhold.renderer, d = r.render; r.render = function (e, c) { if (e === window.__kinhold.escena) n++; return d.call(this, e, c); }; window.__n = () => n; return true; })()")
    pg.wait_for_timeout(2500)
    fps = pg.evaluate('window.__rendimiento.medida().fps'); n = pg.evaluate('window.__n()')
    comprobar(f'{nombre}: los fps del panel son los del mundo (no uno por cada pasada)', fps <= max(1, round(n / 2.5 * 1.6)) + 1, f'panel {fps} fps; el mundo se dibujó {n} veces en 2,5 s')
    c0 = cielo(pg)
    comprobar(f'{nombre}: se sigue viendo el cielo de la página (no sale negro)', sum(c0) / 3 > 120, str(c0))
    pg.screenshot(timeout=180000, path=f'{SALIDA}/{pref}_1_movil-1.png')
    # el panel: el perfil y los seis botones
    pg.evaluate("document.getElementById('btnDemoFps').click()"); pg.wait_for_timeout(1300)
    txt = pg.inner_text('#demoRend')
    comprobar(f'{nombre}: el panel de rendimiento dice el perfil', 'Móvil básico' in txt and 'pasadas' in txt, txt[:200].replace('\n', ' · '))
    comprobar(f'{nombre}: y tiene los seis perfiles para elegir', pg.evaluate("document.querySelectorAll('#demoRend [data-perfil]').length") == 6)
    pg.screenshot(timeout=180000, path=f'{SALIDA}/{pref}_0_panel.png')
    pg.evaluate("document.querySelector('#demoRend [data-perfil=movil-3]').click()"); pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: al pulsar «Móvil alto y tableta» cambia (4 pasadas: oclusión y suavizado)', pg.evaluate(f'{G}.perfil') == 'movil-3' and pg.evaluate(f'{G}.pasadas') == 4, f"{pg.evaluate(f'{G}.perfil')} {pg.evaluate(f'{G}.pasadas')}")
    pg.evaluate("document.getElementById('btnDemoFps').click()"); pg.wait_for_timeout(1200)
    pg.screenshot(timeout=180000, path=f'{SALIDA}/{pref}_2_movil-3.png')
    # se queda guardado
    entrar(pg)
    comprobar(f'{nombre}: al volver a entrar sigue el elegido', pg.evaluate(f'{G}.perfil') == 'movil-3', pg.evaluate(f'{G}.perfil'))
    # ?graficos= fuerza uno (sin guardarlo)
    entrar(pg, '&graficos=pc-3')
    comprobar(f'{nombre}: ?graficos=pc-3 pone el PC alto (3 pasadas: oclusión y MSAA)', pg.evaluate(f'{G}.perfil') == 'pc-3' and pg.evaluate(f'{G}.pasadas') == 3, f"{pg.evaluate(f'{G}.perfil')} {pg.evaluate(f'{G}.pasadas')}")
    c3 = cielo(pg)
    comprobar(f'{nombre}: con el PC alto también se ve el cielo', sum(c3) / 3 > 120, str(c3))
    pg.screenshot(timeout=180000, path=f'{SALIDA}/{pref}_3_pc-3.png')
    # el horizonte del PC alto: se termina de calcular de golpe (en el juego va poco a poco, 2 ms por fotograma)
    hz = pg.evaluate(f"(() => {{ const h = {G}.horizonte, m = h.muestras; while (!m.tiene(1)) m.avanzar(1000); {G}.poner('pc-3', false); return {{ activo: h.activo, tris: h.malla.geometry.index ? h.malla.geometry.index.count / 3 : 0 }}; }})()")
    comprobar(f'{nombre}: el PC alto lleva el horizonte, la isla entera cada 100 m', hz['activo'] and hz['tris'] > 200000, str(hz))
    # el color de lo lejano, de las texturas del nivel (valravnx, 6 nov: en los vértices salían dientes de sierra en el
    # linde del bosque): el suelo y el bosque, del tamaño de la rejilla de cada 100 m, y el sombreador las lee
    tx = pg.evaluate(f"""(() => {{ const h = {G}.horizonte, t = h.texturas, m = h.muestras, c = t.uTexC.value, d = t.uTexD.value;
      let bosque = 0; if (d) for (let i = 3; i < d.image.data.length; i += 4) if (d.image.data[i] > 0) bosque++;
      return {{ usa: t.uTexP.value.w, paso: t.uTexP.value.z, n: [t.uTexN.value.x, t.uTexN.value.y], c: c ? [c.image.width, c.image.height] : null,
        filtro: c ? c.magFilter === 1006 : false, bosque, nx: Math.floor((m.nx - 1) / 1) + 1 }}; }})()""")
    comprobar(f'{nombre}: lo lejano toma el color de sus texturas (suelo y bosque, cada 100 m, con filtrado lineal)', tx['usa'] == 1 and tx['paso'] == 100 and tx['c'] == tx['n'] and tx['n'][0] == tx['nx'] and tx['filtro'] and tx['bosque'] > 1000, str(tx))
    # y es una sola superficie (en dos, el dosel y el suelo se peleaban en la hondura comprimida de lejos: dientes de
    # sierra): sin malla de copas aparte, y el suelo lejano sube con sus copas donde hay bosque
    una = pg.evaluate(f"""(() => {{ const h = {G}.horizonte, m = h.muestras, p = h.malla.geometry.attributes.position.array;
      const dl = h.doselLejos.geometry.index ? h.doselLejos.geometry.index.count : 0;
      let y0 = null; for (let v = 0; v < m.nx * m.nz && y0 === null; v++) {{ const i = v % m.nx, j = (v - i) / m.nx;
        if (m.alto[v] > 30 && i > 2 && j > 2 && i < m.nx - 3 && j < m.nz - 3) {{ let nada = true; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (m.dosel[v + b * m.nx + a] > 0) nada = false; if (nada) y0 = m.alto[v] - p[v * 3 + 1]; }} }}
      let bosque = 0, suben = 0; for (let v = 0; v < m.nx * m.nz; v++) {{ const i = v % m.nx, j = (v - i) / m.nx;
        if (i < 2 || j < 2 || i > m.nx - 3 || j > m.nz - 3 || !(m.alto[v] > 1)) continue;
        let todo = true; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!(m.dosel[v + b * m.nx + a] > 0)) todo = false;
        if (!todo) continue; bosque++; if (p[v * 3 + 1] + y0 - m.alto[v] > m.dosel[v] * 0.5) suben++; /* (sube la media de las copas de alrededor: al menos la mitad de la suya) */ }}
      return {{ dl, bosque, suben }}; }})()""")
    comprobar(f'{nombre}: el bosque de lejos va en el mismo suelo lejano (sin malla aparte; dentro del bosque, el suelo sube con sus copas)', una['dl'] == 0 and una['bosque'] > 1000 and una['suben'] >= una['bosque'] * 0.95, str(una))
    # mirando a ras hacia los montes y el mar (desde la salida, de frente solo hay llano): la franja del horizonte con y sin él
    pg.evaluate('(() => { window.__camAntes = { ...window.__kinhold.cam }; window.__kinhold.cam.pitch = 0.05; window.__kinhold.cam.yaw = 3.14; })()'); pg.wait_for_timeout(3000)
    alto, ancho = pg.evaluate('[innerHeight, innerWidth]')
    franja = {'x': 0, 'y': round(alto * 0.3), 'width': ancho, 'height': round(alto * 0.25)}
    con = Image.open(io.BytesIO(pg.screenshot(clip=franja, timeout=180000))).convert('L')
    pg.screenshot(timeout=180000, path=f'{SALIDA}/{pref}_4_horizonte.png')
    pg.evaluate(f'{G}.horizonte.malla.visible = false'); pg.wait_for_timeout(2500)
    sin = Image.open(io.BytesIO(pg.screenshot(clip=franja, timeout=180000))).convert('L')
    # la parte de la franja que cambia de verdad (más de 6 de 255); el cielo de arriba no cambia, así que no vale la media
    cambia = sum(1 for a, b in zip(con.tobytes(), sin.tobytes()) if abs(a - b) > 6) / (con.width * con.height)
    comprobar(f'{nombre}: con el horizonte se ve lo lejano (cambia la franja del horizonte)', cambia > 0.03, f'cambia el {cambia * 100:.1f} % de la franja')
    pg.evaluate(f"{G}.poner('pc-3', false)")
    pg.evaluate('Object.assign(window.__kinhold.cam, window.__camAntes)'); pg.wait_for_timeout(1000)
    pg.evaluate('localStorage.removeItem("kinhold_graficos")')
    comprobar(f'{nombre}: sin errores de página', not errores, '; '.join(errores)[:300])

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    print('PC'); recorrido(pg, 'PC', 'pc')
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    print('Móvil'); recorrido(ctx.new_page(), 'móvil', 'movil')
    nav.close()
print(f'\n{"HAY FALLOS: " + ", ".join(fallos) if fallos else "TODO CORRECTO"} · capturas en {SALIDA}')
sys.exit(1 if fallos else 0)
