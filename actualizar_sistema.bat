@echo off
echo ==========================================
echo   EDU-MANAGER: ACTUALIZAR BASE DE DATOS
echo ==========================================
echo.

set PROJECT_REF=aveqziaewxcglhteufft

echo 1. Iniciando sesion en Supabase...
echo (Se abrira una ventana en tu navegador para que autorices el acceso).
echo.
call npx supabase login

echo.
echo 2. Corrigiendo nombres de archivos de base de datos (Version Final)...
call node fix_migrations_v2.js

echo.
echo 3. Vinculando con Supabase...
echo (Si te pide contrasena, es la que usaste al crear el proyecto en supabase.com)
echo.
call npx supabase link --project-ref %PROJECT_REF%

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudo vincular el proyecto. 
    echo Revisa tu conexion o contrasena e intenta de nuevo.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Subiendo cambios a la base de datos...
call npx supabase db push

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudieron subir los cambios.
    pause
    exit /b %errorlevel%
)

echo.
echo 3. Desplegando funciones (Edge Functions)...
call npx supabase functions deploy

echo.
echo ==========================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ==========================================
echo.
pause
