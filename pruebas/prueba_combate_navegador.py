# Prueba en navegador real del campo de pruebas de combate de Kinhold.
# Se sirve por HTTP con la misma estructura que la web (jugar/combate/ y recursos/personajes/taller-v12/), porque los
# luchadores son el personaje del taller y se cargan de un .glb aparte. MUTAR=1 apunta a una carpeta de modelos que no
# existe: tiene que fallar.
import sys, os, json, base64, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_combate.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_combate'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/combate'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/combate/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v20'), f'{sitio}/recursos/personajes/taller-v20')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/combate/prueba.html' + ('?recursosMH=../../no-existe/' if os.environ.get('MUTAR') else '')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
D = 'window.__duelo'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

QUIETO = f"{D}.ia.pensar = () => ({{mx:0,mz:0,correr:false}})"

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function(f'{D} !== undefined', timeout=20000)
    ev = pg.evaluate
    def espera(ms): pg.wait_for_timeout(ms)
    # Sin tarjeta gráfica el navegador de pruebas va a 2-4 fps y el juego limita cada paso a 0,05 s:
    # el tiempo de juego corre hasta 10 veces más lento que el real. Por eso se espera a condiciones
    # con márgenes amplios, nunca un tiempo fijo, en lo que depende de la animación.
    def hasta(cond, ms=8000):
        try: pg.wait_for_function(cond, timeout=ms); return True
        except Exception: return False
    def centro_sector(linea):
        r = ev(f"({{x:{D}.rosa.x, y:{D}.rosa.y, r:{D}.rosa.r}})")
        off = {'alto': (0, -0.7), 'bajo': (0, 0.7), 'izquierda': (-0.7, 0), 'derecha': (0.7, 0), 'estocada': (0, 0)}[linea]
        return r['x'] + off[0] * r['r'], r['y'] + off[1] * r['r']

    def foto(ruta, quien='mJugador', ang=0.0, dist=1.9, alto=1.15, mira=1.05):
        # foto de cerca con una cámara aparte (la del juego sigue igual)
        url = ev(f"""(()=>{{const d={D}; const m=d.{quien}; const c=new d.camara.constructor(35,1,0.05,100);
          const a=m.rotation.y+{ang}; c.position.set(m.position.x+Math.sin(a)*{dist}, {alto}, m.position.z+Math.cos(a)*{dist});
          c.lookAt(m.position.x, {mira}, m.position.z); const r=d.renderer; const w=r.domElement.width/r.getPixelRatio(), h=r.domElement.height/r.getPixelRatio();
          r.setSize(800,800,false); r.setClearColor(0xa9c4dc,1); r.render(d.escena,c); const u=r.domElement.toDataURL('image/png');
          r.setClearColor(0,0); r.setSize(w,h,false); return u;}})()""")
        open(ruta, 'wb').write(base64.b64decode(url.split(',')[1]))
    def taller_listo():
        return hasta(f"{D}.mJugador.userData.taller.estado !== 'cargando' && (!{D}.mRival || {D}.mRival.userData.taller.estado !== 'cargando')", 30000) and \
            ev(f"{D}.mJugador.userData.taller.estado === 'listo' && (!{D}.mRival || {D}.mRival.userData.taller.estado === 'listo')")
    # distancia de cada muñeca al sitio del puño donde tiene que estar (el arma la coloca la lógica de poses)
    MANOS = f"""(()=>{{const u={D}.mJugador.userData, t=u.taller, V=u.manos.position.constructor;
        const eje=new V(0,1,0).transformDirection(u.manos.matrixWorld), o=u.manos.getWorldPosition(new V());
        const r=[]; for (const [l,s] of [['d',0.07],['i',-0.07]]) {{ const b=t.brazos[l]; const p=o.clone().addScaledVector(eje,s);
          const m=b.mano.getWorldPosition(new V()), f=b.dedo.getWorldPosition(new V()); r.push(+m.clone().lerp(f,0.5).distanceTo(p).toFixed(3)); }}
        return r; }})()"""

    print('Personaje del taller en el duelo')
    for arm, capas in [('lino', []), ('gambeson', ['gambeson']), ('malla', ['gambeson', 'cota'])]:
        ev(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', armadura:'{arm}', armaduraRival:'{arm}', dificultad:'aprendiz'}})")
        ok = taller_listo()
        comprobar(f'{arm}: los dos luchadores son el personaje del taller', ok, json.dumps(ev(f"{D}.mJugador.userData.taller.estado")))
        if not ok: continue
        # se ve la capa de fuera (lo tapado del todo no se dibuja)
        vis = ev(f"""(()=>{{const r=[]; {D}.mJugador.userData.taller.mh.modelo.traverse(n=>{{if(n.isMesh&&n.visible&&/_capa_(camisa|gambeson|cota)$/.test(n.name)) r.push(n.name.split('_').pop())}}); return r.sort()}})()""")
        fuera = (capas or ['camisa'])[-1]
        comprobar(f'{arm}: lleva puestas las capas {capas or "de lino (camisa y calzas)"}', ev(f"{D}.mJugador.userData.taller.capas") == capas and vis == [fuera], str(vis))
        comprobar(f'{arm}: el muñeco de antes ya no se ve', ev(f"(() => {{ const u = {D}.mJugador.userData; return u.cuerpo.children.filter(h => h.visible && h !== u.armas && h !== u.taller.mh.raiz).length; }})()") == 0)
    ev(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', armadura:'lino', armaduraRival:'malla', dificultad:'aprendiz'}})")
    taller_listo()
    ev(QUIETO)
    ev(f"{D}.rival.actualizar = () => []; {D}.jugador.z = {D}.rival.z - 8")
    espera(700)
    d = ev(MANOS)
    comprobar('en guardia, las dos manos agarran el puño de la espada', max(d) < 0.09, f'{d} m')
    foto(f'{SALIDA}/00a_taller_guardia.png', ang=0.5)
    foto(f'{SALIDA}/00b_taller_guardia_lado.png', ang=1.6)
    # golpes de las cinco líneas a medio camino: las manos siguen en el puño
    peor = 0
    for n, l in enumerate(['alto', 'izquierda', 'derecha', 'bajo', 'estocada']):
        ev(f"(()=>{{const j={D}.jugador; j._act = j._act || j.actualizar; j.actualizar=()=>[]; j.accion='golpeando'; j.linea='{l}'; j.duracion=1; j.tAccion=0.5;}})()")
        espera(350)
        dd = ev(MANOS); peor = max(peor, *dd)
        if max(dd) >= 0.09: print('    ', l, dd)
        foto(f'{SALIDA}/00c_taller_golpe_{n + 1}_{l}.png', ang=0.7, dist=2.7, alto=1.4, mira=1.2)
    comprobar('en los golpes de las cinco líneas las manos siguen en el puño', peor < 0.09, f'peor {peor} m')
    ev(f"(()=>{{const j={D}.jugador; j.actualizar=j._act; j.accion='quieto'; j.linea=null;}})()")
    ev(f"(()=>{{const j={D}.jugador; for (const [z,s,t] of [['torso',0.5,'corte'],['cabeza',0.2,'contundente'],['brazoI',0.5,'perforante'],['piernaD',0.9,'corte']]) j.recibirHerida(z,s,t);}})()")
    espera(400)
    her = ev(f"""(()=>{{const r=[]; {D}.mJugador.traverse(n=>{{if(n.name==='herida'&&n.visible!==false) r.push([n.parent.name, n.userData.superficie])}}); return r}})()""")
    comprobar('cada herida se pinta pegada al cuerpo, en su hueso', len(her) == 4 and all(s for _, s in her) and sorted(h[0] for h in her) == ['head', 'spine_02', 'thigh_r', 'upperarm_l'], json.dumps(her))
    foto(f'{SALIDA}/00d_taller_heridas.png', ang=0.2)
    foto(f'{SALIDA}/00e_taller_herida_cabeza.png', ang=0.1, dist=0.9, alto=1.45, mira=1.35)
    foto(f'{SALIDA}/00f_rival_malla.png', quien='mRival', ang=0.4)

    print('Curación de heridas')
    # el rival, quieto y lejos; el jugador con las cuatro heridas de antes, libre para curarse
    ev(f"{QUIETO}; {D}.rival.actualizar = () => []; {D}.rival.z = {D}.jugador.z + 9; {D}.jugador.accion = 'libre'")
    comprobar('con heridas aparece el botón Curar', pg.is_visible('#btnCurar'))
    # tocar el aviso de la herida de la pierna (la cuarta) enseña qué se le puede hacer
    pg.click('#avisos .aviso[data-h="3"]'); espera(200)
    det = pg.inner_text('#detalle')
    comprobar('el aviso de una herida enseña cómo tratarla', pg.is_visible('#detalle') and 'Vendar' in det and 'Coser' in det and 'Entablillar' not in det, det.replace('\n', ' | '))
    pg.screenshot(path=f'{SALIDA}/00i_curar_opciones.png')
    pg.click('#detalle button.cura[data-m="vendar"]'); espera(150)
    comprobar('elegir Vendar empieza la cura (curando, sin poder parar)', ev(f"{D}.jugador.accion") == 'curando' and (ev(f"{D}.parar(true), {D}.jugador.bloqueando") is False), ev(f"{D}.jugador.accion"))
    comprobar('mientras, el aviso «Curando» y el botón Curar encendido', 'Curando' in pg.inner_text('#avisos') and ev("document.getElementById('btnCurar').classList.contains('activo')"))
    pg.screenshot(path=f'{SALIDA}/00j_curando.png')
    ev(f"{D}.jugador.duracion = 0.3")   # sin GPU el tiempo de juego va muy lento: se acorta la espera
    comprobar('al terminar, la herida queda vendada y gasta una venda', hasta(f"{D}.jugador.heridas[3].vendada", 15000) and ev(f"{D}.jugador.botiquin.vendas") == 2 and 'Hecho: vendar' in pg.inner_text('#registro'))
    # la tecla C trata la herida más urgente (el torso, que es la que más sangra ahora)
    pg.keyboard.press('c'); espera(100)
    comprobar('la tecla C trata la herida más urgente', ev(f"{D}.jugador.accion") == 'curando', ev(f"{D}.jugador.cura && {D}.jugador.cura.metodo"))
    ev(f"{D}.jugador.recibirHerida('brazoD', 0.1, 'corte')"); espera(300)
    comprobar('si te hieren mientras curas, la cura se pierde', ev(f"{D}.jugador.accion") != 'curando' and 'la cura se pierde' in pg.inner_text('#registro'))
    ev(f"(()=>{{const j={D}.jugador; j.cancelado=null; j.accion='libre'; j.curar(0,'vendar'); j.duracion=0.3;}})()")
    hasta(f"{D}.jugador.heridas[0].vendada", 15000)
    ev(f"(()=>{{const j={D}.jugador; j.accion='libre'; j.curar(3,'coser'); j.duracion=0.3;}})()")
    hasta(f"{D}.jugador.heridas[3].cosida", 15000); espera(400)
    vend = ev(f"(()=>{{let n=0; {D}.mJugador.traverse(o=>{{if(o.name==='herida'&&o.material&&o.material.color.getHex()===0xcfc3a8) n++}}); return n}})()")
    comprobar('las heridas vendadas llevan su venda de lino enrollada', vend == 2, f'{vend} vendas')
    ev(f"(()=>{{const j={D}.jugador; j.recibirHerida('piernaI',0.6,'contundente'); j.accion='libre'; j.curar(j.heridas.length-1,'entablillar'); j.duracion=0.3;}})()")
    comprobar('entablillar una pierna rota: venda y dos tablillas', hasta(f"{D}.jugador.heridas.some(h => h.entablillada)", 15000) and (espera(400) or True) and ev(f"(()=>{{let n=0; {D}.mJugador.traverse(o=>{{if(o.name==='herida'&&o.material&&o.material.color.getHex()===0x7a5a3a) n++}}); return n}})()") == 2)
    foto(f'{SALIDA}/00k_taller_vendado.png', ang=0.2)
    foto(f'{SALIDA}/00l_taller_vendado_pierna.png', ang=0.3, dist=1.2, alto=0.8, mira=0.6)
    for arma in ['espada_escudo', 'palo', 'arco']:
        ev(f"{D}.configurar({{modo:'duelo', arma:'{arma}', armadura:'gambeson', dificultad:'aprendiz'}}); {QUIETO}; {D}.rival.actualizar = () => []; {D}.jugador.z = {D}.rival.z - 8")
        taller_listo(); espera(500)
        foto(f'{SALIDA}/00g_taller_{arma}.png', ang=0.5)
        if arma == 'espada_escudo':
            ev(f"{D}.parar(true)"); espera(500)
            asa = ev(f"""(()=>{{const u={D}.mJugador.userData, V=u.manos.position.constructor; const b=u.taller.brazos.i;
              const a=new V(0,0,-0.07).applyMatrix4(u.escudo.matrixWorld); return +b.mano.getWorldPosition(new V()).lerp(b.dedo.getWorldPosition(new V()),0.5).distanceTo(a).toFixed(3)}})()""")
            comprobar('con escudo, la mano izquierda lo agarra por el asa al pararlo', asa < 0.1, f'{asa} m')
            foto(f'{SALIDA}/00h_taller_escudo_parando.png', ang=0.5)
            ev(f"{D}.parar(false)")

    print('Duelo: rosa y ataque con el ratón')
    ev(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', armadura:'lino', armaduraRival:'lino', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 1.7")
    espera(900)
    comprobar('la rosa aparece sobre el rival', pg.is_visible('#rosa'))
    pos = ev(f"(() => {{ const r = document.getElementById('rosa').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }})()")
    comprobar('la rosa está dentro de la pantalla', pos[0] >= 0 and pos[1] >= 0 and pos[0] + pos[2] <= 1280 and pos[1] + pos[3] <= 800, str([round(v) for v in pos]))
    pg.screenshot(path=f'{SALIDA}/01_duelo_rosa.png')
    # el cursor elige la zona: comprobamos las cinco
    bien = True
    for l in ['alto', 'izquierda', 'derecha', 'bajo', 'estocada']:
        x, y = centro_sector(l); pg.mouse.move(x, y); espera(60)
        if ev(f"{D}.lineaSel") != l: bien = False; print('    zona', l, '->', ev(f"{D}.lineaSel"))
    comprobar('el cursor elige cada una de las cinco zonas', bien)
    comprobar('la zona bajo el cursor se resalta', ev("document.querySelector('#rosa [data-l=estocada]').classList.contains('sel')"))
    x, y = centro_sector('alto'); pg.mouse.move(x, y); espera(60)
    pg.mouse.down(); pg.mouse.up()
    comprobar('el clic empieza el golpe por la zona elegida', ev(f"{D}.jugador.accion") == 'preparando' and ev(f"{D}.jugador.linea") == 'alto')
    # finta: clic en otra zona durante la preparación
    x, y = centro_sector('derecha'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.up()
    comprobar('clic en otra zona mientras preparas = finta', ev(f"{D}.jugador.linea") == 'derecha' and ev(f"{D}.jugador.finta"), f"progreso {ev(f'{D}.jugador.progreso()')}")
    pg.screenshot(path=f'{SALIDA}/02_preparando_golpe.png')
    hasta(f"{D}.rival.heridas.length >= 1")
    comprobar('el golpe sin parada hiere al rival', ev(f"{D}.rival.heridas.length") >= 1, json.dumps(ev(f"{D}.rival.heridas")))

    print('Parada del rival y pausa de impacto')
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 1.7")
    espera(300)
    ev(f"{D}.rival.bloquear(true); {D}.rival.tBloqueo = 1")
    antes = ev(f"{D}.rival.heridas.length")
    hasta(f"{D}.jugador.accion === 'libre'")
    p0 = ev(f"{D}.pausas")
    ev(f"{D}.atacar('izquierda')")
    hasta(f"{D}.jugador.accion === 'recuperando'", 30000)
    vio_pausa = ev(f"{D}.pausas") > p0
    comprobar('el rival para con la parada sin elegir lado', ev(f"{D}.rival.heridas.length") == antes and 'para tu golpe' in pg.inner_text('#registro'))
    comprobar('el choque produce pausa de impacto', vio_pausa)

    print('Aprendiz: avisos en la rosa y parada perfecta')
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 1.6")
    espera(300)
    ev(f"{D}.rival.atacar('izquierda')")  # su izquierda entra por tu derecha
    rojo = hasta("document.querySelector('#rosa [data-l=derecha]').classList.contains('amenaza')", 3000)
    comprobar('la zona del golpe que viene se pone roja (lado espejo)', rojo)
    pg.screenshot(path=f'{SALIDA}/03_aviso_rojo.png')
    # Espacio se pulsa desde la propia página en el primer fotograma en verde: con tarjeta gráfica el juego va a su
    # velocidad y la ventana (0,25 s) es más corta que la ida y vuelta desde Python (en el PC de valravnx, 31 oct, la
    # parada llegaba tarde); sin tarjeta, a 2-4 fps, daba igual. Y no en el primerísimo: la ventana es de 0,25 s y, pulsando
    # en su borde, un fotograma de más la sacaba de ella (en el PC fallaba o no según cosas tan ajenas como el tamaño de
    # los textos traducidos); se pulsa ya bien dentro, a 0,15 s del impacto
    ev("""(() => { const s = document.querySelector('#rosa [data-l=derecha]'); window.__vioVerde = false;
      const mira = () => { if (s.classList.contains('verde') && window.__duelo.rival.hastaImpacto() <= 0.15) { window.__vioVerde = true; dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' })); } else requestAnimationFrame(mira); };
      mira(); })()""")
    verde = hasta("window.__vioVerde", 5000)
    comprobar('se pone verde en la ventana de parada perfecta', verde)
    hasta(f"{D}.rival.accion !== 'preparando'", 4000)
    espera(100)
    ev("dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))")
    st = ev(f"{D}.stats")
    comprobar('parar con Espacio en verde da parada perfecta', st['perfectas'] == 1, json.dumps(st))
    comprobar('y abre el contraataque', ev(f"{D}.jugador.puedeContraatacar()") and ev("document.getElementById('rosa').classList.contains('contra')"))
    pg.screenshot(path=f'{SALIDA}/05_contraataque.png')
    ev(f"{D}.atacar('alto')")
    comprobar('el contraataque es imparable', ev(f"{D}.jugador.imparable"))
    ev(f"{D}.rival.bloquear(true); {D}.rival.tBloqueo = 1")  # para "normal": no basta
    hasta(f"{D}.jugador.accion !== 'preparando'", 15000)  # márgenes amplios: a 2-4 fps el juego va más lento
    hasta(f"{D}.rival.heridas.length >= 1", 8000)
    comprobar('una parada normal no detiene el contraataque', ev(f"{D}.rival.heridas.length") >= 1)

    # captura del aviso verde (sin parar)
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'aprendiz'}})"); ev(QUIETO); ev(f"{D}.jugador.z = {D}.rival.z - 1.6")
    espera(300); ev(f"{D}.rival.atacar('alto')")
    hasta("document.querySelector('#rosa [data-l=alto]').classList.contains('verde')", 5000)
    pg.screenshot(path=f'{SALIDA}/04_aviso_verde.png')
    espera(800)

    print('Golpe maestro')
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 1.6")
    espera(300)
    ev(f"{D}.rival.atacar('derecha')")
    hasta(f"{D}.rival.progreso() > 0.1", 3000)
    dorado = ev("document.querySelector('#rosa [data-l=izquierda]').classList.contains('maestro')")
    ev(f"{D}.atacar('izquierda')")
    comprobar('el borde dorado marca que cabe el golpe maestro', dorado)
    hasta(f"{D}.rival.accion !== 'preparando'", 15000)  # márgenes amplios: a 2-4 fps el juego va más lento
    hasta(f"{D}.rival.heridas.length >= 1", 15000)
    st = ev(f"{D}.stats")
    comprobar('golpear por el lado espejo a tiempo es golpe maestro y hiere', st['maestros'] == 1 and ev(f"{D}.rival.heridas.length") >= 1 and ev(f"{D}.jugador.heridas.length") == 0, json.dumps(st))

    print('Movimiento encarado')
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 2.5")
    espera(200)
    r0 = ev(f"Math.hypot({D}.jugador.x-{D}.rival.x, {D}.jugador.z-{D}.rival.z)")
    # se mantiene la tecla hasta que se ha movido de lado (no un tiempo fijo: a 2-4 fps el juego va más lento)
    pg.keyboard.down('d'); espera(1500); hasta(f"Math.abs({D}.jugador.x) > 0.7", 15000); pg.keyboard.up('d')
    r1 = ev(f"Math.hypot({D}.jugador.x-{D}.rival.x, {D}.jugador.z-{D}.rival.z)")
    x1 = ev(f"{D}.jugador.x")
    comprobar('el lateral rodea al rival sin alejarse mucho', abs(x1) > 0.5 and abs(r1 - r0) < 0.6, f'distancia {r0:.2f} -> {r1:.2f}, x={x1:.2f}')
    mira = ev(f"(() => {{ const j={D}.jugador, r={D}.rival; let d = Math.atan2(r.x-j.x, r.z-j.z) - j.rot; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return Math.abs(d); }})()")
    comprobar('y sigue de cara al rival', mira < 0.25, f'{mira:.2f} rad')
    espera(600)
    pg.screenshot(path=f'{SALIDA}/07_rodeando.png')
    # con la distribución rusa, D escribe «в»: el duelo tiene que leer la tecla física (KeyD)
    ev(QUIETO)
    ev(f"{D}.jugador.x = 0; {D}.jugador.z = {D}.rival.z - 2.5")
    espera(200)
    ev("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'в', code: 'KeyD' }))")
    espera(1500); hasta(f"Math.abs({D}.jugador.x) > 0.7", 15000)
    ev("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'в', code: 'KeyD' }))")
    x2 = ev(f"{D}.jugador.x")
    comprobar('con la distribución rusa, D (que escribe «в») mueve de lado', abs(x2) > 0.5, f'x={x2:.2f}')

    print('Combate libre contra la máquina (normal)')
    ev(f"{D}.configurar({{modo:'duelo', dificultad:'normal'}})")
    ev(f"{D}.jugador.z = {D}.rival.z - 1.6")
    # el jugador para cuando viene el golpe (sin ayuda de lado)
    for n in range(120):
        ev(f"""(() => {{ const d={D}; if (d.rival.accion==='preparando' && d.rival.hastaImpacto() < 0.2 && d.jugador.accion==='libre') d.parar(true); else if (d.rival.accion!=='preparando' && d.rival.accion!=='golpeando') d.parar(false); }})()""")
        espera(60)
    st = ev(f"{D}.stats")
    comprobar('el rival ataca y el jugador para sus golpes', st['paradas'] >= 2, json.dumps(st))
    comprobar('ningún golpe del rival va al aire', 'al aire' not in pg.inner_text('#registro'))
    pg.screenshot(path=f'{SALIDA}/08_duelo_normal.png')
    ev(f"{D}.rival.caer('Desangrado')")
    espera(700)
    comprobar('al caer el rival aparece la pantalla de victoria', pg.is_visible('#final') and 'vencido' in pg.inner_text('#tituloFinal'))
    pg.screenshot(path=f'{SALIDA}/09_victoria.png')

    print('Prácticas: arco, retícula y dianas')
    ev(f"{D}.configurar({{modo:'practicas', arma:'arco'}})")
    espera(300)
    comprobar('la rosa no aparece con arco y sí la retícula', not pg.is_visible('#rosa') and pg.is_visible('#reticula'))
    aciertos = ev(f"""(async () => {{
      const d = {D}; const tensiones = [];
      for (let k = 0; k < 6; k++) {{
        d.apuntar(0, 1.3, 18);
        let e = 0;
        while (d.jugador.accion !== 'libre' && e < 30000) {{ await new Promise(r => setTimeout(r, 50)); e += 50; }}  // encajar la flecha (v3)
        d.jugador.empezarTensar();
        while ((d.jugador.tension < 1 || d.jugador.tTenso < 0.15) && e < 30000) {{ await new Promise(r => setTimeout(r, 50)); e += 50; }}
        tensiones.push(+d.jugador.tension.toFixed(2));
        d.disparar();
        await new Promise(r => setTimeout(r, 1200));
      }}
      return {{...d.stats, tensiones}};
    }})()""")
    comprobar('a plena tensión se acierta la diana de 20 m', aciertos['aciertos'] >= 5, json.dumps(aciertos))
    # arco v3: soltar con poca tensión no dispara y lo avisa
    hasta(f"{D}.jugador.accion === 'libre'", 30000)
    antes = ev(f"{D}.stats.flechas")
    ev(f"{D}.apuntar(0,1.3,18); {D}.jugador.empezarTensar()")
    espera(120)
    ev(f"{D}.disparar()")
    espera(150)
    reg = pg.inner_text('#registro')
    comprobar('soltar flojo no dispara y avisa', ev(f"{D}.stats.flechas") == antes and 'flojo' in reg, reg.split('\n')[0])
    ev(f"{D}.cam.yaw=Math.PI+0.25; {D}.cam.pitch=0.35; {D}.cam.dist=9")
    pg.mouse.move(640, 330)
    ev(f"{D}.apuntar(0,1.3,18); {D}.jugador.empezarTensar()")
    hasta(f"{D}.jugador.tension >= 1", 30000)
    hasta("document.getElementById('reticula').classList.contains('lista') && document.getElementById('reticula').offsetWidth < 30", 30000)
    comprobar('la retícula se cierra y se pone verde a plena tensión', ev("document.getElementById('reticula').classList.contains('lista')") and ev("document.getElementById('reticula').offsetWidth") < 30)
    pg.screenshot(path=f'{SALIDA}/10_arco_tensado.png')
    ev(f"{D}.disparar()")
    espera(400)
    ev(f"{D}.cam.yaw=Math.PI; {D}.cam.pitch=0.25; {D}.cam.dist=26")
    espera(900)
    pg.screenshot(path=f'{SALIDA}/11_flechas_en_dianas.png')

    print('Prácticas: poste')
    ev(f"{D}.configurar({{modo:'practicas', arma:'espada_larga'}})")
    ev(f"{D}.jugador.x = -3; {D}.jugador.z = -3.6")
    espera(600)
    comprobar('la rosa aparece sobre el poste', pg.is_visible('#rosa'))
    ev(f"{D}.atacar('izquierda')")
    hasta(f"{D}.jugador.accion === 'recuperando' || {D}.jugador.accion === 'libre'", 30000)
    hasta("document.getElementById('registro').innerText.includes('Poste')", 15000)
    reg = pg.inner_text('#registro')
    comprobar('el poste registra el golpe y su fuerza', 'Poste' in reg, reg.split('\n')[0])

    print('Carga desde 40 m')
    ev(f"{D}.configurar({{modo:'carga', arma:'arco'}})")
    z0, t0 = ev(f"[{D}.rival.z, {D}.rival.reloj]")
    espera(1500)
    z1, t1 = ev(f"[{D}.rival.z, {D}.rival.reloj]")
    v = (z0 - z1) / max(t1 - t0, 1e-3)
    comprobar('el rival corre hacia ti', v > 4.5, f'{v:.1f} m/s en tiempo de juego')
    pg.screenshot(path=f'{SALIDA}/12_carga.png')

    print('Escudo (v4)')
    ev(f"{D}.configurar({{modo:'duelo', arma:'espada_escudo', armaRival:'espada_escudo', armadura:'gambeson', armaduraRival:'lino', dificultad:'aprendiz'}})")
    ev(QUIETO)
    ev(f"{D}.jugador.z = {D}.rival.z - 1.6")
    espera(500)
    comprobar('los dos llevan escudo a la vista', ev(f"!!{D}.mJugador.getObjectByName('escudo') && !!{D}.mRival.getObjectByName('escudo')"))
    y0 = ev(f"{D}.mJugador.getObjectByName('escudo').position.y")
    ev(f"{D}.cam.yaw = Math.PI + 1.2; {D}.cam.pitch = 0.3; {D}.cam.dist = 5; {D}.cam.manual = 1e9")
    espera(400)
    pg.screenshot(path=f'{SALIDA}/12b_escudo_reposo.png')
    ev(f"{D}.parar(true)")
    espera(500)
    y1 = ev(f"{D}.mJugador.getObjectByName('escudo').position.y")
    comprobar('al parar el escudo se levanta', y1 > y0 + 0.15, f'{y0:.2f} -> {y1:.2f} m')
    pg.screenshot(path=f'{SALIDA}/12c_escudo_levantado.png')
    ev(f"{D}.parar(false)")
    ev(f"{D}.cam.manual = -99")
    # tiro contra ti con el escudo levantado y sin él (prácticas: nadie más en medio)
    def flecha_contra_jugador(parando):
        ev(f"{D}.configurar({{modo:'practicas', arma:'espada_escudo'}})")
        ev(f"{D}.jugador.x = 0; {D}.jugador.z = -3.6; {D}.jugador.rot = 0")
        espera(100)
        if parando: ev(f"{D}.parar(true)")
        ev(f"""{D}.ctx.luchadores.tirador = {{arma:'arco', x:0, z:12, rot:Math.PI, def:{{vMin:18, vMax:55}}, factorBrazo:()=>1}}""")
        ev(f"""{D}.lanzar('tirador', {{x:0, y:1.3, z:-3.6}}, {{tension:1, tTenso:0.2}})""")
        # se espera a que la flecha acabe su vuelo (no un tiempo fijo: sin tarjeta gráfica los fotogramas van lentos)
        hasta(f"{D}.proyectiles.every(p => !p.p.activo)", 10000); espera(150)
        res = (ev(f"{D}.jugador.heridas.length"), pg.inner_text('#registro').split('\n')[0])
        ev(f"{D}.parar(false)")
        return res
    h, reg = flecha_contra_jugador(True)
    comprobar('tu escudo levantado para una flecha de frente', h == 0 and 'escudo' in reg, reg)
    h, reg = flecha_contra_jugador(False)
    comprobar('sin parar, la flecha te hiere', h >= 1, reg)
    ult = ev(f"{D}.registroAcciones.entradas.slice(-2)")
    comprobar('el disparo y su herida quedan en el registro de acciones con su autor',
              len(ult) == 2 and ult[0]['tipo'] == 'disparo' and ult[1]['tipo'] == 'impacto' and ult[1]['autor'] == 'tirador' and ult[1]['datos']['objetivo'] == 'jugador' and ult[1]['resultado'] == 'herida', str(ult))
    golpes = ev(f"{D}.registroAcciones.entradas.filter(e => e.tipo === 'golpe').map(e => e.autor)")
    comprobar('los golpes cuerpo a cuerpo de la partida quedan anotados con su autor', len(golpes) > 0 and set(golpes) <= {'jugador', 'rival'}, f'{len(golpes)} golpes')
    # el rival con escudo para tus flechas
    ev(f"{D}.configurar({{modo:'duelo', arma:'arco', armaRival:'espada_escudo', dificultad:'aprendiz'}})")
    ev(f"{D}.rival.z = {D}.jugador.z + 14")
    espera(200)
    ev(f"{D}.apuntar({D}.rival.x, 1.3, {D}.rival.z); {D}.jugador.empezarTensar()")
    hasta(f"{D}.jugador.tension >= 1", 30000)
    espera(150)
    comprobar('el rival levanta el escudo al verte tensar', ev(f"{D}.rival.bloqueando"))
    ev(f"{D}.apuntar({D}.rival.x, 1.3, {D}.rival.z); {D}.disparar()")
    hasta(f"{D}.proyectiles.length > 0 && {D}.proyectiles.every(p => !p.p.activo)", 10000); espera(150)
    reg = pg.inner_text('#registro')
    comprobar('y para tu flecha con el escudo', ev(f"{D}.rival.heridas.length") == 0 and 'escudo' in reg, reg.split('\n')[0])
    pg.click('#btnOpciones'); espera(200)
    n = ev("document.querySelectorAll('#selArmaRival option').length")
    comprobar('opciones: arma del rival con espada y escudo', n == 4 and ev("[...document.querySelectorAll('#selArmaRival option')].some(o => o.value === 'espada_escudo')"), f'{n} opciones')
    pg.click('#btnOpciones')

    print('Paneles')
    ev(f"{D}.configurar({{modo:'practicas', arma:'espada_larga'}})")  # sin rival: que nadie caiga y tape los botones
    espera(200)
    pg.click('#btnOpciones'); espera(200)
    comprobar('opciones sin selector de sistema, con sonido', pg.query_selector('#selSistema') is None and pg.is_visible('#chkSonido'))
    pg.screenshot(path=f'{SALIDA}/13_opciones.png')
    pg.click('#btnOpciones')
    pg.click('#btnAyuda'); espera(200)
    pg.screenshot(path=f'{SALIDA}/14_ayuda.png')
    pg.click('#panelAyuda .cerrar')
    pg.click('#btnDecisiones'); espera(200)
    comprobar('el panel de decisiones dice v2', 'v2' in pg.inner_text('#panelRegistro'))
    pg.click('#panelRegistro .cerrar')

    fps = ev("""new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })""")
    print(f'  (fotogramas por segundo en el navegador de pruebas, sin GPU: {fps})')
    comprobar('sin errores en consola (PC)', len(err) == 0, '; '.join(err[:3]))
    pg.close()

    print('Móvil')
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    mv = ctx.new_page()
    err2 = []
    mv.on('pageerror', lambda e: err2.append(str(e)))
    mv.goto(URL)
    mv.wait_for_function(f'{D} !== undefined', timeout=20000)
    mv.evaluate(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', dificultad:'aprendiz'}}); {QUIETO}; {D}.jugador.z={D}.rival.z-1.7")
    mv.wait_for_timeout(900)
    comprobar('botón Parar, joystick y rosa visibles en táctil', mv.is_visible('#btnParar') and mv.is_visible('#joystick') and mv.is_visible('#rosa'))
    r = mv.evaluate(f"({{x:{D}.rosa.x, y:{D}.rosa.y, r:{D}.rosa.r}})")
    pb = mv.evaluate("(() => { const b = document.getElementById('btnParar').getBoundingClientRect(); const j = document.getElementById('joystick').getBoundingClientRect(); return [b.left, b.top, j.right, j.top]; })()")
    comprobar('la rosa no tapa el botón Parar ni el joystick', r['y'] + r['r'] < pb[1] and r['y'] + r['r'] < pb[3], f"rosa hasta y={r['y']+r['r']:.0f}, parar y={pb[1]:.0f}")
    mv.screenshot(path=f'{SALIDA}/15_movil_duelo.png')
    mv.touchscreen.tap(r['x'] - r['r'] * 0.7, r['y'])
    mv.wait_for_timeout(100)
    comprobar('tocar la zona izquierda de la rosa golpea por la izquierda', mv.evaluate(f"{D}.jugador.linea") == 'izquierda' and mv.evaluate(f"{D}.jugador.accion") in ('preparando', 'golpeando', 'recuperando'))
    mv.wait_for_timeout(200)
    mv.screenshot(path=f'{SALIDA}/16_movil_golpe.png')

    # Cámara táctil con un dedo (GDD): arrastrar por zona libre gira; tocar sin arrastrar no la mueve; el dedo del
    # joystick no cuenta; con el arco tenso y el dedo junto al borde, la cámara sigue hacia ese lado.
    cdp = ctx.new_cdp_session(mv)
    def toque(tipo, puntos):
        cdp.send('Input.dispatchTouchEvent', {'type': tipo, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, x, y in puntos]})
    def arrastre(i, x0, y0, x1, y1, pasos=8, otros=()):
        for k in range(1, pasos + 1):
            toque('touchMove', list(otros) + [(i, x0 + (x1 - x0) * k / pasos, y0 + (y1 - y0) * k / pasos)])
            mv.wait_for_timeout(30)
    mv.evaluate(f"{D}.configurar({{modo:'duelo', arma:'espada_larga', dificultad:'aprendiz'}}); {QUIETO}; {D}.jugador.z={D}.rival.z-1.7; {D}.rival.actualizar = () => []")
    mv.wait_for_timeout(600)
    r = mv.evaluate(f"({{x:{D}.rosa.x, y:{D}.rosa.y, r:{D}.rosa.r}})")
    lx, ly = 120, r['y'] + r['r'] * 1.5 + 30   # zona libre bajo la rosa, encima de los botones
    comprobar('el punto de prueba es zona libre del lienzo', mv.evaluate(f"document.elementFromPoint({lx},{ly}).id") == 'lienzo')
    y0 = mv.evaluate(f"{D}.cam.yaw"); acc0 = mv.evaluate(f"{D}.jugador.accion")
    toque('touchStart', [(1, lx, ly)]); mv.wait_for_timeout(60); toque('touchMove', [(1, lx + 4, ly + 3)]); toque('touchEnd', [])
    mv.wait_for_timeout(100)
    y1 = mv.evaluate(f"{D}.cam.yaw")
    comprobar('móvil: tocar zona libre sin arrastrar no gira la cámara ni golpea', abs(y1 - y0) < 0.01 and mv.evaluate(f"{D}.jugador.accion") == acc0, f"giro {y1 - y0:.3f}")
    toque('touchStart', [(1, lx, ly)]); arrastre(1, lx, ly, lx + 100, ly); toque('touchEnd', [])
    y2 = mv.evaluate(f"{D}.cam.yaw")
    comprobar('móvil: arrastrar un dedo 100 px a la derecha gira la cámara', y2 - y1 < -0.45, f"giro {y2 - y1:.2f} rad")
    mv.wait_for_timeout(300)
    mv.screenshot(path=f'{SALIDA}/16c_movil_camara_un_dedo.png')
    j = mv.evaluate("(() => { const b = document.getElementById('joystick').getBoundingClientRect(); return [b.left + b.width/2, b.top + b.height/2]; })()")
    toque('touchStart', [(5, j[0], j[1])]); mv.wait_for_timeout(60)
    toque('touchStart', [(5, j[0], j[1]), (1, lx, ly)])
    arrastre(1, lx, ly, lx - 80, ly, otros=[(5, j[0], j[1])])
    toque('touchEnd', [(5, j[0], j[1])]); toque('touchEnd', [])
    y3 = mv.evaluate(f"{D}.cam.yaw")
    comprobar('móvil: con un dedo en el joystick, el otro gira la cámara entero', y3 - y2 > 0.38, f"giro {y3 - y2:.2f} rad (80 px = 0,48)")
    mv.evaluate(f"{D}.configurar({{modo:'duelo', arma:'arco', dificultad:'aprendiz'}}); {QUIETO}; {D}.rival.actualizar = () => []; {D}.jugador.z = {D}.rival.z - 8")
    mv.wait_for_timeout(600)
    cx, cy = 195, 420
    y4 = mv.evaluate(f"{D}.cam.yaw")
    toque('touchStart', [(1, cx, cy)]); arrastre(1, cx, cy, 384, cy, pasos=5)
    mv.wait_for_timeout(1200)
    y5 = mv.evaluate(f"{D}.cam.yaw"); tensa = mv.evaluate(f"{D}.jugador.accion")
    mv.screenshot(path=f'{SALIDA}/16d_movil_arco_borde.png')
    comprobar('móvil: con el arco tenso y el dedo junto al borde derecho, la cámara gira hacia allí', y5 - y4 < -0.05 and tensa == 'tensando', f"giro {y5 - y4:.2f} rad, {tensa}")
    toque('touchEnd', [])
    mv.wait_for_timeout(300)
    comprobar('móvil: al soltar el arco deja de seguir y dispara', mv.evaluate(f"{D}.dedoArco") is None and mv.evaluate(f"{D}.jugador.accion") != 'tensando')
    mv.evaluate(f"{D}.configurar({{modo:'duelo', arma:'espada_escudo', armaRival:'espada_escudo', dificultad:'aprendiz'}}); {QUIETO}; {D}.jugador.z={D}.rival.z-1.6")
    mv.wait_for_timeout(600)
    b = mv.evaluate("(() => { const r = document.getElementById('btnParar').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()")
    mv.evaluate(f"{D}.parar(true)")
    mv.wait_for_timeout(500)
    comprobar('móvil: con escudo, Parar lo levanta', mv.evaluate(f"{D}.jugador.bloqueando") and mv.evaluate(f"{D}.mJugador.getObjectByName('escudo').position.y") > 1.2)
    mv.screenshot(path=f'{SALIDA}/16b_movil_escudo.png')
    mv.evaluate(f"{D}.parar(false)")
    # curarse en el móvil: el botón Curar sale con heridas, no tapa Parar y trata la más urgente
    mv.evaluate(f"(()=>{{const j={D}.jugador; j.recibirHerida('torso',0.5,'corte'); j.accion='libre'; {D}.rival.actualizar=()=>[]; {D}.rival.z=j.z+9;}})()")
    mv.wait_for_timeout(400)
    bc = mv.evaluate("(() => { const c = document.getElementById('btnCurar').getBoundingClientRect(), p = document.getElementById('btnParar').getBoundingClientRect(); return [c.bottom <= p.top, c.right <= 390, c.width, c.height]; })()")
    comprobar('móvil: botón Curar visible, sin tapar Parar', mv.is_visible('#btnCurar') and bc[0] and bc[1] and bc[3] >= 40, str(bc))
    mv.tap('#btnCurar'); mv.wait_for_timeout(200)
    comprobar('móvil: tocar Curar empieza a vendar', mv.evaluate(f"{D}.jugador.accion") == 'curando')
    mv.screenshot(path=f'{SALIDA}/16e_movil_curando.png')
    mv.click('#btnAyuda')
    mv.wait_for_timeout(300)
    mv.screenshot(path=f'{SALIDA}/17_movil_ayuda.png')
    comprobar('sin errores en consola (móvil)', len(err2) == 0, '; '.join(err2[:3]))
    nav.close()

print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
