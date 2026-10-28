#!/bin/bash
# Kinhold: jugar en línea en casa (Mac). Doble clic en este archivo.
# Enciende el servidor del juego y la web en este Mac y dice la dirección que hay que abrir en los dos aparatos.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then echo "Falta Node.js. Instálalo desde https://nodejs.org (botón LTS) y vuelve a abrir este archivo."; read -r; exit 1; fi
[ -d node_modules/ws ] || { echo "Preparando por primera vez, espera un poco..."; npm install; }
IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo localhost)
node servidor/servidor.mjs 8080 &
node herramientas/servir_web.mjs 8000 >/dev/null &
sleep 2
echo
echo "  Listo. No cierres esta ventana mientras jugáis."
echo "  En el Mac y en el móvil (misma wifi) abrid esta dirección:"
echo
echo "  http://$IP:8000/jugar/demo/index.html?servidor=ws://$IP:8080"
echo
echo "  Luego: Personaje para elegir el vuestro, Menú, y Jugar en línea."
wait
