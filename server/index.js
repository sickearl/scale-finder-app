import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { DEFAULT_SCALES } from "./defaultScales.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_FILE = path.join(__dirname, "..", "data", "scales.json");
const DEFAULT_PORT = 4001;

/**
 * Avvia il server delle scale.
 * @param {object} [options]
 * @param {number} [options.port]      porta di ascolto (default 4001; 0 = prima libera)
 * @param {string} [options.dataFile]  percorso di data/scales.json (default: <progetto>/data)
 * @param {string} [options.staticDir] cartella di file statici da servire (es. dist/ della build Vite)
 * @returns {Promise<{app: import("express").Express, server: import("http").Server, port: number, dataFile: string}>}
 */
export async function startServer(options = {}) {
  const DATA_FILE = options.dataFile || DEFAULT_DATA_FILE;

  const app = express();
  app.use(cors());
  app.use(express.json());

  async function readScales() {
    try {
      const raw = await fs.readFile(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === "ENOENT") {
        // Prima esecuzione: popola il file con le scale predefinite (occidentali + giapponesi).
        await writeScales(DEFAULT_SCALES);
        return DEFAULT_SCALES;
      }
      // File presente ma non leggibile/valido — non lo sovrascriviamo per non perdere dati:
      // segnaliamo l'errore a chi ha chiamato l'endpoint.
      throw err;
    }
  }

  async function writeScales(scales) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(scales, null, 2), "utf-8");
  }

  app.get("/api/scales", async (req, res) => {
    try {
      const scales = await readScales();
      res.json(scales);
    } catch (err) {
      console.error("Errore nella lettura delle scale:", err);
      res.status(500).json({ error: `Impossibile leggere ${DATA_FILE}. Controlla che il file contenga un array JSON valido.` });
    }
  });

  app.post("/api/scales", async (req, res) => {
    const scales = req.body;
    if (!Array.isArray(scales)) {
      res.status(400).json({ error: "Il corpo della richiesta deve essere un array di scale." });
      return;
    }
    try {
      await writeScales(scales);
      res.json(scales);
    } catch (err) {
      console.error("Errore nel salvataggio delle scale:", err);
      res.status(500).json({ error: "Impossibile salvare le scale." });
    }
  });

  // Modalità desktop: serve i file statici della build Vite (dist/) oltre alle API.
  // Le richieste non-API restituiscono index.html (SPA single-page, nessun routing lato server).
  if (options.staticDir) {
    const staticDir = path.resolve(options.staticDir);
    const indexHtml = path.join(staticDir, "index.html");
    app.use(express.static(staticDir));
    app.get(/^(?!\/api(\/|$)).*/, (req, res) => {
      res.sendFile(indexHtml);
    });
  }

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(options.port ?? DEFAULT_PORT, () => resolve(s));
    s.on("error", reject);
  });

  const port = server.address().port;
  console.log(`Server delle scale attivo su http://localhost:${port}`);
  console.log(`Dati salvati in: ${DATA_FILE}`);
  return { app, server, port, dataFile: DATA_FILE };
}

// Entry CLI (`npm run server`): avvia con i valori predefiniti.
// Quando il modulo è importato da Electron (electron/main.js) non fa nulla.
const invokedDirectly = Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  startServer().catch((err) => {
    console.error("Avvio del server fallito:", err);
    process.exit(1);
  });
}
