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

1. Copia esta carpeta a tu PC (por ejemplo, `D:\valravnxdev\kinhold_grafica`).
2. Doble clic en **Abrir Kinhold grafica.bat**. Si Windows avisa («Windows protegió su PC»), «Más información» →
   «Ejecutar de todas formas».
3. Pulsa **Permitir**. La primera vez:
   - instala Git y Python si no los tienes (con winget, para tu usuario);
   - descarga el programa de GitHub para usar el PC (en `%LOCALAPPDATA%\KinholdGrafica`);
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

## Si algo va mal

- **Ver el registro** (en la ventana): lo que ha hecho el programa. Lo que dice el programa de GitHub está en
  `%LOCALAPPDATA%\KinholdGrafica\runner.txt`.
- Para volver a unir el PC (otro PC, o lo quitaste en GitHub): borra la carpeta `%LOCALAPPDATA%\KinholdGrafica\runner`
  y pulsa **Permitir**.
- Para quitarlo del todo: en GitHub, *Settings → Actions → Runners* → `pc-valravnx-gpu` → *Remove*; y borra
  `%LOCALAPPDATA%\KinholdGrafica`.

## Para las sesiones de Claude

- `node herramientas/pruebas_nube.mjs [grupos]` decide solo dónde va cada grupo; `SOLO_NUBE=1` para no mirar el PC.
- En el resumen de cada grupo hecho en el PC sale `en el PC de valravnx, con su tarjeta: <tarjeta>`.
- Las capturas del PC salen con la letra de Windows (no con Inter, como en la nube): no es un fallo.
- Archivos: `kinhold_grafica.ps1` (la ventana), `elegir_gpu.py` (la manera de usar la tarjeta), `sitecustomize.py`
  (la pone en las pruebas sin tocarlas), y en `.github/workflows/pruebas.yml` lo de `pc-pedido` y `runner.os == 'Windows'`.
