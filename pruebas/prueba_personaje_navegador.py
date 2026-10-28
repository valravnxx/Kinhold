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
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v9'), f'{sitio}/recursos/personajes/taller-v9')
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
                  'hombre_capa_botas' in con and 'hombre_capa_zapatos' not in con and 'hombre_capa_manto' in con and 'hombre_capa_manto_falda' in con
                  and 'hombre_capa_tunica' in con and 'hombre_cinturon_tunica' in con, ', '.join(sorted(x for x in con if 'capa' in x or 'cinturon' in x)))
        pg.click('[data-vista="cuerpo"]'); pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_taller_capa_botas.png')
        for c in ['botas', 'manto']: pg.click(f'[data-capa="{c}"]'); pg.wait_for_timeout(200)
        # personalización del taller (aspecto): colores, peinado, barba y formas, con clics de verdad y sin recargar el modelo
        if not pg.is_visible('#opciones'): pg.click('#btnOpciones')
        mat = lambda n: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}') r = [o.material.color.r, o.material.color.g, o.material.color.b, o.visible]; }}); return r; }})()")
        # las formas se ponen en la malla (no en la GPU): peso de cada una en userData.formas y lo que se ha movido la malla
        influ = lambda n, k: pg.evaluate(f"(() => {{ let r = null; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}' && o.userData.formas && '{k}' in o.userData.formas.nombres) r = o.userData.formas.pesos['{k}']; }}); return r; }})()")
        movida = lambda n: pg.evaluate(f"(() => {{ let r = 0; {E}.diag().pj.modelo.traverse(o => {{ if (o.isMesh && o.name === '{n}' && o.userData.formas) {{ const a = o.geometry.attributes.position, b = o.userData.formas.base;
            for (let i = 0; i < a.count; i++) r = Math.max(r, Math.hypot(a.getX(i) - b.getX(i), a.getY(i) - b.getY(i), a.getZ(i) - b.getZ(i))); }} }}); return r; }})()")
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
                  not mat('hombre_barba_corta')[3] and not mat('hombre_barba_bigote')[3] and not mat('hombre_pelo')[3] and mat('hombre_vello')[3])
        pg.evaluate(f'{E}.instante(1.0)'); pg.screenshot(path=f'{SALIDA}/{nombre}_aspecto_2.png')
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
        malos = pg.evaluate(f"""(() => {{ const m = []; {E}.diag().pj.modelo.traverse(o => {{ const calco = /_(vello|barba_[a-z]+)$/.test(o.name);
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
