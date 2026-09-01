# Trova scala sul manico

App React per visualizzare le note di una scala sul manico della chitarra, con possibilità di importare scale personalizzate. I dati vengono salvati in un file locale (`data/custom-scales.json`), non nel browser: restano quindi anche se cambi browser o cancelli la cronologia.

## Requisiti

- **Node.js** (versione 18 o superiore). Scaricalo da https://nodejs.org (scegli la versione "LTS") e installalo con le opzioni predefinite. Gli script di questo progetto non installano Node.js: vanno usati dopo averlo installato.

## Installazione (una sola volta)

### Windows

1. Estrai questa cartella dove preferisci (es. `Documenti\scale-finder`).
2. Fai clic destro su `install.ps1` → **Esegui con PowerShell**.
   - Se compare un avviso sui criteri di esecuzione, apri PowerShell nella cartella ed esegui invece:
     ```
     powershell -ExecutionPolicy Bypass -File install.ps1
     ```

### macOS / Linux

1. Estrai la cartella.
2. Apri il Terminale nella cartella ed esegui:
   ```
   ./install.sh
   ```

## Avvio

### Windows

Fai doppio clic su `run.ps1` (o clic destro → Esegui con PowerShell). Si apre una finestra con server e app, e dopo pochi secondi il browser predefinito si apre automaticamente su `http://localhost:5173`.

### macOS / Linux

Nel Terminale, nella cartella del progetto:
```
./run.sh
```

In entrambi i casi, per chiudere l'app basta chiudere la finestra del terminale/PowerShell aperta, oppure premere `Ctrl+C` al suo interno.

## Dove sono salvate tutte le scale

Nel file `data/scales.json`, dentro questa stessa cartella — non solo quelle che importi tu, ma **tutte**: le scale occidentali (maggiore, minore, modi, ecc.), quelle giapponesi tradizionali (In, Yo, Hirajoshi, Kumoijoshi, Iwato) e quelle che aggiungi tu.

Il file viene creato automaticamente al primo avvio, precompilato con tutte le scale di base. Da quel momento è tuo: puoi aprirlo con un editor di testo, modificarlo, cancellare scale che non usi (anche quelle predefinite, con la × accanto al nome nell'app) o farne una copia di backup — basta che resti un array JSON valido. Se lo cancelli del tutto, al riavvio successivo verrà ricreato con l'elenco di base.

## Build per un uso "solo consultazione" (opzionale)

Se vuoi generare una versione ottimizzata dei soli file frontend (comunque richiede il server avviato per il salvataggio):

```
npm run build
npm run preview
```

