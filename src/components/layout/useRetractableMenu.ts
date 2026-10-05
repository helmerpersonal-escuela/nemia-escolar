import { useCallback, useEffect, useRef, useState } from 'react'

const PIN_KEY = 'vunlek_menu_fijo'
const EDGE = 28        // px desde el borde izquierdo donde empieza el gesto
const DISTANCE = 56    // px de arrastre horizontal para abrir o cerrar
const DESKTOP = 1024

const readPinned = () => { try { return localStorage.getItem(PIN_KEY) === 'true' } catch { return false } }

/**
 * Menú retráctil:
 * - Computadora: queda como una tira de iconos y se despliega al acercar el puntero (o con el teclado);
 *   se puede "fijar" para dejarlo abierto. No empuja el contenido al desplegarse.
 * - Celular y tableta: oculto; se abre arrastrando el dedo desde el borde izquierdo y se cierra
 *   arrastrando hacia la izquierda o tocando fuera.
 */
export function useRetractableMenu(isOpen: boolean, setOpen: (v: boolean) => void) {
    const [pinned, setPinned] = useState(readPinned)
    const [hovered, setHovered] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const togglePinned = useCallback(() => {
        setPinned(p => { try { localStorage.setItem(PIN_KEY, String(!p)) } catch { /* modo privado */ } return !p })
    }, [])

    // Pequeñas esperas: no se abre por pasar el puntero de camino a otra cosa, ni se cierra al menor desvío
    const hover = useCallback((v: boolean) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setHovered(v), v ? 90 : 280)
    }, [])
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

    // Gestos en pantallas táctiles
    const open = useRef(isOpen)
    open.current = isOpen
    useEffect(() => {
        let sx = 0, sy = 0, tracking: 'open' | 'close' | null = null
        const start = (e: TouchEvent) => {
            if (window.innerWidth >= DESKTOP || e.touches.length !== 1) { tracking = null; return }
            sx = e.touches[0].clientX; sy = e.touches[0].clientY
            tracking = open.current ? 'close' : (sx <= EDGE ? 'open' : null)
        }
        const move = (e: TouchEvent) => {
            if (!tracking) return
            const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy
            if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx)) { tracking = null; return } // es desplazamiento vertical
            if (tracking === 'open' && dx > DISTANCE) { setOpen(true); tracking = null }
            if (tracking === 'close' && dx < -DISTANCE) { setOpen(false); tracking = null }
        }
        const end = () => { tracking = null }
        window.addEventListener('touchstart', start, { passive: true })
        window.addEventListener('touchmove', move, { passive: true })
        window.addEventListener('touchend', end, { passive: true })
        window.addEventListener('touchcancel', end, { passive: true })
        return () => {
            window.removeEventListener('touchstart', start)
            window.removeEventListener('touchmove', move)
            window.removeEventListener('touchend', end)
            window.removeEventListener('touchcancel', end)
        }
    }, [setOpen])

    // Escape cierra el menú desplegado
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setHovered(false); if (window.innerWidth < DESKTOP) setOpen(false) } }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [setOpen])

    /** En computadora: solo iconos (true) o desplegado (false). En celular no aplica. */
    const collapsed = !pinned && !hovered
    return { pinned, togglePinned, collapsed, hover }
}
