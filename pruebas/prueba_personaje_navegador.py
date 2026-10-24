# Prueba en navegador del personaje (hito 1b): vistas de cerca, andar, PC y móvil.
# Uso: python3 pruebas/prueba_personaje_navegador.py <html> <carpeta_capturas>
# MUTAR=1 oculta el dibujo y congela la animación: la prueba tiene que fallar.
import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_personaje.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_personaje'
os.makedirs(SALIDA, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__personaje'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def contenido(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100))
    return im, sum(ImageStat.Stat(im.crop((24, 20, 136, 70))).stddev) / 3

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil)
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto('file://' + RUTA)
        pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        if os.environ.get('MUTAR'):
            pg.add_style_tag(content='canvas{visibility:hidden}')
            pg.evaluate(f"{E}.ponerModo = () => {{}}")
        pg.evaluate(f'{E}.pausar(true)')
        pg.click('[data-modo="quieto"]')
        imgs = {}
        for v in ['cuerpo', 'cara', 'perfil', 'manos', 'espalda']:
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f'{E}.instante(0.5)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_{v}.png')
            imgs[v], desv = contenido(png)
            comprobar(f'{v}: se ve el personaje', desv > 15, f'desviación {desv:.0f}')
        comprobar('las vistas son distintas', sum(ImageStat.Stat(ImageChops.difference(imgs['cuerpo'], imgs['cara'])).mean) / 3 > 8)
        m = pg.evaluate(f'{E}.medida()')
        comprobar('personaje dentro de presupuesto (≤ 26 mil triángulos)', 1000 < m['trianglesPersonaje'] <= 26000, str(m['trianglesPersonaje']))
        # andar: las rodillas y las manos se mueven de verdad
        pg.click('[data-modo="andar"]'); pg.click('[data-vista="cuerpo"]')
        pg.evaluate(f'{E}.instante(0.2)'); a = pg.evaluate(f"[{E}.hueso('rodillaI'), {E}.hueso('munecaD')]")
        pg.evaluate(f'{E}.instante(0.75)'); b = pg.evaluate(f"[{E}.hueso('rodillaI'), {E}.hueso('munecaD')]")
        mov = max(abs(a[i][k] - b[i][k]) for i in range(2) for k in range(3))
        comprobar('al andar se mueven piernas y brazos', mov > 0.05, f'{mov:.3f} m')
        pg.screenshot(path=f'{SALIDA}/{nombre}_andar.png')
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1)
        pg.click('#btnNotas'); pg.wait_for_timeout(150)
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.click('#btnNotas')
        pg.click('[data-vista="perfil"]')
        pg.reload(); pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('recuerda vista y modo al recargar', st['vista'] == 'perfil' and st['modo'] == 'andar', str(st))
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
