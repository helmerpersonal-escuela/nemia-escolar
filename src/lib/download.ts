import { Capacitor } from '@capacitor/core'

/**
 * Guarda un archivo generado en el dispositivo.
 *  - Web: descarga normal del navegador.
 *  - Android/iOS: lo prepara en el teléfono y abre el menú "Compartir" (guardar en Archivos, WhatsApp, correo, Drive…).
 */
export async function saveFile(blob: Blob, fileName: string) {
    if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
        const data = await blobToBase64(blob)
        const res = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache, recursive: true })
        try {
            await Share.share({ title: fileName, url: res.uri, dialogTitle: 'Compartir o guardar' })
        } catch { /* el usuario cerró el menú: no pasa nada */ }
        return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
})
