// Tamaño de letra de la app (preferencia de cada persona en este dispositivo).
export type TextSize = 'normal' | 'lg' | 'xl'

const KEY = 'vunlek.textSize'
const EVENT = 'vunlek:text-size'

export const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; hint: string }[] = [
  { value: 'normal', label: 'Normal', hint: 'Tamaño estándar' },
  { value: 'lg', label: 'Grande', hint: 'Un poco más grande' },
  { value: 'xl', label: 'Muy grande', hint: 'Para leer sin esfuerzo' },
]

export function getTextSize(): TextSize {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'lg' || v === 'xl') return v
  } catch { /* almacenamiento no disponible */ }
  return 'normal'
}

export function applyTextSize(size: TextSize = getTextSize()) {
  const html = document.documentElement
  if (size === 'normal') html.removeAttribute('data-text-size')
  else html.setAttribute('data-text-size', size)
}

export function setTextSize(size: TextSize) {
  try { localStorage.setItem(KEY, size) } catch { /* sin almacenamiento: solo esta sesión */ }
  applyTextSize(size)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: size }))
}

export function onTextSizeChange(cb: (s: TextSize) => void) {
  const h = (e: Event) => cb((e as CustomEvent<TextSize>).detail)
  window.addEventListener(EVENT, h)
  return () => window.removeEventListener(EVENT, h)
}
