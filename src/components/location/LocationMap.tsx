import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
    center: { lat: number; lng: number; zoom: number } | null
    pin: { lat: number; lng: number } | null
    onPin: (p: { lat: number; lng: number }) => void
}

const MEXICO = { lat: 23.6345, lng: -102.5528, zoom: 4 }

// Pin propio (evita depender de las imágenes por defecto de Leaflet, que se rompen al empaquetar)
const pinIcon = L.divIcon({
    className: '',
    html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#4f46e5;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
})

/** Mapa (OpenStreetMap) para marcar la ubicación exacta de la escuela: toca o arrastra el pin. */
export default function LocationMap({ center, pin, onPin }: Props) {
    const box = useRef<HTMLDivElement>(null)
    const map = useRef<L.Map | null>(null)
    const marker = useRef<L.Marker | null>(null)
    const onPinRef = useRef(onPin)
    onPinRef.current = onPin

    useEffect(() => {
        if (!box.current || map.current) return
        const start = pin ? { ...pin, zoom: 16 } : center ?? MEXICO
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], start.zoom)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(m)
        m.on('click', (e: L.LeafletMouseEvent) => onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
        map.current = m
        // El contenedor puede cambiar de tamaño al montarse dentro del asistente
        setTimeout(() => m.invalidateSize(), 200)
        return () => { m.remove(); map.current = null; marker.current = null }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Enfoca lo capturado (estado → municipio → colonia)
    useEffect(() => {
        if (map.current && center) map.current.flyTo([center.lat, center.lng], center.zoom, { duration: 0.8 })
    }, [center?.lat, center?.lng, center?.zoom])

    // Pin de la escuela
    useEffect(() => {
        const m = map.current
        if (!m) return
        if (!pin) { marker.current?.remove(); marker.current = null; return }
        if (!marker.current) {
            marker.current = L.marker([pin.lat, pin.lng], { draggable: true, icon: pinIcon, keyboard: true, title: 'Ubicación de la escuela' }).addTo(m)
            marker.current.on('dragend', () => {
                const p = marker.current!.getLatLng()
                onPinRef.current({ lat: p.lat, lng: p.lng })
            })
        } else {
            marker.current.setLatLng([pin.lat, pin.lng])
        }
    }, [pin?.lat, pin?.lng])

    return <div ref={box} className="relative isolate z-0 w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-200" role="application" aria-label="Mapa para ubicar la escuela" />
}
