# Licencias locales de VUNLEK (sin internet)

Herramientas del **administrador**. No forman parte de la app ni se instalan en las escuelas.
Solo necesitan Node.js 18 o más reciente; no usan internet ni paquetes adicionales.

## Cómo funciona

- Tú tienes una **clave privada** (secreta). Con ella se *firma* cada licencia.
- La app lleva dentro la **clave pública**. Con ella solo se puede *comprobar* una firma, no crearla.
  Por eso nadie puede fabricar licencias a partir de la app (no hay "keygen" posible sin tu clave privada).
- Cada licencia va ligada a **una computadora** (su HWID) y a **una fecha de expiración**.
  Si alguien cambia un dato del archivo, la firma deja de coincidir y la app la rechaza.

Lo que esto **no** impide: que alguien modifique el programa para saltarse la comprobación.
Ningún sistema de licencias local lo impide; lo que sí garantiza es que no puedan emitirse licencias falsas.

## 1. Crear las claves (una sola vez)

```
npm run licencias:claves
```

Crea `clave-privada.pem` y `clave-publica.txt` en la carpeta `.vunlek-licencias` de tu usuario
y copia la clave pública a `src/lib/offlineLicenseKey.ts`. Sube ese archivo con git y publica la app.

**Haz una copia de la carpeta en una memoria USB.** Si pierdes la clave privada no podrás emitir
más licencias para las apps ya instaladas. Si alguien la copia, podrá emitirlas: no la envíes por
correo ni por mensaje y no la guardes dentro del repositorio.

## 2. Generar una licencia

El cliente te dicta el identificador de su equipo (empieza con `PC-`). Luego:

```
npm run licencias:nueva
```

y contesta las preguntas. O todo en una línea:

```
node tools/licencias/generar-licencia.mjs --escuela "Escuela Secundaria Técnica 37" --cct 07DST0037X --expira 2027-07-31 --hwid PC-ABCDE-FGHJK-MNPQR-STVWX
```

Obtienes un archivo `…vunlek-licencia.json` (en `.vunlek-licencias/emitidas`) y un código de una
línea que empieza con `VNLK1.`; cualquiera de los dos sirve para activar. En la misma carpeta,
`emitidas.csv` lleva la lista de lo que has entregado.

## 3. Revisar una licencia

```
node tools/licencias/verificar-licencia.mjs ruta/al/archivo.vunlek-licencia.json
```

## En la app

```ts
import { getHardwareId } from './lib/hardwareId'
import { checkStoredLicense, installLicense } from './lib/offlineLicense'

const { id } = await getHardwareId()            // lo que el cliente te dicta
const r = await installLicense(textoDelArchivoOCodigo, id)   // al activar
const estado = await checkStoredLicense(id)     // al abrir la app, sin internet
if (!estado.ok) mostrar(estado.message)         // estado.status dice por qué
```

Estados posibles: `VALIDA`, `SIN_LICENCIA`, `SIN_CLAVE`, `FORMATO`, `FIRMA`, `ALTERADA`,
`OTRO_EQUIPO`, `VENCIDA`, `RELOJ` (la fecha del equipo se atrasó).
