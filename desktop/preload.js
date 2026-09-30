// Puente mínimo y seguro entre la página de VUNLEK y la app de escritorio (solo estas dos funciones).
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vunlekDesktop', {
  isDesktop: true,
  // Trae la ventana al frente (al tocar un aviso de mensaje)
  focus: () => ipcRenderer.send('vunlek:focus'),
  // Hace parpadear el ícono en la barra de tareas cuando llega un mensaje y la ventana no está al frente
  attention: () => ipcRenderer.send('vunlek:attention'),
})
