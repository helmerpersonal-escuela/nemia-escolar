@echo off
echo ===========================================
echo   PUBLICAR CAMBIOS EN GITHUB
echo ===========================================
echo.

set /p msg="Mensaje del commit (Enter para "Actualizacion"): "
if "%msg%"=="" set msg=Actualizacion automatica

echo.
echo 1. Descargando cambios remotos (git pull)...
git pull origin main

echo.
echo 2. Agregando archivos...
git add .

echo.
echo 3. Guardando cambios (git commit)...
git commit -m "%msg%"

echo.
echo 4. Subiendo a GitHub (git push)...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Ocurrio un error al subir los cambios.
    echo Verifica tu conexion o si hay conflictos.
    pause
    exit /b %errorlevel%
)

echo.
echo [EXITO] Cambios publicados correctamente.
pause
