# Kinhold — reglas de trabajo

Kinhold es el juego de valravnx: supervivencia medieval "tipo MMO" en el navegador, jugable solo o en pareja, en PC, móvil y tablet. Low-poly 3D generado por código (three.js), cámara en tercera persona semiisométrica con giro libre, de la Alta a la Baja Edad Media, sin fantasía. Combate de habilidad inspirado en la esgrima real, sin barras de vida.

**Todo en español**: código, comentarios, textos del juego, commits, diario y mensajes a valravnx.

**Y también en inglés lo que se publica** (más adelante, ruso): cada texto nuevo o cambiado del roadmap, el diario, las decisiones y las notas de versión se añade en `proyecto/idiomas/en.json` (clave: el texto exacto en español; valor: la traducción). `construir_web.mjs` falla si falta alguna, y lista cuáles. Si se cambia un texto en español, hay que volver a traducirlo. Los textos fijos de la web están en el diccionario `UI` de `herramientas/plantilla_web.html`.

## Dónde está cada cosa

- `diseno/gdd.html` — GDD (fuente de verdad del diseño). `diseno/sistemas.html` — recursos, recetas, piezas, valores. `diseno/analisis.html` — análisis y propuestas (lo marcado PROPUESTA no está decidido).
- `diseno/en/` y `diseno/ru/` — los mismos documentos en inglés y en ruso. Cada uno lleva `<meta name="kinhold-origen">` con la huella (sha1) del original; si el español cambia, `construir_web.mjs` falla hasta que se retraduce y se pone la huella nueva.
- `proyecto/roadmap.json` — hitos y tareas con su estado. **Es lo que decide qué se hace.**
- `proyecto/diario.json` — una entrada por sesión de trabajo, con hora de inicio y fin reales.
- `REVISION.md` — donde valravnx deja revisiones y respuestas. Se lee al empezar cada sesión.
- `herramientas/taller/` — taller de personajes (Blender + MPFB2 sin pantalla): `vestir_mpfb.py` (cuerpo y ropa por capas), `pasar_animaciones.mjs`, `preparar_mh.mjs`. Recursos publicados en `docs/recursos/personajes/taller-vN/` (no se tocan; los nuevos van en otra carpeta).
- `src/` — código. `src/logica/` y `src/combate/logica.js` son lógica pura (sin three.js) para que el servidor la pueda ejecutar luego sin rehacerla. Mantenerlo así.
- `pruebas/` — pruebas de lógica (node) y de navegador (Python Playwright con Chromium sin pantalla).
- `docs/` — la web pública (GitHub Pages, rama main, carpeta /docs). Se genera con `node herramientas/construir_web.mjs`. Las versiones jugables están en `docs/jugar/<prototipo>/<vN>.html` y **nunca se borran ni se sobrescriben**; para que la web quepa en 1 GB (valravnx, 29 oct), las antiguas pasan a las releases de GitHub con `herramientas/archivar_versiones.mjs` (en la web quedan las 5 últimas de cada prototipo) y solo se quitan de `docs/` cuando ya están en su release. Las capturas viejas se encogen con `python3 herramientas/encoger_capturas.py`.
- Web: https://valravnxx.github.io/Kinhold/ (con K mayúscula: el repositorio se llama Kinhold y la dirección distingue mayúsculas)

## Una sesión de trabajo (tarea programada cada hora)

1. `git pull`. Instalar dependencias si faltan (`npm install`). Activar la unión automática del diario y las traducciones en el clon (`node herramientas/unir_json.mjs --instalar`; no hace daño repetirlo). Apuntar la hora de inicio (`date -Iseconds`).
   - **Dos sesiones automáticas en paralelo, en carriles A y B** (lo pidió valravnx el 27 oct: siempre dos a la vez, en cosas diferentes y sin pisarse). Cada tarea programada dice su carril (A empieza en el minuto 19 de cada hora, B en el 49). Todo con `herramientas/carriles.mjs`:
     - `node herramientas/carriles.mjs estado` — quién trabaja en qué, qué está a medias y qué archivos toca cada rama activa.
     - `node herramientas/carriles.mjs elegir <carril>` — la tarea que te toca: en el primer hito en curso **en el que no trabaje otro agente vivo** (el otro carril o una sesión de chat), primero lo que esté **a medias** y si no la primera pendiente, con las mismas reglas del paso 3. Si sale con «nada que hacer», terminar sin cambios. Si sale `"retoma": true` con una `rama`, se sigue el trabajo desde esa rama (está a medias de una sesión cortada) en vez de empezar de cero.
     - `node herramientas/carriles.mjs ocupar <carril> trabajo/<AAAAMMDD-HHMM> <hora>` — **anuncia** la tarea (el carril en `sesion.json`, y la tarea `en_curso` en el roadmap con su rama). **Commit y push a main enseguida**, antes de trabajar; si el push falla porque otro subió antes, `git pull` y volver a elegir y ocupar.
     - Un agente (carril o chat) cuenta como vivo si empezó o subió un avance a su rama hace menos de 70 minutos: los avances cada 15 minutos lo mantienen.
     - **Antes de fusionar en main**: `node herramientas/carriles.mjs choques`. Si otra rama activa cambia los mismos archivos de código, no se fusiona a ciegas: se une main primero, se repasan esos archivos a mano y se vuelven a pasar todas las pruebas.
     - Al terminar (bien o mal), `node herramientas/carriles.mjs soltar <carril>` en el último commit.
     - **Hitos con `"lleva": "chat"`**: los lleva a mano una sesión de chat con valravnx (desde el 29 oct, solo lo visual y creativo del mundo; lo técnico, como cavar o el terreno por trozos, lo llevan los carriles). Los carriles no cogen nada de ellos, ni aunque no tengan tareas en curso.
   - **Las sesiones de chat con valravnx trabajan en paralelo** (lo pidió valravnx el 25 oct). Al empezar, **anuncian su tarea**: `node herramientas/carriles.mjs chat trabajo/<AAAAMMDD-HHMM-algo> <hito> "<tarea>" <hora>` (si la tarea no existe en ese hito, la crea al final, `en_curso` y con su rama; luego hacen falta sus traducciones), y commit y push a main enseguida. Trabajan en esa rama; al terminar, `node herramientas/carriles.mjs soltar chat <rama>` en el último commit. Las demás sesiones no cogen nada de un hito en el que trabaja un agente vivo y evitan tocar los mismos archivos que esa rama (mirar `git ls-remote origin 'trabajo/*'` y sus cambios).
   - **Qué sale «en proceso» en la web** (lo pidió valravnx el 28 oct: saber bien en qué se trabaja en cada momento): solo las tareas que lleva un agente vivo anunciado en `sesion.json`, con su nombre (agente A, agente B o chat con valravnx), y en la pestaña Roadmap, debajo de las pestañas y encima de los hitos, el cartel «Ahora mismo» con cada uno (no arriba del todo: lo pidió valravnx). La web lo mira en GitHub al abrirse (el `sesion.json` de main y el último commit de cada rama), así que basta con anunciar y soltar a tiempo; no hace falta regenerarla para eso. Una tarea `en_curso` que no lleva nadie sale «a medias»: no bloquea su hito y un carril la retoma desde su rama. Por eso **nunca se deja una tarea `en_curso` sin anunciarla**.
   - Al fusionar en main, `diario.json`, `proyecto/idiomas/*.json` y `proyecto/sesion.json` se unen solos con `herramientas/unir_json.mjs` (activado con `--instalar`): entran las entradas y los textos de las dos ramas, el diario en orden de hora. Solo para si las dos ramas cambian distinto la misma entrada o traducción; entonces se une a mano esa y nada más. Si choca `docs/index.html`, no se une a mano: se vuelve a generar con `node herramientas/construir_web.mjs` después de unir lo demás.
   - **No perder trabajo a medias:** mientras se trabaja, subir el avance cada 15 minutos más o menos a la rama `trabajo/<AAAAMMDD-HHMM>` (commit "Avance: …"). Al acabar, fusionar en main. Si la sesión se corta, lo hecho queda en esa rama y la siguiente sesión lo retoma desde ahí en vez de empezar de cero (mirar `git ls-remote origin 'trabajo/*'`).
   - Si valravnx habla contigo dentro de la sesión, lo que pida va a `REVISION.md` y se sube enseguida, para que no dependa de esta conversación.
2. Leer `REVISION.md`. Si valravnx ha escrito algo nuevo debajo de la línea, **eso va primero**:
   - Aprobación de un hito en revisión → marcarlo `hecho`.
   - Cambios pedidos → crear tareas en ese hito (estado `pendiente`) y dejarlo `en_curso`.
   - Respuesta a una decisión pendiente → quitarla de `decisiones_pendientes`, pasar sus tareas de `espera_decision` a `pendiente` y anotar la decisión en el diario.
   - Después mover lo procesado a la sección "Procesado" de `REVISION.md` con la fecha.
3. Elegir la tarea:
   - **Si hay un hito en `revision` (terminado, esperando a valravnx), no se empieza ningún hito nuevo.** Solo se pueden hacer tareas `pendiente` de hitos ya `en_curso`. Si no hay ninguna, la sesión termina sin cambios (no hace falta entrada en el diario ni commit).
   - Si no: la primera tarea `pendiente` del primer hito `en_curso`; si no hay, el siguiente hito `pendiente` en el orden del roadmap (pasa a `en_curso`).
   - Las tareas en `espera_decision` no se tocan.
   - **Un hito con `"bloquea": true` que tenga tareas en `espera_decision` tampoco deja empezar hitos nuevos** (ej.: la dirección de arte; no se construye nada encima de un estilo sin elegir).
   - Si una tarea termina con algo que valravnx tiene que elegir (pruebas de estilo, propuestas), al acabarla se añade la pregunta a `decisiones_pendientes`.
4. Si la tarea es "Planificar el hito": leer las partes del GDD y de sistemas que tocan, y desglosar el hito en tareas de **una sesión cada una** (algo que se pueda hacer, probar y publicar en menos de una hora). La última tarea de cada hito es siempre "Revisión completa y publicación".
5. Hacer la tarea **una sola por sesión**, entera: código, pruebas, capturas, publicación.
6. Pruebas (todas, siempre, no solo las de lo tocado — a valravnx le molesta que al arreglar algo se rompa otra cosa):
   - **En la nube, no aquí** (lo pidió valravnx el 29 oct: esta máquina no tiene tarjeta gráfica, dibuja el juego a menos de 3 fotogramas por segundo y la batería entera pasaba de hora y media): `node herramientas/pruebas_nube.mjs`. Sube la rama, lanza en GitHub Actions (gratis, repositorio público) un grupo por máquina y a la vez, espera, deja las capturas (JPG) y la salida de cada grupo en `/tmp/kinhold_capturas/` y sale con error si algo falla. Para repetir solo lo que falló: `node herramientas/pruebas_nube.mjs <grupo> <grupo>` (los grupos: `bash herramientas/probar_todo.sh --grupos`). La rama tiene que llevar `.github/workflows/pruebas.yml` (si no, unir main).
   - **El PC de valravnx, cuando él lo permite** (lo pidió el 31 oct: su tarjeta gráfica, sobre todo de noche; `herramientas/pc_grafica/LEEME.md`): `pruebas_nube.mjs` manda primero los grupos de navegador a su PC y, si no los coge en unos 45 s (parado, apagado o con las pruebas de otra sesión), a la nube; si lo para a medias, lo que falta se repite en la nube. No hay que hacer nada distinto; `SOLO_NUBE=1` para no mirar su PC. Las capturas de su PC salen con la letra de Windows.
   - Mientras corren en la nube, la sesión sigue con lo demás (diario, traducciones, notas); no hace falta esperar mirando.
   - Una prueba nueva se añade como siempre a `herramientas/probar_todo.sh` y entra sola en su grupo (cada «Navegador: …» es un grupo; lo demás va en «logica»). Para probar una sola cosa mientras se trabaja, aquí vale con lanzarla suelta (`node pruebas/….mjs`); la batería entera, en la nube.
   - Solo si la nube no funciona: `bash herramientas/probar_todo.sh` aquí, y anotarlo en el diario.
   - **Ya no hay pruebas aparte de «jugar en línea» ni de «duelo en línea»** (valravnx, 31 oct: «ya hay servidor de verdad […] está todo 100 % online en solo jugar»; «evita la de jugar en línea, eso ya no existe»). Se acabó la excepción del 30 oct: todos los grupos que quedan paran la publicación.
   - Cada prueba nueva se rompe a propósito una vez para comprobar que falla (como `MUTAR=1` en la de combate).
   - Mirar las capturas de verdad (con la herramienta de leer imágenes), en PC (1280×800) y móvil (390×844), de **todas las vistas** del prototipo tocado.
7. Si todo pasa: `git pull` justo antes de publicar y usar el siguiente número de versión libre de ese prototipo (la otra sesión puede haber publicado uno mientras tanto; si `publicar_version.mjs` dice que ya existe, se usa el siguiente y se corrigen las notas y el registro). Publicar una versión nueva solo cuando el cambio sea jugable (`node herramientas/publicar_version.mjs <prototipo> <vN> <html> "<notas>" capturas/<prototipo>-<vN>`), copiar **solo las capturas de este cambio** con `python3 herramientas/capturas.py <carpeta> <prototipo>-<vN> <captura> <captura>…` (las nuevas y las de las vistas que ha tocado, en PC y en móvil; como mucho 12; las convierte a JPG). La batería entera se mira en `/tmp/kinhold_capturas/` pero no se publica: lo pidió valravnx el 29 oct, porque cada noticia salía con 20 u 80 capturas y las del cambio al final, marcar la tarea `hecho` con `inicio` y `fin`, escribir la entrada del diario, `node herramientas/construir_web.mjs`, commit y push.
8. **Si algo falla y no se arregla en la sesión: no publicar.** Entrada en el diario con `estado: "fallo"` y qué falla; la tarea sigue `en_curso` (con `soltar` queda «a medias» y la retoma otra sesión desde su rama). Commit solo del diario y del roadmap (y `sesion.json`).
9. Si con esta tarea se termina el hito: el hito pasa a `revision` y se para (ver paso 3).

## Entrada del diario

```json
{"inicio": "2026-10-25T09:00:12+02:00", "fin": "2026-10-25T09:41:50+02:00", "titulo": "Hito 1b: escalera de un bloque",
 "hito": "construccion-mas", "hecho": ["…frases cortas y concretas…"], "pruebas": "Lógica 40/40, navegador PC y móvil correctos",
 "capturas": "capturas/construccion-v4", "estado": "ok"}
```
Las horas son reales (`date -Iseconds`), nunca estimadas. Las tareas guardan también `inicio` y `fin`.

## Alcance y listón visual (que quede claro siempre)

- Es un **juego online persistente tipo MMO**, aunque sea pequeño al principio: pensado para que algún día tenga muchos jugadores. Cuentas, administración, registros y seguridad son **prioridad alta**, no un añadido (hitos 11 y 11b).
- **Toda acción que cambia el mundo** (construir, desmontar, coger, soltar, comerciar, herir, matar) pasa por la lógica pura con un **autor** (quién la hace), aunque hoy sea un solo jugador. Así el servidor podrá validarla y registrarla sin rehacer nada.
- **Aspecto: sobrio y realista dentro del low-poly.** Nada de colores chillones ni muñecos de cubos de estética infantil. Proporciones humanas creíbles, materiales y paleta apagados y naturales, buena luz y sombras. Técnicas por código permitidas y deseables: geometría con más detalle donde se ve (cara, manos, bordes), variación de color por vértice, texturas generadas por código (canvas), sombreado plano o suave según la pieza, oclusión ambiental horneada en vértices, niebla, gradación de color y posproceso ligero.
- **Personajes: NUNCA esculpidos o inventados por código** (valravnx: «horripilantes»). Base elegida por valravnx el 25 oct: el **taller propio** — cuerpo de MakeHuman (CC0) con la ropa por capas, el pelo, la barba, la piel y los ojos hechos por código (`herramientas/taller/`, cargador `src/personajes/makehuman.js`, recursos en `docs/recursos/personajes/taller-vN/`). Animaciones de Quaternius (CC0) pasadas a su esqueleto con `pasar_animaciones.mjs`; las 39 extra están en `docs/recursos/personajes/v1/animaciones_extra.glb` (meshopt: abrir con `GLTFLoader.setMeshoptDecoder`). El paquete de Quaternius (`src/personajes/cargar.js`) queda solo para comparar. Los recursos publicados no se cambian: los nuevos van en otra carpeta. Procedencia y licencias en `PROCEDENCIA.md`.
- **Antes de construir algo difícil, investigar cómo lo resuelven otros** (guías, proyectos, paquetes libres) y usar el mejor método, en vez de probar a ciegas.
- **Personajes:** personalización (complexión, cara, pelo, barba, piel) y **la ropa y la armadura se ven puestas**, por capas. Es de lo más importante del juego: cada cambio sale en capturas de cerca para valravnx.
- **El estilo aprobado es la prueba de estilo v5 (`docs/capturas/estilo-v5/`) y vale para TODO lo que se ve**: suelo, árboles, piezas, muebles, objetos, en todos los prototipos y en la demo única. Nada sale con el aspecto low-poly inicial ni «provisional». Cada pieza nueva o tocada se compara en captura lado a lado con la v5 antes de publicarla; si no se ve igual de trabajada, no está terminada.
- **Tiene que aguantar en móvil.** Medir los fotogramas; si hace falta, niveles de detalle.
- **Revisión visual antes de enseñar nada** (lo pidió valravnx el 29 oct: «me das el visto bueno a cosas horribles, como las barbas o la capa que no es capa»): antes de enseñar o publicar algo que se ve, capturas de cerca (PC y móvil) al lado de la referencia (la prueba de estilo v5 o la foto de lo real) y, en el mensaje, la lista de lo que aún está mal. Si se ve peor que la referencia, no se enseña como terminado.
- **El juego ya está en línea (valravnx, 30 oct): «ya está lo del online».** Servidor de prueba en Hetzner, https://2-31-141-224.sslip.io (se actualiza a main con `actualizar.sh`; valravnx hace wipes del mundo a menudo). El juego es **siempre en línea**, también desde la web de GitHub, y es el único modo. **Todo el trabajo, también el de las ramas en curso, se adapta y va en esa dirección**: lo nuevo se hace y se prueba en línea (lo que cambia el mundo, por el servidor con su autor; lo que ve un jugador lo ven los demás), y nada nuevo se hace solo para el modo en solitario.
- **El plan sale de la revisión del 29 oct** (aprobada por valravnx, en `diseno/revision.html`): fase 0 (despejar: web por debajo de 1 GB, orden en el código), fase 1 (el primer día de un jugador, entero, en el mundo de verdad y en línea entre dos), fase 2 (servidor y cuentas, administración, mojón), fase 3 (lo demás). Mientras dure la fase 1, nada de piezas ni sistemas sueltos: lo nuevo se hace ya en el mundo de verdad.
- **Hitos con `"carril"`**: solo los coge ese carril, y los mira antes que los demás (desde el 29 oct, el arte lo lleva el carril B en paralelo).

## Reglas de valravnx

- **El repositorio y la web son públicos: nunca se escribe el nombre real del dev.** En el diario, el roadmap, el código, las pruebas, los commits y los textos del juego se le llama «valravnx» (o «el dev»). Tampoco otros datos personales suyos.
- **Comprobar todo antes de afirmarlo.** Nada de memoria ni de suposiciones. Si algo no se ha podido comprobar, decirlo en el diario ("no comprobado: …").
- **No sobrecomplicar sus sistemas.** Implementar lo que dice el GDD a la escala que lo dice; nada de capas extra.
- Lo que el GDD no decide: tomar una decisión provisional sencilla, anotarla en el registro de decisiones del prototipo (`registro.js`) y en el diario. Si es importante o difícil de deshacer, no decidir: añadirla a `decisiones_pendientes` y pasar la tarea a `espera_decision`.
- **Nunca referencias a propiedad intelectual ajena** en el juego (nombres de otros juegos, marcas, personajes) ni en sus textos.
- No dar tiempos que no salgan de datos medidos.
- Los guardados del navegador no se pierden con una versión nueva: si cambia su formato, migrarlo.
- El arte es low-poly por código; cada pieza nueva sale en capturas de cerca para que valravnx la revise.
- Commits con mensajes en español que digan qué cambia. Al final de cada mensaje de commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
