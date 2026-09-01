import React, { useState, useMemo, useEffect } from "react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Low E to high e, top to bottom (as seen looking down at the neck while playing)
const TUNING = [          
  { name: "E", idx: 4 },
  { name: "B", idx: 11 },
  { name: "G", idx: 7 },
  { name: "D", idx: 2 },
  { name: "A", idx: 9 },
  { name: "E", idx: 4 },
];

// Usato solo se il server locale non risponde (es. non ancora avviato):
// un mini elenco per non lasciare l'app vuota. L'elenco completo (occidentali,
// giapponesi, personalizzate) vive in data/scales.json ed è servito dall'API.
const FALLBACK_SCALES = [
  { id: "major", label: "Maggiore (Ionica)", intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ["1", "2", "3", "4", "5", "6", "7"], group: "occidentale", builtin: true },
  { id: "minor", label: "Minore naturale (Eolia)", intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ["1", "2", "b3", "4", "5", "b6", "b7"], group: "occidentale", builtin: true },
];

const GROUP_LABELS = {
  occidentale: "Scale occidentali",
  giapponese: "Scale giapponesi",
  personalizzata: "Scale personalizzate",
};
const GROUP_ORDER = ["occidentale", "giapponese", "personalizzata"];

const FRET_COUNTS = [12, 15, 24];
const MARKER_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_MARKER_FRETS = new Set([12, 24]);

export default function ScaleFinder() {
  const [root, setRoot] = useState(4); // E
  const [scaleId, setScaleId] = useState("major");
  const [fretCount, setFretCount] = useState(15);
  const [labelMode, setLabelMode] = useState("note"); // "note" | "degree"

  const [scales, setScales] = useState(FALLBACK_SCALES);
  const [scalesLoaded, setScalesLoaded] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState("intervals"); // "intervals" | "json"
  const [nameField, setNameField] = useState("");
  const [intervalsField, setIntervalsField] = useState("");
  const [jsonField, setJsonField] = useState("");
  const [formError, setFormError] = useState("");

  // Load all scales once on mount (occidentali + giapponesi + personalizzate,
  // tutte servite dal file data/scales.json tramite il server locale).
  useEffect(() => {
    const fetchScales = async () => {
      const res = await fetch("/api/scales");
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    };

    (async () => {
      try {
        const data = await fetchScales();
        setScales(data);
      } catch (e) {
        // Il server potrebbe non essere ancora pronto: un solo tentativo in più.
        try {
          await new Promise((r) => setTimeout(r, 1200));
          const data = await fetchScales();
          setScales(data);
        } catch (e2) {
          setOfflineFallback(true);
        }
      } finally {
        setScalesLoaded(true);
      }
    })();
  }, []);

  const persistScales = async (next) => {
    setScales(next);
    try {
      const res = await fetch("/api/scales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
      setStorageError(false);
    } catch (e) {
      setStorageError(true);
    }
  };

  const scale = scales.find((s) => s.id === scaleId) || scales[0] || FALLBACK_SCALES[0];

  const scaleSet = useMemo(() => {
    const s = new Set();
    scale.intervals.forEach((iv) => s.add((root + iv) % 12));
    return s;
  }, [root, scale]);

  const degreeFor = (noteIdx) => {
    const diff = (noteIdx - root + 12) % 12;
    const pos = scale.intervals.indexOf(diff);
    if (pos < 0) return null;
    return scale.degrees ? scale.degrees[pos] : String(pos + 1);
  };

  const frets = Array.from({ length: fretCount + 1 }, (_, i) => i);

  const slugify = (str) =>
    "custom-" +
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6);

  const validateIntervals = (arr) => {
    if (arr.some((n) => Number.isNaN(n) || n < 0 || n > 11)) {
      return "Ogni intervallo deve essere un numero tra 0 e 11.";
    }
    if (!arr.includes(0)) {
      return "La scala deve includere 0 (la tonica).";
    }
    if (new Set(arr).size !== arr.length) {
      return "Non inserire lo stesso intervallo due volte.";
    }
    return null;
  };

  const handleAddFromForm = () => {
    setFormError("");
    const name = nameField.trim();
    if (!name) {
      setFormError("Dai un nome alla scala.");
      return;
    }
    const parts = intervalsField
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number);
    if (parts.length === 0) {
      setFormError("Inserisci almeno un intervallo, es: 0,2,4,5,7,9,11");
      return;
    }
    const err = validateIntervals(parts);
    if (err) {
      setFormError(err);
      return;
    }
    const sorted = [...parts].sort((a, b) => a - b);
    const newScale = { id: slugify(name), label: name, intervals: sorted, group: "personalizzata", builtin: false };
    const next = [...scales, newScale];
    persistScales(next);
    setScaleId(newScale.id);
    setNameField("");
    setIntervalsField("");
  };

  const handleJsonImport = () => {
    setFormError("");
    let parsed;
    try {
      parsed = JSON.parse(jsonField);
    } catch (e) {
      setFormError("JSON non valido: controlla la sintassi.");
      return;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const validated = [];
    for (const item of list) {
      if (!item || typeof item.name !== "string" || !Array.isArray(item.intervals)) {
        setFormError('Ogni scala deve avere "name" (testo) e "intervals" (elenco di numeri).');
        return;
      }
      const nums = item.intervals.map(Number);
      const err = validateIntervals(nums);
      if (err) {
        setFormError(`Scala "${item.name}": ${err}`);
        return;
      }
      validated.push({
        id: slugify(item.name),
        label: item.name,
        intervals: [...nums].sort((a, b) => a - b),
        group: "personalizzata",
        builtin: false,
      });
    }
    const next = [...scales, ...validated];
    persistScales(next);
    if (validated.length > 0) setScaleId(validated[validated.length - 1].id);
    setJsonField("");
  };

  const handleDeleteScale = (id) => {
    const next = scales.filter((s) => s.id !== id);
    persistScales(next);
    if (scaleId === id) setScaleId(next[0]?.id ?? "");
  };

  const scalesByGroup = useMemo(() => {
    const map = {};
    scales.forEach((s) => {
      const g = s.group || "personalizzata";
      if (!map[g]) map[g] = [];
      map[g].push(s);
    });
    return map;
  }, [scales]);

  return (
    <div
      style={{
        minHeight: "100%",
        background: "linear-gradient(180deg, #1a130e 0%, #14100c 100%)",
        color: "#ece2d0",
        fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
        padding: "28px 20px 40px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.2px",
              color: "#f1e7d4",
            }}
          >
            Trova scala sul manico
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 14,
              color: "#a5947c",
              maxWidth: 560,
              lineHeight: 1.5,
            }}
          >
            Scegli una tonica e una scala: le note vengono evidenziate su tutto il manico, tonica compresa.
          </p>
        </div>

        {/* Root note picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabelStyle}>Tonica</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {NOTE_NAMES.map((n, i) => (
              <button
                key={n}
                onClick={() => setRoot(i)}
                style={{
                  ...pillBase,
                  background: i === root ? "#c9962f" : "#2a2019",
                  color: i === root ? "#1a130e" : "#d8cab3",
                  fontWeight: i === root ? 700 : 500,
                  border: i === root ? "1px solid #c9962f" : "1px solid #3a2d21",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Scale picker */}
        <div style={{ marginBottom: 10 }}>
          {offlineFallback && (
            <div
              style={{
                marginBottom: 12,
                fontFamily: "system-ui, sans-serif",
                fontSize: 12.5,
                color: "#c7b89c",
                background: "#2a2019",
                border: "1px solid #4a3423",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              Il server locale non risponde: elenco scale ridotto in questo momento. Verifica che sia in esecuzione (`run.sh` / `run.ps1`) e ricarica la pagina.
            </div>
          )}

          {GROUP_ORDER.filter((g) => scalesByGroup[g]?.length).map((g) => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div style={sectionLabelStyle}>{GROUP_LABELS[g]}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {scalesByGroup[g].map((s) => {
                  const active = s.id === scaleId;
                  const isPersonal = g === "personalizzata";
                  return (
                    <div
                      key={s.id}
                      style={{
                        ...pillBase,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 8px 7px 13px",
                        background: active ? (isPersonal ? "#3f5a3d" : "#5a3d24") : (isPersonal ? "#20261e" : "#2a2019"),
                        color: active ? (isPersonal ? "#eef1e8" : "#f1e7d4") : (isPersonal ? "#b8ccb2" : "#b8ab94"),
                        border: active ? (isPersonal ? "1px solid #7fae70" : "1px solid #c9962f") : (isPersonal ? "1px solid #33402f" : "1px solid #3a2d21"),
                        cursor: "default",
                      }}
                    >
                      <span style={{ cursor: "pointer" }} onClick={() => setScaleId(s.id)}>
                        {s.label}
                      </span>
                      <span
                        onClick={() => handleDeleteScale(s.id)}
                        title="Rimuovi scala"
                        style={{
                          cursor: "pointer",
                          opacity: 0.6,
                          fontSize: 13,
                          lineHeight: 1,
                          padding: "2px 4px",
                        }}
                      >
                        ×
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={() => setImportOpen((v) => !v)}
            style={{
              ...pillBase,
              marginTop: 4,
              padding: "9px 16px",
              fontWeight: 700,
              background: importOpen ? "#c9962f" : "#3a2c19",
              color: importOpen ? "#1a130e" : "#e8c887",
              border: "1px solid #c9962f",
            }}
          >
            {importOpen ? "Chiudi importazione" : "+ Importa scala personalizzata"}
          </button>

          {importOpen && (
            <div
              style={{
                marginTop: 10,
                background: "#20180f",
                border: "1px solid #3a2d21",
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => { setImportMode("intervals"); setFormError(""); }}
                  style={{
                    ...pillBase,
                    padding: "5px 11px",
                    fontSize: 12,
                    background: importMode === "intervals" ? "#c9962f" : "#2a2019",
                    color: importMode === "intervals" ? "#1a130e" : "#b8ab94",
                    border: "1px solid #3a2d21",
                  }}
                >
                  Intervalli
                </button>
                <button
                  onClick={() => { setImportMode("json"); setFormError(""); }}
                  style={{
                    ...pillBase,
                    padding: "5px 11px",
                    fontSize: 12,
                    background: importMode === "json" ? "#c9962f" : "#2a2019",
                    color: importMode === "json" ? "#1a130e" : "#b8ab94",
                    border: "1px solid #3a2d21",
                  }}
                >
                  JSON (più scale insieme)
                </button>
              </div>

              {importMode === "intervals" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={fieldLabelStyle}>
                    Nome scala
                    <input
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      placeholder="es: Bebop dominante"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabelStyle}>
                    Intervalli in semitoni dalla tonica, separati da virgola (0 = tonica, obbligatorio)
                    <input
                      value={intervalsField}
                      onChange={(e) => setIntervalsField(e.target.value)}
                      placeholder="es: 0,2,4,5,7,9,10,11"
                      style={inputStyle}
                    />
                  </label>
                  <button onClick={handleAddFromForm} style={{ ...pillBase, alignSelf: "flex-start", background: "#c9962f", color: "#1a130e", border: "1px solid #c9962f" }}>
                    Aggiungi scala
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={fieldLabelStyle}>
                    Incolla un array JSON con "name" e "intervals" per ogni scala
                    <textarea
                      value={jsonField}
                      onChange={(e) => setJsonField(e.target.value)}
                      placeholder={'[\n  { "name": "Bebop dominante", "intervals": [0,2,4,5,7,9,10,11] },\n  { "name": "Whole tone", "intervals": [0,2,4,6,8,10] }\n]'}
                      rows={6}
                      style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }}
                    />
                  </label>
                  <button onClick={handleJsonImport} style={{ ...pillBase, alignSelf: "flex-start", background: "#c9962f", color: "#1a130e", border: "1px solid #c9962f" }}>
                    Importa
                  </button>
                </div>
              )}

              {formError && (
                <div style={{ marginTop: 8, color: "#e0968a", fontSize: 12.5, fontFamily: "system-ui, sans-serif" }}>
                  {formError}
                </div>
              )}
              {storageError && (
                <div style={{ marginTop: 8, color: "#c7b89c", fontSize: 12, fontFamily: "system-ui, sans-serif", opacity: 0.8 }}>
                  Le scale funzionano in questa sessione, ma il salvataggio su file non è riuscito. Controlla che il server locale (npm run server) sia avviato.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row: fret count + label mode */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 22 }}>
          <div>
            <div style={sectionLabelStyle}>Tasti</div>
            <div style={{ display: "flex", gap: 8 }}>
              {FRET_COUNTS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFretCount(f)}
                  style={{
                    ...pillBase,
                    minWidth: 40,
                    background: f === fretCount ? "#c9962f" : "#2a2019",
                    color: f === fretCount ? "#1a130e" : "#d8cab3",
                    border: f === fretCount ? "1px solid #c9962f" : "1px solid #3a2d21",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={sectionLabelStyle}>Etichette</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "note", label: "Note" },
                { id: "degree", label: "Gradi" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLabelMode(m.id)}
                  style={{
                    ...pillBase,
                    background: m.id === labelMode ? "#c9962f" : "#2a2019",
                    color: m.id === labelMode ? "#1a130e" : "#d8cab3",
                    border: m.id === labelMode ? "1px solid #c9962f" : "1px solid #3a2d21",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fretboard */}
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div
            style={{
              minWidth: fretCount * 52 + 90,
              background: "linear-gradient(180deg, #7a5030 0%, #6b4226 55%, #5c3820 100%)",
              borderRadius: 6,
              padding: "18px 14px 10px",
              boxShadow: "inset 0 2px 10px rgba(0,0,0,0.45), 0 6px 18px rgba(0,0,0,0.35)",
              border: "1px solid #3a2717",
            }}
          >
            {/* Fret numbers */}
            <div style={{ display: "flex", marginLeft: 46 }}>
              {frets.map((f) => (
                <div
                  key={f}
                  style={{
                    width: f === 0 ? 34 : 52,
                    flexShrink: 0,
                    textAlign: "center",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 11,
                    color: "#d9c5a3",
                    opacity: 0.75,
                  }}
                >
                  {f}
                </div>
              ))}
            </div>

            {/* Strings */}
            {TUNING.map((string, sIdx) => (
              <div key={sIdx} style={{ display: "flex", alignItems: "center", position: "relative" }}>
                <div
                  style={{
                    width: 46,
                    flexShrink: 0,
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 13,
                    color: "#e9dcc2",
                    fontWeight: 600,
                  }}
                >
                  {string.name}
                </div>
                {frets.map((f) => {
                  const noteIdx = (string.idx + f) % 12;
                  const inScale = scaleSet.has(noteIdx);
                  const isRoot = noteIdx === root;
                  const deg = degreeFor(noteIdx);
                  return (
                    <div
                      key={f}
                      style={{
                        width: f === 0 ? 34 : 52,
                        height: 40,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRight: f === 0 ? "3px solid #cfc7b8" : "2px solid #9c8b6f",
                        position: "relative",
                      }}
                    >
                      {/* string line */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "50%",
                          height: 6 - sIdx * 0.6 > 1.5 ? 6 - sIdx * 0.6 : 1.5,
                          background: "#d8cdb5",
                          opacity: 0.55,
                          transform: "translateY(-50%)",
                        }}
                      />
                      {inScale && (
                        <div
                          style={{
                            width: 27,
                            height: 27,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11.5,
                            fontWeight: 700,
                            fontFamily: "system-ui, sans-serif",
                            zIndex: 2,
                            background: isRoot ? "#c9962f" : "#efe6d4",
                            color: isRoot ? "#1a130e" : "#3a2c1c",
                            border: isRoot ? "2px solid #f1e7d4" : "1px solid #b9a985",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                          }}
                        >
                          {labelMode === "note" ? NOTE_NAMES[noteIdx] : deg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Fret markers */}
            <div style={{ display: "flex", marginLeft: 46, marginTop: 4 }}>
              {frets.map((f) => (
                <div
                  key={f}
                  style={{
                    width: f === 0 ? 34 : 52,
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  {MARKER_FRETS.has(f) && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d9c5a3", opacity: 0.6 }} />
                  )}
                  {DOUBLE_MARKER_FRETS.has(f) && (
                    <>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d9c5a3", opacity: 0.6 }} />
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d9c5a3", opacity: 0.6 }} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend / note list */}
        <div
          style={{
            marginTop: 22,
            fontFamily: "system-ui, sans-serif",
            fontSize: 13.5,
            color: "#c7b89c",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 18px",
            alignItems: "center",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#c9962f", display: "inline-block" }} />
            Tonica ({NOTE_NAMES[root]})
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#efe6d4", border: "1px solid #b9a985", display: "inline-block" }} />
            Note della scala
          </span>
          <span style={{ opacity: 0.85 }}>
            {NOTE_NAMES[root]} {scale.label}: {scale.intervals.map((iv) => NOTE_NAMES[(root + iv) % 12]).join(" – ")}
          </span>
        </div>
      </div>
    </div>
  );
}

const sectionLabelStyle = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  color: "#9a8a70",
  marginBottom: 7,
  fontWeight: 600,
};

const pillBase = {
  padding: "7px 13px",
  borderRadius: 5,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
  transition: "background 0.15s ease",
};

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontFamily: "system-ui, sans-serif",
  fontSize: 12.5,
  color: "#b8ab94",
};

const inputStyle = {
  background: "#150f0a",
  border: "1px solid #3a2d21",
  borderRadius: 4,
  padding: "8px 10px",
  color: "#ece2d0",
  fontSize: 13.5,
  fontFamily: "system-ui, sans-serif",
  outline: "none",
};
