# Prueba en navegador del visor de personajes con el hombre y la mujer de Meshy (valravnx, 10 nov: fuera el taller,
# Quaternius y el muñeco de bloques): carga, vistas, sexo, animaciones y herramientas en la mano, PC y móvil.
# (La ropa por capas, los tintes, las hechuras y el aspecto vuelven cuando los modelos de Meshy los tengan.)
# Uso: python3 pruebas/prueba_personaje_navegador.py <html> <carpeta_capturas>
# Sirve el html y docs/recursos/personajes/v1 por HTTP con la misma estructura que la web (jugar/personaje/ y recursos/personajes/v1/).
# MUTAR=1 oculta el dibujo y congela la animación: la prueba tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops, ImageDraw

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_personaje.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_personaje'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/personaje'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/personaje/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/v1'), f'{sitio}/recursos/personajes/v1')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v24'), f'{sitio}/recursos/personajes/taller-v24')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-carga-v3'), f'{sitio}/recursos/personajes/taller-carga-v3')  # las de cargar del taller
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/meshy-v1'), f'{sitio}/recursos/personajes/meshy-v1')  # los personajes de Meshy
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-dormir-v1'), f'{sitio}/recursos/personajes/taller-dormir-v1')  # tumbarse y levantarse
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-sentarse-v1'), f'{sitio}/recursos/personajes/taller-sentarse-v1')  # sentarse en el suelo
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-anim-v1'), f'{sitio}/recursos/personajes/taller-anim-v1')
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
def se_ve(pg, png):
    """cuánto cambia la imagen al esconder el personaje (si no se dibuja, nada)"""
    pg.evaluate(f'{E}.diag().pj.raiz.visible = false'); pg.evaluate(f'{E}.dibujar()')
    sin = pg.screenshot(); pg.evaluate(f'{E}.diag().pj.raiz.visible = true'); pg.evaluate(f'{E}.dibujar()')
    a, b = [Image.open(io.BytesIO(x)).convert('RGB').resize((160, 100)) for x in (png, sin)]
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
def listo(pg): pg.wait_for_function(f'{E} && {E}.listo()', timeout=180000)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); listo(pg)
        comprobar('sale el personaje de Meshy', bool(pg.evaluate(f'{E}.diag().pj.meshy')))
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
        comprobar('personaje dentro de presupuesto (≤ 36 mil triángulos)', 2000 < m['trianglesPersonaje'] <= 36000, str(m['trianglesPersonaje']))
        if movil: comprobar('en el móvil el panel empieza cerrado', not pg.is_visible('#opciones'))
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        comprobar('ya no se ofrecen las bases de antes', pg.locator('[data-op="base"]').count() == 0)
        # interruptores de la prueba de rendimiento
        pg.click('[data-diag="sombras"]'); pg.click('[data-diag="escena"]')
        d = pg.evaluate(f"(() => {{ const d = {E}.diag(); return [d.renderer.shadowMap.enabled, d.escena.children[0].visible]; }})()")
        comprobar('los interruptores quitan sombras y escenario', d == [False, False], str(d))
        pg.click('[data-diag="sombras"]'); pg.click('[data-diag="escena"]')
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar('sin desplazamiento horizontal', ancho <= vista['width'], f'{ancho}px')
        for sel in ['#estilos', '#inferior', '#opciones']:
            caja = pg.locator(sel).bounding_box()
            comprobar(f'{sel} dentro de la pantalla', caja and caja['x'] >= 0 and caja['x'] + caja['width'] <= vista['width'] + 1 and caja['y'] + caja['height'] <= vista['height'] + 1)
        pg.click('#btnNotas'); pg.wait_for_timeout(150)
        comprobar('las notas se abren', pg.is_visible('#notas') and len(pg.inner_text('#notas')) > 200)
        pg.click('#btnNotas')
        for sexo in ['mujer', 'hombre']:
            if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
            pg.click(f'[data-op="sexo"][data-v="{sexo}"]'); listo(pg)
            comprobar(f'({sexo}) el botón cambia el personaje', pg.evaluate(f'{E}.estado().sexo') == sexo and pg.evaluate(f'{E}.diag().pj.opciones.sexo') == sexo)
            pg.evaluate(f"{E}.ponerModo('quieto')"); pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}.png')
            comprobar(f'({sexo}) se ve', se_ve(pg, png) > 1, f'{se_ve(pg, png):.1f}')
            pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}_cara.png')
            comprobar(f'({sexo}) se ve la cara', se_ve(pg, png) > 4, f'{se_ve(pg, png):.1f}')
            # los pies en el suelo (valravnx, 10 nov: «los pies muy hundidos»): lo más bajo del cuerpo, quieto, a ras del suelo
            bajo = pg.evaluate(f"""(() => {{ const d = {E}.diag(), pj = d.pj; pj.raiz.updateMatrixWorld(true); let b = Infinity;
              pj.modelo.traverse(o => {{ if (o.isSkinnedMesh) {{ o.computeBoundingBox(); b = Math.min(b, o.boundingBox.clone().applyMatrix4(o.matrixWorld).min.y); o.boundingBox = null; }} }});
              return b - pj.raiz.getWorldPosition(new d.THREE.Vector3()).y; }})()""")
            if os.environ.get('MUTAR'): bajo = -0.17
            comprobar(f'({sexo}) los pies en el suelo, ni hundidos ni en el aire', abs(bajo) < 0.03, f'{bajo * 100:.1f} cm')
            pg.evaluate(f"{E}.ponerModo('andar')"); pg.click('[data-vista="cuerpo"]')
            pg.evaluate(f'{E}.instante(0.2)'); a = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
            pg.evaluate(f'{E}.instante(0.65)'); b = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
            mov = max(abs(a[i][k] - b[i][k]) for i in range(2) for k in range(3))
            comprobar(f'({sexo}) al andar se mueven piernas y brazos', mov > 0.05, f'{mov:.3f} m')
            pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}_andar.png')
            # andar y correr a la medida de la velocidad del juego, sin botes enormes
            vel = pg.evaluate(f'{E}.diag().pj.velocidad')
            pg.evaluate(f"{E}.ponerModo('correr')")
            alto = []
            for i in range(12):
                pg.evaluate(f'{E}.instante({i * 0.06})'); alto.append(pg.evaluate(f"{E}.hueso('pelvis')")[1])
            bote = max(alto) - min(alto)
            if os.environ.get('MUTAR'): vel, bote = {'andar': 0.4, 'correr': 5.8}, 0.25
            comprobar(f'({sexo}) andar y correr con zancada natural y poco bote',
                      2.4 < (vel.get('correr') or 0) < 5 and 1 < (vel.get('andar') or 0) < 1.8 and bote < 0.15,
                      f"correr {vel.get('correr', 0):.2f} m/s, andar {vel.get('andar', 0):.2f} m/s, bote {bote * 100:.0f} cm")
            pg.evaluate(f'{E}.instante(0.3)'); pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}_correr.png')
            # las 59 de la biblioteca de Meshy: se cargan, y los botones de «Más animaciones» ponen cada una
            n_clips = pg.evaluate(f'{E}.diag().pj.clips.length')
            if os.environ.get('MUTAR'): n_clips = 9
            comprobar(f'({sexo}) las 67 animaciones de Meshy se cargan (59 de su biblioteca y 8 hechas con texto)', n_clips == 67, f'{n_clips} clips')
            botones = pg.evaluate("[...document.querySelectorAll('#anims-extra [data-modo]')].map(b => b.dataset.modo)")
            comprobar(f'({sexo}) «Más animaciones» tiene sus botones', len(botones) >= 30, str(len(botones)))
            HUESOS = ['pelvis', 'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r']
            pose = lambda: pg.evaluate(f"{HUESOS}.map(n => {E}.hueso(n))")
            rotas, fotos = [], []
            for k in botones:
                dur = pg.evaluate(f"{E}.diag().pj.acciones['{k}'].getClip().duration")
                pg.evaluate(f"{E}.ponerModo('{k}')")
                for t in (0.25, 0.6):
                    pg.evaluate(f'{E}.instante({dur * t})'); p_ = pose()
                    d = [sum((p_[j][i] - p_[0][i]) ** 2 for i in range(3)) ** 0.5 for j in range(1, 6)]
                    if d[0] > 0.85 or max(d[1:]) > 1.2: rotas.append(f'{k} {max(d):.2f} m')
                if nombre == 'pc': fotos.append((k, Image.open(io.BytesIO(pg.screenshot())).convert('RGB')))
            comprobar(f'({sexo}) con cada animación el cuerpo no se desarma', not rotas, ', '.join(rotas[:5]))
            if fotos:
                col, w, h = 8, 320, 200
                hoja = Image.new('RGB', (col * w, -(-len(fotos) // col) * h), (40, 40, 40))
                for i, (k, f) in enumerate(fotos):
                    x, y = (i % col) * w, (i // col) * h
                    hoja.paste(f.resize((w, h)), (x, y)); ImageDraw.Draw(hoja).text((x + 6, y + 4), k, fill=(255, 255, 255))
                hoja.save(f'{SALIDA}/{nombre}_{sexo}_animaciones_hoja.png')
            # herramienta en la mano al trabajar: al picar, el pico; al talar, el hacha; con un golpe de espada, nada
            pg.evaluate(f"{E}.ponerModo('minar')"); pg.evaluate(f'{E}.instante(0.4)'); herr_minar = pg.evaluate(f'{E}.herramienta()')
            pg.evaluate(f"{E}.ponerModo('golpe')"); pg.evaluate(f'{E}.instante(0.4)'); herr_golpe = pg.evaluate(f'{E}.herramienta()')
            pg.evaluate(f"{E}.ponerModo('talar')"); pg.evaluate(f'{E}.instante(0.4)'); herr_talar = pg.evaluate(f'{E}.herramienta()')
            pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(0.4)'); pg.screenshot(path=f'{SALIDA}/{nombre}_{sexo}_talar.png')
            if os.environ.get('MUTAR'): herr_talar = None
            # (en los de Meshy el hueso de la mano está en la muñeca: el mango, a unos 20 cm)
            cerca = lambda h: h and sum((h['mano'][i] - pg.evaluate(f"{E}.hueso('hand_r')")[i]) ** 2 for i in range(3)) ** 0.5 < 0.28
            comprobar(f'({sexo}) al picar, el pico en la mano; al talar, el hacha; con la espada, nada',
                      bool(herr_minar) and herr_minar['tipo'] == 'pico' and bool(herr_talar) and herr_talar['tipo'] == 'hacha' and cerca(herr_talar) and herr_golpe is None,
                      f'{herr_minar} / {herr_talar} / {herr_golpe}')
            pg.evaluate(f"{E}.ponerModo('quieto')")
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
