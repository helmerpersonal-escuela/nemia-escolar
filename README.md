# Vunlek — Sistema de Gestión Escolar

Plataforma para escuelas de educación básica en México (Nueva Escuela Mexicana). Su objetivo es **quitarle carga administrativa al docente con apoyo de IA**: planeación didáctica, evaluación, asistencia, reportes y comunicación con las familias, en un solo lugar.

Funciona como aplicación web (Vercel) y como app móvil Android/iOS (Capacitor).

---

## Qué hace

| Área | Funciones principales |
|---|---|
| **Planeación** | Programa analítico, planeación didáctica por sesiones, bancos de plantillas y PDA, sugerencias con IA a partir del libro de texto |
| **Evaluación** | Libreta de calificaciones, criterios, rúbricas, instrumentos generados con IA, evaluación formativa y portafolio |
| **Asistencia** | Pase de lista de alumnos, asistencia del personal, retardos y justificantes |
| **Seguimiento** | Expediente del alumno, BAP, incidencias, citatorios, entrevistas, alertas académicas |
| **Gestión escolar** | Grupos, horarios, agenda, ausencias y suplencias, PEMC, control de personal |
| **Comunicación** | Chat escuela–familia, avisos del sistema, acceso de tutores |
| **Asistente NEM** | Chat con IA que responde con base en documentos oficiales de la NEM (búsqueda semántica) |
| **Suscripciones** | Planes Básico/Pro con Mercado Pago, prueba gratuita, licencias canjeables |

### Roles

`SUPER_ADMIN` (God Mode) · `DIRECTOR` · `ADMIN` · `ACADEMIC_COORD` · `TECH_COORD` · `SCHOOL_CONTROL` · `TEACHER` · `INDEPENDENT_TEACHER` · `PREFECT` · `SUPPORT` · `TUTOR` · `STUDENT`

Un mismo usuario puede pertenecer a varias escuelas (*workspaces*) con un rol distinto en cada una (`profile_tenants`).

---

## Trabajo sin conexión

Pensado para escuelas con mala señal. En la app Android y en la web (se instala desde Chrome como app):

- **Abre sin internet**: la web usa un *service worker* (`vite-plugin-pwa`) que guarda la app en el dispositivo; la sesión y los últimos datos consultados (perfil, escuela, suscripción) quedan en IndexedDB.
- **Pase de lista, calificaciones e incidencias** se pueden capturar sin señal. Se guardan en una *bandeja de salida* en el dispositivo y se envían solos al volver la conexión (`src/lib/offline/outbox.ts`).
  - Reintentar nunca duplica: asistencia y calificaciones usan *upsert* por su llave única; las incidencias llevan `id` generado en el dispositivo.
  - Si un dato se corrige varias veces sin señal, solo se sube la última versión.
  - Si el servidor rechaza un cambio (permisos, datos), tras 3 intentos queda como "no enviado" y se muestra en el indicador de conexión para reintentar o descartar.
  - En un dispositivo compartido, cada cambio se sube solo con la sesión de quien lo capturó. Al cerrar sesión se borran las copias de datos de alumnos.
- **"Preparar para usar sin conexión"** (indicador de conexión en el encabezado): descarga todos los grupos con sus alumnos, actividades, rúbricas e historial para usarlos después sin señal. Cada grupo abierto con internet también se guarda automáticamente.
- Eliminar reportes, crear actividades y demás funciones administrativas siguen requiriendo conexión.

## Tecnología

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query
- **Backend:** Supabase (Postgres con RLS, Auth, Storage, Edge Functions en Deno)
- **IA:** Gemini / Groq / OpenAI, **siempre a través de la función `ai-proxy`** (las llaves nunca llegan al navegador)
- **Pagos:** Mercado Pago (Checkout Pro + webhook)
- **Móvil:** Capacitor 8 (Android e iOS)
- **Pruebas:** Vitest + Testing Library, Playwright (E2E)

---

## Estructura

```
src/
  features/          Módulos por dominio (planning, evaluation, attendance, groups, …)
  components/        Layout, rutas protegidas y componentes compartidos
  hooks/             useTenant, useSubscriptionLimits, useChat, …
  lib/               supabase.ts, aiClient.ts (IA), gemini.ts (prompts NEM)
  services/          NemAiService (asistente NEM), extracción de PDF
supabase/
  migrations/        Esquema de la base de datos (en orden cronológico)
  functions/         Edge Functions (ver abajo)
  demo_seed.sql      Datos de una escuela de demostración (solo desarrollo)
android/, ios/       Proyectos nativos generados por Capacitor
tests/               Pruebas E2E (Playwright)
_archivo/            Scripts de depuración y salidas antiguas (fuera de git)
```

### Edge Functions

| Función | Para qué | Autenticación |
|---|---|---|
| `ai-proxy` | Toda llamada a IA (`generate`, `embed`). Límite diario por usuario y registro en `ai_usage` | Sesión del usuario |
| `create-payment-preference` | Crea el cobro en Mercado Pago. El precio sale de `license_limits` | Sesión del usuario |
| `mercado-pago-webhook` | Recibe la notificación de pago, verifica la firma y activa el plan | Firma `x-signature` |
| `create-test-user` | Alta directa de personal por Dirección/Coordinación | Sesión + rol en la escuela |
| `invite-tutor` | Crea o vincula la cuenta de un tutor | Sesión + personal de la escuela |

---

## Puesta en marcha (desarrollo)

Requisitos: Node.js 20+, npm, y una cuenta de Supabase.

```bash
npm install
cp .env.example .env      # y llena los valores
npm run dev               # http://localhost:5173
```

### Variables de entorno

**En `.env` (frontend, son públicas):**

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Llave pública (publishable) de Supabase |
| `VITE_MP_PUBLIC_KEY` | Llave pública de Mercado Pago |

> ⚠️ Todo lo que empieza con `VITE_` queda dentro de la app y cualquiera puede verlo. **Nunca** pongas ahí llaves de IA, tokens de Mercado Pago ni la service role.

**Secretos del servidor** (Supabase → Edge Functions → Secrets, o desde God Mode, que los guarda en `system_settings` con lectura exclusiva del servidor):

| Secreto | Usado por |
|---|---|
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY` | `ai-proxy` (OpenAI es necesario para el asistente NEM) |
| `MP_ACCESS_TOKEN` | Pagos |
| `MP_WEBHOOK_SECRET` | Verificación de firma del webhook |
| `FRONTEND_URL` | URL de regreso después del pago |

Ajustes opcionales en `system_settings` (God Mode): `preferred_provider` (`gemini`/`groq`/`openai`), `ai_daily_limit` (200 por defecto), `gemini_model`, `groq_model`, `openai_model`.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila TypeScript y genera `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias (Vitest) |
| `npx playwright test` | Pruebas E2E |
| `npm run cap:sync` | Copia `dist/` a los proyectos nativos |
| `npm run cap:open-android` / `cap:open-ios` | Abre Android Studio / Xcode |

---

## Base de datos

- Las migraciones viven en `supabase/migrations/` y se aplican en orden con el CLI de Supabase:
  ```bash
  npx supabase link --project-ref <ref>
  npx supabase db push
  ```
- **Nunca** hagas cambios de esquema directo en el panel sin crear la migración correspondiente.
- Toda tabla nueva debe tener **RLS activado** y políticas explícitas. Revisa el asesor de seguridad de Supabase después de cada cambio.
- Las funciones `SECURITY DEFINER` deben validar al usuario (`auth.uid()`, `is_god_mode()`, `has_tenant_link()`) y fijar `search_path`.

### Modelo de seguridad (resumen)

- **Super Admin:** `is_god_mode()` usa `auth.users` (correo confirmado) y `profile_roles`, nunca campos editables del perfil.
- **Perfiles:** un trigger impide que desde la app alguien se asigne `SUPER_ADMIN`, cambie su correo o se mueva a una escuela o rol sin vínculo en `profile_tenants`.
- **Configuración del sistema:** los secretos de `system_settings` solo los lee el Super Admin y el servidor.
- **Implementaciones sensibles** (borrado de cuentas, etc.) viven en el esquema `private`, que la API no expone. En `public` solo hay envoltorios que verifican permisos.

---

## Despliegue

- **Web:** Vercel compila automáticamente la rama `main` (`vercel.json` redirige todas las rutas a `index.html`).
- **Edge Functions:** `npx supabase functions deploy <nombre>`.
- **Android:** `npm run build && npm run cap:sync`, luego se genera el APK/AAB desde Android Studio. El CI (`.github/workflows/ci-cd.yml`) genera un APK de depuración en cada push a `main`.
- **iOS:** requiere macOS + Xcode (`npm run cap:open-ios`).

---

## Cuentas de demostración

`supabase/demo_seed.sql` crea una escuela de prueba con usuarios para cada rol. Úsalo **solo en entornos de desarrollo**; nunca en producción.
