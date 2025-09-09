# Chrome-Extension: On-Device PII-Masking & Upload-Tracking — TODO

Ziel: Chrome MV3 Extension, die auf gängigen LLM-Web-UIs Eingaben **vor dem Senden maskiert** (PII), den Send-Button/Enter kurz deaktiviert, das redigierte Ergebnis ins Eingabefeld zurückschreibt und dann das Senden erlaubt. Zusätzlich: Revisions-Log der Eingaben und Tracking von Datei-Uploads. **Alle Verarbeitung on-device** via `transformers.js` (+ Heuristiken).

> Arbeitsprinzip für Agent: Arbeite die Tasks von oben nach unten ab. Nach jedem **größeren** Teilabschnitt (gekennzeichnet mit `🎯 Meilenstein`) committen. Nach Abschluss eines Unterpunkts setze das Kästchen auf `[x]` und, wenn erforderlich, füge neue Unteraufgaben hinzu. Halte dich an die vorgeschlagenen Commit-Messages. Aktualisiere diese TODO-Datei fortlaufend. Schreibe ausführbare Tests nach jedem Commit, um deine Änderunge zu testen und falls nötig anzupassen / zu fixen. Verwende die größte Zeit für das eigentlich Entwickeln, nicht für Tests. Nutze 80/20 als Heuristik für Development/Features vs. Tests.

---

## 0. Projekt-Setup

- [ ] Repo initialisieren
  - [ ] `npm init -y`
  - [ ] `pnpm` oder `npm` festlegen (Standard: `pnpm`)
  - [ ] `.editorconfig`, `.nvmrc`, `.gitignore`
  - [ ] Lizenz + `README.md`
- [ ] Basis-Ordnerstruktur anlegen
  - [ ] `extension/manifest.json`
  - [ ] `extension/content/`
  - [ ] `extension/background/`
  - [ ] `extension/workers/`
  - [ ] `extension/ui/` (Optionen/Popup)
  - [ ] `extension/assets/`
  - [ ] `src/pii/` (Masking-Pipeline)
  - [ ] `src/logging/` (IndexedDB, Export)
  - [ ] `src/selectors/` (Site-Selector-Map)
  - [ ] `tests/`
- [ ] Tooling
  - [ ] TypeScript + tsconfig
  - [ ] Vite (Build für MV3), `rollup-plugin-chrome-extension` o.ä.
  - [ ] ESLint + Prettier (strikt)
  - [ ] Jest/Vitest für Unit-Tests
  - [ ] Web Test Runner / Playwright für E2E (optional)
- [ ] CI
  - [ ] GitHub Actions: Lint + Test + Build
  - [ ] Artefakt-Upload `dist/extension.zip`

**Commit**: `chore: scaffold repo, tooling, ci`

🎯 **Meilenstein**: Grundgerüst + CI grün

---

## 1. Manifest V3 & Berechtigungen

- [ ] `manifest.json` mit MV3
  - [ ] `permissions`: `storage`, `scripting`, `offscreen`
  - [ ] `host_permissions`: `https://chat.openai.*/*`, `https://chatgpt.com/*`, `https://claude.ai/*`, später erweiterbar
  - [ ] `content_scripts`: lädt auf erlaubten Hosts, `all_frames: true`
  - [ ] `background`: `service_worker`
  - [ ] `action` + `options_page`
- [ ] Grund-Build läuft, Extension lässt sich im Dev-Mode laden

**Commit**: `feat: add MV3 manifest and minimal build`

🎯 **Meilenstein**: MV3-Extension lädt im Browser

---

## 2. Site-Erkennung & DOM-Hooks

- [ ] Selector-Map erstellen (`src/selectors/sites.ts`)
  - [ ] Hostname-Matches + `inputSel`, `sendSel`
  - [ ] Fallbacks + Shadow DOM Handling
- [ ] Content Script (`extension/content/main.ts`)
  - [ ] `MutationObserver` zum (Re-)Wiring
  - [ ] Eingabefeld + Send-Button finden
  - [ ] Keydown-Hook (Enter ohne Shift abfangen; `isComposing` respektieren)
  - [ ] Click-Hook auf Send-Button
  - [ ] Deaktivierung von Send während Verarbeitung (inkl. `aria-disabled`)
  - [ ] Wiederaktivierung nach Masking
- [ ] Robustheit
  - [ ] Mehrere Eingabekomponenten (SPA-Reloads)
  - [ ] Zeitouts + Fehlerpfade

**Akzeptanztest**:
- Auf ChatGPT und Claude wird Enter abgefangen, Send-Button kurz deaktiviert, danach wieder aktiv.
- Keine Blockade bei Shift+Enter (Zeilenumbruch).

**Commit**: `feat(content): hook inputs and intercept submit/enter`

🎯 **Meilenstein**: Stabiler Interceptor

---

## 3. On-Device PII-Masking Pipeline

---

## 3.a Modellwahl & Erkennungsregeln (verbindlich)

- [ ] **NER-Modell**: `Xenova/bert-base-NER` (transformers.js kompatibel)
  - [ ] Download/Bundling oder Lazy-Load; Hash/Checksum verifizieren
  - [ ] Language/locale berücksichtigen (primär `en`, zusätzliche Regex für de-DE Felder)
- [ ] **Regex/Heuristik-Layer**
  - [ ] Präzise Patterns: E-Mail, Telefon (intl), **IBAN**, BIC, Kreditkarte (Luhn-Check), Postleitzahlen, URLs, UUID, Geburtsdatum-Formate
  - [ ] **Deny-List Exact Matchers** (ähnlich Microsoft Presidio Recognizers)
    - [ ] SSN/Sozialversicherungsnummern (Länder-spezifisch)
    - [ ] IBAN-Ländermuster, Steuer-IDs (z. B. DE, AT, CH), Ausweisnummern
    - [ ] Custom Unternehmens-IDs (konfigurierbar)
  - [ ] Confidence-Merging: Regex > Deny-List > NER; Konflikte deterministisch auflösen
- [ ] **Unit-Tests für Recognizers**
  - [ ] Goldens für jede PII-Klasse
  - [ ] Falsch-Positiv-Guardrails (z. B. Namen in generischem Kontext)

**Commit**: `feat(pii): use Xenova/bert-base-NER with regex + deny-list recognizers`


- [ ] Worker-Infrastruktur
  - [ ] WebWorker/Offscreen Document für Inferenz (nicht im UI-Thread)
  - [ ] Nachrichtenprotokoll: `{type: "PII_MASK", text, locale, options}`
  - [ ] WebGPU bevorzugen, WASM-Fallback
- [ ] `transformers.js` integrieren
  - [ ] Lade- und Warmup-Logik
  - [ ] Caching/Singleton-Prozess
- [ ] Modellwahl
  - [ ] Lightweight NER (z. B. RoBERTa/Distil) lokal gebündelt oder Lazy-Loaded
  - [ ] Quantisierte Gewichte
- [ ] Heuristiken/Regex ergänzen
  - [ ] E-Mail, Telefonnummer, IBAN, BIC, Kreditkarte, Adressen, Personennamen (lokalisiert), Postleitzahlen, URLs, UUIDs
- [ ] Maskierungsstrategie
  - [ ] Token/Span durch Platzhalter ersetzen, z. B. `[[EMAIL]]`, `[[PHONE]]` usw.
  - [ ] Erhalte Struktur (Länge optional normalisieren)
  - [ ] Vermeide Over-Masking von generischen Wörtern; Confidence-Thresholds
- [ ] API
  - [ ] `maskText(input, opts): { text, diffs, spans }`
  - [ ] Spans enthalten Typ, Offset, Länge, Original-Hash (optional)
- [ ] Performance
  - [ ] Ziel-Latenz < 150 ms bei 300–500 Zeichen auf WebGPU, < 600 ms auf WASM
  - [ ] Graceful Timeout + Fallback: Bei Timeout sende Original nur nach ausdrücklicher User-Einstellung

**Akzeptanztest**:
- Beispieltext mit E-Mail, Tel, IBAN, Adresse → korrekt maskiert.
- UI bleibt responsiv; keine Hänger.

**Commit**: `feat(pii): add on-device masking via transformers.js + heuristics`

🎯 **Meilenstein**: PII-Masking liefert verlässliche Masken

---

## 4. Content-Script <-> Worker Orchestrierung

- [ ] Flow
  1. Content Script fängt Enter/Klick ab.
  2. Deaktiviert Send.
  3. Sendet Text an Worker.
  4. Ersetzt Eingabe durch maskierten Text.
  5. Aktiviert Send, triggert Senden.
- [ ] Fehlerbehandlung
  - [ ] Bei Fehler: Snackbar/Toast im DOM (leichtgewichtig), Option „trotzdem senden“.
  - [ ] Logging eines Fehlereintrags (siehe §5).

**Akzeptanztest**:
- Maskierter Text erscheint im Eingabefeld; Nutzer sendet ihn ab.
- Bei Fehler zeigt die Extension eine deutliche, aber unaufdringliche Meldung.

**Commit**: `feat(flow): wire content script with worker and replace input with masked text`

🎯 **Meilenstein**: End-to-End Masking im Ziel-DOM

---

## 5. Revisions-Log (IndexedDB) & Upload-Tracking

- [ ] IndexedDB Store
  - [ ] `revisions`: `{id, ts, site, originalHash, masked, spans, version}`
  - [ ] `uploads`: `{id, ts, site, filename, size, mime}`
  - [ ] Migrations + Versionierung
- [ ] Logging-API
  - [ ] `logRevision({ original, masked, site, spans })` (Hash statt Klartext für Original)
  - [ ] `logUpload({ filename, size, mime, site })`
- [ ] Dateiupload-Hooks
  - [ ] `input[type=file]` `change` beobachten
  - [ ] Drag&Drop-Ziele (`drop`) erkennen
- [ ] Export
  - [ ] JSON/CSV-Export (optional `chrome.downloads` nutzen)
  - [ ] Lösch-/Purge-Funktion

**Akzeptanztest**:
- Revision entsteht pro Submit-Vorgang.
- Upload-Metadaten werden erfasst, ohne Dateiinhalt zu lesen.

**Commit**: `feat(log): add indexeddb revisions and upload tracking with export`

🎯 **Meilenstein**: Nachvollziehbares Protokoll

---

## 6. Optionen/Settings-UI

---

## 6.a PII-Typen gezielt aktivieren/deaktivieren

- [ ] Settings-UI: Schalter pro PII-Klasse (`EMAIL`, `PHONE`, `IBAN`, `CARD`, `NAME`, `ADDR`, `URL`, `UUID`, `TAX_ID`, `SSN`, …)
- [ ] Pipeline respektiert Schalter (Before-Merge filtern)
- [ ] Presets: „Strikt“, „Balanciert“, „Locker“
- [ ] Pro-Site Overrides (z. B. Namen erlauben auf internen Tools)

**Akzeptanztest**:
- Deaktivierter Typ wird weder erkannt noch maskiert.
- Umschalten wirkt ohne Reload.

**Commit**: `feat(settings): per-PII toggles and presets`


- [ ] Toggle: Schutz aktiv/inaktiv je Site
- [ ] Thresholds pro PII-Typ
- [ ] Timeout-Strategie: blockieren vs. „trotzdem senden“-Schalter
- [ ] Export/Import der Settings
- [ ] Log-Viewer (basic Tabelle, Paginierung)

**Akzeptanztest**:
- Settings wirken sofort (oder nach Reload) auf Content Script.
- Export/Import funktioniert.

**Commit**: `feat(ui): add options page with site toggles, thresholds, and log viewer`

🎯 **Meilenstein**: Nutzbare Konfiguration

---

## 7. Qualität, Tests, Datenschutz

- [ ] Unit-Tests
  - [ ] NER-Wrapper, Regex-Patterns, Masking-Merger
  - [ ] Selector-Finder, Event-Interceptor
- [ ] E2E-Smoke (manuell oder Playwright lokal)
- [ ] Performance-Benchmarks (CI optional)
- [ ] Security/Privacy
  - [ ] Keine Remote-Telemetrie
  - [ ] Least-Privilege Host-Permissions
  - [ ] DS-GVO-konforme Löschung/Export
  - [ ] Threat-Model (README-Abschnitt)

**Commit**: `test: add unit tests and privacy checks`

🎯 **Meilenstein**: Stabil + geprüft

---



---

## 8. Enterprise-Deployment & Policy-Lockdown

- [ ] **Managed Deployment** (Chrome Enterprise)
  - [ ] Unterstütze Installation via Unternehmensrichtlinien (force-install)
  - [ ] Definiere **Policy-Schema** (JSON) für zentrale Vorgaben
    - [ ] `locked`: boolean (verhindert lokale Änderungen)
    - [ ] `enabledSites`: string[]
    - [ ] `disabledSites`: string[]
    - [ ] `piiToggles`: Record<PIIType, boolean>
    - [ ] `thresholds`: Record<PIIType, number>
    - [ ] `timeoutMs`: number
  - [ ] Implementiere **`chrome.storage.managed`**-Layer
    - [ ] Read-only Merge: `managed` > `sync` > `local`
    - [ ] UI sperrt Felder bei `locked=true` (visuell & technisch)
- [ ] **Auditing/Export** für Compliance
  - [ ] Export-Rollen: User vs. Admin (Admin-Export enthält zusätzliche Metriken, nie Klartext-Originale)
  - [ ] Signierte Export-Dateien (optional)
- [ ] **Docs für IT-Admins**
  - [ ] JSON-Policy-Beispiele
  - [ ] Rollout-Anleitung (GPO/Google Admin Console)
- [ ] **E2E-Tests** mit `chrome.storage.managed` Mocks

**Akzeptanztest**:
- Bei `locked=true` lassen sich Settings nicht ändern.
- Extension übernimmt Policy-Defaults ohne lokale Interaktion.

**Commit**: `feat(enterprise): managed storage, policy schema, and lockable settings`


## 9. Release

- [ ] Versionierung SemVer
- [ ] `CHANGELOG.md`
- [ ] Build `dist/` + zip
- [ ] Installationsanleitung im README
- [ ] (Optional) Chrome Web Store Vorbereitungen

**Commit**: `chore(release): v0.1.0`

---

## Implementierungsnotizen (Kurz)

### A. Minimaler Content-Script Hook (Pseudocode)

```ts
function intercept(site) {
  const input = findInput(site);
  const send  = findSend(site);
  async function process() {
    const original = input.value;
    disable(send);
    try {
      const { text: masked, spans } = await maskPII(original);
      if (masked) input.value = masked;
      await logRevision({ original, masked, site, spans });
      triggerSend(send);
    } finally {
      enable(send);
    }
  }
  input.onkeydown = (e) => {
    if (!e.shiftKey && e.key === 'Enter' && !e.isComposing) {
      e.preventDefault(); process();
    }
  };
  send.onclick = (e) => { e.preventDefault(); process(); };
}
```

### B. Masking-API (Beispielsignaturen)

```ts
type MaskSpan = { type: 'EMAIL'|'PHONE'|'IBAN'|'CARD'|'NAME'|'ADDR'|'URL'|'UUID', start: number, end: number, conf: number };

async function maskPII(input: string, opts?: { locale?: string, minConf?: number }): 
  Promise<{ text: string, spans: MaskSpan[] }>;
```

### C. Datenhaltung (IndexedDB-Modelle)

```ts
// revisions: original wird nur gehasht gespeichert
{ id, ts, site, originalHash, masked: string, spans: MaskSpan[], version: string }
```

### D. Selektoren (erweiterbar)

```ts
[{ name:'ChatGPT', host:/chat\.openai|chatgpt\.com/, inputSel:'textarea', sendSel:'button[data-testid="send-button"]' },
 { name:'Claude', host:/claude\.ai/, inputSel:'textarea', sendSel:'button[type="submit"]' }]
```

---

## Konventionen für Commits

- `chore: scaffold repo, tooling, ci`
- `feat: add MV3 manifest and minimal build`
- `feat(content): hook inputs and intercept submit/enter`
- `feat(pii): add on-device masking via transformers.js + heuristics`
- `feat(flow): wire content script with worker and replace input with masked text`
- `feat(log): add indexeddb revisions and upload tracking with export`
- `feat(ui): add options page with site toggles, thresholds, and log viewer`
- `test: add unit tests and privacy checks`
- `chore(release): v0.1.0`

---


---

## Ergänzungen (neu)

- [ ] Settings sollen erlauben, **pro PII-Typ** (z. B. E-Mail, Telefon, IBAN, Kreditkarte, Name, Adresse, URL, UUID, SSN) das Maskieren zu aktivieren oder zu deaktivieren.
- [ ] Unternehmensmodus: Extension so gestalten, dass **IT-Administratoren** sie mandatory verteilen und Settings **sperren** können (Policy-Driven, z. B. Chrome Enterprise Policies). Nutzer dürfen Settings dann nicht ändern.
- [ ] Für die PII-Erkennung **Kombination** verwenden:
  - [ ] Modell: [`Xenova/bert-base-NER`](https://huggingface.co/Xenova/bert-base-NER) via `transformers.js`.
  - [ ] Regex-basierte Regeln für strukturierte Identifier (E-Mail, Telefonnummern, IBAN, Kreditkarten etc.).
  - [ ] **Deny-List** mit exakten Mustern, ähnlich wie Microsoft Presidio’s Recognizers, um bestimmte Identifier-Klassen robust zu blocken (z. B. SSNs, IBANs, Kreditkarten).

**Commit**: `feat(settings+pii): add per-type toggles, enterprise lock, bert-base-NER + regex + deny-list`


## Definition of Done (DoD)

- Eingaben auf Zielseiten werden vor dem Senden **maskiert**, nicht gelöscht.
- Senden bleibt blockiert, bis Masking abgeschlossen ist oder Timeout-Policy greift.
- Revisions-Log und Upload-Tracking funktionieren lokal, ohne Remote-Calls.
- Settings-UI erlaubt Steuerung pro Site und Export der Logs.
- Build, Tests und Lint laufen in CI.
