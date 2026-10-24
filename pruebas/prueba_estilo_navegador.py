# Prueba en navegador de la prueba de estilo v6 (hito 1b): las dos luces, las cinco vistas (con personaje y cara), PC y móvil.
# Uso: python3 pruebas/prueba_estilo_navegador.py <html> <carpeta_capturas>
# Comprueba que cada combinación se dibuja (la franja central de la imagen tiene contenido),
# que se cumple el presupuesto (triángulos y dibujados), que las luces se distinguen,
# que la interfaz cabe, que no hay errores y que luz y vista se recuerdan al recargar.
# MUTAR=1 oculta el dibujo y pone un presupuesto imposible para comprobar que la prueba falla cuando debe.
import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops

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
    return im, sum(ImageStat.Stat(im.crop((24, 25, 136, 65))).stddev) / 3

def diferencia(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

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
        pg.evaluate(f'{E}.pausar(true)')  # sin tarjeta gráfica cada fotograma tarda segundos: se dibuja a mano
        presu = pg.evaluate(f'{E}.PRESUPUESTO')
        if os.environ.get('MUTAR'): presu = {'triangulos': 5000, 'dibujados': 5}  # y un presupuesto imposible
        imagenes = {}
        for luz in ['manana', 'tarde']:
            pg.click(f'[data-luz="{luz}"]')
            comprobar(f'luz {luz} puesta y marcada', pg.evaluate(f'{E}.estado().luz') == luz and 'sel' in (pg.get_attribute(f'[data-luz="{luz}"]', 'class') or ''))
            for v in ['maqueta', 'cabana', 'lado', 'personaje', 'cara']:
                pg.click(f'[data-vista="{v}"]')
                pg.evaluate(f'{E}.dibujar()')
                png = pg.screenshot(path=f'{SALIDA}/{nombre}_{luz}_{v}.png')
                im, desv = analizar(png)
                imagenes[(luz, v)] = im
                comprobar(f'{luz}/{v}: la imagen tiene contenido', desv > 18, f'desviación {desv:.0f}')
                m = pg.evaluate(f'{E}.medida()')
                comprobar(f'{luz}/{v}: dentro del presupuesto', 1000 < m['triangulos'] <= presu['triangulos'] and 0 < m['dibujados'] <= presu['dibujados'],
                          f"{m['triangulos']} triángulos (máx. {presu['triangulos']}), {m['dibujados']} dibujados (máx. {presu['dibujados']})")
        comprobar('mañana y tarde se distinguen', diferencia(imagenes[('manana', 'maqueta')], imagenes[('tarde', 'maqueta')]) > 4)
        comprobar('la vista de la cara es distinta de la del personaje', diferencia(imagenes[('manana', 'personaje')], imagenes[('manana', 'cara')]) > 8)
        # personaje: una sola malla con esqueleto, de pie en el suelo, y la animación de andar se mueve
        per = pg.evaluate(f'{E}.personaje()')
        comprobar('personaje: una malla con esqueleto', per['mallas'] == 1 and per['huesos'] >= 15, str(per))
        comprobar('personaje: triángulos razonables', 3000 <= per['triangulos'] <= (500 if os.environ.get('MUTAR') else 12000), f"{per['triangulos']}")
        comprobar('personaje: de pie en el suelo y de altura creíble', -0.03 < per['pies']['minY'] < 0.06 and 1.6 < per['pies']['maxY'] - per['pies']['minY'] < 1.85, str(per['pies']))
        pg.click('[data-vista="personaje"]')
        pg.click('#btnAndar')
        comprobar('el botón pone a andar', pg.evaluate(f'{E}.estado().andar') is True and 'sel' in (pg.get_attribute('#btnAndar', 'class') or ''))
        pg.evaluate(f'{E}.instante(0.3)'); a1 = analizar(pg.screenshot(path=f'{SALIDA}/{nombre}_andar_1.png'))[0]
        pg.evaluate(f'{E}.instante(0.82)'); a2 = analizar(pg.screenshot(path=f'{SALIDA}/{nombre}_andar_2.png'))[0]
        comprobar('al andar cambia la pose', diferencia(a1, a2) > 1.5, f'diferencia {diferencia(a1, a2):.1f}')
        per2 = pg.evaluate(f'{E}.personaje()')
        comprobar('al andar no se hunde ni flota', -0.04 < per2['pies']['minY'] < 0.09, str(per2['pies']))
        pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(0.82)'); pg.screenshot(path=f'{SALIDA}/{nombre}_andar_cara.png')
        pg.click('#btnAndar')
        comprobar('y lo para', pg.evaluate(f'{E}.estado().andar') is False)
        comprobar('las vistas son distintas', diferencia(imagenes[('manana', 'maqueta')], imagenes[('manana', 'cabana')]) > 8)
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior', '#medida']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1 and caja['y'] + caja['height'] <= vista['height'] + 1)
        pg.click('#btnNotas'); pg.wait_for_timeout(200); pg.evaluate(f'{E}.dibujar()')
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.screenshot(path=f'{SALIDA}/{nombre}_notas.png')
        pg.click('#btnNotas')
        pg.click('[data-vista="maqueta"]'); pg.evaluate(f'{E}.dibujar()')
        if not movil:
            p0 = analizar(pg.screenshot())[0]
            pg.mouse.move(640, 450); pg.mouse.down(); pg.mouse.move(760, 430, steps=8); pg.mouse.up()
            pg.wait_for_timeout(300)
            d = diferencia(p0, analizar(pg.screenshot())[0])
            comprobar('arrastrar gira la cámara', d > 3, f'diferencia {d:.1f}')
        # el desenfoque se quita y se pone
        pg.click('#btnDesenfoque')
        comprobar('el botón quita el desenfoque', not pg.evaluate('document.body.classList.contains("desenfoque")') and not pg.is_visible('.foco.arriba'))
        pg.click('#btnDesenfoque')
        comprobar('y lo vuelve a poner', pg.is_visible('.foco.arriba'))
        pg.click('[data-luz="tarde"]'); pg.click('[data-vista="cabana"]'); pg.click('#btnAndar')
        pg.reload(); pg.wait_for_function(f'{E} !== undefined', timeout=30000)
        st = pg.evaluate(f'{E}.estado()')
        comprobar('recuerda luz, vista y si anda al recargar', st['luz'] == 'tarde' and st['vista'] == 'cabana' and st['andar'] is True, str(st))
        pg.evaluate(f'{E}.ponerAndar(false)')
        comprobar(f'sin errores en consola ({nombre})', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
