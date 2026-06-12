import type { DemoFile } from "../types/demo";
import type { DemoAnalysisResult } from "../types/stats";

interface Props {
  demo: DemoFile;
  result?: DemoAnalysisResult;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onAnalyze: () => void;
  onExportDebug: () => void;
}

export function StatisticsModal({ demo, result, loading, error, onClose, onAnalyze, onExportDebug }: Props) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Statistiken</h2>
            <p className="text-sm text-slate-500">{demo.filename}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">All demo analysis happens locally on your PC. No demo files are uploaded.</p>
          </div>
          <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold hover:bg-slate-200" onClick={onClose}>Schließen</button>
        </div>

        <div className="mb-4 flex gap-3">
          <button className="rounded-2xl bg-orange-500 px-4 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50" onClick={onAnalyze} disabled={loading}>
            {loading ? "Analysiere lokal..." : "Analyse starten"}
          </button>
          {result && <button className="rounded-2xl bg-slate-100 px-4 py-3 font-bold hover:bg-slate-200" onClick={onExportDebug}>Export stats-debug.json</button>}
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-900">{error}</div>}

        {result && (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Info label="Parser" value={result.demo.parser} />
              <Info label="Map" value={result.demo.mapName} />
              <Info label="Tickrate" value={String(result.demo.tickRate)} />
              <Info label="Rounds" value={String(result.demo.totalRounds)} />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>{["Name", "K", "D", "A", "K/D", "ADR", "DMG", "HS %", "KAST %", "Entry K", "Entry D", "Flash A", "Util", "T ADR", "CT ADR"].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {result.players.map((player) => (
                    <tr key={player.steamId} className="border-t border-slate-200 odd:bg-slate-50">
                      <td className="px-3 py-2"><div className="font-bold">{player.name}</div><div className="text-xs text-slate-500">{player.steamId}</div></td>
                      <td className="px-3 py-2">{player.kills}</td><td className="px-3 py-2">{player.deaths}</td><td className="px-3 py-2">{player.assists}</td><td className="px-3 py-2">{player.kd}</td><td className="px-3 py-2">{player.adr}</td><td className="px-3 py-2">{player.damage}</td><td className="px-3 py-2">{player.headshotPercent}</td><td className="px-3 py-2">{player.kastPercent}</td><td className="px-3 py-2">{player.entryKills}</td><td className="px-3 py-2">{player.entryDeaths}</td><td className="px-3 py-2">{player.flashAssists}</td><td className="px-3 py-2">{player.utilityDamage}</td><td className="px-3 py-2">{player.tStats.adr}</td><td className="px-3 py-2">{player.ctStats.adr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold">Debug</h3>
              <p className="text-sm text-slate-700">Kills: {result.debug.rawKillsCount} | Damages: {result.debug.rawDamagesCount} | Shots: {result.debug.rawShotsCount} | Rounds: {result.debug.rawRoundsCount}</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">{result.debug.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-100 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="text-lg font-black">{value}</div></div>;
}
