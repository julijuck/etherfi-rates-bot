# etherfi-rates-bot

Bot que chequea diariamente las tasas de ether.fi Cash:

- **Earn rates**: APY de los tres vaults en USD de https://www.ether.fi/app/cash/earn (página pública, sin login): **USD**, **USD Bold** y **USD RWAs**
- **Borrow rate**: APY de la fila "USD" en https://www.ether.fi/app/cash/borrow (página pública, sin login). Antes era una tasa fija (4%) documentada en el Help Center, pero ether.fi la cambió a una tasa dinámica del pool, igual para todos los usuarios

Para cada vault se calcula el spread (`earn - borrow`). Si el de cualquiera de los tres cae por debajo de un umbral (default `0.25`), envía un email de alerta que dice cuál o cuáles quedaron por debajo. Si alguna de las dos páginas no se puede leer, reintenta hasta 3 veces (con 20s de espera entre intento e intento) antes de avisar por email, así un hipo de red transitorio no dispara una alerta falsa. Si después de los reintentos sigue sin poder leerla (por ejemplo porque ether.fi cambió el diseño), ahí sí avisa por email en vez de fallar en silencio.

Cada chequeo exitoso se guarda en `data/history.json` (local, no se commitea). Los domingos, además del chequeo normal, se envía un email con el resumen de los últimos 7 días: borrow y earn de cada vault por día, y el spread promedio, mínimo y máximo de cada vault. Los registros viejos (de antes de que el bot leyera los tres vaults) solo tienen el vault USD; en el resumen los otros dos aparecen como `-` esos días.

El bot usa [Playwright](https://playwright.dev/) para abrir las páginas con un navegador headless, igual que lo haría una persona:

- **Earn**: la página `/cash/earn` arma sus tarjetas con un JSON que pide a `/app/cash/api/markets/overview` (con el país y la región que detecta de tu IP). El bot abre la página y lee esa misma respuesta, buscando cada vault por su id interno (`liquid-usd`, `liquid-defi` para Bold, `liquid-rwa` para RWAs). También verifica que el nombre de la tarjeta siga siendo el esperado, que el vault esté `live` y que el APY sea un número razonable; si algo no cuadra, falla con un mensaje claro en vez de reportar una tasa equivocada. Se pasó a esto porque las tres tarjetas dicen "USD" y leerlas por texto era fácil de confundir. Es un endpoint interno de ether.fi (no una API pública documentada), así que puede cambiar.
- **Borrow**: lee el porcentaje visible que aparece después de un texto ancla (`BORROW_VAULT_PATTERN`) para no confundirse con otros porcentajes de la página.

Si en el futuro querés agregar o sacar vaults de earn, editá `EARN_VAULTS` en `src/rateSources.js`. El primero de la lista es el que se guarda también como `earnRate` en el historial. Para el borrow, `BORROW_VAULT_PATTERN` si cambia la moneda del préstamo.

## ⚠️ Por qué corre localmente y no en GitHub Actions

El vault "USD" (tu posición real, ~5,10% hoy) solo aparece si la IP que visita la página no está geo-restringida. Los runners de GitHub Actions salen desde datacenters de EE.UU., y desde ahí ether.fi muestra en su lugar un vault distinto ("Reserve", con una tasa más baja), por el mismo mecanismo que bloquea otros vaults con el cartel "Not available in your region". Como no hay forma de arreglar esto ajustando el scraper, el chequeo real corre en tu propia Mac (con IP de Argentina), programado con `launchd`.

El workflow de GitHub Actions (`.github/workflows/check-rates.yml`) se dejó solo para debugging manual (`workflow_dispatch`), no corre automáticamente.

## Setup en macOS

1. Cloná el repo y entrá a la carpeta:
   ```bash
   git clone <url-del-repo>
   cd etherfi-rates-bot
   ```
2. Instalá dependencias:
   ```bash
   npm install
   npx playwright install chromium
   ```
3. Generá un [App Password de Gmail](https://myaccount.google.com/apppasswords) para la cuenta desde la que se van a enviar (y recibir) las alertas.
4. Copiá `.env.example` a `.env` y completá tu App Password:
   ```bash
   cp .env.example .env
   ```
   Editá `.env` y completá `GMAIL_APP_PASSWORD` (nunca se commitea, ya está en `.gitignore`).
5. Instalá el chequeo diario automático:
   ```bash
   ./scripts/install-macos.sh
   ```
   Esto crea un `launchd` LaunchAgent que corre `npm run check` todos los días a las 10:00 (hora del sistema) y también una vez ahora mismo, como prueba. A diferencia de `cron`, si la Mac está apagada o dormida a esa hora, `launchd` corre el chequeo apenas la prendas/despiertes.
6. Revisá el log en `logs/check-rates.log` para confirmar que las tasas se leyeron bien.

Para desinstalarlo: `./scripts/uninstall-macos.sh`

## Correr manualmente / probar

```bash
npm run check
```

Tests (no necesitan red ni navegador; usan una respuesta real de ether.fi guardada en `test/`):

```bash
npm test
```

Para forzar el envío de un email de prueba, bajar el umbral en `.env` (o pasarlo inline):

```bash
SPREAD_THRESHOLD=10 npm run check
```

## Configuración

| Variable            | Default | Descripción                                              |
|---------------------|---------|-----------------------------------------------------------|
| `SPREAD_THRESHOLD`  | `0.25`  | Spread mínimo (en puntos porcentuales) antes de alertar   |
| `GMAIL_USER`        | —       | Cuenta de Gmail usada para enviar y recibir las alertas   |
| `GMAIL_APP_PASSWORD`| —       | App Password de esa cuenta de Gmail                       |

Estas variables se leen de `.env` localmente (vía [dotenv](https://www.npmjs.com/package/dotenv)), o de GitHub Secrets si se corre manualmente el workflow de Actions.
