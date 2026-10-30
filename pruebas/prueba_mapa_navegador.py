# Prueba en navegador del visor del mapa del mundo (hito 10, bocetos): genera el mundo, comprueba que se dibuja la
# tierra, cambia de capa, amplía, toca un sitio, abre las notas y saca capturas de todas las vistas en PC y móvil.
# MUTAR=1 borra la tierra antes de pintar una capa: tiene que fallar.
# Uso: python3 pruebas/prueba_mapa_navegador.py <html> <carpeta_capturas>
import sys, os, json, subprocess, time, socket
from playwright.sync_api import sync_playwright
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_mapa.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_mapa'
os.makedirs(SALIDA, exist_ok=True)
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
# parte del lienzo con color de tierra (verde o pardo: el mar es azulado)
TIERRA = """(() => { const c = document.getElementById('lienzo'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let t = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 37) { n++; if (d[i + 1] >= d[i + 2] + 4) t++; } return t / n; })()"""
MEDIDAS = {}
# la vista de juego está lista cuando los trozos del suelo cubren el decorado de cerca (los hace un hilo aparte)
def esperar_juego(pg): pg.wait_for_function('window.__cerca.vj && window.__cerca.vj.listo', timeout=180000)
# se sirve por http desde la raíz del repositorio (con file:// el navegador no deja cargar el personaje)
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_s = socket.socket(); _s.bind(('', 0)); PUERTO = _s.getsockname()[1]; _s.close()
SERVIDOR = subprocess.Popen([sys.executable, '-m', 'http.server', str(PUERTO)], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
URL = f'http://localhost:{PUERTO}/' + os.path.relpath(RUTA, RAIZ).replace(os.sep, '/') + '?recursosMH=/docs/recursos/personajes/taller-v12/'
with sync_playwright() as p:
    nav = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    for nombre, opc in [('pc', dict(viewport={'width': 1280, 'height': 800})), ('movil', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        ctx = nav.new_context(locale='es-ES', **opc); pg = ctx.new_page(); err = []
        pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_function('window.__mapa && window.__mapa.listo', timeout=240000)
        r = pg.evaluate('window.__mapa.resumen'); ms = pg.evaluate('window.__mapa.msGenerar')
        comprobar(f'{nombre}: abre el mundo elegido (semilla 66172, 256 km)', pg.evaluate('window.__mapa.mapa.semilla === 66172 && window.__mapa.mapa.lado === 256'))
        _datos = pg.inner_text('#datos')
        comprobar(f'{nombre}: el mundo elegido se llama Kinland y su nombre va en el mar bajo la costa sur', _datos.startswith('Kinland') and pg.evaluate('(() => { const c = window.__mapa.mapa.continente, m = window.__mapa.mapa; return !!c && !m.tierra[Math.min(m.N - 1, Math.floor(c.y)) * m.N + Math.floor(c.x)]; })()'), _datos[:60])
        comprobar(f'{nombre}: hay grandes vetas marcadas', r['vetas'].get('granHierro', 0) >= 2 and r['vetas'].get('granCarbon', 0) >= 2, json.dumps(r['vetas']))
        MEDIDAS[nombre] = {'ms_generar': ms, **r}
        comprobar(f'{nombre}: se genera el mundo', r and r['tierraKm2'] > 5000, f"{ms} ms · {r['tierraKm2']} km² de tierra")
        comprobar(f'{nombre}: la isla grande está apartada (más de 20 km de mar)', r['separacionIsla'] and r['separacionIsla'] >= 20, f"{r['separacionIsla']} km")
        t = pg.evaluate(TIERRA)
        comprobar(f'{nombre}: se dibuja la tierra (relieve)', t > 0.1, f'{t * 100:.0f} % del lienzo')
        pg.screenshot(path=f'{SALIDA}/{nombre}_1_relieve.png')
        if os.environ.get('MUTAR'): pg.evaluate('window.__mapa.mapa.forma.fill(-50)')
        pg.evaluate('window.__mapa.fondo("biomas")'); pg.wait_for_timeout(200)
        t = pg.evaluate(TIERRA)
        comprobar(f'{nombre}: se dibuja la tierra (biomas)', t > 0.1, f'{t * 100:.0f} % del lienzo')
        pg.screenshot(path=f'{SALIDA}/{nombre}_2_biomas.png')
        pg.evaluate('window.__mapa.fondo("roca"); window.__mapa.capa("vetas", true)'); pg.wait_for_timeout(200)
        if nombre == 'movil':
            comprobar('móvil: la leyenda empieza escondida (no tapa el mapa)', not pg.is_visible('#leyenda'))
            pg.screenshot(path=f'{SALIDA}/movil_3a_roca_vetas_sin_leyenda.png')
            pg.click('#btnLeyenda'); pg.wait_for_timeout(150)
        pg.screenshot(path=f'{SALIDA}/{nombre}_3_roca_vetas.png')
        leyenda = pg.inner_text('#leyenda')
        tapa = pg.evaluate("(() => { const a = document.getElementById('leyenda').getBoundingClientRect(), b = document.getElementById('superior').getBoundingClientRect(); return a.height > 0 && a.top < b.bottom; })()")
        comprobar(f'{nombre}: la leyenda no tapa los botones de arriba', not tapa)
        if nombre == 'movil': pg.click('#btnLeyenda')
        comprobar(f'{nombre}: la leyenda enseña rocas y vetas', 'Caliza' in leyenda and 'Veta pequeña de carbón' in leyenda and 'Gran veta de hierro' in leyenda)
        # comarcas de Whitholm (valravnx, 30 oct): de lejos las fronteras de las 8 comarcas; ampliado, los lindes de las zonas
        pg.evaluate('window.__mapa.capa("comarcas", true)'); pg.wait_for_timeout(300)
        comprobar(f'{nombre}: las 8 comarcas de Whitholm (A a H)', pg.evaluate('window.__mapa.comarcas && window.__mapa.comarcas.letras.join("")') == 'ABCDEFGH')
        ley = pg.inner_text('#leyenda') if nombre == 'pc' else (pg.click('#btnLeyenda'), pg.wait_for_timeout(150), pg.inner_text('#leyenda'), pg.click('#btnLeyenda'))[2]
        comprobar(f'{nombre}: la leyenda explica las comarcas y las zonas', 'Frontera de comarca' in ley and 'Zona' in ley)
        pg.screenshot(path=f'{SALIDA}/{nombre}_3b_comarcas.png')
        isla = pg.evaluate('(() => { const m = window.__mapa.mapa, c = m.centros[m.paisIsla], k = m.lado / m.N; return [(c % m.N + 0.5) * k, (Math.floor(c / m.N) + 0.5) * k]; })()')
        pg.evaluate(f'window.__mapa.ampliar(3, {isla[0]}, {isla[1]})'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'{SALIDA}/{nombre}_3c_comarcas_isla.png')
        pg.evaluate(f'window.__mapa.ampliar(9, {isla[0] + 4}, {isla[1] + 6})'); pg.wait_for_timeout(300)
        n = pg.evaluate('window.__mapa.pixelesComarcas()'); ms_c = pg.evaluate('window.__mapa.msComarcas')
        comprobar(f'{nombre}: ampliado se pintan los lindes de las zonas', n > 20000, f'{n} píxeles · {ms_c} ms')
        MEDIDAS[nombre]['ms_comarcas'] = ms_c
        W, H = opc['viewport']['width'], opc['viewport']['height']
        if nombre == 'pc': pg.mouse.click(W / 2, H / 2)
        else: pg.touchscreen.tap(W / 2, H / 2)
        pg.wait_for_timeout(200); info = pg.inner_text('#datos')
        comprobar(f'{nombre}: tocar en Whitholm dice su comarca (con su nombre) y su zona', 'comarca ' in info and 'zona ' in info and any(c in info for c in ['Breiddal', 'Motdale', 'Nordwold', 'Lindholt', 'Strandvang', 'Furulid', 'Sudholt', 'Ravnsnes']), info[:200])
        pg.screenshot(path=f'{SALIDA}/{nombre}_3d_zonas.png')
        pg.evaluate('window.__mapa.capa("comarcas", false)')
        # ampliar sobre el centro de la región 2 (Rudmere) y tocarlo
        m = pg.evaluate('(() => { const m = window.__mapa.mapa, c = m.centros[1], k = m.lado / m.N; return [(c % m.N + 0.5) * k, (Math.floor(c / m.N) + 0.5) * k]; })()')
        pg.evaluate('window.__mapa.fondo("relieve"); window.__mapa.capa("vetas", false)')
        pg.evaluate(f'window.__mapa.ampliar(4, {m[0]}, {m[1]})'); pg.wait_for_timeout(200)
        W, H = opc['viewport']['width'], opc['viewport']['height']
        if nombre == 'pc': pg.mouse.click(W / 2, H / 2)
        else: pg.touchscreen.tap(W / 2, H / 2)
        pg.wait_for_timeout(200)
        info = pg.inner_text('#datos')
        comprobar(f'{nombre}: tocar un sitio dice qué hay, con el nombre de la región (y a cuánto está el hierro y el carbón)', 'm de altura' in info and 'Rudmere' in info and 'País' not in info and 'hierro a' in info, info[:160])
        cerca = pg.evaluate("(() => { const t = document.getElementById('datos').textContent; const m = t.match(/hierro a (\\d+) km, carbón a (\\d+) km/); return m ? [+m[1], +m[2]] : null; })()")
        comprobar(f'{nombre}: hierro y carbón a menos de 25 km del sitio tocado', cerca and max(cerca) < 25, str(cerca))
        pg.screenshot(path=f'{SALIDA}/{nombre}_4_ampliado.png')
        # de cerca: el botón que sale al tocar abre el paisaje en 3D del sitio tocado
        comprobar(f'{nombre}: al tocar sale «Ver de cerca»', pg.is_visible('#btnCerca'))
        pg.evaluate("document.getElementById('btnCerca').click()")
        pg.wait_for_function('window.__cerca && window.__cerca.listo', timeout=240000)
        med = pg.evaluate('window.__cerca.medidas')
        comprobar(f'{nombre}: de cerca se dibuja el terreno y el bosque', med and med['triangulos'] > 50000 and med['arboles'] > 500, json.dumps(med))
        pg.wait_for_timeout(1500); pg.screenshot(path=f'{SALIDA}/{nombre}_6_cerca_alto.png', timeout=240000)
        pg.evaluate('window.__cerca.vista("pie")'); pg.wait_for_timeout(1500)
        pie = pg.evaluate("(() => { const c = document.querySelector('#lienzoCerca'); return [c.width, c.height]; })()")
        pg.screenshot(path=f'{SALIDA}/{nombre}_7_cerca_pie.png', timeout=240000)
        comprobar(f'{nombre}: la vista a pie se pone', pg.evaluate('window.__cerca.vistaActual') == 'pie', str(pie))
        # como en el juego: el trozo de cerca con todo el detalle, el personaje y andar tocando el suelo
        pg.evaluate("document.getElementById('btnJuego').click()"); pg.wait_for_timeout(1500); esperar_juego(pg)
        jm = pg.evaluate('window.__cerca.juego')
        if os.environ.get('MUTAR'): jm['hierba'] = 0
        comprobar(f'{nombre}: como en el juego, el trozo de cerca tiene rejilla de 1–1,25 m, hierba, piedras y árboles', jm and jm['pasoM'] <= 1.25 and jm['hierba'] > 1000 and jm['rocas'] > 0 and jm['triangulos'] > 100000, json.dumps(jm))
        comprobar(f'{nombre}: sale la ayuda de andar', pg.is_visible('#juegoAyuda'))
        a = pg.evaluate('[window.__cerca.vj.pos.x, window.__cerca.vj.pos.z]')
        pg.evaluate('(() => { const v = window.__cerca.vj; v.andarA(v.pos.x + 8, v.pos.z + 3); })()'); pg.wait_for_timeout(2500)
        b = pg.evaluate('[window.__cerca.vj.pos.x, window.__cerca.vj.pos.z, window.__cerca.vj.pos.y, window.__cerca.vj.altura(window.__cerca.vj.pos.x, window.__cerca.vj.pos.z)]')
        comprobar(f'{nombre}: el personaje anda y va pegado al suelo', b[0] > a[0] and abs(b[2] - b[3]) < 0.05, str(b))
        pg.screenshot(path=f'{SALIDA}/{nombre}_8_juego.png', timeout=240000)
        pg.evaluate('window.__cerca.camara(0.18, 30, 2.6)'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_9_juego_bajo.png', timeout=240000)
        # el suelo va por trozos (sin el trozo único que se rehacía entero) y, al ir lejos, el decorado se rehace poco a poco:
        # ningún fotograma se para. Se lleva al personaje 1 m por fotograma (más deprisa que corriendo) 200 m en línea
        # recta. MUTAR_TROZOS=1 rehace el decorado de golpe, como antes: tiene que fallar
        if os.environ.get('MUTAR_TROZOS'): pg.evaluate('window.__cerca.vj.deGolpe = true')
        pg.evaluate("""new Promise(res => { const v = window.__cerca.vj; v.msMax = 0; v.fotogramas = 3; let k = 0;
          const f = () => { if (k++ < 200) { v.pos.x += 1; requestAnimationFrame(f); } else if (v.haciendo) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); })""")
        try: pg.wait_for_function('window.__cerca.vj.trozos.faltan() === 0', timeout=60000)
        except Exception: pass
        pg.wait_for_timeout(500)
        tj = pg.evaluate('window.__cerca.juego')
        pg.evaluate('window.__cerca.vj.deGolpe = false')
        MEDIDAS[f'{nombre}_juego_andar'] = tj
        comprobar(f'{nombre}: como en el juego, el suelo va por trozos con rejilla de 1 m cerca', tj['trozos'] >= 9 and tj['triangulosSuelo'] > 20000 and tj['ladoTrozosM'] >= 192, f"{tj['trozos']} trozos, {tj['triangulosSuelo']} triángulos de suelo, cuadro de {tj['ladoTrozosM']} m")
        comprobar(f'{nombre}: al andar 200 m el decorado se rehace sin parar el juego (ningún fotograma pasa de 60 ms en suelo y decorado)', tj['rehechos'] >= 1 and tj['msFotogramaMax'] < 60, f"{tj['rehechos']} veces rehecho, fotograma más largo {tj['msFotogramaMax']} ms")
        pg.evaluate('window.__cerca.camara(0.5, 40, 2.2)'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_9b_juego_trozos.png', timeout=240000)
        # junto al río más cercano: el agua de cerca se dibuja y el personaje queda en la orilla, fuera del agua
        r = pg.evaluate('window.__cerca.rioCercano()')
        if r:
            off = r['ancho'] / 2 + 7
            pg.evaluate(f"window.__cerca.juegoEn({r['x']} + Math.cos({r['dir']} + 1.57) * {off}, {r['z']} + Math.sin({r['dir']} + 1.57) * {off}, {r['dir']})"); pg.wait_for_timeout(1500); esperar_juego(pg)
            hay = pg.evaluate("!!(window.__cerca.vj.grupo && window.__cerca.vj.grupo.getObjectByName('aguaCerca'))")
            if os.environ.get('MUTAR'): hay = False
            comprobar(f'{nombre}: junto al río se dibuja su agua de cerca', hay, f"río de {r['ancho']:.0f} m a {abs(complex(r['x'], r['z'])):.0f} m del centro")
            # el agua se mueve: dos capturas seguidas mirando al río, con la cámara quieta, tienen que diferir
            if os.environ.get('MUTAR') or os.environ.get('MUTAR_AGUA'): pg.evaluate('window.__cerca.pararAgua = true')   # MUTAR_AGUA=1: solo para el agua
            pg.evaluate(f"window.__cerca.camara(0.6, 14, {r['dir']} + 1.57)"); pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_10a_rio_de_cerca.png', timeout=240000); pg.wait_for_timeout(1200)
            pg.screenshot(path=f'{SALIDA}/{nombre}_10b_rio_de_cerca.png', timeout=240000)
            from PIL import Image, ImageChops
            a = Image.open(f'{SALIDA}/{nombre}_10a_rio_de_cerca.png').convert('L'); b = Image.open(f'{SALIDA}/{nombre}_10b_rio_de_cerca.png').convert('L')
            dif = ImageChops.difference(a, b).point(lambda v: 255 if v > 8 else 0)
            parte = dif.histogram()[255] / (a.size[0] * a.size[1])
            comprobar(f'{nombre}: el agua del río se mueve (cambia entre dos capturas con la cámara quieta)', parte > 0.01, f'{parte * 100:.1f} % de la imagen')
            pg.evaluate('window.__cerca.pararAgua = false')
            pg.evaluate(f"window.__cerca.camara(0.12, 70, {r['dir']})"); pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/{nombre}_10_rio.png', timeout=240000)
        else: comprobar(f'{nombre}: hay un río en la zona de cerca', False)
        # el mundo de cerca es siempre igual: se rehace el trozo 50 m más allá y lo que queda en la parte común (a menos de
        # 18 m de un punto que cubren los dos, dentro del radio de la hierba también en el móvil) tiene que estar en el mismo sitio. MUTAR_FIJO=1: el azar cambia con el centro
        if os.environ.get('MUTAR_FIJO'): pg.evaluate('window.__cerca.vj.azarCentro = true')
        FOTO = '''(([qx, qz]) => { const L = window.__cerca.vj.L, f = (k, M = L) => M[k].filter(e => Math.hypot(e[0] - qx, e[2] - qz) < 18).map(e => e[0].toFixed(2) + ',' + e[2].toFixed(2) + ',' + e[3].toFixed(2)).sort();
          return { arboles: Object.keys(L.arboles).flatMap(e => f(e, L.arboles).map(x => e + ':' + x)), hierba: f('hierba'), rocas: f('rocas') }; })'''
        p0 = pg.evaluate('[window.__cerca.vj.pos.x, window.__cerca.vj.pos.z]')
        q = [p0[0] + 25, p0[1]]
        pg.evaluate(f'window.__cerca.juegoEn({p0[0]}, {p0[1]}, 0)'); pg.wait_for_timeout(800)
        a = pg.evaluate(FOTO, q)
        pg.evaluate(f'window.__cerca.juegoEn({p0[0] + 50}, {p0[1]}, 0)'); pg.wait_for_timeout(800)
        b = pg.evaluate(FOTO, q)
        iguales = all(a[k] == b[k] for k in a)
        if not iguales: print('    distintos:', {k: (len(set(a[k]) ^ set(b[k])), len(a[k]), len(b[k])) for k in a})
        comprobar(f'{nombre}: al rehacer el trozo de cerca en otro sitio, lo que ya estaba sale igual (árboles, hierba y piedras)', iguales and len(a['hierba']) > 50, f"{len(a['arboles'])} árboles, {len(a['hierba'])} matas de hierba, {len(a['rocas'])} piedras en la parte común")
        pg.evaluate('window.__cerca.vj.azarCentro = false')
        pg.evaluate("document.getElementById('btnAlto').click()"); pg.wait_for_timeout(500)
        comprobar(f'{nombre}: al salir del juego se quita el trozo de cerca', pg.evaluate("!window.__cerca.vj.grupo && document.getElementById('juegoAyuda').hidden"))
        pg.evaluate("document.getElementById('btnVolverMapa').click()"); pg.wait_for_timeout(500)
        comprobar(f'{nombre}: «Volver al mapa» vuelve', not pg.is_visible('#cerca'))
        pg.click('#btnNotas'); pg.wait_for_timeout(200)
        comprobar(f'{nombre}: las notas se abren', pg.is_visible('#notas'))
        pg.screenshot(path=f'{SALIDA}/{nombre}_5_notas.png'); pg.click('#btnNotas')
        ancho = pg.evaluate('document.documentElement.scrollWidth')
        comprobar(f'{nombre}: nada se sale de la pantalla', ancho <= W, f'{ancho}px')
        fuera = pg.evaluate("[...document.querySelectorAll('#superior button, #superior select, #superior input, #leyenda, #datos')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1); }).map(e => e.id || e.textContent).slice(0, 5)")
        comprobar(f'{nombre}: botones, leyenda y datos dentro de la pantalla', not fuera, ', '.join(fuera))
        solape = pg.evaluate("(() => { const a = document.getElementById('leyenda').getBoundingClientRect(), b = document.getElementById('datos').getBoundingClientRect(); return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top); })()")
        comprobar(f'{nombre}: la leyenda no tapa los datos', not solape)
        if nombre == 'pc':
            # un acantilado de costa: el personaje no sube la pared andando (se para al pie). MUTAR_PARED=1 quita el límite
            pg.evaluate('window.__mapa.cerca(73.5, 70.5)'); pg.wait_for_function('window.__cerca && window.__cerca.listo', timeout=240000)
            pg.evaluate('window.__cerca.vista("juego")'); pg.wait_for_timeout(1500); esperar_juego(pg)
            r = pg.evaluate('window.__cerca.paredCercana()')
            comprobar('pc: junto al acantilado de costa hay paredes de roca', bool(r), str(r))
            jm2 = pg.evaluate('window.__cerca.juego')
            if os.environ.get('MUTAR_ROCA'): jm2['paredes'] = 0
            comprobar('pc: las paredes del acantilado llevan piezas de roca 3D', jm2 and jm2.get('paredes', 0) > 100 and pg.evaluate("!!window.__cerca.vj.grupo.getObjectByName('rocaPared')"), f"{jm2.get('paredes')} piezas · {jm2.get('triangulos')} triángulos")
            if r:
                pg.evaluate(f"window.__cerca.juegoEn({r['x']}, {r['z']}, {r['dir']})"); pg.wait_for_timeout(1500); esperar_juego(pg)
                if os.environ.get('MUTAR_PARED'): pg.evaluate('window.__cerca.vj.sinLimite = true')
                y0 = pg.evaluate('window.__cerca.vj.pos.y')
                pg.evaluate(f"(() => {{ const v = window.__cerca.vj; v.andarA(v.pos.x + Math.cos({r['dir']}) * 40, v.pos.z + Math.sin({r['dir']}) * 40); }})()"); pg.wait_for_timeout(9000)
                fin = pg.evaluate('[window.__cerca.vj.parado, window.__cerca.vj.pos.y]')
                comprobar('pc: el personaje se para al pie de la pared y no la sube', fin[0] == 'pared' and fin[1] - y0 < 3, f'{fin[0]}, subió {fin[1] - y0:.1f} m')
                pg.evaluate(f"window.__cerca.camara(0.25, 30, {r['dir']} + 3.14)"); pg.wait_for_timeout(1500)
                pg.screenshot(path=f'{SALIDA}/pc_11_acantilado.png', timeout=240000)
            pg.evaluate("document.getElementById('btnVolverMapa').click()"); pg.wait_for_timeout(500)
            # un salto de agua de 35 m: el agua de cerca cae en una lámina casi vertical y al pie lleva su poza de espuma.
            # MUTAR_SALTO=1 da por buena una lámina sin caída: tiene que fallar
            pg.evaluate('window.__mapa.cerca(84.92, 74.79)'); pg.wait_for_function('window.__cerca && window.__cerca.listo', timeout=240000)
            sa = pg.evaluate('window.__cerca.saltoCercano()')
            pg.evaluate(f"window.__cerca.juegoEn({sa['x']} + Math.cos({sa['dir']}) * 22 + Math.cos({sa['dir']} + 1.57) * {sa['ancho'] / 2 + 10}, {sa['z']} + Math.sin({sa['dir']}) * 22 + Math.sin({sa['dir']} + 1.57) * {sa['ancho'] / 2 + 10}, {sa['dir']} + 3.14)"); pg.wait_for_timeout(1500); esperar_juego(pg)
            caida = pg.evaluate('''(() => { const a = window.__cerca.vj.grupo.getObjectByName('aguaCerca'); if (!a) return [0, 0];
              const n = a.geometry.attributes.normal, e = a.geometry.attributes.aEspuma, ix = a.geometry.index; let v = 0, m = 0;
              const usados = new Set(ix.array); for (const k of usados) { if (Math.abs(n.getY(k)) < 0.5) v++; m = Math.max(m, e.getX(k)); } return [v, m]; })()''')
            if os.environ.get('MUTAR_SALTO'): caida = [0, 0]
            comprobar(f"pc: el salto de agua de {sa['alto']:.0f} m cae en una lámina casi vertical, con su poza de espuma", caida[0] > 10 and caida[1] > 0.8, f'{caida[0]} puntos de agua cayendo · espuma al pie {caida[1]:.2f}')
            pg.evaluate(f"window.__cerca.camara(0.25, 40, {sa['dir']})"); pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{SALIDA}/pc_12_salto_de_agua.png', timeout=240000)
            pg.evaluate("document.getElementById('btnVolverMapa').click()"); pg.wait_for_timeout(500)
            # el mundo de 188 km del GDD, para comparar
            pg.select_option('#lado', '188'); pg.wait_for_function('window.__mapa.listo && window.__mapa.mapa.lado === 188', timeout=240000)
            r2 = pg.evaluate('window.__mapa.resumen'); MEDIDAS['pc_188'] = r2
            comprobar('pc: también se genera el mundo de 188 km', r2['tierraKm2'] > 3000, f"{r2['tierraKm2']} km²")
            pg.screenshot(path=f'{SALIDA}/pc_6_188km.png')
            # en inglés no falta ningún texto
            pg.goto(URL + '&lang=en'); pg.wait_for_function('window.__mapa && window.__mapa.listo', timeout=240000)
            pg.click('#btnNotas'); pg.evaluate('window.__mapa.fondo("biomas"); window.__mapa.capa("vetas", true)')
            faltan = pg.evaluate('[...window.__idioma.faltan]')
            comprobar('pc: en inglés no falta ningún texto', not faltan, '; '.join(faltan[:4]))
            pg.screenshot(path=f'{SALIDA}/pc_7_ingles.png')
        comprobar(f'{nombre}: sin errores en consola', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
SERVIDOR.kill()
json.dump(MEDIDAS, open(f'{SALIDA}/medidas.json', 'w'), indent=1)
print('\nResultado:', 'TODO CORRECTO' if not fallos else f'{len(fallos)} fallos: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
