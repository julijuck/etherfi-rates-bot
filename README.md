# etherfi-rates-bot

Bot que chequea diariamente las tasas de ether.fi Cash:

- **Earn rate**: tasa que paga el colateral (Liquid USD vault) — https://www.ether.fi/app/cash/earn
- **Borrow rate**: tasa de repago del préstamo contra ese colateral — https://www.ether.fi/app/cash/safe

Si el spread (`earn - borrow`) cae por debajo de un umbral (default `0.25`), envía un email de alerta. Si alguna de las dos páginas no se puede leer (por ejemplo porque ether.fi cambió el diseño), también avisa por email en vez de fallar en silencio.

Como ether.fi no expone una API pública estable para estas tasas, el bot usa [Playwright](https://playwright.dev/) para renderizar las páginas con un navegador headless y leer el porcentaje del texto visible, igual que lo haría una persona.

## Setup

1. Generar un [App Password de Gmail](https://myaccount.google.com/apppasswords) para la cuenta desde la que se van a enviar (y recibir) las alertas.
2. En este repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**, y cargar:
   - `GMAIL_USER`: la dirección de Gmail (ej. `juliancolombo2@gmail.com`)
   - `GMAIL_APP_PASSWORD`: el App Password generado en el paso 1
3. El workflow `.github/workflows/check-rates.yml` corre todos los días a las 13:00 UTC (~10am Argentina). También se puede disparar manualmente desde la pestaña **Actions → Check ether.fi Cash rates → Run workflow**.

## Correr localmente

```bash
npm install
npx playwright install --with-deps chromium
GMAIL_USER=... GMAIL_APP_PASSWORD=... npm run check
```

Para forzar el envío de un email de prueba, bajar el umbral:

```bash
SPREAD_THRESHOLD=10 GMAIL_USER=... GMAIL_APP_PASSWORD=... npm run check
```

## Configuración

| Variable            | Default | Descripción                                              |
|---------------------|---------|-----------------------------------------------------------|
| `SPREAD_THRESHOLD`  | `0.25`  | Spread mínimo (en puntos porcentuales) antes de alertar   |
| `GMAIL_USER`        | —       | Cuenta de Gmail usada para enviar y recibir las alertas   |
| `GMAIL_APP_PASSWORD`| —       | App Password de esa cuenta de Gmail                       |
