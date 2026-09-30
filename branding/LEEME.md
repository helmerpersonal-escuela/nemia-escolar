# Marca VUNLEK: cómo cambiar el logo

Todos los logos e iconos de la app (web, celular Android/iPhone y Windows) se generan
automáticamente a partir de **dos archivos** de esta carpeta:

| Archivo | Qué es |
|---|---|
| `Vunlek.svg` | Solo el dibujo (sin texto). Es el icono de la app. |
| `Vunlek_inicio.svg` | El dibujo arriba y el nombre **VUNLEK** abajo. |
| `marca.json` | Colores: `color` (logo), `fondoIcono` (fondo del icono del celular) y `fondoPantallaCarga`. |

## Para cambiar el diseño

1. Exporta el nuevo diseño desde Illustrator como **SVG** (cuadrado, 1024 × 1024 recomendado)
   y reemplaza `Vunlek.svg` y/o `Vunlek_inicio.svg` con el **mismo nombre**.
   - Las partes **oscuras** del dibujo se vuelven el logo; las partes **claras** (blanco, gris claro)
     se vuelven huecos transparentes.
   - En `Vunlek_inicio.svg` el nombre debe ir **abajo** del dibujo, en su propio grupo, sin encimarse.
   - Convierte los textos a contornos (Texto → Crear contornos) antes de exportar.
2. Si cambias el color, edítalo en `marca.json` (formato `#RRGGBB`).
3. En la carpeta del proyecto corre:

```
npx playwright install chromium
```

(solo la primera vez) y luego:

```
npm run marca
```

4. Revisa los archivos nuevos en `branding/generados/` y `public/brand/`.
5. Para que llegue a todos lados:
   - Web: sube los cambios con git (se publica sola).
   - Android / iPhone: `npm run build` y `npx cap sync`, y vuelve a generar el APK / la app.
   - Windows: `cd desktop` y `npm run dist:win`.

## Qué genera

- `public/brand/logo-{simbolo|horizontal|vertical}-{color|blanco}.svg` (los usa la app con `<BrandLogo />`).
- `public/favicon.svg`, `favicon.ico`, `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`.
- Android: iconos (`mipmap-*`), icono adaptable, color de fondo y pantallas de carga (`drawable-*`).
- iOS: `AppIcon-512@2x.png` (1024 sin transparencia) y pantalla de carga 2732 × 2732.
- Windows: `desktop/build/icon.png` e `icon.ico`.
