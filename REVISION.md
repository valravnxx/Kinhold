# Revisión de valravnx

Escribe aquí debajo lo que quieras: aprobar un hito ("apruebo el 1b"), pedir cambios, o responder a lo que te espera en la web. Basta con texto normal. El trabajo automático lo lee al empezar cada hora y lo mueve a "Procesado".

---

## Procesado

### 29 oct 2026 (17:02 UTC) — por el chat: acción «releases» lanzada

«verde» → valravnx lanzó la acción «releases» y salió bien: 6 releases con 103 versiones antiguas (comprobado en GitHub). La tarea de quitarlas de la web pasa a pendiente y la hace esta sesión de chat.

### 29 oct 2026 (15:21–15:24) — por el chat: Whitholm, mundo de los playtests
valravnx: «he pensado en hacer del juego solo en la isla norte (con el resto ahí) como si fuera el mundo de los playtests, que abrir en caso de que haya playerbase o dejar que ellos mismos descubran el mundo si llegan a hacer barcos en un futuro», y después: «sí, y habrá que subdividir la isla en comarcas, y luego discutiremos sobre los recursos». → Anotado en el GDD (apartado 4) como decidido; en el roadmap, la demo aparece en Whitholm con todos en la misma comarca, las comarcas de Whitholm van primero en el hito Mundo, y los recursos de la isla quedan como decisión pendiente para hablarlo con el chat.

### 29 oct 2026 (14:44) — por el chat: revisión completa y replanificación
valravnx: «Me gusta [el inventario], pero ahora mismo tenemos que hacer un análisis de todo lo que tenemos, cómo conecta todo con todo, porque hemos estado haciendo por nuestra cuenta en chats privados muchas cosas, sobre todo con el tema mundo. Hay que cohesionar un poquito todo lo que tenemos para acabar de dirigir ahora y planificar de nuevo muchos de los hitos para cuadrarlo bien. Haz una revisión completa de lo que tenemos, lo que falta, lo que está apuntado que falta y lo que de verdad hace falta, y reestructura todo para planificar así los futuros hitos.» → La lleva el chat: documento de revisión y propuesta de hitos nuevos, para que valravnx la apruebe antes de cambiar el roadmap.
→ Revisión hecha (diseno/revision.html). valravnx decidió el 29 oct: (1) el orden nuevo tal cual: fase 0 (despejar), fase 1 (el primer día en el mundo de verdad y entre dos), fase 2 (servidor y cuentas) y luego el resto; (2) la web por debajo de 1 GB pasando las versiones antiguas a las releases de GitHub, sin borrar ninguna; (3) el servidor en la nube (Hetzner), ya; (4) lo técnico de cavar y del mundo lo llevan los carriles y lo creativo sigue en el chat. Pasado al roadmap: hitos nuevos «Despejar» y «El juego en el mundo de verdad», orden nuevo, el arte para el carril B y la regla de revisión visual en CLAUDE.md.

### 29 oct 2026 (13:05) — por el chat: el panel de inventario y revisar lo visual
valravnx: «arreglemos el menú de inventario: primero, si algo se lleva en las dos manos o en el hombro, no debe aparecer eso en inventario, debe cogerlo y verse como lo lleva, no que haya huecos de hombro izquierdo/derecho, etc. El inventario es el equipo, y llevas algo en cada mano o una cosa más grande en las dos. Luego, el dibujo del avatar del equipo está retorcido y horripilante, eso hay que cambiarlo. Revisa lo que haces, sobre todo lo visual: últimamente me das el visto bueno a cosas horribles, como las barbas, la capa que no es capa y demás cosas que voy a tener que gastar el doble de tiempo en corregir luego.» → Tarea nueva en el hito de equipo, la lleva el chat. Las barbas y la capa quedan anotadas como tareas pendientes del hito de arte. Antes de enseñar o publicar nada visual, revisarlo en capturas de cerca con ojo crítico y decir lo que aún está mal.

### 29 oct 2026 (13:02) — por el chat: capturas de cada noticia
valravnx: «cuando pasas una noticia sobre un tema concreto, pasas las capturas de TODO lo anterior relacionado, a veces más de 20 capturas siendo las 2 últimas las relacionadas, arregla eso». → Se publican solo las capturas del cambio (capturas.py pide cuáles) y en la web las entradas con muchas enseñan unas pocas y el resto plegado.

### 29 oct 2026 (11:02) — por el chat: pruebas en la nube
valravnx, tras medir que las pruebas de navegador tardan horas porque esta máquina no tiene gráfica (construcción sola, 55 min; el juego se dibuja a menos de 3 fotogramas por segundo): «toma la 1, hazlo, mira a ver cómo va, si va todo bien, si lo puedes hacer totalmente por tu cuenta sin necesitarme a mí, y si lo puedes hacer, pasa todos los procesos ahí». → Tarea en el hito «Infraestructura»: las pruebas en GitHub Actions (gratis en repositorio público, 4 núcleos, hasta 20 trabajos a la vez), con una prueba piloto antes de pasarlo todo.

### 29 oct 2026 (05:40) — por el chat: manos y prendas rotas
valravnx: «cuando han hecho el cambio de ropas han roto las manos de todos los personajes y a su vez algunas de las prendas están rotas y bug, compruébalo bien». → Encontrado: desde taller-v9 las manos salen destrozadas al diezmar la piel. Arreglo en curso en esta sesión de chat, con repaso de todas las prendas.

### 29 oct 2026 (05:02) — por el chat: saltos de agua y relieve por escalas
valravnx, a las capturas del mapa v12 y a si se cierra «Relieve de detalle por escalas»: «si» → Los saltos de agua quedan aprobados tal cual y «Relieve de detalle por escalas» se da por hecho. El chat sigue con «Bosques frondosos».

### 28 oct 2026 (21:53) — por el chat: seguir con el hito del mapa, juntos

«Ahora quiero que sigas con los pasos de la sección mapa; como es algo así creativo, lo llevaremos juntos» → El chat sigue el hito 10 en orden, enseñando capturas a valravnx en cada paso antes de darlo por terminado. Empieza por los saltos de agua. Se propone cerrar «Relieve de detalle por escalas» (ya cubierto por las capas de detalle de las v3 y v4, los valles y los cortados): queda pendiente de que valravnx diga que sí.

### 28 oct 2026 (20:58) — por el chat: tirones en línea
valravnx: «le da lagazos horribles (y a mí en el server) cuando abres o cierras puertas o cuando acabas de construir algo». → Arreglo en curso en esta sesión de chat.

### 28 oct 2026 (19:37) — por el chat: duelo en línea, los dos «esperando rival»
valravnx y su pareja, conectados al mismo servidor (el de su PC, por el túnel), salían los dos «conectados y esperando rival». Causa: el servidor de casa era el que bajó jugar_en_casa.bat el 27 oct, de antes del duelo en línea (el .bat pregunta si bajar la versión nueva y a los 10 s sigue con «no»). Actualizado a mano, ya funciona. → Arreglo: el juego avisa si el servidor es antiguo, y el .bat baja la versión nueva él solo cuando la hay.

### 28 oct 2026 (19:28) — por el chat: montañas en escalones

«Por lo de los acantilados, las montañas se ven así ahora, como escaloncitos; ¿cómo podemos diferenciar las dos cosas?» (captura de una ladera nevada en peldaños pequeños con bordes en zigzag) → Los escalones de los cortados se aplicaban a casi cualquier ladera de roca dura con algo de pendiente. Tarea nueva en el hito 10, la lleva el chat: ladera de montaña continua; cortados solo donde ya es muy empinado y aflora la roca, en pocos escalones grandes.

### 28 oct 2026 (15:46) — por el chat: nombres del mundo
valravnx decide los nombres: continente **Kinland**; regiones **Whitholm** (la isla), **Eikwold** (noroeste), **Rudmere** (suroeste), **Highfell** (macizo central) y **Storaa** (sureste, el gran río). Descartados Hornfell (casi igual que una región de otro juego de supervivencia) y Highmark (marca de una aseguradora). «No son países como tal, son regiones; países los harán si eso los jugadores.» → Tarea en el hito del mundo, en curso en esta sesión de chat.

### 28 oct 2026 (15:11) — por el chat: que el mundo sea siempre igual

«Cada vez que camino a un borde para reescribir la zona de alta calidad y avanzar a un acantilado, la zona que estaba cambia junto a lo nuevo; ¿cómo hacemos un seed de esto para que sea siempre el mundo igual?» → El terreno ya era fijo; lo que cambiaba era el reparto de árboles, hierba, piedras y rocas, que salía de un azar que empezaba en el centro del trozo de cerca. Tarea nueva en el hito 10, la lleva el chat: todo se coloca según su sitio en el mundo y la semilla.

### 28 oct 2026 (12:35) — por el chat: roca de verdad en los cortados

«Me gusta la dirección, pero aunque ahora queda mucho más vertical, aún se ve como una textura gris que baja en plano. ¿Hay alguna forma de hacerle formas como si fuera de rocas, un escarpado de roca, para que quede mejor? Y con unas texturas con más sombra, más como roca real» → Tarea nueva en el hito 10, la lleva el chat: las paredes de los cortados cubiertas de piezas de roca 3D hechas por código (bloques con caras, aristas, salientes y grietas, encajados en la pared) y una textura de roca con sombra en grietas y rincones.

### 28 oct 2026 (09:33) — por el chat: acantilados de verdad

«Los acantilados son también un suelo caminable con piedrecitas; ¿cómo podemos hacerlos como lo que son, imponentes acantilados? Actualmente puedes caminar sobre todo y, al considerarse roca, invoca piedras; habría que definir los acantilados como una roca enorme, todo, que dará belleza al lugar» (con captura del móvil de una ladera gris con cantos). → Se hace ya la tarea del hito 10 «Roca dura y blanda»: donde la roca es dura y empinada, paredes de roca con repisas (estratos) en vez de rampas; las paredes son roca maciza, sin hierba ni piedrecitas (el pedregal va al pie) y no se suben andando.
Antes, a las 09:27: «¿Cómo podemos coger lo que tenemos y subirle el realismo y detalle? Que un arroyo parezca un arroyo, un río un río, un mar un mar, con su playa y todo, o rocas escarpadas dependiendo del lugar» → propuestas cuatro tareas (suelo por materiales, cauces según su tamaño, costas según la roca, vegetación de ribera y de costa y el mar de lejos); el orden queda por decidir.

### 28 oct 2026 (06:57) — por el chat: agua que se mueve

«¿Cómo está la simulación del agua? ¿Queda realista? ¿Con su movimiento de olas en la dirección del río? ¿Diferente de río que de mar? ¿Mar rompiendo olas y río moviéndose lentamente en su dirección?» → Aún no había ninguna (láminas planas y quietas). «Ve haciéndolo tú en paralelo» → Tarea nueva en el hito 10, la lleva el chat: agua que se mueve (río en su dirección, mar con oleaje y olas que rompen, color según la hondura, espuma).

### 28 oct 2026 (05:18) — por el chat: los ríos son agujeros enormes

«La mayoría de ríos son agujeros en el terreno enormes, y creo que es porque aún no hemos programado el agua» (con captura del móvil: un tajo de roca gris con el río al fondo). → No es solo el agua: el valle del río se tallaba con un ancho fijo, así que donde el terreno queda muy por encima del río salía un tajo casi vertical. Se hace ya la tarea del hito 10 «Valles tallados por los ríos» (laderas con pendiente limitada, vegas anchas abajo, gargantas solo en la montaña).

### 28 oct 2026 (05:38) — por el chat: ver quién trabaja en qué
valravnx: «cuando comiencen una tarea, dirán cuál es y entonces en la web saldrá como que esa está en proceso, y que solo salgan en proceso aquellas en las que de verdad se esté trabajando por algún agente en concreto, para saber bien en qué se trabaja en cada momento». → Tarea en el hito de infraestructura, en curso en esta sesión de chat.

### 27 oct 2026 (21:22) — por el chat: el paisaje de cerca, como se ve en el juego

«Se ve bien, pero claro, es a 0 detalle; está muy bien como "lo que se ve de lejos" pero no como se ve el juego de cerca.» → Tarea nueva en el hito 10: vista «Como en el juego» en el boceto de cerca, con el personaje, la cámara del juego y un trozo de terreno alrededor con todo el detalle (rejilla de 1 m, hierba, flores, matorrales, piedras, árboles completos y sombras).

### 27 oct 2026 — por el chat: fotogramas bajos al construir (jugando en línea)

«Cuando estamos haciendo cualquiera de los dos una construcción (la carga de construir con el hacha) nos bajan los fps mucho… luego vuelve a normal» y «tiene los fps mucho más bajos durante todo el proceso, no a tirones» → Arreglado (construcción v26, demo v22): al avanzar una obra se rehace solo esa pieza y no todo lo construido.
«Cada vez que salgo al menú y vuelvo dice que soy uno más… not big deal» (los que se van tardan en desaparecer a través del túnel) → va con la tarea pendiente de conexiones que se cortan del hito 1f.

### 27 oct 2026 — por el chat: probar en línea en casa, más fácil

«¿Qué pongo para probar con otra persona?» (resumido) y «me lo ponías con textos en alguna terminal y lo hacía más rápido, ¿no?» → Archivos de doble clic en la raíz: `jugar_en_casa.bat` (Windows) y `jugar_en_casa.command` (Mac). Encienden el servidor y la web en su ordenador y dicen la dirección que hay que abrir en los dos aparatos (con el servidor ya puesto: no hace falta tocar Opciones). No comprobado en Windows ni en Mac de verdad; el paso de la dirección por la página, sí.
«¿Me puedes hacer un bat que me lo haga todo, incluido descargar e instalar Node?» → `jugar_en_casa.bat` lo hace todo: si faltan, descarga Node.js portable (sin instalar nada en Windows) y el juego en la carpeta Kinhold del usuario; enciende el servidor (el mundo se guarda aparte, en Kinhold\mundo.jsonl, y no se pierde al actualizar) y la web (`herramientas/servir_web.mjs`, sin descargar nada más), y abre el juego. Se puede bajar suelto. La web local y la conexión, comprobadas aquí; el .bat, no comprobado en un Windows de verdad.
La otra persona juega desde otro país; «en bat todo, en uno» → `jugar_en_casa.bat` pregunta si la otra persona está en la misma casa (1) o lejos (2). Con 2 (tras avisar de que quien tenga el enlace puede entrar al servidor del juego, que aún no tiene contraseñas): descarga el túnel gratuito de Cloudflare, saca el servidor del juego a internet sin abrir puertos y da el enlace a la web pública con el servidor ya puesto (copiado al portapapeles). Probado por valravnx el 27 oct con dos aparatos en países distintos: funciona (construyen juntos y se ven con su personaje, 60 fps en su PC).

### 27 oct 2026 (18:54) — por el chat: un paisaje bonito de cerca

«Sobre todo topología final, frondosidad de bosques, que no parezcan llanos de 20 kilómetros hasta una colina que crezca otros 10 km hasta estar a los 6000 metros; que sean acantilados, lugares bellos, hacerlo de manera que el landscape sea bonito, ¿cómo lo hacemos?» → Planificado el hito 10 con tareas para el relieve de detalle por escalas, cortados y acantilados según la roca, valles tallados por los ríos, bosques densos con claros y lindes, y un boceto 3D de cerca para juzgar el paisaje antes de meterlo en el juego.

### 27 oct 2026 (18:23) — por el chat: el suelo de troncos no cierra

«El suelo de troncos no acaba de cerrar cuando hay varios, debería juntarse todo de una» (con captura: rendijas verdes y las testas de los troncos en cada junta) → Tarea de arreglo en el hito 1c, en curso en la sesión de chat.

### 27 oct 2026 (16:57) — por el chat: semilla del mundo y recursos

«66172 de seed en 256 me gusta. Lo que tienes que poner los recursos para que los jugadores normales puedan tener sin moverse 100 km; lo que sí puedes poner marcadas así las superbetas para explotar a muerte, eso sí» → Decidido el mundo de 256 × 256 km con la semilla 66172 (decisión «tamaño del mundo» resuelta). Tarea nueva en el hito 10, en curso en la sesión de chat: recursos comunes cerca de cualquier sitio y grandes vetas marcadas en el mapa.

### 27 oct 2026 (12:50 y 13:06) — por el chat: el mapa, con formas naturales a la europea

«En vez de ser un país circular, me gustaría que fuera algo con más relieves. Piensa en estilo Europa, un país mínimo me gustaría que fuera insular, bastante apartado del continente para forzar el uso de barcos… zonas geográficamente muy separadas… para que no sea una gran masa de tierra circular en medio del mar.» Y después: «Este no deja de ser una especie de trapezoide con dos pequeños salientes y una isla circular… mira cómo es el mapa de Europa, mira cómo son mapas de fantasía diseñados en otros lados. Haz un research… No quiero formas predefinidas, quiero que tenga curvas, penínsulas, ínsulas, un poco de todo» → Investigado (generadores de mapas de fantasía por plantillas de colinas, sierras, fosas y hoyas; dominio deformado; costas fractales) y rehecho el generador sin figuras fijas, con una isla-país siempre apartada por mar. Publicado «Mapa del mundo» v1. Queda por decidir el tamaño del mundo (188 o 256 km).

### 27 oct 2026 (13:51) — por el chat: dos fallos en construir

«Se ven los muebles del piso de arriba aunque estés en el de abajo, no debe ocurrir con el siguiente piso tapado; y parece que el control con WASD está fallando según mi chica, que está testeando» → Tarea de arreglo en el hito 1c, en curso en la sesión de chat.

### 27 oct 2026 (12:36) — por el chat: decisiones de cavar y diseño del mundo

«Sí, aprueba lo del vano por material» (sin derrumbes: sin apoyo no se avanza). Escombro: «sacarlo con carretilla, sí, porque es importante que sea un material que se pueda utilizar». Hierro: «poco y malo en superficie, y lo bueno en la mina, sí». «Prohibimos cavar dentro del radio de mojón ajeno, y no solo eso, sino de su radio de influencia» (en el GDD, el radio de exclusión). → GDD apartado 8 (Cavar y minar) y tareas nuevas en el hito 1g.
«Tendríamos que empezar a trabajar en el diseño de mundo… es un buen punto para empezar a hacer unos primeros bocetos» → Hito 10 (Mundo) lo lleva la sesión de chat; primera tarea: bocetos del mundo.

### 27 oct 2026 (12:27) — por el chat: cavar en todo el mundo, sin agujeros a lo loco

Medida en su móvil (cavar v1): 70 fps, 13,0 mil triángulos, malla por golpe 23,7 ms de media y 52,3 ms el peor (98 golpes). «Funciona perfecto».
«¿Cómo hacemos para que todo el mundo pueda ser editado de esta manera? Hay que hacerlo de una manera que esté bien. No podemos permitir que se hagan agujeros así a lo loco, y menos hacia abajo… más que se colapse, que no te permita avanzar si no tienes suficiente sustentación… si quieres hacer una mina profunda, tengas que poner sustentación en todas partes, ir poniendo los pilarcitos… los minerales y materiales como roca tengan diferentes tipos de sustentación, y que el hierro no se encuentre al aire libre excepto en ocasiones súper especiales, el carbón, tal… todo de manera realista… que no se abuse del cavar, que sea complejo y una labor que se tenga que hacer entre varios o que tome su tiempo hacer una mina decente» → En conversación: propuesta de diseño (mundo entero editable, sustentación por material, geología) pendiente de su visto bueno antes de pasarla al GDD y al hito 1g.

### 27 oct 2026 (10:13) — por el chat: la decoración se pone en el piso de arriba

«Al construir con un piso encima decoraciones, estas se ponen en el piso de arriba y no en el que estás, eso no debería ocurrir jamás; hay que mirar que el clic sea en el suelo del piso en el que estés si es que tienes el techo quitado por estar ahí» (con captura en el móvil: cama de madera sobre el altillo) → Tarea de arreglo en el hito 1c, en curso por la sesión de chat.

### 27 oct 2026 (10:15) — por el chat: suelos de troncos sin huecos

«Y de paso modifica los suelos de troncos para que no dejen huequecitos en el suelo, que tapen del todo» → Va en la misma tarea de arreglo.

### 27 oct 2026 (10:10) — por el chat: la web, de pergamino a feria medieval

«Al ser todo papel, aunque se vea bien, se siente como una web en modo claro más que algo medieval… que el tema no sea solo papiro, sino feria medieval: los cuadros de texto sí van en papiro con dibujo de papiro envuelto arriba y abajo o a los lados, y el resto es madera y estandartes varios… investiga antes de hacer una nueva versión» → Tarea nueva en el hito 0, en curso en la sesión de chat.

### 27 oct 2026 (08:50 UTC) — en la sesión del carril B: más de dos sesiones a la vez

El carril B estaba aún ocupado por la sesión de las obras (viva). valravnx: «hazla si no entorpece a los demás aunque sean varias a la vez» → Esta sesión hace la tarea «Cámara táctil con un dedo durante el combate» como una sesión de chat (tarea en curso en el roadmap y rama propia, sin tocar la reserva del carril en sesion.json), porque no comparte archivos con las demás ramas activas.

### 27 oct 2026 (09:41) — por el chat: web de progreso con estilo medieval

«Tu trabajo ahora va a ser embellecer la página de Kinhold del desarrollo, volverla estilo medieval estilizada lo más bonita posible con estilos de pergamino… la prueba integral unificada es la de jugar alpha más actualizada y el resto deben estar escondidas debajo en desplegables… todo lo demás estilízalo para que sea más fácil de visualizar y a la vez bonito» → Tarea nueva en el hito 0 (infraestructura), en curso en la sesión de chat.

### 27 oct 2026 (09:28) — por el chat: sin ciudades NPC

«Meter ciudades rompe el rollo de mundo a explorar que tenía la idea de survival, así que los quitaremos; los mercaderes aparecerán a cosa de 2 km de donde haya nadie cuando se dirijan a un asentamiento y solo se quedarán si se crea el sistema para ello, como el de reclutar soldados; y haremos lo del carro simple» → GDD (apartados 16 y 20) y documento de sistemas, en los tres idiomas: fuera las ciudades NPC; los mercaderes y mercenarios ambulantes aparecen a unos 2 km de cualquier jugador y llegan andando al asentamiento; un mercader solo se queda fijo si se crea un sistema para ello; los mensajeros van a asentamientos; la carretilla de rueda maciza se fabrica (ya no la regalan); dónde se celebran torneos y ferias queda por decidir.

### 27 oct 2026 (08:20 UTC) — por el chat: dónde va el servidor de prueba

«Para la pregunta del hito, opción A» → Servidor de la prueba online (hito 1f) en un alojamiento en la nube con una cuenta de valravnx: se le preparan el servidor y los pasos, y él crea la cuenta y, si es de pago, elige el plan. Pregunta quitada de las pendientes; la tarea de poner el servidor en internet pasa a pendiente.

### 27 oct 2026 (08:23) — por el chat: cavar y minar (en conversación)

valravnx pregunta cuánta carga de servidor supondría modificar el terreno cavando o minando, con la idea de que al entrar en una mina desaparezca lo que hay encima (como el tejado de las casas) y lo que el personaje no ve funda a negro. → Respuesta en el chat. valravnx no quiere casillas («look terriblemente cuadriculado»); se queda el híbrido que propone: cubitos pequeños (unos 50 cm) y la roca dibujada lisa e irregular alrededor con semilla fija (09:04). A las 09:09: «vamos a trabajarlo en paralelo, tercero» → GDD (sección 8, tres idiomas) y hito nuevo 1g «Cavar y minar», que lleva a mano esta sesión de chat; los carriles A y B no lo tocan («lleva»: «chat» en el roadmap).

### 27 oct 2026 (06:51–06:54) — por el chat: dos sesiones en paralelo

«¿Hay manera de duplicar el trabajo en paralelo sin romper nada?» y «que mida que no se pisen ni se estropeen entre ellas, que sean cosas diferentes, cambia y aplica para que haya dos siempre en paralelo» → Carriles A (minuto 19) y B (minuto 49) con herramientas/carriles.mjs, reglas nuevas en CLAUDE.md y su prueba.

### 27 oct 2026 (06:46) — por el chat: hito 1e aprobado

«Aprueba el 1e con pendiente a pulir todo lo que quede en el 10b» → Hito 1e aprobado y marcado como hecho. Pasan al hito 10b las losas del cimiento que repiten dibujo y la pregunta del desenfoque de maqueta (quitada de las preguntas pendientes).

### 27 oct 2026 (06:43) — por el chat: heridas, para más adelante

«También el tema de heridas, ahora son cuadrados sobre el personaje, en un futuro ya haremos que se vean mejor, pero para más adelante, quiero algo jugable antes» → La tarea de heridas visibles pasa del hito de arte (1b) al hito 10b, que ahora se llama «Pulido de manos, animaciones y heridas».

### 27 oct 2026 (06:39) — por el chat: manos y animaciones, para más adelante

«Para un momento más futuro, quiero que hagamos una faena de nivelar las manos de los personajes con las herramientas que estén tomando para que las agarren bien… y que las animaciones no clipen con los mismos personajes. Más adelante: ahora lo importante es la funcionalidad, pero tiene que estar en el roadmap segurísimo.» → Hito nuevo 10b «Pulido de manos y animaciones», después del Mundo (pendiente, no se empieza antes), y su fila en el GDD.

### 26 oct 2026 (15:59) — por el chat: cómo será el premium

valravnx: el premium desbloqueará recetas para fabricar versiones más bonitas de las cosas, «pero ya se hará» → GDD (apartados 2 y 20, en los tres idiomas): el premium son recetas que se desbloquean, se fabrican en el juego con sus materiales y solo cambian el aspecto. Se concreta más adelante.

### 26 oct 2026 (15:35) — por el chat: análisis de lo que falta para un juego acabado

valravnx pidió analizar todos los sistemas y lo que faltaría (ropa tejida cosmética en vez de calidades, hogar, objetos, peces, una carreta de inicio, barcos por los que se pueda andar y comarcas con nombre que se dominan). Sus respuestas al análisis: el mapa del mundo lo revisará mucho a mano, así que los nombres se irán poniendo y ajustando; las ciudades NPC le parecen bien aunque la gente se arremoline cerca («un mal necesario»: crea rutas entre reinos, sitios de paso, y lejos queda sitio para bandidos y solitarios); la carretilla te la dan los NPCs además de enseñarte a hacerla; nada de calidades de objetos; el resto, como se propuso. → GDD v0.9, apartado 20 «Ampliación para un juego acabado» (también en inglés y ruso), con el hito donde se planifica cada cosa; documento de sistemas v1.2 (rastra en N0, carretilla de rueda maciza en N1); tarea de la ropa crafteable del hito 1b sin calidades.

### 26 oct 2026 (15:20) — por el chat: estados de simulación más variados

valravnx propone estados más variados de simulación; acepta los cinco que encajan, «pero para más adelante» → GDD (sección 6, también en inglés y ruso): mojado, herida infectada, comida en mal estado, dolor y borracho, como ampliación posterior a la primera versión del hito de supervivencia. Aburrimiento, tristeza y pánico quedan fuera.

### 26 oct 2026 (15:15) — por el chat: prueba online pronto

valravnx está de acuerdo en que lo multijugador es el mayor riesgo y le preocupa el coste del servidor para unas 100 personas → Hito nuevo 1f, «Prueba online mínima», en curso justo después del 1e (estilo v5): dos jugadores en el mismo mundo desde dos dispositivos, y una medición con 100 jugadores simulados para saber qué servidor hace falta y cuánto cuesta al mes.

### 26 oct 2026 (15:10) — por el chat: el estilo v5 solo está en los muros

«Revisa que la mejora gráfica de la construcción se aplique bien, he visto que has mejorado las paredes de troncos pero nada más… quiero que sea visualmente como aprobé en la prueba que hicimos, y eso aplica a todo» → Comprobado en las capturas de construcción v13 y demo v8: solo los muros de troncos tienen el estilo; tejados, cimientos, suelos, puertas, empalizada, muebles y el suelo de la escena siguen con el aspecto inicial. Hito nuevo 1e, «El estilo de la prueba v5 en todo», en curso y por delante del resto: reúne las cuatro tareas de estilo del 1c y añade la escena común (hierba, flores, matorrales, piedras, árboles de la v5), todo lo demás que se ve, y una revisión final comparando cada vista con la v5. Regla nueva en CLAUDE.md: la v5 vale para todo y nada se publica con el aspecto inicial.

### 26 oct 2026 (12:06) — por el chat: mundo a escala real, nado y obras con materiales (en conversación)

valravnx quiere: mundo a escala real en todo (planicies, pero también valles, pasos y montañas tipo Pirineos, bosques frondosos, ríos de varios gruesos; un mundo aún inexplorado que no se sienta un llano gigante y que favorezca establecerse en sitios concretos, como junto a los ríos); saber si el nado está en el GDD (no lo está); y que construir sea poner el marco de la obra, llevarle los materiales y construir con un tiempo según la pieza, con andamios, poleas y poleas mayores para subir materiales y piedras a lo alto (complicado pero posible en grupo, y no demasiado para una casita de madera solo o en pareja). → Propuesta enviada en el chat. valravnx (12:11): «sí, todo» → GDD v0.8 (mundo a escala real, agua y nado, obras), tareas nuevas en el hito 1c y el hito 10 puesto al día.

### 26 oct 2026 (09:28–10:14) — por el chat: pantalla en blanco en el móvil

«Sufro crasheos aleatorios donde se queda el juego así» (pantalla en blanco con los botones vivos), «jugando seguido y se queda así aunque reinicie», «no iba lagueado ni por debajo de 80 fps» → Fuga de memoria gráfica al rehacer las piezas, arreglada (construcción v12, combate v9, demo v7), con aviso y recarga si se pierde el dibujo 3D. Para recuperar el navegador: cerrar Chrome del todo y volver a abrir.

### 26 oct 2026 (07:51) — por el chat: brazos de la carrera

«La versión de carrera nueva tiene que mejorar en posición de brazos, están torcidos adelante en pose nada natural, arréglalo y aprobamos de una, y prueba el otro pendiente» → Brazos arreglados (personaje v13, demo v5) y carrera aprobada: se cierra la pregunta de la carrera. «El otro pendiente»: se empieza a pasar la construcción al estilo elegido (muros primero).

### 26 oct 2026 (07:43) — por el chat: la construcción sigue con el aspecto inicial

«Los muebles y construcción son los low-poly iniciales, no lo de la prueba visual, tienes pendiente cambiar antes de añadir más, ¿no?» → Cierto: la escena (cielo, luz, suelo, decorado) ya tiene el estilo v5, pero las piezas y los muebles no. Cinco tareas nuevas en el hito 1c, justo después de las barandillas (que estaba a medias) y antes de cualquier pieza nueva: muros, cimientos y suelos, tejados, puertas y cercas, y muebles con el estilo de la prueba. Sustituyen a la tarea de arte «Piezas de construcción con más detalle».

### 26 oct 2026 (07:36) — por el chat: hito 1d (Una sola demo)

«1d aprobado, sigue» → Hito 1d aprobado y marcado como hecho. Ya no hay ningún hito en revisión: se pueden empezar hitos nuevos.

### 26 oct 2026 (06:49) — por el chat: la carrera nueva en la demo única

«Ahora integra ese correr y todo en la única» → Demo única v4: el personaje del taller-v5 (carrera suavizada y a su velocidad) en construir, duelo y personaje, con lo último de cada prototipo.

### 26 oct 2026 (05:04) — por el chat: revisión de la demo

«Va muy bien de fps, pero la animación de correr me parece fea y exagerada, ¿podemos buscar otras?» → Se cierra la pregunta de los fps en el móvil (van bien). Tarea nueva en arte: correr más natural.

### 25 oct 2026 (17:51) — por el chat: no se pueden quitar muebles en PC

«Al quitar un mueble en PC, pide clicarlo y confirmar, pero al mover el ratón para confirmar se desclica, haciendo imposible borrar muebles» → Tarea nueva en el hito 1c (en curso, la hace esta sesión de chat): en Desmontar, lo elegido con clic se queda fijo hasta confirmar o cancelar; pasar el ratón ya no lo cambia.

### 25 oct 2026 (17:45) — por el chat: hito 0b (Bases técnicas)

«No tengo forma de revisar algo así, no sé de coding, haz un review rápido tú y apruébalo si lo ves bien» → Revisión del código hecha por Claude: las acciones con autor (`src/logica/acciones.js`) rechazan bien los mensajes mal formados, las piezas que no existen y los autores que no están en el combate; la unión del diario y las traducciones (`herramientas/unir_json.mjs`) solo se para ante un choque de verdad; todas las pruebas pasan. Detalles menores sin importancia (quitar un mueble que no existe no dice el motivo; el botón «rellenar» de materiales es solo del prototipo y el servidor tendrá que rechazarlo). Hito aprobado y marcado como hecho.

### 25 oct 2026 (14:28) — por el chat: hito 0 (Infraestructura)

«Perfecto, revisado» → Hito de infraestructura aprobado y marcado como hecho (documentos de diseño en ruso incluidos).

### 25 oct 2026 (11:13) — por el chat: análisis del proyecto

«Arregla en el proyecto añadiendo hitos donde toque de todos estos puntos, actualiza el GDD y planifica unificar demos.» → Hitos nuevos 0b (bases técnicas) y 1d (una sola demo), tareas nuevas en infraestructura, duelo, arte, equipo y servidor, y GDD v0.7 (también en inglés).

### 25 oct 2026 (10:59) — por el chat, sobre la ropa por capas

«Que se pueda customizar más adelante in-game todo eso.» → Tarea nueva en el hito de arte: personalización en el juego de la ropa y la armadura (tintes, blasón de la sobreveste, capas).

### 25 oct 2026 (09:53) — por el chat: decisiones pendientes

Estilo: el realismo en miniatura de la v5 es la base. Cámara táctil: como se propuso. Curación: la tabla del análisis; en combate se puede, lento y vendido. Fuego amigo: sigue al PvP (desactivado dentro de la familia: no hace nada; fuera, hiere). valravnx pide además que la sesión del chat pueda trabajar en paralelo a otras sesiones.

### 25 oct 2026 (09:39) — por el chat: algo no relacionado con la ropa

«Puedes hacer, están haciendo los modelados de ropa; haz algo no relacionado.» Elige planificar el hito de construcción (1c). Hecho: 9 tareas nuevas en el roadmap; los puentes se dejan para el hito Mundo.

### 25 oct 2026 (09:14) — por el chat: base de los personajes

«Lo veo bien, sigue» y elige el **taller propio** (MakeHuman con ropa por código) como base de los personajes. Se cierran las decisiones personaje-v2 y paquete-ropa; tareas del hito de arte rehechas para el taller. Ya no hace falta que solo la sesión del chat toque `src/personaje/`: las sesiones automáticas pueden seguir con las tareas del taller (que no toquen a la vez lo que esté haciendo la sesión del chat: mirar `proyecto/sesion.json`).

(Nota anterior, ya superada, del 24 oct 23:05: personajes con las bases de Quaternius y solo la sesión del chat toca el personaje.)

### 25 oct 2026 (08:21 y 08:35) — por el chat: pecho, postura y hombros del hombre

Arreglado en personaje v7: tronco enderezado, hombros en su sitio, brazos colgando rectos y túnica que cae desde el pecho. Prueba nueva de postura.

### 25 oct 2026 (07:35) — por el chat: ropa del taller «al revés»

Arreglado en personaje v6: la ropa, el pelo y la cofia no escribían profundidad en calidad alta y la piel se pintaba encima.

### 25 oct 2026 (06:38) — por el chat: «adelante»

Animaciones de Quaternius pasadas al esqueleto de MakeHuman; personaje v5 publicado con la opción «Base del personaje» para comparar.

### 25 oct 2026 (06:37) — por el chat, sobre el taller MakeHuman

«Sigue con una claridad en la barbilla, pero está decente para usar de placeholder por ahora.» → El personaje vestido de MakeHuman vale como provisional. Queda pendiente: oscurecer la barba bajo la barbilla (se aclara antes de tiempo hacia el cuello).

### 25 oct 2026 (05:41) — por el chat, sobre el taller MakeHuman

«La barba del hombre deja la barbilla mal, hazle solo un coloreado; sus labios son enormes.» → Barba pintada en la piel y labios más finos. Además se arregla el encuadre de las fotos, que cortaba la barbilla.

### 24 oct 2026 (20:53) — por el chat, sobre la prueba de estilo v4

"Los árboles fatal, la casa está bien; los árboles se ven como rayajos raros." → Prueba de estilo v5 con árboles rehechos.

### 24 oct 2026 (20:34) — por el chat, sobre la prueba de estilo v3

"Me gusta, aunque el mundo no estará recortado en la base; ¿podemos hacer una prueba texturizando un poco para probar ese rollo de realismo en miniatura?" → Prueba de estilo v4.

### 24 oct 2026 (20:21) — por el chat, sobre la prueba de estilo v2

"El estilo me recuerda a juegos gratuitos de motor genérico, y las rocas no cubren el fondo del edificio, se ven como piedras sueltas; no me acaba de convencer." Elegida la dirección «maqueta en miniatura» (formas limpias y redondeadas, luz suave, sombras de contacto, fondo desenfocado). → Tarea nueva en el hito 1b: prueba de estilo v3.

### 24 oct 2026 — por el chat, sobre los personajes

"Tienes que hacerlos por código pero respetando lo que te he dicho; sé que tienes métodos de hacerlos vistosos, hay que saber solo el cómo." → Decisión: personajes por código. Tarea del personaje a pendiente.

### 24 oct 2026 (19:24) — por el chat, sobre las pruebas de estilo v1

"Solo has hecho un modelado y metido 3 skins encima, la B y C van horribles en cualquier PC y móvil, y el modelado del personaje es una absoluta aberración; mira cómo hacerlos de manera más eficiente y bella aunque sea estilizando, busca guías, presets, ideas." → Tarea nueva en el hito 1b (rehacer las pruebas, ligeras y estilizadas) y decisión pendiente sobre el origen de los personajes.

### 24 oct 2026 (19:14) — dos tareas nuevas en el hito 5 (Duelo)

**24 oct, 19:00 — prueba del combate v2 con un amigo (pasado por el chat). Crear tareas en el hito 5 (Duelo), estado pendiente:**

1. **El arco está roto: se puede correr y disparar como una ametralladora.** Arreglo provisional:
   - no se puede soltar antes del 50% de tensión (si sueltas antes, se cancela sin disparar);
   - correr cancela el tensado y no se puede empezar a tensar corriendo;
   - después de cada disparo, 0,8 s para sacar y encajar la siguiente flecha (piedras: 0,5 s);
   - pruebas nuevas en `prueba_combate.mjs` para las tres cosas (y romperlas a propósito una vez).
2. **Hace falta escudo.** Está en sistemas: escudo redondo (tablas + cuero + umbo, carpintero). Versión provisional sencilla para el campo de pruebas:
   - nueva opción "Espada y escudo" (espada de una mano, algo más corta que la larga);
   - con escudo, Parar también detiene **flechas y piedras** que vengan de frente;
   - la parada con escudo cuesta menos aliento que con la espada; parada perfecta y golpe maestro funcionan igual;
   - el escudo se ve en el brazo izquierdo y se levanta al parar;
   - el rival de la máquina también puede llevarlo (opción "Ropa/arma del rival").
   Anotar en `registro.js` que es provisional y que valravnx lo revisará.

(Idea descartada por valravnx, no hacer: elegir el golpe por la dirección en que mueves el ratón; ya se probó en la v1 y era caótico.)
