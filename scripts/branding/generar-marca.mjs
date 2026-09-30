/**
 * Genera TODOS los logos e iconos de VUNLEK a partir de los dos SVG de /branding.
 *
 * Uso (desde la carpeta del proyecto):
 *   npx playwright install chromium      (solo la primera vez)
 *   npm run marca
 *
 * Para cambiar el diseño: reemplaza branding/Vunlek.svg (solo el dibujo) y/o
 * branding/Vunlek_inicio.svg (dibujo + nombre abajo), o cambia los colores en
 * branding/marca.json, y vuelve a correr `npm run marca`. Ver branding/LEEME.md.
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/marca.json'), 'utf8'))
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8')
const write = (p, data) => {
    const full = path.join(ROOT, p)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, data)
    console.log('  ✓', p)
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent('<html><body style="margin:0"></body></html>')

// ── 1. Logos en SVG (a color y en blanco), con los detalles como huecos transparentes ──
// Las partes oscuras del diseño son "tinta" y las claras son huecos: así el logo sirve
// sobre cualquier fondo en un solo color.
const logos = await page.evaluate(({ symSrc, fullSrc, color }) => {
    const host = document.body
    const load = (src) => {
        const doc = new DOMParser().parseFromString(src, 'image/svg+xml')
        const svg = document.importNode(doc.documentElement, true)
        svg.querySelectorAll('metadata, title').forEach(n => n.remove())
        svg.setAttribute('width', '1024'); svg.setAttribute('height', '1024')
        host.appendChild(svg)
        // Pinta cada figura de blanco (tinta) o negro (hueco) según qué tan oscura es
        const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return 1; const [r, g, b] = m.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
        svg.querySelectorAll('path, polygon, rect, circle, ellipse, polyline, line').forEach(el => {
            const f = getComputedStyle(el).fill
            const ink = f !== 'none' && lum(f) < 0.6
            el.setAttribute('fill', ink ? '#fff' : '#000')
            el.removeAttribute('class'); el.removeAttribute('style')
        })
        svg.querySelectorAll('style, defs').forEach(n => n.remove())
        return svg
    }
    const bbox = (el) => { const b = el.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height } }
    const pad = (b, p = 8) => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p })
    let n = 0
    const wrap = (inner, b, fill) => {
        const id = 'm' + (n++)
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" role="img" aria-label="VUNLEK"><title>VUNLEK</title>` +
            `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}">${inner}</mask></defs>` +
            `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${fill}" mask="url(#${id})"/></svg>`
    }
    const sym = load(symSrc), full = load(fullSrc)
    const symB = bbox(sym), fullB = bbox(full)
    // En el logo con nombre, el texto es el grupo que queda más abajo y no se encima con el dibujo
    const kids = [...full.children].filter(k => k.getBBox().width > 0)
    const text = kids.reduce((a, k) => (k.getBBox().y > a.getBBox().y ? k : a), kids[0])
    const tB = bbox(text)
    const drawing = kids.filter(k => k !== text)
    const dB = drawing.map(bbox).reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) }))
    const separable = tB.y >= dB.y + dB.h - 2
    const out = {}
    for (const [tone, fill] of [['color', color], ['blanco', '#FFFFFF']]) {
        out[`simbolo-${tone}`] = wrap(sym.innerHTML, pad(symB), fill)
        out[`vertical-${tone}`] = wrap(full.innerHTML, pad(fullB), fill)
        if (separable) {
            const k = (dB.h * 0.36) / tB.h, gap = dB.w * 0.1
            const W = dB.w + gap + tB.w * k, H = dB.h
            const inner = `<g transform="translate(${-dB.x},${-dB.y})">${drawing.map(d => d.outerHTML).join('')}</g>` +
                `<g transform="translate(${dB.w + gap},${(H - tB.h * k) / 2}) scale(${k}) translate(${-tB.x},${-tB.y})">${text.outerHTML}</g>`
            out[`horizontal-${tone}`] = wrap(inner, { x: -8, y: -8, w: W + 16, h: H + 16 }, fill)
        }
    }
    host.innerHTML = ''
    return { out, separable }
}, { symSrc: read(cfg.simbolo), fullSrc: read(cfg.logoConNombre), color: cfg.color })

if (!logos.separable) console.warn('  ! No se pudo separar el nombre del dibujo: se usa el logo vertical en lugar del horizontal.')
if (!logos.out['horizontal-color']) { logos.out['horizontal-color'] = logos.out['vertical-color']; logos.out['horizontal-blanco'] = logos.out['vertical-blanco'] }
console.log('Logos SVG:')
for (const [k, v] of Object.entries(logos.out)) {
    write(`public/brand/logo-${k}.svg`, v)
    write(`branding/generados/logo-${k}.svg`, v)
}

// favicon.svg: cuadro redondeado del color de fondo con el dibujo en blanco
{
    const s = logos.out['simbolo-blanco']
    const vb = s.match(/viewBox="([^"]+)"/)[1]
    const inner = s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>'))
    write('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${cfg.fondoIcono}"/><svg x="7" y="9" width="50" height="46" viewBox="${vb}">${inner}</svg></svg>`)
}

// ── 2. Iconos PNG ──
const uri = k => 'data:image/svg+xml;base64,' + Buffer.from(logos.out[k]).toString('base64')
async function render(file, w, h, html, transparent = false) {
    await page.setViewportSize({ width: w, height: h })
    await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${html}</body></html>`)
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0))
    const buf = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } })
    if (file) write(file, buf)
    return buf
}
const tile = (file, size, { bg = cfg.fondoIcono, sym = 'simbolo-blanco', scale = 0.68, shape = 'square', transparent = false } = {}) =>
    render(file, size, size, `<div style="width:${size}px;height:${size}px;background:${bg};${shape === 'round' ? `border-radius:${size * 0.22}px;` : shape === 'circle' ? 'border-radius:50%;' : ''}display:flex;align-items:center;justify-content:center"><img src="${uri(sym)}" style="width:${size * scale}px;margin-top:${size * 0.02}px"></div>`, transparent || shape !== 'square')
const splash = (file, w, h, frac = 0.42) =>
    render(file, w, h, `<div style="width:${w}px;height:${h}px;background:${cfg.fondoPantallaCarga};display:flex;align-items:center;justify-content:center"><img src="${uri('vertical-color')}" style="width:${Math.min(w, h) * frac}px"></div>`)

console.log('Web:')
await tile('public/pwa-192.png', 192, { shape: 'round' })
await tile('public/pwa-512.png', 512, { shape: 'round' })
await tile('public/pwa-maskable-512.png', 512, { scale: 0.56 })
await tile('public/apple-touch-icon.png', 180, { scale: 0.66 })

// ICO con imágenes PNG adentro (lo aceptan Windows y los navegadores)
function ico(pngs) {
    const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
    let offset = 6 + 16 * pngs.length
    const dir = pngs.map(({ size, buf }) => {
        const e = Buffer.alloc(16)
        e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1)
        e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12)
        offset += buf.length
        return e
    })
    return Buffer.concat([head, ...dir, ...pngs.map(p => p.buf)])
}
const icoSizes = async (sizes) => {
    const out = []
    for (const s of sizes) out.push({ size: s, buf: await tile(null, s, { shape: 'round', scale: s <= 32 ? 0.84 : 0.72 }) })
    return ico(out)
}
write('public/favicon.ico', await icoSizes([16, 32, 48]))

console.log('Android:')
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const RES = 'android/app/src/main/res'
for (const [d, k] of Object.entries(dens)) {
    await tile(`${RES}/mipmap-${d}/ic_launcher.png`, 48 * k, { shape: 'round', scale: 0.7 })
    await tile(`${RES}/mipmap-${d}/ic_launcher_round.png`, 48 * k, { shape: 'circle', scale: 0.62 })
    // Capa del icono adaptable: el dibujo cabe en la zona segura (66 de 108 dp)
    await tile(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, { bg: 'transparent', scale: 0.47, transparent: true })
}
const sp = { 'drawable': [480, 320], 'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
    'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920] }
for (const [d, [w, h]] of Object.entries(sp)) await splash(`${RES}/${d}/splash.png`, w, h)
{
    const f = path.join(ROOT, RES, 'values/ic_launcher_background.xml')
    if (fs.existsSync(f)) {
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/(<color name="ic_launcher_background">)[^<]*(<\/color>)/, `$1${cfg.fondoIcono.toUpperCase()}$2`))
        console.log('  ✓', RES + '/values/ic_launcher_background.xml')
    }
}

console.log('iOS:')
const IOS = 'ios/App/App/Assets.xcassets'
await tile(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, { scale: 0.66 })
const sp2 = await splash(null, 2732, 2732, 0.26)
for (const n of ['', '-1', '-2']) write(`${IOS}/Splash.imageset/splash-2732x2732${n}.png`, sp2)

console.log('Escritorio (Windows):')
await tile('desktop/build/icon.png', 512, { shape: 'round' })
write('desktop/build/icon.ico', await icoSizes([16, 24, 32, 48, 64, 128, 256]))

await browser.close()
console.log('\nListo. Siguientes pasos: npm run build · npx cap sync · (escritorio) cd desktop && npm run dist:win')
