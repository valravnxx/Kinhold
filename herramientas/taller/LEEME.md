# Taller de personajes: cómo montarlo desde cero

El taller hace los personajes del juego sin pantalla: Blender (instalado como paquete de Python, `bpy`) con la extensión
MPFB2 de MakeHuman crea el cuerpo, y `vestir_mpfb.py` le pone por código la piel, el pelo y la ropa por capas. Luego
`pasar_animaciones.mjs` le pasa las animaciones y `preparar_mh.mjs` lo comprime para la web.

Las versiones de todo están fijadas en **`versiones.json`**. `vestir_mpfb.py` y `mpfb_prueba.py` las comprueban al
empezar y paran si algo no coincide (lo encontrado se guarda en `taller_versiones.json`, junto a los personajes que salen).

## Lo que hace falta

- Linux x86_64 con Python de la versión fijada (`python` en `versiones.json`: el paquete `bpy` solo existe para esa).
- git, node de la versión mayor fijada y npm.
- Sitio en disco: el paquete `bpy` ocupa unos 880 MB y el repositorio de MPFB2 unos 180 MB (medido el 25 oct 2026).
- No hacen falta los paquetes de recursos de MakeHuman (pieles, ojos, pelo): la piel y la ropa se pintan por código.

## Montarlo (automático)

```
bash herramientas/taller/montar_taller.sh            # clona MPFB2 en ~/mpfb2
bash herramientas/taller/montar_taller.sh /otra/ruta  # o donde se diga
```

Instala `bpy`, `numpy` y `pillow` en sus versiones, clona MPFB2 y lo deja en su commit, lo enlaza como extensión de
Blender y hace `npm ci`. Al final pasa la comprobación. En este servidor tardó unos 2 minutos solo en bajar `bpy`.

## Montarlo a mano (lo mismo, paso a paso)

1. `python3 -m pip install bpy==<versión> numpy==<versión> pillow==<versión> --break-system-packages`
   (sin `--break-system-packages` si se usa un entorno virtual).
2. `git clone https://github.com/makehumancommunity/mpfb2.git ~/mpfb2 && git -C ~/mpfb2 checkout <commit>`
3. Enlazar la extensión donde la busca Blender, con la versión mayor.menor de `bpy` (para 5.2.3, `5.2`):
   `mkdir -p ~/.config/blender/5.2/extensions/user_default && ln -sfn ~/mpfb2/src/mpfb ~/.config/blender/5.2/extensions/user_default/mpfb`
4. `npm ci` en la raíz del proyecto (las versiones de node salen de `package-lock.json`).
5. `python3 herramientas/taller/comprobar_taller.py` → tiene que terminar en «Todo coincide con versiones.json.»

## Comprobar que sale lo mismo

```
FOTOS=pocas python3 herramientas/taller/vestir_mpfb.py /tmp/vestir
```

Hace los dos personajes (`hombre.glb`, `mujer.glb`), sus texturas y unas fotos de prueba (Cycles en CPU). En este servidor
(2 núcleos) tardó unos 7 minutos. El 25 oct 2026 se comprobó así, montado desde cero con estas versiones: las
47 mallas (24 del hombre y 23 de la mujer) salen con el mismo número de vértices y la misma caja que en los recursos
publicados `taller-v4`. No comprobado: que las texturas salgan idénticas píxel a píxel.

## Cambiar una versión

1. Cambiarla en `versiones.json` (versiones exactas; el commit de MPFB2, con el hash entero).
2. `bash herramientas/taller/montar_taller.sh` y volver a generar los personajes.
3. Mirar las fotos y comparar con los recursos publicados antes de hacer una versión nueva de recursos
   (`docs/recursos/personajes/taller-vN/` no se tocan nunca; lo nuevo va en otra carpeta).

Para probar algo con otras versiones sin cambiar las fijadas: `TALLER_SIN_COMPROBAR=1` (avisa, pero no para).
Nunca se publica nada hecho así.

## Prueba

`python3 herramientas/taller/comprobar_taller.py --prueba` (va en `herramientas/probar_todo.sh`, no necesita Blender):
comprueba el formato de `versiones.json`, que una versión distinta se detecta y que el montaje lee las versiones de
`versiones.json` en vez de copiarlas. Con `MUTAR=1` se rompe a propósito y falla.
