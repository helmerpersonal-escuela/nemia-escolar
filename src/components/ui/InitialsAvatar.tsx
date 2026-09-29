/** Iniciales en un círculo (sin servicios externos: no se envían nombres ni CURP a terceros). */
const COLORS = ['bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700']

export const InitialsAvatar = ({ name, className = 'h-10 w-10 rounded-full text-sm' }: { name?: string | null; className?: string }) => {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
    const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
    const color = COLORS[Array.from(String(name ?? '')).reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]
    return <span aria-hidden="true" className={`inline-flex items-center justify-center font-black shrink-0 ${color} ${className}`}>{initials}</span>
}
