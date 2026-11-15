# Prueba en navegador (Chromium sin pantalla) de la lluvia que se ve (P11b, «La lluvia y el riego»: gotas alrededor de
# la cámara en una sola malla, cielo gris y luz más apagada al nublarse, con paso suave de un tiempo a otro). En el mundo
# de verdad (Whitholm), sin servidor, de día (?hora=11, el cielo vivo), en PC (1280×800) y en móvil (390×844):
#   - las pruebas automáticas sin ?tiempo lo ven despejado, quieto (ninguna otra prueba depende del tiempo que haga);
#   - nublado: el cielo, gris (menos azul) y la luz del sol mucho más débil; sin gotas;
#   - lloviendo: las gotas se ven (trazos claros finos, distintos de la misma vista sin lluvia), en una sola malla de
#     trazos (menos en el móvil), también contra el cielo;
#   - el paso de un tiempo a otro, suave: un segundo después de empezar a llover, solo un poco; al minuto, del todo;
#   - bajo techo, sin gotas (el tejado se quita para ver dentro);
#   - la lluvia se oye: el rumor suena con la lluvia y no sin ella; bajo techo, más bajo y apagado (menos agudos);
#   - y moja: lloviendo, el suelo y las piezas más oscuros (la misma vista sin gotas, contra la de nublado seco); al
#     parar sigue mojado un rato y se seca de a poco; bajo techo, lo de dentro menos mojado;
#   - lo que cuesta dibujarla: ms por fotograma con lluvia y sin ella (aquí, sin tarjeta gráfica: solo como dato; los
#     fotogramas de verdad los mide valravnx en su PC y su móvil);
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_lluvia_navegador.py <html> <carpeta_capturas>
# MUTAR=1: sin nublar el cielo, sin gotas y sin mojar (como antes de estas tareas): tiene que fallar.
import sys, os, io, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat, ImageChops
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_lluvia'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&hora=11'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg):
    pg.goto(BASE)
    pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    if MUTAR: pg.evaluate(f'{K}.cielo.nublar = () => {{}}; {K}.tiempoV.lluvia.paso = () => {{}}; {K}.cielo.mojar = () => {{}}')
    pg.wait_for_timeout(1500)

def poner(pg, t, pitch=0.12):
    pg.evaluate(f'{K}.tiempoV.poner({json.dumps(t)})')
    pg.evaluate(f'{K}.cam.pitch = {pitch}')
    pg.wait_for_timeout(2000)

def foto(pg, ruta=None):
    b = pg.screenshot(timeout=180000)
    if ruta: open(ruta, 'wb').write(b)
    return Image.open(io.BytesIO(b)).convert('RGB')

def media(im, caja):
    return [round(x) for x in ImageStat.Stat(im.crop(caja)).mean]

def trazos(a, b, caja, umbral=10):
    """píxeles que cambian en b respecto a a (las gotas: trazos sobre lo de detrás; contra el cielo gris claro, de poco
    contraste, como la lluvia de verdad: ahí con un umbral más bajo)"""
    d = ImageChops.difference(b.crop(caja).convert('L'), a.crop(caja).convert('L'))
    return sum(1 for v in d.getdata() if v > umbral)

def recorrido(pg, nombre, pref, movil):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    comprobar(f'{nombre}: sin ?tiempo, las pruebas lo ven despejado, quieto', pg.evaluate(f'{K}.tiempoV.fijo') == 'despejado' and pg.evaluate(f'{K}.tiempoV.ahora.lluvia') == 0)
    W, H = foto(pg).size
    cielo = (0, round(H * 0.05), W, round(H * 0.18))
    abajo = (round(W * 0.05), round(H * 0.45), round(W * 0.95), round(H * 0.95))
    # despejado
    poner(pg, 'despejado')
    sol0 = pg.evaluate(f'{K}.ambiente.sol.intensity')
    im0 = foto(pg, f'{SALIDA}/{pref}_1_despejado.png')
    c0 = media(im0, cielo)
    comprobar(f'{nombre}: despejado, el cielo azul', c0[2] > c0[0] + 12, str(c0))
    comprobar(f'{nombre}: despejado, sin gotas', not pg.evaluate(f'{K}.tiempoV.lluvia.malla.visible'))
    # nublado
    poner(pg, 'nublado')
    sol1 = pg.evaluate(f'{K}.ambiente.sol.intensity')
    im1 = foto(pg, f'{SALIDA}/{pref}_2_nublado.png')
    c1 = media(im1, cielo)
    comprobar(f'{nombre}: nublado, el cielo gris (casi nada de azul)', c1[2] - c1[0] < (c0[2] - c0[0]) * 0.5, f'{c1} (despejado {c0})')
    comprobar(f'{nombre}: nublado, la luz del sol mucho más débil', sol1 < sol0 * 0.4, f'{round(sol1, 2)} (despejado {round(sol0, 2)})')
    comprobar(f'{nombre}: nublado, sin gotas', not pg.evaluate(f'{K}.tiempoV.lluvia.malla.visible'))
    oido1 = pg.evaluate(f'{K}.tiempoV.oido')
    comprobar(f'{nombre}: nublado, la lluvia no suena', oido1['vol'] == 0, json.dumps(oido1))
    comprobar(f'{nombre}: nublado y seco, nada mojado', pg.evaluate(f'{K}.cielo.mojado') == 0)
    comprobar(f'{nombre}: nublado, el suelo más apagado', sum(media(im1, abajo)) < sum(media(im0, abajo)) - 15, f'{media(im1, abajo)} (despejado {media(im0, abajo)})')
    # lloviendo
    poner(pg, 'lluvia')
    im2 = foto(pg, f'{SALIDA}/{pref}_3_lluvia.png')
    info = pg.evaluate(f'(() => {{ const l = {K}.tiempoV.lluvia; return {{ visible: l.malla.visible, cuantas: l.cuantas, cantidad: l.cantidad, tipo: l.malla.type }}; }})()')
    comprobar(f'{nombre}: lloviendo, las gotas en una sola malla de trazos', info['visible'] and info['tipo'] == 'LineSegments' and info['cantidad'] > 0.99, json.dumps(info))
    comprobar(f'{nombre}: {"en el móvil, menos gotas" if movil else "en el PC, más gotas"}', (info['cuantas'] <= 3000) if movil else (info['cuantas'] >= 3000), str(info['cuantas']))
    # contra el cielo: la misma vista enseguida sin las gotas (las nubes se mueven: así casi no cambian entre las dos)
    pg.evaluate(f'{K}.tiempoV.lluvia.malla.material.uniforms.uOpacidad.value = 0'); pg.wait_for_timeout(300)
    im2b = foto(pg)
    pg.evaluate(f'{K}.tiempoV.lluvia.malla.material.uniforms.uOpacidad.value = 0.24')
    n_abajo = trazos(im1, im2, abajo); n_cielo = trazos(im2b, im2, cielo, 3)
    # moja: la misma vista sin gotas, más oscura que la de nublado seco
    seco, moj = media(im1, abajo), media(im2b, abajo)
    comprobar(f'{nombre}: lloviendo, el suelo mojado (más oscuro que nublado y seco)', pg.evaluate(f'{K}.cielo.mojado') > 0.99 and sum(moj) < sum(seco) * 0.85, f'{moj} (seco {seco}); mojado {pg.evaluate(f"{K}.cielo.mojado")}')
    oido2 = pg.evaluate(f'{K}.tiempoV.oido')
    comprobar(f'{nombre}: lloviendo al raso, la lluvia suena (con sus gotas sueltas)', oido2['vol'] > 0.95 and oido2['filtro'] > 5000, json.dumps(oido2))
    print(f'  (dato) {nombre}: el sonido, en un contexto «{oido2["contexto"]}»')
    area = (abajo[2] - abajo[0]) * (abajo[3] - abajo[1])
    comprobar(f'{nombre}: lloviendo, las gotas se ven (trazos claros sobre lo de detrás)', n_abajo > area * 0.004, f'{n_abajo} píxeles de {area}')
    comprobar(f'{nombre}: y también contra el cielo', n_cielo > 30, f'{n_cielo} píxeles')
    # de cerca, para mirar
    poner(pg, 'lluvia', pitch=0.02)
    foto(pg, f'{SALIDA}/{pref}_4_lluvia_horizonte.png')
    # el paso suave: de despejado a lluvia
    poner(pg, 'despejado')
    pg.evaluate(f'{K}.tiempoV.poner("lluvia", true)')
    pasos = pg.evaluate(f'(() => {{ const t = {K}.tiempoV, r = []; t.paso(1); r.push(t.ahora); for (let i = 0; i < 89; i++) t.paso(1); r.push(t.ahora); return r; }})()')
    uno, fin = pasos
    comprobar(f'{nombre}: un segundo después de empezar a llover, solo un poco (el paso es suave)', 0.01 < uno['lluvia'] < 0.3 and 0.01 < uno['nubes'] < 0.3, json.dumps(uno))
    comprobar(f'{nombre}: al minuto y medio, lloviendo del todo y el cielo cubierto', fin['lluvia'] > 0.95 and fin['nubes'] > 0.95, json.dumps(fin))
    techo = pg.evaluate(f'(() => {{ const t = {K}.tiempoV; t.paso(3, true); const dentro = t.lluvia.cantidad; t.paso(3, false); return [dentro, t.lluvia.cantidad]; }})()')
    comprobar(f'{nombre}: bajo techo no caen gotas (y al salir, sí)', techo[0] < 0.01 and techo[1] > 0.9, str(techo))
    dentro = pg.evaluate(f'(() => {{ const t = {K}.tiempoV; t.paso(3, true); const r = {{ oido: t.oido, mojado: {K}.cielo.mojado }}; t.paso(3, false); r.fuera = {{ oido: t.oido, mojado: {K}.cielo.mojado }}; return r; }})()')
    comprobar(f'{nombre}: bajo techo, la lluvia suena más baja y apagada', 0.3 < dentro['oido']['vol'] < 0.6 and dentro['oido']['filtro'] < 1500 and dentro['fuera']['oido']['vol'] > 0.9, json.dumps(dentro))
    comprobar(f'{nombre}: bajo techo, lo de dentro menos mojado', dentro['mojado'] < 0.5 and dentro['fuera']['mojado'] > 0.9, json.dumps(dentro))
    # para de llover: un rato después, sigue mojado y ya no suena; se seca de a poco
    pg.evaluate(f'{K}.tiempoV.poner("nublado", true)')
    sec = pg.evaluate(f'(() => {{ const t = {K}.tiempoV, r = []; for (let i = 0; i < 60; i++) t.paso(1); r.push({{ m: {K}.cielo.mojado, vol: t.oido.vol }}); for (let i = 0; i < 840; i++) t.paso(1); r.push({{ m: {K}.cielo.mojado }}); for (let i = 0; i < 1000; i++) t.paso(1); r.push({{ m: {K}.cielo.mojado }}); return r; }})()')
    comprobar(f'{nombre}: un minuto después de parar, sigue mojado y ya no suena', sec[0]['m'] > 0.9 and sec[0]['vol'] < 0.01, json.dumps(sec))
    comprobar(f'{nombre}: a los 15 min, a medio secar; a la media hora, seco', 0.3 < sec[1]['m'] < 0.7 and sec[2]['m'] == 0, json.dumps(sec))
    # la captura de después de la lluvia: el cielo aún cubierto y el suelo mojado, sin gotas
    poner(pg, 'lluvia'); pg.evaluate(f'{K}.tiempoV.poner("nublado", true)')
    pg.evaluate(f'(() => {{ const t = {K}.tiempoV; for (let i = 0; i < 60; i++) t.paso(1); }})()')
    pg.wait_for_timeout(1500)
    im5 = foto(pg, f'{SALIDA}/{pref}_5_mojado_tras_la_lluvia.png')
    comprobar(f'{nombre}: tras la lluvia, sin gotas y el suelo aún oscuro', not pg.evaluate(f'{K}.tiempoV.lluvia.malla.visible') and sum(media(im5, abajo)) < sum(seco) * 0.88, f'{media(im5, abajo)} (seco {seco})')
    # lo que cuesta (como dato)
    poner(pg, 'nublado'); sin = pg.evaluate('window.__graficos.medir(10)')
    poner(pg, 'lluvia'); con = pg.evaluate('window.__graficos.medir(10)')
    print(f'  (dato) {nombre}: ms por fotograma, sin lluvia {sin:.1f} y con lluvia {con:.1f} (sin tarjeta gráfica; perfil {pg.evaluate("window.__graficos.perfil")})')
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        recorrido(ctx.new_page(), nombre, pref, movil)
        ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
