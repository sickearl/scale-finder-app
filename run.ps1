# run.ps1 - Avvia il server e l'app, poi apre il browser predefinito.

Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".\node_modules")) {
    Write-Host "Dipendenze non trovate. Esegui prima install.ps1." -ForegroundColor Red
    Read-Host "Premi Invio per chiudere"
    exit 1
}

Write-Host "Avvio del server e dell'app in una nuova finestra..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev"

Write-Host "Attendo che l'app sia pronta..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

$url = "http://localhost:5173"
Write-Host "Apro il browser su $url" -ForegroundColor Green
Start-Process $url

Write-Host "Fatto. Per chiudere l'app, chiudi l'altra finestra PowerShell (o premi Ctrl+C al suo interno)." -ForegroundColor Cyan
Read-Host "Premi Invio per chiudere questa finestra"
