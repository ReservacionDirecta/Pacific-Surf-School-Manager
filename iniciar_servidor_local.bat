@echo off
title Pacific Surf School - Servidor Local
:: Configurar codificación de caracteres a UTF-8 para consola limpia
chcp 65001 >nul
cls

:: Definir colores para formato elegante
echo.
echo  ==============================================================
echo     █▀█ █▀█ █▀▀ █ █▀▀ █ █▀▀   █▀▀ █ █ █▀█ █▀▀   █▀▀ █▀▀ █ █ █▀█ █▀█ █   
echo     █▀▀ █▀█ █   █ █▀  ▄ █     ▀▀█ █ █ █▀▄ █▀    ▀▀█ █   █▀█ █ █ █ █ █   
echo     ▀   ▀ ▀ ▀▀▀ ▀ ▀   ▀ ▀▀▀   ▀▀▀ ▀▀▀ ▀ ▀ ▀     ▀▀▀ ▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀ ▀▀▀ 
echo  ==============================================================
echo                SISTEMA INTEGRADO DE CONTROL DIRECTO
echo                     Estable, Rápido y Portátil
echo  ==============================================================
echo.

:: 1. Verificar prerrequisitos (Node.js)
echo [*] Buscando instalación de Node.js en el sistema...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR] ¡No se encontró Node.js!
    echo [INFO] Por favor descarga e instala Node.js LTS desde: https://nodejs.org/
    echo [INFO] Una vez instalado, cierra esta ventana y vuelve a ejecutar este archivo.
    echo.
    pause
    exit
)
echo [OK] Node.js detectado correctamente.

:: 2. Configuración del entorno (.env)
if not exist .env (
    echo [*] Archivo de variables de entorno (.env) ausente.
    echo [*] Copiando plantilla inicial desde .env.example...
    copy .env.example .env >nul
    echo [OK] Archivo .env configurado. Puedes editarlo para configurar tu base de datos y llaves.
)

:: 3. Verificar estado de dependencias del framework
if not exist node_modules (
    echo [*] Carpeta "node_modules" no detectada.
    echo [*] Instalando dependencias necesarias. Esto puede tardar un momento...
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo [ERR] Error crítico instalando paquetes. Verifica tu conexión de red e intenta de nuevo.
        pause
        exit
    )
    echo [OK] Dependencias instaladas con éxito.
) else (
    echo [OK] Dependencias locales ya instaladas.
)

:: 4. Lanzar sitio de forma automática en el explorador por defecto
echo [*] Preparando apertura del navegador...
start "" "http://localhost:3000"

:: 5. Iniciar Servidor web express + base de datos SQLite local
echo ==============================================================
echo [INFO] Iniciando el servidor local de desarrollo...
echo [INFO] Conectando a la Base de Datos SQLite (database.sqlite)
echo [INFO] Presiona CTRL + C para apagar el servidor de forma segura.
echo ==============================================================
echo.

call npm run dev
pause
