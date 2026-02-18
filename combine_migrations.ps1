$migrationsPath = "c:\SistemaGestionEscolar\supabase\migrations"
$outputPath = "c:\SistemaGestionEscolar\consolidated_schema.sql"

# Definir archivos base que DEBEN ir primero para crear las tablas fundamentales
# SIGUIENDO EL ORDEN DE DEPENDENCIAS LÓGICO
$priorityFiles = @(
    "20260215000052_setup_database.sql",
    "20260215000053_setup_phase1_5_onboarding.sql",
    "20260215000110_subscriptions_schema.sql",
    "20260215000029_institutional_setup.sql",
    "20260215000055_setup_phase2.sql",
    "20260215000057_setup_phase3_students.sql",
    "20260215000054_setup_phase1_6_subjects.sql",
    "20260215000038_create_evaluation_config_schema.sql",
    "20260215000003_create_criteria_catalog.sql",
    "20260215000039_create_evaluation_schema.sql",
    "20260215000042_create_planning_schema.sql",
    "20260215000043_create_rubric_schema.sql",
    "20260215000047_create_tracking_schema.sql",
    "20260215000027_create_synthetic_catalog.sql",
    "20260215000030_seed_phase_6.sql",
    "20260215000031_seed_phases_1_2.sql",
    "20260215000032_seed_phases_3_4_5.sql",
    "20260215000005_analytical_program.sql",
    "20260215000014_zzz_fix_analytical_schema_full.sql",
    "20260215000113_database_resurrection.sql"
)

$allFiles = Get-ChildItem -Path "$migrationsPath\*.sql" | Sort-Object Name
$remainingFiles = $allFiles | Where-Object { $priorityFiles -notcontains $_.Name }

if (Test-Path $outputPath) { Remove-Item $outputPath }

# 1. Procesar archivos de prioridad
foreach ($fileName in $priorityFiles) {
    $filePath = Join-Path $migrationsPath $fileName
    if (Test-Path $filePath) {
        Write-Host "Priorizando: $fileName"
        Add-Content -Path $outputPath -Value "-- ########## PRIORITY FILE: $fileName ##########"
        $content = Get-Content -Path $filePath -Raw
        Add-Content -Path $outputPath -Value $content
        Add-Content -Path $outputPath -Value "`n"
    }
    else {
        Write-Warning "Archivo de prioridad no encontrado: $fileName"
    }
}

# 2. Procesar el resto de los archivos en orden alfabético
foreach ($file in $remainingFiles) {
    Write-Host "Procesando: $($file.Name)"
    Add-Content -Path $outputPath -Value "-- ########## FILE: $($file.Name) ##########"
    $content = Get-Content -Path $file.FullName -Raw
    Add-Content -Path $outputPath -Value $content
    Add-Content -Path $outputPath -Value "`n"
}

Write-Host "Combinación ordenada completada: $outputPath"
