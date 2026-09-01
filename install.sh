#!/usr/bin/env bash
# install.sh - Installa le dipendenze del progetto (non installa Node.js).
# Esegui questo script una sola volta, prima del primo avvio.

set -e
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm non trovato."
  echo "Installa Node.js (che include npm) da https://nodejs.org, poi riesegui questo script."
  exit 1
fi

echo "Installazione delle dipendenze in corso..."
npm install

echo "Installazione completata. Ora puoi usare ./run.sh per avviare l'app."
