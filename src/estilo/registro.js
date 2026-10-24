// Decisiones tomadas en la prueba de estilo, para revisar.
export const VERSION_ESTILO = 'Prueba de estilo · v5 (realismo en miniatura, árboles rehechos)';
export const REGISTRO_ESTILO = [
  'v5, por qué: en la v4 los árboles se veían con rayajos raros (la textura de hojas se proyectaba por caras y hacía trazos). Ahora las copas son bolas suaves con bultos, como racimos, con luz arriba y sombra dentro, y una textura de manchas redondas que envuelve la copa sin costuras. Los pinos tienen el borde de cada piso en puntas caídas. La cabaña no cambia.',
  'v4, por qué: te gustó la maqueta de la v3, pero el mundo no estará recortado y querías probar el «realismo en miniatura» con algo de textura.',
  'Es la v3 con texturas hechas por código: veta en troncos y tablas, anillos en los cortes, paja en hebras, piedra, corteza, hojas y suelo. Las texturas son en gris y dan el detalle y el relieve (bumpMap); el color sigue saliendo de la paleta.',
  'Las texturas se colocan a escala real: la veta sigue el largo de cada tronco y tabla, la paja baja por la pendiente y los anillos se centran en cada corte.',
  'El suelo ya no acaba en un borde: sigue con lomas suaves hasta el horizonte, con un bosque lejano repetido con instancias y niebla del color del cielo.',
  'Se mantiene de la v3: formas redondeadas, zócalo de piedra continuo, luz suave con sombras blandas y de contacto, teleobjetivo y desenfoque arriba y abajo (con botón para quitarlo).',
  'Una malla por textura (unas siete) en vez de una sola: sigue muy por debajo del límite de dibujados.',
  'Presupuesto medido: como mucho 50 mil triángulos (contando la pasada de sombra) y 60 dibujados. Una sola sombra de 1024 px. Resolución adaptativa: empieza a 1,5× como mucho y baja hasta 0,75× si no llegas a 50 fps.',
  'El personaje se hará por código (lo decidiste); llega en la tarea siguiente.',
  'Puedes girar la cámara arrastrando (un dedo en el móvil) y acercarte con la rueda o pellizcando.',
];
