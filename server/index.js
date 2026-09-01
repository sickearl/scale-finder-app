import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_SCALES } from "./defaultScales.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "data", "scales.json");

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
    res.status(500).json({ error: "Impossibile leggere data/scales.json. Controlla che il file contenga un array JSON valido." });
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

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`Server delle scale attivo su http://localhost:${PORT}`);
  console.log(`Dati salvati in: ${DATA_FILE}`);
});
