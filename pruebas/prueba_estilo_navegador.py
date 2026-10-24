# Prueba en navegador de las pruebas de estilo (hito 1b): los tres estilos, las tres vistas, PC y móvil.
# Uso: python3 pruebas/prueba_estilo_navegador.py <html> <carpeta_capturas>
# Comprueba que cada combinación se dibuja (imagen con contenido, no vacía ni de un color),
# que los estilos se distinguen entre sí, que la interfaz cabe, que no hay errores
# y que el guardado (estilo y vista) se recuerda al recargar.
# MUTAR=1 oculta el dibujo para comprobar que la prueba falla cuando debe.
import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_estilo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_estilo'
os.makedirs(SALIDA, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
E = 'window.__estilo'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def analizar(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100))
    # el contenido se mide en la franja central, donde no hay botones ni paneles
    st = ImageStat.Stat(im.crop((24, 25, 136, 65)))
    return im, sum(st.stddev) / 3, st.mean

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
        if os.environ.get('MUTAR'):  # rotura a propósito: sin dibujo, la prueba tiene que fallar
            pg.add_style_tag(content='canvas{visibility:hidden}')
        pg.evaluate(f'{E}.pausar(true)')  # sin tarjeta gráfica cada fotograma tarda segundos: se dibuja a mano
        imagenes = {}
        for est in 'ABC':
            pg.click(f'[data-estilo="{est}"]')
            pg.wait_for_timeout(300)
            comprobar(f'estilo {est} seleccionado', pg.evaluate(f'{E}.estado().estilo') == est)
            comprobar(f'{est}: botón marcado', 'sel' in (pg.get_attribute(f'[data-estilo="{est}"]', 'class') or ''))
            for v in ['escena', 'personaje', 'cara']:
                pg.click(f'[data-vista="{v}"]')
                pg.evaluate(f'{E}.dibujar()')
                png = pg.screenshot(path=f'{SALIDA}/{nombre}_{est}_{v}.png')
                im, desv, media = analizar(png)
                imagenes[(est, v)] = im
                comprobar(f'{est}/{v}: la imagen tiene contenido', desv > 18, f'desviación {desv:.0f}')
            m = pg.evaluate(f'{E}.medida()')
            print(f'     medida {est}: {m["triangulosAhora"]} triángulos, {m["llamadasAhora"]} dibujados')
            comprobar(f'{est}: triángulos y dibujados razonables para móvil', 1000 < m['triangulosAhora'] < 250000 and 0 < m['llamadasAhora'] < 400, f"{m['triangulosAhora']} / {m['llamadasAhora']}")
        # los estilos se ven distintos (diferencia media de píxeles entre A, B y C en la misma vista)
        from PIL import ImageChops
        for a, b in [('A', 'B'), ('B', 'C'), ('A', 'C')]:
            dif = sum(ImageStat.Stat(ImageChops.difference(imagenes[(a, 'escena')], imagenes[(b, 'escena')])).mean) / 3
            comprobar(f'{a} y {b} se distinguen', dif > 4, f'diferencia {dif:.1f}')
        # la interfaz cabe sin salirse
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior', '#resumen']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1 and caja['y'] + caja['height'] <= vista['height'] + 1)
        # notas
        pg.click('#btnNotas'); pg.wait_for_timeout(200); pg.evaluate(f'{E}.dibujar()')
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_notas.png')
        pg.click('#btnNotas')
        # girar la cámara arrastrando
        antes = pg.evaluate('JSON.stringify(window.__estilo.estado())')
        pg.click('[data-vista="escena"]'); pg.evaluate(f'{E}.dibujar()')
        p0 = pg.screenshot()
        if not movil:
            pg.mouse.move(640, 450); pg.mouse.down(); pg.mouse.move(760, 430, steps=8); pg.mouse.up()
            pg.wait_for_timeout(300)
            d = sum(ImageStat.Stat(ImageChops.difference(analizar(p0)[0], analizar(pg.screenshot())[0])).mean) / 3
            comprobar('arrastrar gira la cámara', d > 3, f'diferencia {d:.1f}')
        # se recuerda estilo y vista al recargar
        pg.click('[data-estilo="A"]'); pg.click('[data-vista="cara"]'); pg.wait_for_timeout(200)
        pg.reload(); pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('recuerda estilo y vista al recargar', st['estilo'] == 'A' and st['vista'] == 'cara', str(st))
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
