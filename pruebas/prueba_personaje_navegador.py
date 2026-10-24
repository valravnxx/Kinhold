# Prueba en navegador del personaje v2 (bases CC0): carga, personalización, vistas, animación, PC y móvil.
# Uso: python3 pruebas/prueba_personaje_navegador.py <html> <carpeta_capturas>
# Sirve el html y docs/recursos/personajes/v1 por HTTP con la misma estructura que la web (jugar/personaje/ y recursos/personajes/v1/).
# MUTAR=1 oculta el dibujo y congela la animación: la prueba tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_personaje.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_personaje'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/personaje'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/personaje/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/v1'), f'{sitio}/recursos/personajes/v1')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/personaje/prueba.html'

ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__personaje'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def contenido(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100))
    return im, sum(ImageStat.Stat(im.crop((40, 15, 140, 75))).stddev) / 3
def listo(pg): pg.wait_for_function(f'{E} && {E}.listo()', timeout=180000)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil)
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); listo(pg)
        if os.environ.get('MUTAR'):
            pg.add_style_tag(content='canvas{visibility:hidden}')
            pg.evaluate(f"{E}.ponerModo = () => {{}}")
        pg.evaluate(f'{E}.pausar(true)')
        pg.evaluate(f"{E}.ponerModo('quieto')")
        imgs = {}
        for v in ['cuerpo', 'cara', 'perfil', 'espalda']:
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_{v}.png')
            imgs[v], desv = contenido(png)
            comprobar(f'{v}: se ve el personaje', desv > 15, f'desviación {desv:.0f}')
        comprobar('las vistas son distintas', sum(ImageStat.Stat(ImageChops.difference(imgs['cuerpo'], imgs['cara'])).mean) / 3 > 8)
        m = pg.evaluate(f'{E}.medida()')
        comprobar('personaje dentro de presupuesto (≤ 36 mil triángulos)', 5000 < m['trianglesPersonaje'] <= 36000, str(m['trianglesPersonaje']))
        # la animación del paquete mueve el cuerpo de verdad
        pg.evaluate(f"{E}.ponerModo('andar')"); pg.click('[data-vista="cuerpo"]')
        pg.evaluate(f'{E}.instante(0.2)'); a = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
        pg.evaluate(f'{E}.instante(0.65)'); b = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
        mov = max(abs(a[i][k] - b[i][k]) for i in range(2) for k in range(3))
        comprobar('al andar se mueven piernas y brazos', mov > 0.05, f'{mov:.3f} m')
        pg.screenshot(path=f'{SALIDA}/{nombre}_andar.png')
        # personalización: cada cambio carga y se ve distinto
        antes = contenido(pg.screenshot())[0]
        for i, cambio in enumerate([{'sexo': 'mujer', 'pelo': 'mono', 'colorPelo': 'negro', 'piel': 'media'},
                                    {'sexo': 'hombre', 'ropa': 'explorador', 'pelo': 'rapado', 'colorPelo': 'pelirrojo', 'piel': 'morena', 'barba': 'si'},
                                    {'sexo': 'mujer', 'ropa': 'campesino', 'pelo': 'largo', 'colorPelo': 'rubio', 'piel': 'clara'}]):
            pg.evaluate(f'{E}.cambiar({cambio})'); listo(pg)
            pg.evaluate(f"{E}.ponerModo('quieto')"); pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_variante{i + 1}.png')
            ahora = contenido(png)[0]
            dif = sum(ImageStat.Stat(ImageChops.difference(antes, ahora)).mean) / 3
            comprobar(f'variante {i + 1} cargada y distinta', dif > 2, f'diferencia {dif:.1f}')
            antes = ahora
            pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_variante{i + 1}_cara.png')
            comprobar(f'variante {i + 1}: se ve la cara', contenido(png)[1] > 15)
        # botones de la personalización (clic de verdad)
        pg.click('[data-op="sexo"][data-v="hombre"]'); listo(pg)
        comprobar('el botón Hombre cambia el personaje', pg.evaluate(f'{E}.estado().sexo') == 'hombre')
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior', '#opciones']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1 and caja['y'] + caja['height'] <= vista['height'] + 1)
        pg.click('#btnNotas'); pg.wait_for_timeout(150)
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.click('#btnNotas')
        pg.click('[data-vista="perfil"]')
        pg.reload(); listo(pg)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('recuerda vista y personaje al recargar', st['vista'] == 'perfil' and st['sexo'] == 'hombre', str(st))
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
