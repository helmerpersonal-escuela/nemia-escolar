@echo off
REM Script simple para subir cambios a Git
REM Uso: git-push-simple.bat

echo Verificando estado...
git status

echo.
echo Agregando archivos...
git add .

echo.
set /p mensaje="Escribe el mensaje del commit: "

echo.
echo Creando commit...
git commit -m "%mensaje%"

echo.
echo Subiendo a GitHub...
git push

echo.
echo Cambios subidos exitosamente!
git log --oneline -1

pause
