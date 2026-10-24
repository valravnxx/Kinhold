// Decisiones tomadas en la prueba de estilo, para revisar.
export const VERSION_ESTILO = 'Prueba de estilo · v2';
export const REGISTRO_ESTILO = [
  'v2, por qué: en la v1 había un solo modelo con tres acabados, B y C iban muy lentos y el personaje no valía. Ahora hay un solo estilo, estilizado y sobrio, hecho para que vaya bien en móvil.',
  'Sombreado de dibujo con tres tonos (luz, medio y sombra) y caras planas: se lee bien de lejos y es barato. El color va en los vértices con algo de variación y oclusión horneada (más oscuro al pie de las cosas y bajo el alero). Sin texturas.',
  'Presupuesto medido: como mucho 30 mil triángulos y 60 dibujados por imagen. Toda la parte fija (cabaña, leña, tocón, barril, banco, cerca) es un solo dibujado; árboles, rocas y matas van repetidos con instancias, un dibujado por tipo.',
  'Una sola luz con sombra, de 1024 px y ajustada a la zona cercana. Cielo con degradado y niebla, sin efectos de posproceso.',
  'Resolución adaptativa: empieza a 1,5× como mucho; si en 2 s no llegas a 50 fps baja un escalón (hasta 0,75×) y si vas sobrado sube. Arriba se ve lo medido en tu aparato.',
  'Tejado de paja grueso con flecos en el alero y franjas de atado, para que se lea como paja y no como tablas.',
  'Dos luces para comparar con el mismo coste: mañana y tarde.',
  'El personaje no está: espera tu decisión (malla continua por código o modelos libres ya animados).',
  'Puedes girar la cámara arrastrando (un dedo en el móvil) y acercarte con la rueda o pellizcando.',
];
