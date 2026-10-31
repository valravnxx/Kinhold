@echo off
rem Abre «Kinhold · tu gráfica para las pruebas» (sin ventana negra detrás).
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0kinhold_grafica.ps1"
