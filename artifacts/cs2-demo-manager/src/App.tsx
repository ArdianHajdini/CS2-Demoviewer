import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StatisticsModal } from "./components/StatisticsModal";
import { cacheAnalysis, loadAnalysisCache, type AnalysisCache } from "./services/analysisCache";
import {
  copyToClipboard,
  detectDownloadsFolder,
  detectReplayFolder,
  importDemo,
  listDemos,
  openFolder,
} from "./services/demoService";
import { analyzeDemo, exportStatsDebug } from "./services/statsService";
import { buildVoiceCommand } from "./services/voiceService";
import type { DemoFile, VoiceMode } from "./types/demo";
import type { DemoAnalysisResult } from "./types/stats";

type Notice = { kind: "success" | "error" | "info"; text: string };

export default function App() {
  const [directory, setDirectory] = useState("");
  const [downloadsDirectory, setDownloadsDirectory] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [demos, setDemos] = useState<DemoFile[]>([]);
  const [downloadCandidates, setDownloadCandidates] = useState<DemoFile[]>([]);
  const [selected, setSelected] = useState<DemoFile>();
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("all");
  const [analysis, setAnalysis] = useState<DemoAnalysisResult>();
  const [analysisCache, setAnalysisCache] = useState<AnalysisCache>(() => loadAnalysisCache());
  const [loadingStats, setLoadingStats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  const newestDemo = useMemo(() => demos[0], [demos]);

  useEffect(() => {
    void bootstrapDefaults();
  }, []);

  async function bootstrapDefaults() {
    try {
      const [downloads, replay] = await Promise.all([detectDownloadsFolder(), detectReplayFolder()]);
      setDownloadsDirectory(downloads);
      if (replay) {
        setDirectory(replay);
        const rows = await listDemos(replay);
        setDemos(sortDemos(rows));
      }
    } catch {
      setNotice({ kind: "info", text: "Auto-Erkennung nicht verfuegbar. Bitte Replay- und Downloads-Ordner manuell eintragen." });
    }
  }

  async function refresh(targetDirectory = directory) {
    if (!targetDirectory.trim()) {
      setNotice({ kind: "error", text: "Bitte zuerst den CS2 Replay-Ordner eintragen." });
      return;
    }
    setBusy(true);
    try {
      const rows = await listDemos(targetDirectory.trim());
      setDemos(sortDemos(rows));
      setNotice({ kind: "success", text: `${rows.length} Demo-Datei(en) im Replay-Ordner gefunden.` });
    } catch (err) {
      setNotice({ kind: "error", text: `Scan fehlgeschlagen: ${formatError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function scanDownloads() {
    if (!downloadsDirectory.trim()) {
      setNotice({ kind: "error", text: "Bitte zuerst den Downloads-Ordner eintragen." });
      return;
    }
    setBusy(true);
    try {
      const rows = await listDemos(downloadsDirectory.trim());
      setDownloadCandidates(sortDemos(rows));
      setNotice({ kind: "success", text: `${rows.length} Demo-Datei(en) in Downloads gefunden.` });
    } catch (err) {
      setNotice({ kind: "error", text: `Downloads-Scan fehlgeschlagen: ${formatError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function doImport(path = sourcePath) {
    if (!path.trim()) {
      setNotice({ kind: "error", text: "Bitte eine .dem, .dem.gz oder .dem.zst Datei eintragen oder aus Downloads waehlen." });
      return;
    }
    if (!directory.trim()) {
      setNotice({ kind: "error", text: "Bitte zuerst den CS2 Replay-Ordner eintragen." });
      return;
    }
    setBusy(true);
    try {
      const importedPath = await importDemo(path.trim(), directory.trim());
      const rows = await listDemos(directory.trim());
      setDemos(sortDemos(rows));
      setNotice({ kind: "info", text: `Import erfolgreich. Analysiere Demo lokal: ${importedPath}` });
      const result = await analyzeDemo(importedPath);
      setAnalysisCache((cache) => cacheAnalysis(cache, importedPath, result));
      setNotice({ kind: result.success ? "success" : "error", text: result.success ? `Importiert und analysiert: ${importedPath}` : `Importiert, aber Analyse fehlgeschlagen: ${result.error || "Analyzer error"}` });
    } catch (err) {
      setNotice({ kind: "error", text: `Import fehlgeschlagen: ${formatError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function importAllDownloads() {
    if (!downloadCandidates.length) {
      setNotice({ kind: "info", text: "Keine Download-Demos zum Importieren gefunden." });
      return;
    }
    setBusy(true);
    let imported = 0;
    const errors: string[] = [];
    for (const demo of downloadCandidates) {
      try {
        const importedPath = await importDemo(demo.filepath, directory.trim());
        const result = await analyzeDemo(importedPath);
        setAnalysisCache((cache) => cacheAnalysis(cache, importedPath, result));
        imported += 1;
      } catch (err) {
        errors.push(`${demo.filename}: ${formatError(err)}`);
      }
    }
    try {
      setDemos(sortDemos(await listDemos(directory.trim())));
    } finally {
      setBusy(false);
    }
    setNotice(errors.length ? { kind: "error", text: `${imported} importiert, ${errors.length} Fehler. ${errors[0]}` } : { kind: "success", text: `${imported} Demo-Datei(en) importiert.` });
  }

  async function runAnalysis() {
    if (!selected) return;
    setLoadingStats(true);
    setNotice(undefined);
    try {
      const result = await analyzeDemo(selected.filepath);
      setAnalysis(result);
      setAnalysisCache((cache) => cacheAnalysis(cache, selected.filepath, result));
      if (!result.success) setNotice({ kind: "error", text: result.error || "Analyzer failed" });
    } catch (err) {
      setNotice({ kind: "error", text: formatError(err) });
    } finally {
      setLoadingStats(false);
    }
  }

  async function exportDebug() {
    if (!analysis || !selected) return;
    const filepath = `${selected.filepath}.stats-debug.json`;
    await exportStatsDebug(filepath, analysis.debug);
    setNotice({ kind: "success", text: `Exportiert: ${filepath}` });
  }

  async function copyCommand(demo: DemoFile) {
    let cached = analysisCache[demo.filepath];
    if ((voiceMode === "t" || voiceMode === "ct") && !cached) {
      setNotice({ kind: "info", text: "Voice-Team-Command braucht Parserdaten. Analysiere Demo einmalig lokal..." });
      cached = await analyzeDemo(demo.filepath);
      setAnalysisCache((cache) => cacheAnalysis(cache, demo.filepath, cached));
    }
    const command = buildVoiceCommand(voiceMode, demo.filename, cached);
    await copyToClipboard(command);
    const hasTeamMask = voiceMode === "all" || voiceMode === "none" || Boolean(cached?.debug.voicePlayers?.length);
    setNotice({ kind: hasTeamMask ? "success" : "error", text: hasTeamMask ? "CS2 Console Command wurde kopiert." : "Command kopiert, aber keine Voice-Spielerdaten gefunden. Bitte erst Statistiken analysieren." });
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-6 p-4 lg:grid-cols-[280px_1fr] lg:p-6">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 font-black text-white">CS</div>
            <h1 className="text-2xl font-black tracking-tight">CS2 Demo Manager</h1>
            <p className="mt-2 text-sm text-slate-500">FACEIT-Demos lokal importieren, starten und mit demoparser2 auswerten.</p>
          </div>

          <nav className="space-y-2 text-sm font-semibold">
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">Demo Library</div>
            <div className="rounded-2xl px-4 py-3 text-slate-500">Stats Analyzer</div>
            <div className="rounded-2xl px-4 py-3 text-slate-500">Voice Commands</div>
            <div className="rounded-2xl px-4 py-3 text-slate-500">Settings</div>
          </nav>

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-bold">Local only</div>
            <p className="mt-1">Keine Demo wird hochgeladen. Analyse laeuft nur auf deinem PC.</p>
          </div>
        </aside>

        <section className="space-y-6">
          <header className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.28em] text-orange-300">FACEIT / CS2 Replay Workflow</p>
                <h2 className="mt-2 text-4xl font-black tracking-tight">Import. Copy command. Analyze locally.</h2>
                <p className="mt-3 max-w-3xl text-slate-300">Erst Replay-Ordner setzen, dann Downloads scannen oder einzelne Demo importieren. Jeder Schritt zeigt jetzt sichtbar Erfolg oder Fehler.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Metric label="Demos" value={String(demos.length)} />
                <Metric label="Downloads" value={String(downloadCandidates.length)} />
                <Metric label="Parser" value="dparser2" />
              </div>
            </div>
          </header>

          {notice && <NoticeBox notice={notice} />}

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <Card title="Setup" subtitle="Ordner setzen und Demos finden">
                <div className="grid gap-4">
                  <PathInput label="CS2 Replay-Ordner" value={directory} onChange={setDirectory} placeholder="...\game\csgo\replays" />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => refresh()} disabled={busy}>Replay-Ordner scannen</Button>
                    <Button tone="secondary" onClick={() => directory && openFolder(directory)} disabled={!directory}>Ordner öffnen</Button>
                    <Button tone="secondary" onClick={bootstrapDefaults}>Auto-Erkennung</Button>
                  </div>
                </div>
              </Card>

              <Card title="Demo importieren" subtitle="Einzeldatei oder Downloads-Ordner">
                <div className="space-y-4">
                  <PathInput label="Demo-Datei" value={sourcePath} onChange={setSourcePath} placeholder="C:\Users\ardia\Downloads\match.dem.zst" />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => doImport()} disabled={busy}>Importieren</Button>
                    <Button tone="secondary" onClick={() => setSourcePath("C:\\Users\\ardia\\Downloads\\1-09fdf9ba-246f-4ca4-a250-7639a6f5c790-1-1.dem.zst")}>Test-Demo einsetzen</Button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <PathInput label="Downloads-Ordner" value={downloadsDirectory} onChange={setDownloadsDirectory} placeholder="C:\Users\ardia\Downloads" compact />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button tone="secondary" onClick={scanDownloads} disabled={busy}>Downloads scannen</Button>
                      <Button onClick={importAllDownloads} disabled={busy || !downloadCandidates.length}>Alle gefundenen importieren</Button>
                    </div>
                    {downloadCandidates.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {downloadCandidates.slice(0, 4).map((demo) => (
                          <button key={demo.filepath} className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm shadow-sm" onClick={() => doImport(demo.filepath)}>
                            <span className="truncate font-medium">{demo.filename}</span>
                            <span className="ml-3 text-xs text-orange-600">import</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Quick Actions" subtitle="CS2 Command und Status">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">Voice-Modus</label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none ring-orange-500 focus:ring-2" value={voiceMode} onChange={(event) => setVoiceMode(event.target.value as VoiceMode)}>
                  <option value="all">Alle hören</option>
                  <option value="none">Kein Voice</option>
                  <option value="t">Team T</option>
                  <option value="ct">Team CT</option>
                </select>
                {newestDemo ? (
                  <div className="rounded-2xl bg-slate-950 p-4 text-white">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Neueste Demo</div>
                    <div className="mt-1 truncate font-bold">{newestDemo.filename}</div>
                    <button className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white hover:bg-orange-600" onClick={() => copyCommand(newestDemo)}>Command kopieren</button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Noch keine Demo im Replay-Ordner gescannt.</div>
                )}
              </div>
            </Card>
          </div>

          <Card title="Demo Library" subtitle="Importierte .dem Dateien im Replay-Ordner">
            {demos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
                <div className="text-lg font-bold">Keine Demos geladen</div>
                <p className="mt-2 text-sm text-slate-500">Scanne den Replay-Ordner oder importiere eine Demo aus Downloads.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {demos.map((demo) => (
                  <DemoRow key={demo.filepath} demo={demo} cached={Boolean(analysisCache[demo.filepath])} onCopy={() => copyCommand(demo)} onStats={() => { setSelected(demo); setAnalysis(analysisCache[demo.filepath]); }} />
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>

      {selected && <StatisticsModal demo={selected} result={analysis ?? analysisCache[selected.filepath]} loading={loadingStats} error={notice?.kind === "error" ? notice.text : undefined} onClose={() => setSelected(undefined)} onAnalyze={runAnalysis} onExportDebug={exportDebug} />}
    </main>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h3 className="text-xl font-black tracking-tight">{title}</h3><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{children}</section>;
}

function Button({ children, onClick, disabled, tone = "primary" }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "primary" | "secondary" }) {
  const cls = tone === "primary" ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-slate-100 text-slate-800 hover:bg-slate-200";
  return <button className={`rounded-2xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function PathInput({ label, value, onChange, placeholder, compact }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; compact?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input className={`w-full rounded-2xl border border-slate-200 bg-white px-4 ${compact ? "py-2" : "py-3"} text-sm outline-none ring-orange-500 placeholder:text-slate-400 focus:ring-2`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function DemoRow({ demo, cached, onCopy, onStats }: { demo: DemoFile; cached: boolean; onCopy: () => void; onStats: () => void }) {
  return <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="truncate text-base font-black">{demo.filename}</div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">local</span>{cached && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">stats cached</span>}</div><div className="mt-1 truncate text-sm text-slate-500">{demo.filepath}</div><div className="mt-2 flex gap-3 text-xs font-semibold text-slate-500"><span>{formatFileSize(demo.sizeBytes)}</span><span>{formatDate(demo.modifiedAt)}</span></div></div><div className="flex flex-wrap gap-2"><Button tone="secondary" onClick={onCopy}>Copy Command</Button><Button onClick={onStats}>{cached ? "Stats öffnen" : "Analysieren"}</Button></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-xs uppercase tracking-wide text-slate-400">{label}</div><div className="text-lg font-black">{value}</div></div>;
}

function NoticeBox({ notice }: { notice: Notice }) {
  const cls = notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : notice.kind === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-blue-200 bg-blue-50 text-blue-900";
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${cls}`}>{notice.text}</div>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const seconds = Number(value);
  const date = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "unbekannt" : date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sortDemos(rows: DemoFile[]) {
  return [...rows].sort((a, b) => Number(b.modifiedAt || 0) - Number(a.modifiedAt || 0));
}

function formatError(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
