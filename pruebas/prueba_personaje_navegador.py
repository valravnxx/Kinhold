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
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v2'), f'{sitio}/recursos/personajes/taller-v2')
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
                                    {'sexo': 'hombre', 'pelo': 'rapado', 'colorPelo': 'pelirrojo', 'piel': 'morena', 'barba': 'si', 'calidad': 'ligera'},
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
        if movil: comprobar('en el móvil el panel empieza cerrado', not pg.is_visible('#opciones'))
        comprobar('calidad alta por defecto', pg.evaluate(f'{E}.estado().calidad') in ('alta', 'ligera'))
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        # calidad ligera (móvil): material sencillo sin relieve
        lig = pg.evaluate(f"(() => {{ const d = {E}.diag(); let n = 0, std = 0; d.pj.modelo.traverse(o => {{ if (o.isMesh) {{ n++; if (o.material.type !== 'MeshLambertMaterial') std++; }} }}); return [n, std, {E}.estado().calidad]; }})()")
        comprobar('calidad ligera: todo con material sencillo', lig[0] > 0 and lig[1] == 0 and lig[2] == 'ligera', str(lig))
        esq = pg.evaluate(f"(() => {{ const s = new Set(); {E}.diag().pj.modelo.traverse(o => {{ if (o.isSkinnedMesh) s.add(o.skeleton); }}); return s.size; }})()")
        comprobar('ropa, pelo y barba comparten un solo esqueleto', esq <= 2, f'{esq} esqueletos')
        comprobar('el traje de explorador no se ofrece (demasiado de fantasía)', pg.locator('[data-op="ropa"][data-v="explorador"]').count() == 0)
        # interruptores de la prueba de rendimiento
        pg.click('[data-diag="sombras"]'); pg.click('[data-diag="escena"]')
        d = pg.evaluate(f"(() => {{ const d = {E}.diag(); return [d.renderer.shadowMap.enabled, d.escena.children[0].visible]; }})()")
        comprobar('los interruptores quitan sombras y escenario', d == [False, False], str(d))
        pg.screenshot(path=f'{SALIDA}/{nombre}_sin_escena.png')
        pg.click('[data-diag="sombras"]'); pg.click('[data-diag="escena"]')
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
        # base del taller propio (MakeHuman vestido por código): carga, se ve, anda y cambia de sexo
        pg.click('[data-op="base"][data-v="makehuman"]'); listo(pg)
        comprobar('taller propio: carga el personaje de MakeHuman', pg.evaluate(f'{E}.estado().base') == 'makehuman' and pg.evaluate(f"{E}.diag().pj.clips.includes('Walk_Loop')"))
        for sexo in ['hombre', 'mujer']:
            pg.evaluate(f"{E}.cambiar({{sexo: '{sexo}'}})"); listo(pg)
            pg.evaluate(f"{E}.ponerModo('quieto')"); pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_taller_{sexo}.png')
            comprobar(f'taller propio ({sexo}): se ve', se_ve(pg, png) > 1, f'{se_ve(pg, png):.1f}')
            pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)')
            png = pg.screenshot(path=f'{SALIDA}/{nombre}_taller_{sexo}_cara.png')
            comprobar(f'taller propio ({sexo}): se ve la cara', se_ve(pg, png) > 4, f'{se_ve(pg, png):.1f}')
            # postura al estar quieto (Pedro: «doblado hacia delante», «hombros muy para atrás»): cabeza y hombros sobre la pelvis
            pg.evaluate(f"{E}.ponerModo('quieto')"); pg.evaluate(f'{E}.instante(1.0)')
            post = pg.evaluate(f"""(() => {{ const d = {E}.diag(), h = d.pj.hueso, v = (n) => {{ const p = new d.THREE.Vector3(); h[n].getWorldPosition(p); return d.pj.modelo.worldToLocal(p); }};
              const pel = v('pelvis'); return [v('head').z - pel.z, v('upperarm_l').z - pel.z, v('upperarm_r').z - pel.z, v('lowerarm_l').z - v('upperarm_l').z]; }})()""")
            if os.environ.get('MUTAR'): post = [0.2, -0.05, -0.05, -0.08]
            comprobar(f'taller propio ({sexo}): de pie recto (cabeza y hombros sobre la pelvis, brazos sin irse atrás)',
                      post[0] < 0.10 and min(post[1], post[2]) > -0.01 and post[3] > -0.03, ', '.join(f'{x * 100:.1f} cm' for x in post))
            pg.evaluate(f"{E}.ponerModo('andar')"); pg.click('[data-vista="cuerpo"]')
            pg.evaluate(f'{E}.instante(0.2)'); a = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
            pg.evaluate(f'{E}.instante(0.65)'); b = pg.evaluate(f"[{E}.hueso('calf_l'), {E}.hueso('hand_r')]")
            mov = max(abs(a[i][k] - b[i][k]) for i in range(2) for k in range(3))
            comprobar(f'taller propio ({sexo}): al andar se mueven piernas y brazos', mov > 0.05, f'{mov:.3f} m')
            pg.screenshot(path=f'{SALIDA}/{nombre}_taller_{sexo}_andar.png')
        # en calidad alta, toda la ropa y el pelo escriben profundidad (si no, la piel se pinta encima: v5)
        pg.evaluate(f"{E}.cambiar({{calidad: 'alta'}})"); listo(pg)
        malos = pg.evaluate(f"(() => {{ const m = []; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && (!o.material.depthWrite || o.material.transparent)) m.push(o.name); }}); return m; }})()")
        if os.environ.get('MUTAR'): malos = ['mutado']
        comprobar('taller propio en calidad alta: todo escribe profundidad', not malos, ', '.join(malos))
        pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_alta_cara.png')
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_alta_cuerpo.png')
        tri = pg.evaluate(f'{E}.medida()')['trianglesPersonaje']
        comprobar('taller propio dentro de presupuesto (≤ 36 mil triángulos)', 5000 < tri <= 36000, str(tri))
        pg.evaluate(f"{E}.cambiar({{sexo: 'hombre'}})"); listo(pg)
        pg.click('[data-op="base"][data-v="quaternius"]'); listo(pg)
        comprobar('vuelve a la base de Quaternius', pg.evaluate(f'{E}.estado().base') == 'quaternius')
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
