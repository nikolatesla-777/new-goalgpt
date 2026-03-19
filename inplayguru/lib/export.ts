import { Pick } from "./supabase";

export function exportPicksToCSV(picks: Pick[], filename = "picks.csv") {
  const headers = [
    "Tarih",
    "Strateji",
    "Lig",
    "Ev Sahibi",
    "Deplasman",
    "Dakika",
    "Pick Skoru",
    "HT Skoru",
    "FT Skoru",
    "Predict",
    "Sonuç",
  ];

  const rows = picks.map((p) => [
    p.picked_at ? new Date(p.picked_at).toLocaleString("tr-TR") : "",
    p.strategy_name || "",
    p.league || "",
    p.home_team || "",
    p.away_team || "",
    p.timer || "",
    p.score_pick || "",
    p.score_ht || "",
    p.score_ft || "",
    p.predict || "",
    p.strike_result || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
