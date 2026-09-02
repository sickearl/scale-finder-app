import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sviluppo: se impostata, la finestra carica il dev server Vite (HMR) invece
// del server interno; il proxy /api → :4001 è già configurato in vite.config.js.
const DEV_URL = process.env.SF_DEV_URL || "";

// Smoke test: `npx electron . --smoke-test` apre la finestra, la chiude e
// termina con exit code 0. Usato per la verifica automatica.
const SMOKE_TEST = process.argv.includes("--smoke-test");

let mainWindow = null;

/**
 * Percorso di data/scales.json.
 * - Dev (npm run electron:dev / app): <progetto>/data, com'è oggi.
 * - Pacchettizzato: accanto all'exe che l'utente avvia (app portabile, i dati
 *   viaggiano con essa); se la cartella non è scrivibile (es. installazione
 *   in Program Files), fallback su %APPDATA%/scale-finder/data.
 *
 * Nota exe portabile: il launcher si estrae in una cartella temporanea e
 * process.execPath punta lì; electron-builder però espone PORTABLE_EXECUTABLE_DIR
 * con la directory reale del file .exe — è quella la posizione corretta per i dati.
 */
function resolveDataFile() {
  if (app.isPackaged) {
    const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
    const dataDir = path.join(exeDir, "data");
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.accessSync(dataDir, fs.constants.W_OK);
      return path.join(dataDir, "scales.json");
    } catch {
      return path.join(app.getPath("userData"), "data", "scales.json");
    }
  }
  return path.join(app.getAppPath(), "data", "scales.json");
}

/** Cartella dei file statici della build Vite, se presente. */
function resolveStaticDir() {
  const distDir = path.join(__dirname, "..", "dist");
  return fs.existsSync(path.join(distDir, "index.html")) ? distDir : null;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (SMOKE_TEST) {
    const failTimer = setTimeout(() => {
      console.error("[smoke-test] timeout: la finestra non ha terminato il caricamento");
      app.exit(1);
    }, 15000);
    mainWindow.webContents.once("did-finish-load", () => {
      clearTimeout(failTimer);
      console.log(`[smoke-test] finestra caricata: ${url}`);
      setTimeout(() => app.quit(), 800);
    });
  }
}

async function boot() {
  let url = DEV_URL;

  if (!url) {
    try {
      const { port } = await startServer({
        port: 0, // prima porta libera: nessun conflitto con altre istanze/servizi
        dataFile: resolveDataFile(),
        staticDir: resolveStaticDir(),
      });
      url = `http://localhost:${port}`;
    } catch (err) {
      console.error("Avvio del server interno fallito:", err);
      dialog.showErrorBox("Scale Finder", `Impossibile avviare il server interno:\n\n${err.message}`);
      app.quit();
      return;
    }
  }

  createWindow(url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Seconda istanza: quella esiste già, la riportiamo in primo piano e usciamo.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("window-all-closed", () => {
    app.quit();
  });
}
