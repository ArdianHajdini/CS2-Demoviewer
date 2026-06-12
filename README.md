# CS2 Demo Manager

Lokale Windows-Desktop-App fuer CS2/FACEIT-Demos.

## Datenschutz

All demo analysis happens locally on your PC. No demo files are uploaded. No match data is sent to our servers.

## Features in Version 1

- Lokale `.dem`, `.dem.gz` und `.dem.zst` Dateien importieren
- FACEIT-Archive lokal nach `.dem` entpacken
- CS2 Replay-/Voice-Commands generieren
- Lokalen `@laihoe/demoparser2` Analyzer starten
- Basisstats aus der lokalen `.dem` berechnen
- `stats-debug.json` exportieren
- Windows Build via GitHub Actions

## Lokal Starten

```bash
cd artifacts/cs2-demo-manager
npm install
cd analyzer
npm install
cd ..
npm run tauri dev
```

## Demo Import

In der App den CS2 Replay-Ordner eintragen und eine lokale Demo-Datei importieren. `.dem` wird kopiert, `.dem.gz` und `.dem.zst` werden lokal entpackt.

## Stats Analyse

Nach dem Import wird die Demo automatisch lokal analysiert und ein kompakter Cache in der App gespeichert. In der Demo-Liste auf `Statistiken` klicken, um gespeicherte Stats zu sehen oder `Analyse starten` fuer eine neue Analyse auszufuehren. Tauri startet lokal:

```bash
node analyzer/analyze-demo.js "C:\\path\\to\\demo.dem"
```

Der Analyzer schreibt JSON auf stdout. Die UI blockiert nicht dauerhaft; das Backend bricht nach 120 Sekunden ab.

## Parser

- `demoparser2` ist die Hauptquelle fuer Statistiken, Events, Tickdaten, Aim- und Movement-Rohdaten.
- `source2-demo` wurde nicht entfernt und sollte fuer Voice-Slots beibehalten werden, bis der demoparser2-POC Player-Slots fuer `tv_listen_voice_indices` verlaesslich bestaetigt.
- Spieler werden ueber SteamID64/XUID zusammengefuehrt, nicht ueber Namen.

## Stats Berechnung

- Kills, Deaths, Assists kommen aus `player_death`.
- Damage und ADR kommen aus `player_hurt`; ADR = Damage / geparste Runden.
- Headshot % = Headshot-Kills / Kills.
- Entry Kill/Death = erster gueltiger Kill einer Runde.
- KAST wird pro Spieler pro Runde berechnet: Kill, Assist, Survive oder Trade innerhalb von 5 Sekunden.
- T/CT-Sidestats sind in der UI versteckt, bis verlaessliche per-event Side-Zuordnung verifiziert ist.

## Debug Export

`Export stats-debug.json` schreibt neben die Demo:

```text
match.dem.stats-debug.json
```

Enthalten sind Raw `player_death` Rows, Raw `player_hurt` Rows, Raw `round_start` / `round_end` Rows, normalisierte Kills/Damages, per-round KAST-Tabelle, Parser-Exports, Warnungen und berechnete Spielerwerte.

## Analyzer Packaging

Development nutzt `node` aus der lokalen Entwicklerumgebung. Vor `npm run tauri build` kopiert `npm run prepare:analyzer-runtime` die aktuelle Windows `node.exe` nach `analyzer/node.exe`. Tauri bundelt den Analyzer-Ordner als Resource, damit der Installer fuer normale Nutzer keine manuelle Node-Installation voraussetzt.

Wichtig: `analyzer/node.exe` ist absichtlich in `.gitignore`, wird aber beim lokalen Build und in GitHub Actions vor dem Tauri-Build erzeugt.

## Windows Build

Bei Push auf `main` oder manuell ueber `workflow_dispatch` baut GitHub Actions die Tauri-App.

Artifacts liegen im Workflow unter:

```text
artifacts/cs2-demo-manager/src-tauri/target/release/bundle/**/*
```

## Testplan

1. `.dem` importieren und Demo-Liste pruefen.
2. `Statistics` starten und Analyzer-JSON pruefen.
3. Kills, Rundenzahl, ADR, HS% und KAST% auf Plausibilitaet pruefen.
4. `stats-debug.json` exportieren.
5. GitHub Actions Build ausfuehren und MSI/NSIS Artifact herunterladen.
