import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, queryPersister, PERSIST_MAX_AGE } from './lib/queryClient'
import { startOutbox } from './lib/offline/outbox'
import { registerServiceWorker } from './lib/offline/registerSW'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { installGlobalErrorHandlers } from './lib/errorReporting'

const missingEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(k => !import.meta.env[k])

if (missingEnv.length) {
  // Falla de configuración del despliegue: mensaje claro en vez de pantalla en blanco.
  document.getElementById('root')!.innerHTML =
    '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:24px;text-align:center">' +
    '<h1 style="font-size:20px">Configuración incompleta</h1>' +
    '<p style="color:#475569">Faltan variables de entorno en el servidor: ' + missingEnv.join(', ') +
    '. Agrégalas en Vercel → Settings → Environment Variables y vuelve a desplegar.</p></div>'
  throw new Error('Faltan variables de entorno: ' + missingEnv.join(', '))
}

installGlobalErrorHandlers()
startOutbox()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE, buster: 'v1' }}
    >
      <BrowserRouter>
        <ToastProvider>
          <ErrorBoundary area="app">
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
