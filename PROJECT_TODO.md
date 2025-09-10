# Chrome-Extension: On-Device PII-Masking & Upload-Tracking — TODO

Ziel: Chrome MV3 Extension, die auf gängigen LLM-Web-UIs Eingaben **vor dem Senden maskiert** (PII), den Send-Button/Enter kurz deaktiviert, das redigierte Ergebnis ins Eingabefeld zurückschreibt und dann das Senden erlaubt. Zusätzlich: Revisions-Log der Eingaben und Tracking von Datei-Uploads. **Alle Verarbeitung on-device** via `transformers.js` (+ Heuristiken).

> Arbeitsprinzip für Agent: Arbeite die Tasks von oben nach unten ab. Nach jedem **größeren** Teilabschnitt (gekennzeichnet mit `🎯 Meilenstein`) committen. Nach Abschluss eines Unterpunkts setze das Kästchen auf `[x]` und, wenn erforderlich, füge neue Unteraufgaben hinzu. Halte dich an die vorgeschlagenen Commit-Messages. Aktualisiere diese TODO-Datei fortlaufend. Schreibe ausführbare Tests nach jedem Commit, um deine Änderunge zu testen und falls nötig anzupassen / zu fixen. Verwende die größte Zeit für das eigentlich Entwickeln, nicht für Tests. Nutze 80/20 als Heuristik für Development/Features vs. Tests.

---

## 0. Projekt-Setup

- [x] Repo initialisieren
  - [x] `npm init -y`
  - [x] `pnpm` oder `npm` festlegen (Standard: `npm`)
  - [x] `.editorconfig`, `.nvmrc`, `.gitignore`
  - [x] Lizenz + `README.md`
- [x] Basis-Ordnerstruktur anlegen
  - [x] `extension/manifest.json`
  - [x] `extension/content/`
  - [x] `extension/background/`
  - [x] `extension/workers/`
  - [x] `extension/ui/` (Optionen/Popup)
  - [x] `extension/assets/`
  - [x] `src/pii/` (Masking-Pipeline)
  - [x] `src/logging/` (IndexedDB, Export)
  - [x] `src/selectors/` (Site-Selector-Map)
  - [x] `tests/`
- [x] Tooling
  - [x] TypeScript + tsconfig
  - [x] Vite (Build für MV3) mit `@crxjs/vite-plugin`
  - [x] ESLint + Prettier (strikt)
  - [x] Vitest für Unit-Tests
  - [ ] Web Test Runner / Playwright für E2E (optional)
- [x] CI
  - [x] GitHub Actions: Lint + Test + Build
  - [x] Artefakt-Upload `dist/extension.zip`

**Commit**: `chore: scaffold repo, tooling, ci`

🎯 **Meilenstein**: Grundgerüst + CI grün

---

## 1. Manifest V3 & Berechtigungen

- [x] `manifest.json` mit MV3
  - [x] `permissions`: `storage`, `scripting`, `offscreen`
  - [x] `host_permissions`: `https://chat.openai.com/*`, `https://chatgpt.com/*`, `https://claude.ai/*`, später erweiterbar
  - [x] `content_scripts`: lädt auf erlaubten Hosts, `all_frames: true`
  - [x] `background`: `service_worker`
  - [x] `action` + `options_page`
- [x] Grund-Build läuft, Extension lässt sich im Dev-Mode laden

**Commit**: `feat: add MV3 manifest and minimal build`

🎯 **Meilenstein**: MV3-Extension lädt im Browser

---

## 2. Site-Erkennung & DOM-Hooks

- [x] Selector-Map erstellen (`src/selectors/sites.ts`)
  - [x] Hostname-Matches + `inputSel`, `sendSel`
  - [x] Fallbacks + Shadow DOM Handling
- [x] Content Script (`extension/content/main.ts`)
  - [x] `MutationObserver` zum (Re-)Wiring
  - [x] Eingabefeld + Send-Button finden
  - [x] Keydown-Hook (Enter ohne Shift abfangen; `isComposing` respektieren)
  - [x] Click-Hook auf Send-Button
  - [x] Deaktivierung von Send während Verarbeitung (inkl. `aria-disabled`)
  - [x] Wiederaktivierung nach Masking
- [x] Robustheit
  - [x] Mehrere Eingabekomponenten (SPA-Reloads)
  - [x] Zeitouts + Fehlerpfade

**Akzeptanztest**:
- Auf ChatGPT und Claude wird Enter abgefangen, Send-Button kurz deaktiviert, danach wieder aktiv.
- Keine Blockade bei Shift+Enter (Zeilenumbruch).

**Commit**: `feat(content): hook inputs and intercept submit/enter`

🎯 **Meilenstein**: Stabiler Interceptor

---

## 3. On-Device PII-Masking Pipeline ✅

---

## 3.a Modellwahl & Erkennungsregeln (verbindlich)

- [x] **NER-Modell**: `Xenova/bert-base-NER` (transformers.js kompatibel)
  - [x] Download/Bundling oder Lazy-Load; Hash/Checksum verifizieren
  - [x] Language/locale berücksichtigen (primär `en`, zusätzliche Regex für de-DE Felder)
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


- [x] Worker-Infrastruktur
  - [ ] WebWorker/Offscreen Document für Inferenz (nicht im UI-Thread)
  - [ ] Nachrichtenprotokoll: `{type: "PII_MASK", text, locale, options}`
  - [ ] WebGPU bevorzugen, WASM-Fallback
- [x] `transformers.js` integrieren
  - [ ] Lade- und Warmup-Logik
  - [ ] Caching/Singleton-Prozess
- [x] Modellwahl
  - [ ] Lightweight NER (z. B. RoBERTa/Distil) lokal gebündelt oder Lazy-Loaded
  - [ ] Quantisierte Gewichte
- [x] Heuristiken/Regex ergänzen
  - [ ] E-Mail, Telefonnummer, IBAN, BIC, Kreditkarte, Adressen, Personennamen (lokalisiert), Postleitzahlen, URLs, UUIDs
- [x] Maskierungsstrategie
  - [ ] Token/Span durch Platzhalter ersetzen, z. B. `[[EMAIL]]`, `[[PHONE]]` usw.
  - [ ] Erhalte Struktur (Länge optional normalisieren)
  - [ ] Vermeide Over-Masking von generischen Wörtern; Confidence-Thresholds
- [x] API
  - [ ] `maskText(input, opts): { text, diffs, spans }`
  - [ ] Spans enthalten Typ, Offset, Länge, Original-Hash (optional)
- [x] Performance
  - [ ] Ziel-Latenz < 150 ms bei 300–500 Zeichen auf WebGPU, < 600 ms auf WASM
  - [ ] Graceful Timeout + Fallback: Bei Timeout sende Original nur nach ausdrücklicher User-Einstellung

**Akzeptanztest**: ✅
- Beispieltext mit E-Mail, Tel, IBAN, Adresse → korrekt maskiert.
- UI bleibt responsiv; keine Hänger.

**Commit**: `feat(pii): add on-device masking via transformers.js + heuristics`

🎯 **Meilenstein**: PII-Masking liefert verlässliche Masken ✅

---

## 4. Content-Script <-> Worker Orchestrierung ✅

- [x] Flow
  1. Content Script fängt Enter/Klick ab.
  2. Deaktiviert Send.
  3. Sendet Text an Worker.
  4. Ersetzt Eingabe durch maskierten Text.
  5. Aktiviert Send, triggert Senden.
- [x] Fehlerbehandlung
  - [x] Bei Fehler: Snackbar/Toast im DOM (leichtgewichtig), Option „trotzdem senden".
  - [x] Logging eines Fehlereintrags (siehe §5).

**Akzeptanztest**: ✅
- Maskierter Text erscheint im Eingabefeld; Nutzer sendet ihn ab.
- Bei Fehler zeigt die Extension eine deutliche, aber unaufdringliche Meldung.

**Commit**: `feat(flow): wire content script with worker and replace input with masked text`

🎯 **Meilenstein**: End-to-End Masking im Ziel-DOM ✅

---

## 5. Revisions-Log (IndexedDB) & Upload-Tracking ✅

- [x] IndexedDB Store
  - [x] `revisions`: `{id, ts, site, originalHash, masked, spans, version}`
  - [x] `uploads`: `{id, ts, site, filename, size, mime}`
  - [x] Migrations + Versionierung
- [x] Logging-API
  - [x] `logRevision({ original, masked, site, spans })` (Hash statt Klartext für Original)
  - [x] `logUpload({ filename, size, mime, site })`
- [x] Dateiupload-Hooks
  - [x] `input[type=file]` `change` beobachten
  - [x] Drag&Drop-Ziele (`drop`) erkennen
- [x] Export
  - [x] JSON/CSV-Export (optional `chrome.downloads` nutzen)
  - [x] Lösch-/Purge-Funktion

**Akzeptanztest**: ✅
- Revision entsteht pro Submit-Vorgang.
- Upload-Metadaten werden erfasst, ohne Dateiinhalt zu lesen.

**Commit**: `feat(log): add indexeddb revisions and upload tracking with export`

🎯 **Meilenstein**: Nachvollziehbares Protokoll

---

## 6. Optionen/Settings-UI ✅

---

## 6.a PII-Typen gezielt aktivieren/deaktivieren

- [x] Settings-UI: Schalter pro PII-Klasse (`EMAIL`, `PHONE`, `IBAN`, `CARD`, `NAME`, `ADDR`, `URL`, `UUID`, `TAX_ID`, `SSN`, …)
- [x] Pipeline respektiert Schalter (Before-Merge filtern)
- [x] Presets: „Strikt“, „Balanciert“, „Locker“
- [ ] Pro-Site Overrides (z. B. Namen erlauben auf internen Tools)

**Akzeptanztest**: ✅
- Deaktivierter Typ wird weder erkannt noch maskiert.
- Umschalten wirkt ohne Reload.

**Commit**: `feat(settings): per-PII toggles and presets`


- [x] Toggle: Schutz aktiv/inaktiv je Site
- [x] Thresholds pro PII-Typ
- [x] Timeout-Strategie: blockieren vs. „trotzdem senden“-Schalter
- [x] Export/Import der Settings
- [x] Log-Viewer (basic Tabelle, Paginierung)

**Akzeptanztest**: ✅
- Settings wirken sofort (oder nach Reload) auf Content Script.
- Export/Import funktioniert.

**Commit**: `feat(ui): add options page with site toggles, thresholds, and log viewer`

🎯 **Meilenstein**: Nutzbare Konfiguration ✅

---

## 7. Qualität, Tests, Datenschutz ✅

- [x] Unit-Tests
  - [x] NER-Wrapper, Regex-Patterns, Masking-Merger
  - [x] Selector-Finder, Event-Interceptor
- [x] E2E-Smoke (manuell oder Playwright lokal)
- [x] Performance-Benchmarks (CI optional)
- [x] Security/Privacy
  - [x] Keine Remote-Telemetrie
  - [x] Least-Privilege Host-Permissions
  - [x] DS-GVO-konforme Löschung/Export
  - [x] Threat-Model (README-Abschnitt)

**Commit**: `test: add unit tests and privacy checks`

🎯 **Meilenstein**: Stabil + geprüft ✅

---



---

## 8. Enterprise-Deployment & Policy-Lockdown ✅

- [x] **Managed Deployment** (Chrome Enterprise)
  - [x] Unterstütze Installation via Unternehmensrichtlinien (force-install)
  - [x] Definiere **Policy-Schema** (JSON) für zentrale Vorgaben
    - [x] `locked`: boolean (verhindert lokale Änderungen)
    - [x] `enabledSites`: string[]
    - [x] `disabledSites`: string[]
    - [x] `piiToggles`: Record<PIIType, boolean>
    - [x] `thresholds`: Record<PIIType, number>
    - [x] `timeoutMs`: number
    - [x] `features`: Feature toggles (NER, export, logging)
    - [x] `compliance`: Audit mode, required PII types, prohibited sites
    - [x] `dataRetention`: Retention policies and cleanup
    - [x] `uiRestrictions`: Hide advanced settings, disable preset changes
  - [x] Implementiere **`chrome.storage.managed`**-Layer
    - [x] Read-only Merge: `managed` > `sync` > `local`
    - [x] UI sperrt Felder bei `locked=true` (visuell & technisch)
    - [x] Field-level locking for granular control
    - [x] Policy validation and sanitization
- [x] **Auditing/Export** für Compliance
  - [x] Export-Rollen: User vs. Admin (Admin-Export enthält zusätzliche Metriken, nie Klartext-Originale)
  - [x] Enhanced audit logging for compliance mode
  - [x] Policy enforcement tracking
- [x] **Docs für IT-Admins**
  - [x] JSON-Policy-Beispiele
  - [x] Rollout-Anleitung (GPO/Google Admin Console)
  - [x] Complete enterprise deployment guide
  - [x] Policy reference documentation
  - [x] Monitoring and troubleshooting guides
- [x] **E2E-Tests** mit `chrome.storage.managed` Mocks
  - [x] Comprehensive managed storage tests
  - [x] Enterprise UI behavior tests
  - [x] Policy application and validation tests

**Akzeptanztest**:
- Bei `locked=true` lassen sich Settings nicht ändern.
- Extension übernimmt Policy-Defaults ohne lokale Interaktion.

**Commit**: `feat(enterprise): managed storage, policy schema, and lockable settings`


## 9. Release ✅

- [x] Versionierung SemVer
  - [x] Version 1.0.0 in package.json, manifest.json, settings-storage.ts
- [x] `CHANGELOG.md`
  - [x] Comprehensive changelog with all features and changes
- [x] Build `dist/` + zip
  - [x] Production build created successfully (~454KB)
  - [x] Distribution zip file: `pii-checker-extension-v1.0.0.zip`
- [x] Installationsanleitung im README
  - [x] Complete README with installation, usage, and configuration guides
  - [x] Enterprise deployment instructions
  - [x] Developer setup and contribution guidelines
- [x] Chrome Web Store Vorbereitungen
  - [x] Store listing materials and descriptions
  - [x] Privacy policy documentation
  - [x] Submission requirements and assets planning

**Commit**: `chore(release): v1.0.0`

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
