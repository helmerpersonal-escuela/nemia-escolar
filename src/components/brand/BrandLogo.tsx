/**
 * Logo oficial de VUNLEK (archivos en /public/brand, generados desde /branding).
 * - symbol: solo el dibujo (libro + cerebro)
 * - horizontal: dibujo + "VUNLEK" a la derecha
 * - vertical: dibujo arriba + "VUNLEK" abajo
 * tone "color" = índigo #42428F para fondos claros; "blanco" para fondos oscuros o de color.
 */
type Props = {
    variant?: 'symbol' | 'horizontal' | 'vertical'
    tone?: 'color' | 'blanco'
    className?: string
    /** Texto alternativo. Vacío si hay un texto "VUNLEK" junto al logo. */
    alt?: string
}

const FILE = { symbol: 'simbolo', horizontal: 'horizontal', vertical: 'vertical' } as const

export const BRAND_COLOR = '#42428F'

export function BrandLogo({ variant = 'symbol', tone = 'color', className = '', alt = 'VUNLEK' }: Props) {
    return (
        <img
            src={`/brand/logo-${FILE[variant]}-${tone}.svg`}
            alt={alt}
            className={className}
            draggable={false}
            decoding="async"
        />
    )
}
