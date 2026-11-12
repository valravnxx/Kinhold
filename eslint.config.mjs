// Kinhold — el analizador de código (eslint). Solo lo que señala fallos de verdad:
// nombres sin definir, claves repetidas, código que no se alcanza, comparaciones imposibles…
// Se pasa con `node herramientas/comprobar_codigo.mjs` (segundos, sin la nube).
import globals from 'globals';

const reglas = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-const-assign': 'error',
  'no-import-assign': 'error',
  'no-func-assign': 'error',
  'no-class-assign': 'error',
  'no-redeclare': 'error',
  'no-unsafe-negation': 'error',
  'no-unsafe-finally': 'error',
  'no-compare-neg-zero': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-constant-binary-expression': 'error',
  'no-unused-private-class-members': 'error',
  'for-direction': 'error',
  'getter-return': 'error',
  'no-setter-return': 'error',
  'no-sparse-arrays': 'error',
  'no-unexpected-multiline': 'error',
  'no-loss-of-precision': 'error',
  'no-invalid-regexp': 'error',
  'no-obj-calls': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
};

export default [
  { ignores: ['node_modules/**', 'docs/**', '**/node_modules/**', 'src/**/dist/**', 'herramientas/pc_grafica/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: reglas,
  },
  {
    // Lo que corre en node: el servidor, las herramientas, las pruebas y los constructores.
    files: ['servidor/**', 'herramientas/**', 'pruebas/**', '*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // En las pruebas, llamar dos veces a lo mismo y comparar es mirar que sale siempre igual.
    files: ['pruebas/**'],
    rules: { 'no-self-compare': 'off' },
  },
  {
    // La lógica pura la ejecutan el navegador y el servidor: ni window ni document.
    files: ['src/logica/**', 'src/combate/logica.js'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
  },
];
