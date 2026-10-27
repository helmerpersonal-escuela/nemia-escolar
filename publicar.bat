@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Publicar VUNLEK (web en vunlek.com) ===
echo.
git status --short
echo.
set N=0
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set N=%%i
if not "%N%"=="0" goto commit
set P=0
for /f %%i in ('git rev-list --count @{u}..HEAD') do set P=%%i
if "%P%"=="0" (
  echo No hay cambios para publicar.
  goto fin
)
echo Hay cambios guardados sin subir. Subiendo...
goto push
:commit
set "MSG="
set /p MSG=Describe el cambio (Enter = "Actualizacion %date%"): 
if not defined MSG set "MSG=Actualizacion %date%"
rem Quitar comillas: si se pegan, el mensaje del commit queda vacio
set "MSG=%MSG:"=%"
if not defined MSG set "MSG=Actualizacion %date%"
echo.
git add -A
git commit -m "%MSG%"
if errorlevel 1 goto error
:push
git push
if errorlevel 1 goto error
echo.
echo Listo. Vercel publicara la nueva version en 2 o 3 minutos.
goto fin
:error
echo.
echo Algo fallo. Copia el mensaje de arriba y compartelo con Claude.
:fin
echo.
pause
