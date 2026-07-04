#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_LABEL="com.etherfi-rates-bot.check"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$REPO_DIR/logs"
NODE_PATH="$(command -v node || true)"

if [ -z "$NODE_PATH" ]; then
  echo "No encontré 'node' en el PATH. Instalá Node.js primero." >&2
  exit 1
fi

if [ ! -f "$REPO_DIR/.env" ]; then
  echo "No existe $REPO_DIR/.env todavía."
  echo "Copiando .env.example a .env -- completá GMAIL_APP_PASSWORD antes de seguir."
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  exit 1
fi

mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${REPO_DIR}/src/checkRates.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_DIR}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>10</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/check-rates.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/check-rates.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo "Instalado. Corre todos los días a las 10:00 (hora del sistema), y también ahora mismo como prueba."
echo "Log: $LOG_DIR/check-rates.log"
echo "Para desinstalar: scripts/uninstall-macos.sh"
