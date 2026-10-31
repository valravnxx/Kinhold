# Prueba en navegador del personaje v2 (bases CC0): carga, personalización, vistas, animación, PC y móvil.
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
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v19'), f'{sitio}/recursos/personajes/taller-v19')
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
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')  # en español, como valravnx (el inglés lo prueba prueba_idioma_navegador.py)
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); listo(pg)
        comprobar('por defecto sale el taller propio', pg.evaluate(f'{E}.estado().base') == 'makehuman')
        pg.evaluate(f"{E}.cambiar({{base: 'quaternius'}})"); listo(pg)  # las primeras pruebas son de la base de Quaternius
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
            # postura al estar quieto (valravnx: «doblado hacia delante», «hombros muy para atrás»): cabeza y hombros sobre la pelvis
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
            # correr (valravnx: «fea y exagerada»): zancada a la medida de la velocidad del juego (3,6 m/s) y sin botes enormes
            vel = pg.evaluate(f'{E}.diag().pj.velocidad')
            pg.evaluate(f"{E}.ponerModo('correr')")
            alto = []
            for i in range(12):
                pg.evaluate(f'{E}.instante({i * 0.078})'); alto.append(pg.evaluate(f"{E}.hueso('pelvis')")[1])
            bote = max(alto) - min(alto)
            if os.environ.get('MUTAR'): vel, bote = {'andar': 0.97, 'correr': 5.8}, 0.25
            comprobar(f'taller propio ({sexo}): al correr, zancada natural y poco bote',
                      2.4 < (vel.get('correr') or 0) < 4.5 and 0.5 < (vel.get('andar') or 0) < 1.5 and bote < 0.15,
                      f"correr {vel.get('correr', 0):.2f} m/s, andar {vel.get('andar', 0):.2f} m/s, bote {bote * 100:.0f} cm")
            pg.click('[data-vista="cuerpo"]')
            pg.evaluate(f'{E}.instante(0.3)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_{sexo}_correr.png')
            # las 39 animaciones extra pasadas al esqueleto de MakeHuman (taller-anim-v1): se cargan, cada una mueve el cuerpo
            # y el cuerpo no se desarma (las manos y los pies siguen a una distancia de la pelvis de cuerpo humano)
            ids = pg.evaluate(f"(() => {{ const pj = {E}.diag().pj; return [pj.clips.length, Object.keys(pj.acciones).filter(k => pj.acciones[k] && k !== pj.acciones[k].getClip().name)]; }})()")
            n_clips = ids[0]
            if os.environ.get('MUTAR'): n_clips = 9
            comprobar(f'taller propio ({sexo}): las 39 animaciones extra se cargan', n_clips == 9 + 39, f'{n_clips} clips')
            botones = pg.evaluate("[...document.querySelectorAll('#anims-extra [data-modo]')].map(b => b.dataset.modo)")
            comprobar(f'taller propio ({sexo}): botones de las 39 extra en «Más animaciones»', len(botones) == 39, str(len(botones)))
            HUESOS = ['pelvis', 'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'lowerarm_l', 'lowerarm_r']
            pose = lambda: pg.evaluate(f"{HUESOS}.map(n => {E}.hueso(n))")
            quietas, rotas, fotos = [], [], []
            for k in botones:
                dur = pg.evaluate(f"{E}.diag().pj.acciones['{k}'].getClip().duration")
                # la pose de estar quieto en los mismos instantes, para comparar
                pg.evaluate(f"{E}.ponerModo('quieto')"); pg.evaluate(f'{E}.instante({dur * 0.25})'); qa = pose()
                pg.evaluate(f'{E}.instante({dur * 0.6})'); qb = pose()
                pg.evaluate(f"{E}.ponerModo('{k}')")
                pg.evaluate(f'{E}.instante({dur * 0.25})'); a = pose()
                pg.evaluate(f'{E}.instante({dur * 0.6})'); b = pose()
                if os.environ.get('MUTAR'): a, b = qa, [[c * 3 for c in x] for x in qb]
                cambio = max(max(abs(x[i] - y[i]) for i in range(3)) for x, y in zip(a, qa))
                cambio = max(cambio, max(max(abs(x[i] - y[i]) for i in range(3)) for x, y in zip(b, qb)) if not os.environ.get('MUTAR') else 0)
                if cambio < 0.05: quietas.append(f'{k} {cambio:.3f}')
                # cuerpo entero: la cabeza a menos de 80 cm de la pelvis y manos y pies a menos de 1,1 m
                for p_ in (a, b):
                    d = [sum((p_[j][i] - p_[0][i]) ** 2 for i in range(3)) ** 0.5 for j in range(1, 6)]
                    if d[0] > 0.8 or max(d[1:]) > 1.1: rotas.append(f'{k} {max(d):.2f} m')
                if nombre == 'pc': fotos.append((k, Image.open(io.BytesIO(pg.screenshot())).convert('RGB')))
            comprobar(f'taller propio ({sexo}): cada animación extra se aparta de estar quieto (más de 5 cm)', not quietas, ', '.join(quietas))
            comprobar(f'taller propio ({sexo}): con las extra el cuerpo no se desarma', not rotas, ', '.join(rotas[:5]))
            if fotos:  # hoja con todas las poses (al 60 % de cada animación), para mirarlas
                col, w, h = 8, 320, 200
                hoja = Image.new('RGB', (col * w, -(-len(fotos) // col) * h), (40, 40, 40))
                for i, (k, f) in enumerate(fotos):
                    x, y = (i % col) * w, (i // col) * h
                    hoja.paste(f.resize((w, h)), (x, y)); ImageDraw.Draw(hoja).text((x + 6, y + 4), k, fill=(255, 255, 255))
                hoja.save(f'{SALIDA}/{nombre}_taller_{sexo}_extra_hoja.png')
            # unas cuantas de cerca, con un clic de verdad en su botón (en el móvil el panel se cierra para la foto)
            for k, t in [('apuntar', 0.6), ('minar', 0.3), ('guardiaEscudo', 1.0), ('golpePesado1', 0.35)]:
                if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
                pg.click(f'#anims-extra [data-modo="{k}"]'); pg.wait_for_timeout(100)
                if nombre == 'movil': pg.click('#btnOpciones')
                pg.evaluate(f'{E}.instante({t})'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_{sexo}_extra_{k}.png')
            comprobar(f'taller propio ({sexo}): el botón pone la animación extra', pg.evaluate(f'{E}.estado().modo') == 'golpePesado1')
            pg.evaluate(f"{E}.ponerModo('quieto')")
        # ropa por capas: el botón Gambesón lo pone encima (y esconde el cuerpo del vestido, que queda tapado)
        vis = lambda: pg.evaluate(f"(() => {{ const v = []; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.visible) v.push(o.name); }}); return v; }})()")
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        antes = vis()
        pg.click('[data-capa="gambeson"]'); pg.wait_for_timeout(200)
        con = vis()
        if os.environ.get('MUTAR'): con = antes
        comprobar('capas: el gambesón se pone encima y tapa el cuerpo de la prenda de debajo',
                  'mujer_capa_gambeson' in con and 'mujer_capa_vestido' not in con and 'mujer_capa_vestido_falda' in con and 'mujer_cinturon_gambeson' in con and 'mujer_cinturon_vestido' not in con,
                  ', '.join(sorted(set(con) ^ set(antes))))
        pg.evaluate(f"{E}.instante(1.0)"); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_gambeson.png')
        pg.click('[data-capa="gambeson"]'); pg.wait_for_timeout(200)
        comprobar('capas: al quitarlo vuelve como estaba', sorted(vis()) == sorted(antes))
        # cota y sobreveste: la sobreveste no tiene mangas, así que deja ver las de la cota (y su cuello)
        for c in ['cota', 'sobreveste']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        con = vis()
        if os.environ.get('MUTAR'): con = [x for x in con if 'mangas' not in x]
        comprobar('capas: con sobreveste se ven las mangas y el cuello de la cota', 'mujer_capa_sobreveste' in con and 'mujer_capa_cota_mangas' in con and 'mujer_capa_cota' in con,
                  ', '.join(sorted(x for x in con if 'capa' in x)))
        # lo que frena la ropa sale de los datos de cada prenda: camisa + cota frena el 64 % del corte en el torso y en los
        # brazos (la sobreveste no tiene mangas ni frena), la cabeza nada; pesa 0,3 + 1 + 10 + 0,6 + 0,6 kg (src/logica/prendas.js)
        tabla = pg.evaluate("[...document.querySelectorAll('#ropa-datos tr')].map(f => [...f.children].map(c => c.textContent))")
        datos = pg.text_content('#ropa-datos') or ''
        if os.environ.get('MUTAR'): tabla = []
        filas = {f[0]: f[1:] for f in tabla}
        comprobar('ropa: la tabla dice lo que frena la cota (torso y brazos 64 % del corte; cabeza nada) y lo que pesa',
                  filas.get('Torso', [''])[0] == '64 %' and filas.get('Brazos', [''])[0] == '64 %' and filas.get('Cabeza') == ['—', '—', '—'] and '12,5 kg' in datos,
                  f'{tabla} · {datos[-120:]}')
        pg.evaluate(f"{E}.instante(1.0)"); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_sobreveste.png')
        for c in ['cota', 'sobreveste']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        # hombre con cota: el cinturón ciñe la cota y no se estira hasta los brazos (hasta taller-v6 lo tenía; valravnx lo vio).
        # Se mide su forma de base: computeBoundingBox cuenta también las formas (peso), que lo ensanchan a propósito
        pg.evaluate(f"{E}.cambiar({{sexo: 'hombre'}})"); listo(pg)
        pg.click('[data-capa="cota"]'); pg.wait_for_timeout(200)
        cint = pg.evaluate(f"""(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === 'hombre_cinturon_cota') {{
            const b = new ({E}.diag().THREE.Box3)().setFromBufferAttribute(o.geometry.attributes.position); r = [o.visible, Math.max(-b.min.x, b.max.x)]; }} }}); return r; }})()""")
        if os.environ.get('MUTAR'): cint = [True, 0.317]
        comprobar('hombre con cota: se ve su cinturón y ciñe la cintura (no llega a los brazos)', bool(cint) and cint[0] and cint[1] < 0.22,
                  f'medio ancho {cint[1]:.3f} m' if cint else 'sin cinturón')
        pg.evaluate(f"{E}.ponerModo('quieto')"); pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
        pg.screenshot(path=f'{SALIDA}/{nombre}_taller_hombre_cota.png')
        pg.click('[data-capa="cota"]'); pg.wait_for_timeout(200)
        # tocados de uno en uno, botas en lugar de los zapatos, y la capa abierta deja ver la túnica y su cinturón
        pg.click('[data-capa="capucha"]'); pg.wait_for_timeout(200)
        con1 = vis(); pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_capucha.png')
        pg.click('[data-capa="sombrero"]'); pg.wait_for_timeout(200)
        con2 = vis(); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_sombrero.png')
        pg.click('[data-capa="sombrero"]'); pg.wait_for_timeout(200)
        con3 = vis()
        if os.environ.get('MUTAR'): con2 = con2 + ['hombre_capa_capucha']
        comprobar('tocados: de uno en uno (poner el sombrero quita la capucha) y se quitan',
                  'hombre_capa_capucha' in con1 and 'hombre_capa_sombrero' in con2 and 'hombre_capa_capucha' not in con2
                  and not any(t in con3 for t in ('hombre_capa_capucha', 'hombre_capa_sombrero')), ', '.join(x for x in con2 if 'capa_' in x))
        comprobar('tocados: bajo la capucha no asoman las orejas; con el sombrero, sí', 'hombre_orejas' not in con1 and 'hombre_orejas' in con2 and 'hombre_orejas' in con3)
        for c in ['botas', 'manto']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        con = vis()
        if os.environ.get('MUTAR'): con = [x for x in con if x != 'hombre_cinturon_tunica']
        comprobar('botas en lugar de zapatos; con la capa se siguen viendo la túnica y su cinturón',
                  'hombre_capa_botas' in con and 'hombre_capa_zapatos' not in con and 'hombre_capa_manto' in con and 'hombre_capa_manto_broche' in con
                  and 'hombre_capa_tunica' in con and 'hombre_cinturon_tunica' in con, ', '.join(sorted(x for x in con if 'capa' in x or 'cinturon' in x)))
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_capa_botas.png')
        # la capa (taller-v16) de espalda y de perfil, quieto y andando: tiene que caer de los hombros y no atravesar las piernas
        for v in ['espalda', 'perfil']:
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_capa_{v}.png')
        # la capa se mueve al andar (makehuman.js, VUELO_GLSL): se queda atrás y ondea; al pararse vuelve. Se pasa el
        # tiempo a mano (2 s en pasos de 1/30 s) para que no dependa de lo que tarde cada fotograma en la nube
        pasos = 0 if os.environ.get('MUTAR') else 60
        andar_capa = f"(() => {{ const pj = {E}.diag().pj; for (let i = 0; i < {pasos}; i++) pj.mezclador.update(1 / 30); {E}.pausar(true); {E}.dibujar(); return pj.vueloCapa(); }})()"
        pg.evaluate(f"{E}.ponerModo('andar')")
        vu = pg.evaluate(andar_capa)
        comprobar('la capa se queda atrás al andar (el bajo, al menos 6 cm) y ondea', vu['z'] < -0.06 and vu['onda'] > 0.003, str(vu))
        for v in ['perfil', 'espalda']:
            pg.click(f'[data-vista="{v}"]'); pg.evaluate(f'{E}.dibujar()'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_capa_andando_{v}.png')
        pg.evaluate(f'{E}.pausar(false)')
        pg.evaluate(f"{E}.ponerModo('quieto')")
        vq = pg.evaluate(andar_capa.replace(str(pasos), str(3 * pasos)))
        comprobar('al pararse, la capa vuelve a caer recta', abs(vq['z']) < 0.02 and abs(vq['x']) < 0.02 and vq['onda'] < 0.001 and pasos > 0, str(vq))
        pg.evaluate(f'{E}.pausar(false)'); pg.click('[data-vista="cuerpo"]')
        for c in ['botas', 'manto']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        # descalzo (el GDD empieza así): se ven los pies y no los zapatos; con botas, las botas
        con0 = vis()
        pg.click('[data-capa="descalzo"]'); pg.wait_for_timeout(200)
        con = vis()
        if os.environ.get('MUTAR'): con = [x for x in con if x != 'hombre_pies']
        comprobar('descalzo: se ven los pies y no los zapatos (con zapatos, al revés)',
                  'hombre_pies' in con and 'hombre_capa_zapatos' not in con and 'hombre_pies' not in con0 and 'hombre_capa_zapatos' in con0,
                  ', '.join(sorted(x for x in con if 'pies' in x or 'zapatos' in x)))
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_descalzo.png')
        pg.click('[data-vista="pies"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_descalzo_pies.png')
        pg.evaluate(f"{E}.ponerModo('andar')"); pg.evaluate(f'{E}.instante(0.4)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_descalzo_andando.png')
        pg.evaluate(f"{E}.ponerModo('quieto')")
        pg.click('[data-capa="botas"]'); pg.wait_for_timeout(200)
        con = vis()
        comprobar('descalzo y con botas: se ven las botas, no los pies', 'hombre_capa_botas' in con and 'hombre_pies' not in con)
        for c in ['botas', 'descalzo']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        # tintes de la ropa y blasón de la sobreveste (taller-v13): con clics de verdad, sin recargar el modelo
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        colm = lambda n: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}') r = [o.material.color.r, o.material.color.g, o.material.color.b]; }}); return r; }})()")
        pj0 = pg.evaluate(f'{E}.diag().pj.modelo.uuid')
        for c in ['cota', 'sobreveste']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
        liso = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_tintes_0.png'))[0]
        sv0, cam0 = colm('hombre_capa_sobreveste'), colm('hombre_capa_camisa')
        comprobar('tintes: por defecto, sobreveste roja (rubia)', sv0 and sv0[0] > 4 * sv0[2], str(sv0))
        pg.click('[data-tinte="sobreveste"][data-v="glasto"]'); pg.click('[data-tinte="tunica"][data-v="verde"]'); pg.click('[data-tinte="botas"][data-v="negro"]') if pg.query_selector('[data-tinte="botas"]') else None
        pg.click('[data-tinte="camisa"][data-v="blanco"]'); pg.wait_for_timeout(100)
        if os.environ.get('MUTAR'): pg.evaluate(f"{E}.diag().pj.ponerTintes({{}})")
        sv1, svf, svm, tu1 = colm('hombre_capa_sobreveste'), colm('hombre_capa_sobreveste_falda'), colm('hombre_capa_tunica_mangas'), colm('hombre_capa_tunica')
        comprobar('tintes: la sobreveste pasa a azul (glasto), con su falda del mismo color', sv1 and sv1[2] > sv1[0] and svf == sv1, f'{sv0} → {sv1}')
        comprobar('tintes: la túnica pasa a verde, mangas incluidas', tu1 and tu1[1] > tu1[0] and tu1[1] > tu1[2] and svm == tu1, str(tu1))
        comprobar('tintes: la camisa blanqueada es más clara que la cruda', colm('hombre_capa_camisa')[2] > cam0[2], f'{cam0} → {colm("hombre_capa_camisa")}')
        pg.evaluate(f'{E}.instante(1.0)'); azul = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_tintes_1.png'))[0]
        dif = sum(ImageStat.Stat(ImageChops.difference(liso, azul)).mean) / 3
        comprobar('tintes: el personaje se ve de otro color', dif > 1.5, f'diferencia {dif:.1f}')
        for dib, col in [('cruz', 'gualda'), ('cuartelado', 'blanco'), ('banda', 'negro')]:
            pg.click(f'[data-blason="dibujo"][data-v="{dib}"]'); pg.wait_for_timeout(100)
            pg.click(f'[data-blason="color"][data-v="{col}"]'); pg.wait_for_timeout(100)
            if os.environ.get('MUTAR'): pg.evaluate(f"{E}.diag().pj.ponerTintes({{prendas: {{sobreveste: 'glasto', tunica: 'verde', camisa: 'blanco'}}}})")
            pg.evaluate(f'{E}.instante(1.0)')
            con = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_blason_{dib}.png'))[0]
            dif = sum(ImageStat.Stat(ImageChops.difference(azul, con)).mean) / 3
            comprobar(f'blasón: «{dib}» de {col} se ve sobre la sobreveste', dif > 0.4 and pg.evaluate(f'{E}.tintes().blason.dibujo') == dib, f'diferencia {dif:.2f}')
            if dib == 'cruz':
                pg.click('[data-vista="espalda"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_blason_cruz_espalda.png')
                pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_blason_cruz_cerca.png')
                pg.click('[data-vista="cuerpo"]')
        comprobar('tintes: sin volver a cargar el modelo', pg.evaluate(f'{E}.diag().pj.modelo.uuid') == pj0)
        pg.reload(); listo(pg)
        t = pg.evaluate(f'{E}.tintes()')
        comprobar('tintes: se recuerdan al recargar', t['prendas']['sobreveste'] == 'glasto' and t['blason'] == {'dibujo': 'banda', 'color': 'negro'}, str(t))
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        pg.evaluate(f"{E}.tintes({{prendas: {{sobreveste: 'rubia', tunica: 'pardo', camisa: 'natural', botas: 'natural'}}, blason: {{dibujo: 'liso'}}}})")
        comprobar('tintes: vuelven a los de antes', colm('hombre_capa_sobreveste') == sv0)
        for c in ['cota', 'sobreveste']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        # hechura de la ropa fabricada (src/logica/hechura.js): material, corte y tejido, con clics de verdad y sin recargar
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        pj0 = pg.evaluate(f'{E}.diag().pj.modelo.uuid')
        if os.environ.get('MUTAR'): pg.evaluate(f"{E}.diag().pj.ponerHechuras = () => {{}}")
        pg.evaluate(f"{E}.tintes({{prendas: {{tunica: 'natural'}}}})")
        tu0 = colm('hombre_capa_tunica')
        pg.click('[data-hechura="tunica"][data-que="material"][data-v="lino"]'); pg.wait_for_timeout(100)
        tu1 = colm('hombre_capa_tunica')
        comprobar('hechura: la túnica de lino sin teñir es más clara que la de lana', tu0 and tu1 and tu1[0] > tu0[0] * 1.3, f'{tu0} → {tu1}')
        visible = lambda n: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}') r = o.visible; }}); return r; }})()")
        comprobar('hechura: con la túnica larga, la falda de la camisa no se ve', visible('hombre_capa_camisa_falda') is False)
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); larga = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_hechura_0.png'))[0]
        pg.click('[data-hechura="tunica"][data-que="corte"][data-v="corto"]'); pg.wait_for_timeout(100)
        comprobar('hechura: con la túnica corta asoma la camisa, más larga', visible('hombre_capa_camisa_falda') is True)
        pg.evaluate(f'{E}.instante(1.0)'); corta = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_hechura_corta.png'))[0]
        dif = sum(ImageStat.Stat(ImageChops.difference(larga, corta)).mean) / 3
        comprobar('hechura: la túnica corta se ve distinta', dif > 0.5, f'diferencia {dif:.2f}')
        for tej in ['cuadros', 'rayas', 'sarga', 'espiguilla']:
            pg.click(f'[data-hechura="tunica"][data-que="tejido"][data-v="{tej}"]'); pg.wait_for_timeout(100)
            pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)')
            con = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_hechura_{tej}.png'))[0]
            dif = sum(ImageStat.Stat(ImageChops.difference(corta, con)).mean) / 3
            if tej in ('cuadros', 'rayas'): comprobar(f'hechura: el tejido «{tej}» se ve en la túnica', dif > 0.3, f'diferencia {dif:.2f}')
            pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_hechura_{tej}_cerca.png')
        comprobar('hechura: sin volver a cargar el modelo', pg.evaluate(f'{E}.diag().pj.modelo.uuid') == pj0)
        pg.reload(); listo(pg)
        h = pg.evaluate(f'{E}.hechuras()')
        comprobar('hechura: se recuerda al recargar', h['tunica'] == {'material': 'lino', 'corte': 'corto', 'tejido': 'espiguilla'}, str(h['tunica']))
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        pg.evaluate(f"{E}.hechuras('tunica', {{material: 'lana', corte: 'largo', tejido: 'liso'}})"); pg.evaluate(f"{E}.tintes({{prendas: {{tunica: 'pardo'}}}})")
        comprobar('hechura: vuelve a la de siempre', visible('hombre_capa_camisa_falda') is False and pg.evaluate(f'{E}.hechuras()')['tunica'] == {'material': 'lana', 'corte': 'largo', 'tejido': 'liso'})
        # personalización del taller (aspecto): colores, peinado, barba y formas, con clics de verdad y sin recargar el modelo
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        mat = lambda n: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}') r = [o.material.color.r, o.material.color.g, o.material.color.b, o.visible]; }}); return r; }})()")
        # las formas se ponen en la malla (no en la GPU): peso de cada una en userData.formas y lo que se ha movido la malla
        influ = lambda n, k: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}' && o.userData.formas && '{k}' in o.userData.formas.nombres) r = o.userData.formas.pesos['{k}']; }}); return r; }})()")
        movida = lambda n: pg.evaluate(f"""(() => {{ let r = 0; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}' && o.userData.formas) {{ const a = o.geometry.attributes.position, b = o.userData.formas.base;
            for (let i = 0; i < a.count; i++) r = Math.max(r, Math.hypot(a.getX(i) - b.getX(i), a.getY(i) - b.getY(i), a.getZ(i) - b.getZ(i))); }} }}); return r; }})()""")
        pj0 = pg.evaluate(f'{E}.diag().pj.modelo.uuid')
        pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)')
        cara0 = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_0.png'))[0]
        piel0, iris0, pelo0 = mat('hombre_piel'), mat('hombre_iris_l'), mat('hombre_pelo')
        for clave, v in [('piel', 'morena'), ('ojos', 'azules'), ('pelo', 'rubio'), ('barba', 'bigote')]:
            pg.click(f'[data-asp="{clave}"][data-v="{v}"]'); pg.wait_for_timeout(100)
        if os.environ.get('MUTAR'): pg.evaluate(f"{E}.diag().pj.ponerAspecto({{}})")
        piel1, iris1, pelo1 = mat('hombre_piel'), mat('hombre_iris_l'), mat('hombre_pelo')
        cambia = lambda x, y: x and y and sum(abs(x[i] - y[i]) for i in range(3)) > 0.05
        comprobar('aspecto: cambian la piel, los ojos y el pelo (también las cejas y la barba, del mismo color)',
                  cambia(piel0, piel1) and cambia(iris0, iris1) and cambia(pelo0, pelo1) and mat('hombre_vello')[:3] == pelo1[:3] and mat('hombre_barba_bigote')[:3] == pelo1[:3],
                  f'piel {piel0[:3]} → {piel1[:3]}')
        comprobar('aspecto: el pelo rubio es más claro que el castaño oscuro', sum(pelo1[:3]) > sum(pelo0[:3]) * 2)
        comprobar('aspecto: con «Bigote» se ve el bigote y no la barba corta', mat('hombre_barba_bigote')[3] and not mat('hombre_barba_corta')[3])
        pg.evaluate(f'{E}.instante(1.0)'); cara1 = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_1.png'))[0]
        dif = sum(ImageStat.Stat(ImageChops.difference(cara0, cara1)).mean) / 3
        comprobar('aspecto: la cara se ve distinta', dif > 2, f'diferencia {dif:.1f}')
        pg.click('[data-asp="barba"][data-v="ninguna"]'); pg.click('[data-asp="peinado"][data-v="rapado"]'); pg.wait_for_timeout(100)
        comprobar('aspecto: afeitado y rapado (sin barba ni pelo; las cejas y el pelo pintado se quedan)',
                  not mat('hombre_barba_corta')[3] and not mat('hombre_barba_bigote')[3] and not mat('hombre_barba_mostacho')[3] and not mat('hombre_pelo')[3] and mat('hombre_vello')[3])
        pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_2.png')
        # peinados y barbas nuevos (taller-v10): melena con barba larga (la corta va debajo), trenzas con perilla; bajo la
        # capucha no asoman las trenzas ni las orejas
        ver = lambda n: (mat(f'hombre_{n}') or [0, 0, 0, None])[3]
        pg.click('[data-asp="peinado"][data-v="melena"]'); pg.click('[data-asp="barba"][data-v="larga"]'); pg.wait_for_timeout(100)
        if os.environ.get('MUTAR'): pg.evaluate(f"{E}.diag().pj.ponerAspecto({{peinado: 'corto', barba: 'corta'}})")
        comprobar('aspecto: melena y barba larga (con el pelo corto, la barba corta debajo y el bigote con volumen)',
                  all(ver(n) for n in ('pelo', 'pelo_melena', 'barba_larga', 'barba_corta', 'barba_mostacho')) and not ver('pelo_trenzas') and not ver('pelo_coleta'))
        pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_melena_larga.png')
        pg.click('[data-vista="espalda"]') if pg.query_selector('[data-vista="espalda"]') else None
        pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_melena_espalda.png')
        pg.click('[data-asp="peinado"][data-v="trenzas"]'); pg.click('[data-asp="barba"][data-v="perilla"]'); pg.wait_for_timeout(100)
        comprobar('aspecto: trenzas y perilla', ver('pelo_trenzas') and ver('barba_perilla') and not ver('pelo_melena') and not ver('barba_larga') and not ver('barba_corta'))
        pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_trenzas.png')
        pg.click('[data-capa="capucha"]'); pg.wait_for_timeout(150)
        comprobar('aspecto: bajo la capucha no asoman las trenzas ni las orejas', ver('capa_capucha') and not ver('pelo_trenzas') and not ver('orejas'))
        pg.click('[data-capa="capucha"]'); pg.wait_for_timeout(150)
        comprobar('aspecto: sin la capucha vuelven las trenzas y las orejas', ver('pelo_trenzas') and ver('orejas'))
        pg.click('[data-asp="peinado"][data-v="coleta"]'); pg.wait_for_timeout(100)
        pg.click('[data-vista="cara"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_coleta.png')
        pg.click('[data-asp="barba"][data-v="ninguna"]'); pg.click('[data-asp="peinado"][data-v="rapado"]'); pg.wait_for_timeout(100)
        # formas: los deslizadores mueven las formas de MakeHuman (en la piel y en la ropa) y la altura escala el personaje
        cabeza0 = pg.evaluate(f"{E}.hueso('head')")[1]
        for k, v in [('peso', 1), ('cara', 1), ('nariz', -1), ('menton', 1), ('altura', 1)]:
            pg.evaluate(f"(() => {{ const r = document.querySelector('[data-forma=\"{k}\"]'); r.value = {v}; r.dispatchEvent(new Event('input')); }})()")
        pg.evaluate(f'{E}.instante(1.0)')
        cabeza1 = pg.evaluate(f"{E}.hueso('head')")[1]
        f = [influ('hombre_piel', 'peso_mas'), influ('hombre_capa_tunica', 'peso_mas'), influ('hombre_piel', 'cara_mas'), influ('hombre_piel', 'nariz_menos'), influ('hombre_piel', 'menton_mas'), influ('hombre_capa_tunica', 'cara_mas')]
        comprobar('formas: peso en la piel y en la túnica; cara, nariz y mentón en la piel (no en la túnica)', f[:5] == [1, 1, 1, 1, 1] and f[5] is None, str(f))
        mv = [movida('hombre_piel'), movida('hombre_capa_tunica')]
        sin_gpu = pg.evaluate(f"(() => {{ let r = 0; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.geometry.morphAttributes.position) r++; }}); return r; }})()")
        comprobar('formas: la piel y la túnica se mueven de verdad (más de 5 mm) y ninguna pieza calcula formas en la GPU', mv[0] > 0.005 and mv[1] > 0.005 and sin_gpu == 0, f'{mv[0] * 1000:.0f} y {mv[1] * 1000:.0f} mm; {sin_gpu} con formas en la GPU')
        comprobar('formas: más alto (la cabeza sube un 6 % aprox.)', 1.04 < cabeza1 / cabeza0 < 1.08, f'{cabeza0:.3f} → {cabeza1:.3f} m')
        cara2 = contenido(pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_3.png'))[0]
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_cuerpo.png')
        comprobar('aspecto: sin volver a cargar el modelo', pg.evaluate(f'{E}.diag().pj.modelo.uuid') == pj0)
        pg.reload(); listo(pg)
        asp = pg.evaluate(f'{E}.diag().pj.aspecto')
        comprobar('aspecto: se recuerda al recargar', asp['piel'] == 'morena' and asp['pelo'] == 'rubio' and asp['formas']['peso'] == 1 and asp['peinado'] == 'rapado', str(asp))
        pg.evaluate(f"{E}.cambiar({{aspecto: {{}}}})"); listo(pg)
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')  # en el móvil, al recargar empieza cerrado
        pg.evaluate(f"{E}.cambiar({{sexo: 'mujer'}})"); listo(pg)
        # en calidad alta, toda la ropa y el pelo escriben profundidad (si no, la piel se pinta encima: v5)
        pg.evaluate(f"{E}.cambiar({{calidad: 'alta'}})"); listo(pg)
        # (menos los calcos de pelo pintados sobre la piel, que van con mezcla suave y despegados con polygonOffset)
        malos = pg.evaluate(f"""(() => {{ const m = []; {E}.diag().pj.modelo.traverse(o => {{ const calco = /_(vello|barba_(corta|bigote|perilla))$/.test(o.name);
            if (o.isMesh && (calco ? !(o.material.transparent && o.material.polygonOffset) : (!o.material.depthWrite || o.material.transparent))) m.push(o.name); }}); return m; }})()""")
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
