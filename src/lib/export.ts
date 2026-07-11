// ============================================================
// Kyncal — Module d'export (PDF, Excel, CSV)
// ============================================================

import type {
  Planning,
  Cascadeur,
  Spectacle,
  Saison,
  EntreePlanning,
} from "@/types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================================
// HELPERS
// ============================================================

function getCascadeurName(cascadeurs: Cascadeur[], id: string): string {
  const c = cascadeurs.find((c) => c.id === id);
  return c ? `${c.prenom} ${c.nom}` : id;
}

function getSpectacleName(spectacles: Spectacle[], id: string): string {
  return spectacles.find((s) => s.id === id)?.nom || id;
}

function getRoleName(
  spectacles: Spectacle[],
  spectacleId: string,
  roleId: string
): string {
  const sp = spectacles.find((s) => s.id === spectacleId);
  return sp?.roles.find((r) => r.id === roleId)?.nom || roleId;
}

function getEntreeLabel(
  entry: EntreePlanning,
  spectacles: Spectacle[]
): string {
  if (entry.assignation.type === "repos") return "REPOS";
  if (entry.assignation.type === "absent")
    return `ABS (${entry.assignation.motif})`;
  return getRoleName(
    spectacles,
    entry.assignation.spectacleId,
    entry.assignation.roleId
  );
}

function getEntreeSpectacle(
  entry: EntreePlanning,
  spectacles: Spectacle[]
): string {
  if (entry.assignation.type !== "travail") return "";
  return getSpectacleName(spectacles, entry.assignation.spectacleId);
}

// ============================================================
// CSV EXPORT
// ============================================================

export function exportCSV(
  planning: Planning,
  cascadeurs: Cascadeur[],
  spectacles: Spectacle[],
  saison: Saison
): void {
  const dates = [
    ...new Set(planning.entrees.map((e) => e.date)),
  ].sort();

  // En-têtes
  const headers = ["Cascadeur", "Repos", ...dates];

  // Lignes
  const rows: string[][] = cascadeurs
    .filter((c) => c.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((c) => {
      const row = [`${c.prenom} ${c.nom}`, c.typeRepos];
      for (const date of dates) {
        const entry = planning.entrees.find(
          (e) => e.date === date && e.cascadeurId === c.id
        );
        row.push(entry ? getEntreeLabel(entry, spectacles) : "");
      }
      return row;
    });

  // Construire le CSV
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");

  downloadFile(
    csv,
    `planning_${saison.nom.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    "text/csv;charset=utf-8;"
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================
// EXCEL EXPORT
// ============================================================

export function exportExcel(
  planning: Planning,
  cascadeurs: Cascadeur[],
  spectacles: Spectacle[],
  saison: Saison
): void {
  // Import dynamique pour le SSR
  import("xlsx").then((XLSX) => {
    const dates = [
      ...new Set(planning.entrees.map((e) => e.date)),
    ].sort();

    // Données pour la feuille principale
    const data: (string | number)[][] = [];

    // En-têtes
    data.push(["Cascadeur", "Repos", ...dates.map((d) => format(parseISO(d), "EEE d MMM", { locale: fr }))]);

    // Lignes par cascadeur
    const cascadeursActifs = cascadeurs
      .filter((c) => c.actif)
      .sort((a, b) => a.nom.localeCompare(b.nom));

    for (const c of cascadeursActifs) {
      const row: (string | number)[] = [
        `${c.prenom} ${c.nom}`,
        c.typeRepos,
      ];
      for (const date of dates) {
        const entry = planning.entrees.find(
          (e) => e.date === date && e.cascadeurId === c.id
        );
        row.push(entry ? getEntreeLabel(entry, spectacles) : "");
      }
      data.push(row);
    }

    // Feuille stats
    const statsData: (string | number)[][] = [
      ["Statistiques"],
      ["Cascadeur", "Jours travail", "Jours repos", "Jours absence"],
    ];
    for (const c of cascadeursActifs) {
      const entrees = planning.entrees.filter((e) => e.cascadeurId === c.id);
      statsData.push([
        `${c.prenom} ${c.nom}`,
        entrees.filter((e) => e.assignation.type === "travail").length,
        entrees.filter((e) => e.assignation.type === "repos").length,
        entrees.filter((e) => e.assignation.type === "absent").length,
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(data);
    const ws2 = XLSX.utils.aoa_to_sheet(statsData);

    // Largeur de colonnes
    ws1["!cols"] = [
      { wch: 20 },
      { wch: 8 },
      ...dates.map(() => ({ wch: 14 })),
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "Planning");
    XLSX.utils.book_append_sheet(wb, ws2, "Statistiques");

    XLSX.writeFile(
      wb,
      `planning_${saison.nom.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );
  });
}

// ============================================================
// PDF EXPORT
// ============================================================

export function exportPDF(
  planning: Planning,
  cascadeurs: Cascadeur[],
  spectacles: Spectacle[],
  saison: Saison
): void {
  import("jspdf").then((jsPDFModule) => {
    import("jspdf-autotable").then(() => {
      const doc = new jsPDFModule.default({ orientation: "landscape", unit: "mm", format: "a4" });

      // Titre
      doc.setFontSize(16);
      doc.text(`Planning — ${saison.nom}`, 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text(
        `${format(parseISO(saison.dateDebut), "d MMM yyyy", { locale: fr })} — ${format(parseISO(saison.dateFin), "d MMM yyyy", { locale: fr })}`,
        14,
        22
      );
      doc.setTextColor(0);

      const dates = [
        ...new Set(planning.entrees.map((e) => e.date)),
      ].sort();

      // Limiter à 2 semaines par page pour la lisibilité
      const chunkSize = 14;
      const cascadeursActifs = cascadeurs
        .filter((c) => c.actif)
        .sort((a, b) => a.nom.localeCompare(b.nom));

      for (let i = 0; i < dates.length; i += chunkSize) {
        const chunk = dates.slice(i, i + chunkSize);

        if (i > 0) {
          doc.addPage();
        }

        const startY = i === 0 ? 28 : 15;

        // En-têtes
        const head = [
          ["Cascadeur", ...chunk.map((d) => format(parseISO(d), "EEE d", { locale: fr }))],
        ];

        // Données
        const body = cascadeursActifs.map((c) => {
          const row = [`${c.prenom} ${c.nom}`];
          for (const date of chunk) {
            const entry = planning.entrees.find(
              (e) => e.date === date && e.cascadeurId === c.id
            );
            row.push(entry ? getEntreeLabel(entry, spectacles) : "-");
          }
          return row;
        });

        (doc as any).autoTable({
          startY,
          head,
          body,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [51, 51, 51], fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
        });
      }

      doc.save(
        `planning_${saison.nom.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`
      );
    });
  });
}

// ============================================================
// HELPER DOWNLOAD
// ============================================================

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
