// VUNLEK para escritorio: una ventana propia que abre www.vunlek.com.
// Como carga el sitio en línea, siempre tiene la versión más nueva (no hay que reinstalar).
const { app, BrowserWindow, shell, session, Menu, dialog, ipcMain } = require('electron')
const path = require('path')

const APP_URL = 'https://www.vunlek.com'
// Sitios que se abren dentro de la ventana (inicio de sesión y pagos); lo demás, en el navegador.
const INSIDE = [/^https:\/\/(www\.)?vunlek\.com/, /^https:\/\/[a-z0-9-]+\.supabase\.co/, /^https:\/\/accounts\.google\.com/,
  /^https:\/\/[a-z0-9.-]*mercadopago\.com(\.mx)?/]
const isInside = (url) => INSIDE.some((re) => re.test(url))

// Google no permite iniciar sesión desde navegadores "incrustados"; se usa la huella de Chrome normal.
const CHROME_UA = (ua) => ua.replace(/\s?Electron\/[\d.]+/, '').replace(/\s?vunlek-escritorio\/[\d.]+/, '')

let win = null

// Windows muestra los avisos con el nombre e ícono de la app solo si tiene su identificador
if (process.platform === 'win32') app.setAppUserModelId('com.vunlek.escritorio')

// Avisos de mensajes: traer la ventana al frente o hacer parpadear el ícono
ipcMain.on('vunlek:focus', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show(); win.focus()
})
// --- Identificador de la computadora para las licencias locales -----------------------------
// Se toma el identificador que el sistema operativo le da al equipo (no cambia al reinstalar la
// app) y se entrega su huella SHA-256 abreviada: el dato original nunca sale de la computadora.
let hwidCache = null
function machineId() {
  const { execFileSync } = require('child_process')
  const fs = require('fs')
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true })
      return (out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i) || [])[1] || null
    }
    if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' })
      return (out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/) || [])[1] || null
    }
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim() || null
    }
  } catch (e) { /* sin acceso: la app usa el identificador de la instalación */ }
  return null
}
ipcMain.handle('vunlek:hwid', () => {
  if (hwidCache) return hwidCache
  const id = machineId()
  if (!id) return null
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
  const hash = require('crypto').createHash('sha256').update(`vunlek-hwid-v1:${id.toLowerCase()}`).digest()
  let code = ''
  for (let i = 0; i < 20; i++) code += alphabet[hash[i] % alphabet.length]
  hwidCache = `PC-${code.match(/.{5}/g).join('-')}`
  return hwidCache
})

ipcMain.on('vunlek:attention', () => { if (win && !win.isFocused()) win.flashFrame(true) })

function createWindow () {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'VUNLEK',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true, preload: path.join(__dirname, 'preload.js') }
  })
  win.webContents.setUserAgent(CHROME_UA(win.webContents.getUserAgent()))
  win.on('focus', () => win && win.flashFrame(false))
  win.webContents.session.setSpellCheckerLanguages(['es-MX', 'es'])

  // Enlaces externos (PDF, WhatsApp, etc.) en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url === 'about:blank') return { action: 'allow' }
    if (isInside(url)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInside(url)) { event.preventDefault(); shell.openExternal(url) }
  })

  // Sin internet: pantalla amable con botón para reintentar
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || APP_URL } })
  })

  win.loadURL(APP_URL)
}

// Micrófono (notas de voz), cámara (foto del alumno) y ubicación (mapa de la escuela) solo para VUNLEK
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = details.requestingUrl || wc.getURL()
    const allowed = ['media', 'geolocation', 'notifications', 'clipboard-sanitized-write', 'fullscreen']
    callback(isInside(origin) && allowed.includes(permission))
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'VUNLEK',
      submenu: [
        { label: 'Inicio', click: () => win && win.loadURL(APP_URL) },
        { label: 'Recargar', accelerator: 'F5', click: () => win && win.reload() },
        { type: 'separator' },
        { label: 'Acercar', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Alejar', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Tamaño normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Pantalla completa', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Acerca de VUNLEK', click: () => dialog.showMessageBox({ title: 'VUNLEK', message: `VUNLEK Escolar ${app.getVersion()}`, detail: 'Gestión escolar para docentes.\nwww.vunlek.com' }) },
        { label: 'Salir', role: 'quit' }
      ]
    },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] }
  ]))

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

// Una sola ventana de VUNLEK abierta a la vez
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
