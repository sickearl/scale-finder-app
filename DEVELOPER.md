# Note per lo sviluppatore

Documentazione tecnica del progetto. Il `README.md` è per chi vuole solo installare e usare l'app; questo file è per chi vuole modificarla.

## Stack e struttura

```
scale-finder-app/
├── index.html            entry point Vite
├── vite.config.js        dev server (porta 5173) + proxy /api → :4001
├── src/
│   ├── main.jsx           bootstrap React
│   └── App.jsx            intero frontend (un solo componente)
├── server/
│   ├── index.js           server Express (porta 4001)
│   └── defaultScales.js   dati di seed (scale predefinite)
├── data/
│   └── scales.json        creato/letto/scritto a runtime, non versionare
├── install.sh / install.ps1
└── run.sh / run.ps1
```

Frontend: React 18 + Vite, nessun router, nessuna libreria di stato esterna — tutto vive in `useState`/`useMemo` dentro `ScaleFinder` (`src/App.jsx`).

Backend: Express minimale con due sole route, unico scopo è leggere/scrivere `data/scales.json` su disco. Non c'è database, non c'è autenticazione: è pensato per uso locale mono-utente.

## Flusso dei dati

```
App.jsx (mount)
  → GET /api/scales
      → server legge data/scales.json
        → se il file non esiste: lo crea da DEFAULT_SCALES (defaultScales.js) e lo restituisce
        → se esiste: lo restituisce così com'è (anche se l'utente l'ha svuotato o modificato a mano)
  ← risposta: array di scale → setScales(...)

Utente aggiunge/importa/rimuove una scala
  → si costruisce l'array "next" (intero elenco aggiornato, non solo il delta)
  → POST /api/scales con "next" nel body
      → server sovrascrive data/scales.json per intero
  ← risposta: stesso array → setScales(next) (già fatto in ottimistico prima della risposta)
```

Punto importante: **il client manda sempre l'array completo**, non operazioni incrementali. `persistScales(next)` in `App.jsx` fa sia l'update ottimistico dello stato locale sia il POST. Se si aggiunge una nuova modalità di modifica, va sempre costruito l'array intero (scale esistenti ± quella toccata) prima di chiamare `persistScales`.

## Modello dati di una scala

```ts
{
  id: string;          // univoco, slug (es. "major", "custom-bebop-a1b2")
  label: string;       // nome mostrato nell'interfaccia
  intervals: number[]; // semitoni dalla tonica, 0–11, deve includere 0
  degrees?: string[];  // opzionale, stessa lunghezza di intervals (es. "1","b3","5")
                        // se assente, l'interfaccia mostra 1,2,3... in base alla posizione
  group: "occidentale" | "giapponese" | "personalizzata";
  builtin: boolean;    // solo informativo, non blocca la cancellazione nell'UI
}
```

Non ci sono altri vincoli lato server: `POST /api/scales` valida solo che il body sia un array (vedi `server/index.js`). La validazione "vera" (0 presente, niente duplicati, range 0–11) avviene lato client in `validateIntervals()` dentro `App.jsx`, prima di costruire la nuova scala nei form di import.

## API

### `GET /api/scales`
Restituisce l'array di tutte le scale nel file. Se il file non esiste, lo crea con `DEFAULT_SCALES` e lo restituisce (seed one-shot, non ripetuto se il file esiste già anche vuoto).

### `POST /api/scales`
Body: array di scale (stesso schema sopra). Sovrascrive interamente `data/scales.json`. Risponde con l'array salvato, o `400` se il body non è un array, o `500` se la scrittura su disco fallisce.

Non esistono endpoint per operazioni parziali (PATCH/DELETE su un id): è una scelta deliberata per tenere il server stupido e senza logica di merge.

## Componente frontend (`src/App.jsx`)

Costanti in cima al file:
- `NOTE_NAMES` — le 12 note cromatiche, sempre con diesis (niente enarmonie con i bemolle).
- `TUNING` — accordatura standard, Mi grave in alto / Mi cantino in basso nel disegno del manico. Per cambiare accordatura, modificare gli `idx` (indice 0–11 in `NOTE_NAMES`) di questo array.
- `FALLBACK_SCALES` — mini elenco (solo Maggiore/Minore) usato se il fetch a `/api/scales` fallisce due volte di fila (server non ancora su, o giù). Serve solo a non lasciare la UI vuota.
- `FRET_COUNTS` — le opzioni del selettore tasti (12/15/24).
- `MARKER_FRETS` / `DOUBLE_MARKER_FRETS` — puntini di riferimento sul manico.

Stato principale:
- `root` (0–11) e `scaleId` — cosa sta guardando l'utente in questo momento.
- `scales` — l'intero elenco caricato dal server; è la fonte di verità per tutto (compreso `scalesByGroup`, calcolato con `useMemo` per popolare le tre sezioni dell'interfaccia).
- `offlineFallback` — true se il server non ha risposto e si sta usando `FALLBACK_SCALES`.
- `storageError` — true se l'ultimo salvataggio (`POST`) è fallito; mostrato come avviso nel pannello di importazione.

Funzioni chiave:
- `degreeFor(noteIndex)` — dato un indice di nota assoluto (0–11), restituisce il grado (stringa) rispetto alla tonica corrente, usando `degrees` se presente o un numero progressivo altrimenti.
- `slugify(str)` — genera un id univoco per le scale create da form/JSON (`"custom-" + slug + "-" + suffisso random`).
- `validateIntervals(arr)` — unica validazione condivisa tra i due percorsi di import.
- `handleAddFromForm()` / `handleJsonImport()` — costruiscono una o più nuove scale e chiamano `persistScales`.
- `handleDeleteScale(id)` — filtra l'array e richiama `persistScales`; se la scala eliminata era quella attiva, seleziona la prima disponibile.

## Estendere il progetto

**Aggiungere scale di default**: modifica `server/defaultScales.js`. Ha effetto solo su installazioni nuove (file `data/scales.json` non ancora creato) — su installazioni esistenti l'utente deve aggiungerle a mano o cancellare il file per fare un reseed completo.

**Aggiungere un gruppo di scale** (es. "arabe", "indiane"): aggiungi il valore a `GROUP_LABELS` e `GROUP_ORDER` in `App.jsx`, poi usa quel valore come `group` nelle nuove scale (in `defaultScales.js` o via import JSON).

**Cambiare accordatura**: modifica l'array `TUNING`. Per rendere l'accordatura configurabile da UI (drop D, mezzo tono sotto, 7 corde, ecc.) servirebbe: un nuovo stato `tuning`, un selettore in UI, e un piccolo set di preset da cui scegliere — il calcolo delle note (`(string.idx + fret) % 12`) resta invariato.

**Persistenza diversa da file JSON** (es. SQLite, sync cloud): l'unico punto di contatto è `server/index.js`; il frontend parla solo con `/api/scales` via `fetch`, quindi si può sostituire il backend senza toccare `App.jsx`.

## Build

`npm run build` produce un bundle statico in `dist/` con Vite, ma **il salvataggio delle scale richiede comunque il server Express attivo** (serve per leggere/scrivere `data/scales.json`): non è un'app puramente statica. `npm run preview` serve la build ma non avvia il backend — va lanciato separatamente con `npm run server` se si vuole testare anche il salvataggio.

## Limiti noti

- Nessuna autenticazione/multi-utente: un solo file dati condiviso da chiunque acceda al server.
- Nessun lock sui file: due scritture concorrenti (es. due tab aperte che salvano nello stesso istante) possono sovrascriversi a vicenda (ultima vince).
- `degrees` per le scale giapponesi/personalizzate non segue una convenzione teorica rigorosa fuori dal contesto occidentale; sono etichette utili per l'interfaccia, non affermazioni musicologiche.
