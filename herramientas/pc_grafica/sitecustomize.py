# Kinhold — en el PC de valravnx (pruebas con su tarjeta gráfica): Python carga este archivo solo al empezar si su
# carpeta está en PYTHONPATH (lo pone .github/workflows/pruebas.yml, y solo en su PC). Cambia, sin tocar las pruebas,
# cómo abren el navegador: quita el «--use-gl=swiftshader» (dibujar sin tarjeta) y pone lo que eligió
# herramientas/pc_grafica/elegir_gpu.py para usar la de verdad. En la nube (y en las sesiones) no hace nada.
import os, json

_args = os.environ.get('KINHOLD_GPU_ARGS')
if _args:
    try:
        from playwright.sync_api._generated import BrowserType
    except Exception:
        BrowserType = None
    if BrowserType is not None:
        _extra = json.loads(_args)
        _canal = os.environ.get('KINHOLD_GPU_CANAL') or None
        _oculto = os.environ.get('KINHOLD_GPU_HEADLESS', '1') != '0'
        _original = BrowserType.launch

        def _launch(self, *a, **k):
            if self.name == 'chromium':
                quitar = ('--use-gl=', '--use-angle=')
                args = [x for x in (k.get('args') or []) if not x.startswith(quitar)]
                k['args'] = args + [x for x in _extra if x not in args]
                if _canal and not k.get('channel'): k['channel'] = _canal
                if not _oculto: k['headless'] = False
            return _original(self, *a, **k)

        BrowserType.launch = _launch
