@echo off
setlocal enabledelayedexpansion
echo ===========================================
echo   ACTUALIZAR REPOSITORIO DE GIT (GITHUB)
echo ===========================================
echo.

REM 1. Preguntar mensaje (Opcional)
set "mensaje=Actualizacion automatica %date% %time%"
set /p "input=Escribe el mensaje del cambio (Enter para usar fecha/hora): "

if not "!input!"=="" set "mensaje=!input!"

echo.
echo 1. Agregando archivos al control de versiones...
git add .
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al agregar archivos.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Guardando cambios (Commit)...
git commit -m "!mensaje!"
if %errorlevel% neq 0 (
    echo [INFO] No hay cambios pendientes para guardar.
)

echo.
echo 3. Subiendo cambios a la nube (Push)...
git push --set-upstream origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudieron subir los cambios a GitHub.
    echo Verifica tu conexion a internet o que tengas permisos.
    pause
    exit /b %errorlevel%
)

echo.
echo ===========================================
echo   TODO LISTO: CODIGO ACTUALIZADO
echo ===========================================
echo.
pause
