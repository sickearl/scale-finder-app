#!/usr/bin/env bash
# run.sh - Avvia il server e l'app, poi apre il browser predefinito.

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Dipendenze non trovate. Esegui prima ./install.sh"
  exit 1
fi

echo "Avvio del server e dell'app..."
npm run dev &
DEV_PID=$!

# Ferma anche il server quando questo script viene interrotto (Ctrl+C)
trap "kill $DEV_PID 2>/dev/null" EXIT

echo "Attendo che l'app sia pronta..."
sleep 5

URL="http://localhost:5173"
echo "Apro il browser su $URL"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then
  open "$URL"
else
  echo "Apri manualmente il browser su $URL"
fi

wait $DEV_PID
