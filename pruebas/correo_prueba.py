# Para las pruebas de navegador con cuenta: el código de verificación del correo (valravnx, 2 nov). El servidor de las
# pruebas no tiene la clave de Resend, así que apunta cada código en su salida («código de verificación para «usuario»:
# 123456»); esto la lee en segundo plano (y así la salida del servidor no se atasca) y rellena la pantalla como un jugador.
import re, threading, time

class Codigos:
    def __init__(self, proceso):
        self.lineas = []
        threading.Thread(target=self._leer, args=(proceso,), daemon=True).start()
    def _leer(self, proceso):
        for l in proceso.stdout: self.lineas.append(l)
    def todos(self, usuario):
        r = re.compile(r'código de verificación para «' + re.escape(usuario) + r'»: (\d{6})')
        return [m.group(1) for l in list(self.lineas) for m in [r.search(l)] if m]
    # el último código de ese usuario (espera a que haya más de `antes`)
    def de(self, usuario, antes=0, ms=15000):
        fin = time.time() + ms / 1000
        while time.time() < fin:
            c = self.todos(usuario)
            if len(c) > antes: return c[-1]
            time.sleep(0.1)
        return None

# crea la cuenta en la pantalla y confirma el correo con el código que llega; True si se quita la pantalla
def crear_y_confirmar(pg, codigos, usuario, clave='clave-de-prueba-123', ms=20000):
    pg.fill('#pcUsuario', usuario); pg.fill('#pcCorreo', usuario.lower() + '@ejemplo.com')
    pg.fill('#pcClave', clave); pg.fill('#pcClave2', clave); pg.click('#pcIr')
    try: pg.wait_for_selector('#pcFormCorreo:not([hidden])', timeout=ms)
    except Exception: return False
    c = codigos.de(usuario)
    if not c: return False
    pg.fill('#pcCodigo', c); pg.click('#pcIrCorreo')
    try: pg.wait_for_function("!document.getElementById('pantallaCuenta')", timeout=ms); return True
    except Exception: return False
