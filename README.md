# etherfi-rates-bot

Bot que chequea diariamente las tasas de ether.fi Cash:

- **Earn rate**: APY del vault "USD" en https://www.ether.fi/app/cash/earn (página pública, sin login)
- **Borrow rate**: tasa de interés del préstamo contra el colateral. La app (`/cash/safe`) solo la muestra logueado con wallet, así que en cambio se lee del [artículo público del Help Center](https://help.ether.fi/en/articles/326983-understanding-your-cash-card-borrow-mode-vs-direct-pay-mode) que la documenta como una tasa fija ("Annual interest rate: 4% APY")

Si el spread (`earn - borrow`) cae por debajo de un umbral (default `0.25`), envía un email de alerta. Si alguna de las dos páginas no se puede leer (por ejemplo porque ether.fi cambió el diseño o el texto del vault/artículo), también avisa por email en vez de fallar en silencio.

Cada chequeo exitoso se guarda en `data/history.json` (local, no se commitea). Los domingos, además del chequeo normal, se envía un email con el resumen de earn/borrow/spread de los últimos 7 días.

Como ether.fi no expone una API pública estable para estas tasas, el bot usa [Playwright](https://playwright.dev/) para renderizar las páginas con un navegador headless y leer el porcentaje del texto visible, igual que lo haría una persona. La extracción busca el número que aparece después de un texto ancla (`nearText`, ej. el nombre del vault o "annual interest rate") para evitar confundirse con otros porcentajes de la misma página.

Si en el futuro cambiás de vault (hoy es "USD"), actualizá `EARN_VAULT_PATTERN` en `src/checkRates.js`.

## ⚠️ Por qué corre localmente y no en GitHub Actions

El vault "USD" (tu posición real, ~5,10% hoy) solo aparece si la IP que visita la página no está geo-restringida. Los runners de GitHub Actions salen desde datacenters de EE.UU., y desde ahí ether.fi muestra en su lugar un vault distinto ("Reserve", con una tasa más baja) — el mismo mecanismo que bloquea otros vaults con el cartel "Not available in your region". Como no hay forma de arreglar esto ajustando el scraper, el chequeo real corre en tu propia Mac (con IP de Argentina), programado con `launchd`.

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
