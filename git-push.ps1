# Script para subir cambios a Git
# Uso: .\git-push.ps1 "mensaje del commit"

param(
    [Parameter(Mandatory=$false)]
    [string]$mensaje = "Actualización de código"
)

Write-Host "🔍 Verificando estado del repositorio..." -ForegroundColor Cyan
git status

Write-Host "`n📦 Agregando archivos modificados..." -ForegroundColor Yellow
git add .

Write-Host "`n💾 Creando commit..." -ForegroundColor Green
git commit -m "$mensaje"

Write-Host "`n🚀 Subiendo cambios a GitHub..." -ForegroundColor Magenta
git push

Write-Host "`n✅ ¡Cambios subidos exitosamente!" -ForegroundColor Green
Write-Host "`n📊 Último commit:" -ForegroundColor Cyan
git log --oneline -1
