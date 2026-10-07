# Escuela de prueba (datos ficticios)

Dos scripts para probar VUNLEK con una escuela completa y luego dejar todo limpio.
Se ejecutan en tu computadora; no forman parte de la app.

## Preparación (una vez)

1. Copia `tools/demo/env.seed.ejemplo` a la raíz del proyecto con el nombre `.env.seed`.
2. Llena `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API).
   Deja `NODE_ENV=development`. Ese archivo no se sube a GitHub.
3. En Supabase (SQL Editor) ejecuta `supabase/migrations/20261017110000_borrar_escuela_de_prueba.sql`.

## Crear

```
npm run demo:crear
```

Crea la escuela "Rosario Castellanos" (ficticia) con 3 ciclos, 6 grupos, 1 directora, 10 docentes,
50 alumnos con calificaciones, 25 madres/padres con cuenta (2 con tres hijos y 3 con dos, en grados
distintos), 18 planeaciones y 4 programas analíticos (uno por campo formativo).
Al terminar imprime las cuentas y las guarda en `demo_credentials.md` (no se sube a GitHub).
La contraseña se genera al azar en cada ejecución y es la misma para todas las cuentas de prueba.

## Borrar

```
npm run demo:borrar
```

muestra qué se borraría. Para borrarlo de verdad:

```
npm run demo:borrar -- --confirmar
```

## Candados

- Solo corren con `NODE_ENV=development`; con cualquier otro valor, o dentro de Vercel/CI, se detienen
  antes de conectarse a la base.
- La limpieza borra **solo** lo que creó `demo:crear` (queda anotado en la tabla `demo_runs`) y las
  cuentas con correo `@demo.vunlek.test`. Aunque se ejecutara contra producción, no puede tocar
  una escuela ni una cuenta real.
- El borrado es una sola operación: si algo falla, no se borra nada.

No hay contadores que reiniciar: los registros usan identificadores únicos (UUID), no números consecutivos.

## Escenarios para probar

`demo:crear` también deja casos listos para revisar (función `demo_escenarios`, fechas relativas al día en que se crea):

- **Credenciales**: cada alumno tiene un código de lector `DEMO001`, `DEMO002`… en el orden de la lista (grado, grupo, apellido).
  En «Entrega de tarea con credencial» se puede teclear el código y pulsar Enter para simular la credencial.
- **Tarea abierta** en Matemáticas de cada grupo: «Tarea 5… (entrega con credencial)», la mitad del grupo ya la entregó y nadie está calificado.
- **Asistencia** con faltas, retardos y justificadas.
- **Seis alumnos con dificultades** (reprobación, conducta, falta grave, inasistencias, socioemocional, diagnóstico) y
  **dos docentes** (uno con inasistencias y planeaciones en borrador; otro con retardos). Sus nombres se imprimen al crear la escuela.
- Incidencias con acuerdos y avances, hojas prefoliadas sin capturar, encuesta socioemocional y diagnóstico de Matemáticas
  de primer grado capturados, bitácora de la dirección, cuatro visitas al aula (una en cada estado), asistencia del personal,
  ausencias y permisos, seguimiento y apoyo a alumnos, avisos, calendario, una sesión de CTE con acuerdos y solicitudes al técnico.
