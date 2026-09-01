# install.ps1 - Installa le dipendenze del progetto (non installa Node.js).
# Esegui questo script una sola volta, prima del primo avvio.

Set-Location -Path $PSScriptRoot

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "npm non trovato." -ForegroundColor Red
    Write-Host "Installa Node.js (che include npm) da https://nodejs.org, poi riesegui questo script." -ForegroundColor Yellow
    Read-Host "Premi Invio per chiudere"
    exit 1
}

Write-Host "Installazione delle dipendenze in corso..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "L'installazione e' fallita. Controlla i messaggi sopra." -ForegroundColor Red
    Read-Host "Premi Invio per chiudere"
    exit 1
}

Write-Host "Installazione completata. Ora puoi usare run.ps1 per avviare l'app." -ForegroundColor Green
Read-Host "Premi Invio per chiudere"
