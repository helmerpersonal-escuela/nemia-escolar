@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Actualizar la app de Android con la version mas reciente ===
echo.
echo 1) Armando la pagina (1 o 2 minutos)...
call npm run build
if errorlevel 1 goto error
echo.
echo 2) Copiandola a la app de Android...
call npx cap sync android
if errorlevel 1 goto error
echo.
echo 3) Abriendo Android Studio...
call npx cap open android
echo.
echo Listo. En Android Studio conecta el celular y presiona el boton verde (Run).
echo La app se reinstala con la version nueva sin borrar la sesion.
goto fin
:error
echo.
echo Algo fallo. Copia el mensaje de arriba y compartelo con Claude.
:fin
echo.
pause
