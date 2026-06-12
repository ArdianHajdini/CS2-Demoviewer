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

In der Demo-Liste auf `Statistics` klicken und `Analyse starten` ausfuehren. Tauri startet lokal:

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
- KAST ist in Version 1 als K/A/S-like vorbereitet; Trades werden im Debug als noch nicht final gemeldet.
- T/CT-Sidestats bleiben null, bis verlaessliche per-tick Side-Zuordnung verifiziert ist.

## Debug Export

`Export stats-debug.json` schreibt neben die Demo:

```text
match.dem.stats-debug.json
```

Enthalten sind Raw-Kills, Raw-Damages, Raw-Rounds, Parser-Exports, Warnungen und berechnete Spielerwerte.

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
