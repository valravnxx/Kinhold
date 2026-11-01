# Kinhold · tu gráfica para las pruebas

Lo pidió valravnx el 31 oct 2026: que las pruebas de Kinhold usen la tarjeta gráfica de su PC **cuando él lo permite**
(sobre todo de noche) y, si no, sigan en GitHub Actions. Así no se usa el PC mientras juega, pero sí cuando no está.

## Cómo funciona

- En el PC hay una ventana pequeña, **Kinhold · tu gráfica para las pruebas**, con un botón **Permitir / Parar**.
- Mientras está en **Permitir**, el PC es una máquina más de GitHub Actions para este repositorio (un «self-hosted
  runner» con la etiqueta `kinhold-gpu`). Con **Parar**, o al cerrar la ventana, deja de serlo.
- Cada vez que una sesión de Claude pasa las pruebas (`node herramientas/pruebas_nube.mjs`):
  1. Manda los grupos de navegador a tu PC (rama `pc-pedido/…`). El grupo «logica» va siempre a la nube.
  2. Si tu PC no coge el primer grupo en unos 45 s (está parado, apagado o con las pruebas de otra sesión), cancela
     eso y lo manda todo a la nube, como antes.
  3. Si lo paras a medias, lo que faltaba (y lo que se cortó) se repite en la nube.
- Antes de las pruebas, en tu PC, `elegir_gpu.py` busca la manera de que el navegador dibuje con tu tarjeta de verdad;
  si no la encuentra, esos grupos se repiten en la nube en vez de ir lentos en tu PC.
- Todo lo que arranca desde la ventana (las pruebas, el navegador) va con **prioridad baja**: si te pones a jugar con
  ella encendida, el juego va primero (aunque la tarjeta la compartís; para jugar, mejor **Parar**).
- **Parar solo a las…**: si lo marcas, a esa hora para solo (por ejemplo, las 8:00 si lo dejas por la noche).

## Ponerlo en marcha (una vez)

1. Copia esta carpeta a tu PC (por ejemplo, `D:\valravnxdev\kinhold_grafica`). Para actualizarlo, cambia
   `kinhold_grafica.ps1` por el nuevo con la ventana cerrada.
2. Doble clic en **Abrir Kinhold grafica.bat**. Si Windows avisa («Windows protegió su PC»), «Más información» →
   «Ejecutar de todas formas».
3. Pulsa **Permitir**. La primera vez:
   - instala Git y Python si no los tienes (con winget, para tu usuario);
   - descarga el programa de GitHub para usar el PC (en `D:\KinholdGrafica`, o en la carpeta que elijas abajo en la
     ventana; si no hay disco D, en `%LOCALAPPDATA%\KinholdGrafica`);
   - abre GitHub en «New self-hosted runner»: copia el código que va detrás de `--token` y pégalo en la ventanita.
4. Cuando diga **Permitido: esperando pruebas**, ya está. En GitHub, *Settings → Actions → Runners* lo verás como
   `pc-valravnx-gpu`, «Idle».

**Importante, una vez (seguridad):** el repositorio es público. En GitHub, *Settings → Actions → General →
«Approval for running fork pull request workflows from contributors»*, elige **«Require approval for all external
contributors»**. Así nadie de fuera puede hacer que tu PC ejecute nada sin que tú lo apruebes. Las pruebas solo las
lanzan las ramas `pc-pedido/…`, que solo puede subir quien tiene permiso de escritura en el repositorio (tú y las
sesiones de Claude).

Ten en cuenta que, mientras está permitido, las pruebas se ejecutan con tu usuario de Windows (como cualquier programa
que abres). Solo ejecutan el código del repositorio de Kinhold.

## Dónde guarda (31 oct: le llenaba el SSD a valravnx)

- Todo lo que guardan las pruebas va a **una carpeta que eliges**, por defecto `D:\KinholdGrafica`: el programa de
  GitHub y su trabajo, el navegador de las pruebas, las cachés de pip y npm y lo temporal. En la ventana, abajo,
  «Guarda en … (cambiar)» la cambia y se lleva todo (sin volver a pedir el código).
- Lo temporal de cada tanda se borra solo al acabar (antes se quedaba en la carpeta temporal de Windows: 7 GB en 170
  vueltas).
- Al abrir la versión nueva, si encuentra en el disco de Windows lo de la anterior, pregunta y lo pasa a la carpeta y
  borra de C: la carpeta `%LOCALAPPDATA%\KinholdGrafica`, el navegador de las pruebas (`%LOCALAPPDATA%\ms-playwright`) y
  las carpetas temporales de las pruebas (solo las que se reconocen como suyas). La caché de pip (`%LOCALAPPDATA%\pip\Cache`)
  la pregunta aparte, porque puede ser también de otros programas. «Liberar el disco de Windows» lo vuelve a mirar.
- Los paquetes de Python de las pruebas (playwright, pillow, numpy) se quedan en tu Python (unos cientos de MB).
- `probar_programa.ps1` prueba todo esto en Windows con carpetas de prueba (en la nube, en una máquina windows-latest).

## Si algo va mal

- **31 oct: todos los grupos fallaban en segundos** con «bash: command not found». Git para Windows solo pone
  `Git\cmd` en el PATH, no su bash, y los pasos del flujo van en bash. Arreglado en el propio flujo (un primer paso en
  PowerShell pone el bash de Git y el Python del usuario en el PATH): en el PC no hay que cambiar nada. Con eso,
  salieron cuatro cosas que solo pasan en Windows o con tarjeta, también arregladas: el navegador «nuevo» pedía
  favicon.ico (ahora va el de la nube), la cola del servidor de páginas de las pruebas rechazaba conexiones, los enlaces
  simbólicos piden administrador (se hacen uniones de carpeta) y dos pruebas iban a destiempo a velocidad real
  (combate y construcción). La batería entera en su PC: 25 grupos en unos 40 min, todos bien salvo «jugar en línea».

- **Ver el registro** (en la ventana): lo que ha hecho el programa. Lo que dice el programa de GitHub está en
  `runner.txt`, en esa carpeta.
- Para volver a unir el PC (otro PC, o lo quitaste en GitHub): borra la carpeta `runner` de esa carpeta
  y pulsa **Permitir**.
- Para quitarlo del todo: en GitHub, *Settings → Actions → Runners* → `pc-valravnx-gpu` → *Remove*; y borra
  esa carpeta (y `kinhold_grafica_ajustes.json`, junto al programa).

## Para las sesiones de Claude

- `node herramientas/pruebas_nube.mjs [grupos]` decide solo dónde va cada grupo; `SOLO_NUBE=1` para no mirar el PC.
- En el resumen de cada grupo hecho en el PC sale `en el PC de valravnx, con su tarjeta: <tarjeta>`.
- Las capturas del PC salen con la letra de Windows (no con Inter, como en la nube): no es un fallo.
- Archivos: `kinhold_grafica.ps1` (la ventana), `elegir_gpu.py` (la manera de usar la tarjeta), `sitecustomize.py`
  (la pone en las pruebas sin tocarlas), y en `.github/workflows/pruebas.yml` lo de `pc-pedido` y `runner.os == 'Windows'`.
