import fs from 'fs';
import { genererPlanning } from './src/lib/planning-algorithm';

const d = JSON.parse(fs.readFileSync('exports/kyncal-backup-2026-07-12 (5).json', 'utf8'));

const config = { contraintesEnchainement: [] };
const r = genererPlanning(d.saisons[0], d.spectacles, d.cascadeurs, config);
const entrees = r.planning.entrees;

const stats: Record<string, number> = {};
entrees.filter((e: any) => e.assignation.type === 'travail').forEach((e: any) => {
  stats[e.cascadeurId] = (stats[e.cascadeurId] || 0) + 1;
});

const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

console.log('\n=== JOURS TRAVAILLÉS ===');
sorted.forEach(([id, n]) => {
  const c = d.cascadeurs.find((x: any) => x.id === id);
  console.log(`${c.prenom} ${c.nom} (${c.typeRepos}): ${n}j`);
});

console.log(`\nTotal travail: ${entrees.filter((e: any) => e.assignation.type === 'travail').length}`);
console.log(`Total repos: ${entrees.filter((e: any) => e.assignation.type === 'repos').length}`);

// Check max consecutive days
console.log('\n=== MAX JOURS CONSÉCUTIFS ===');
const cascadeursActifs = d.cascadeurs.filter((c: any) => c.actif);
for (const c of cascadeursActifs) {
  const entries = entrees.filter((e: any) => e.cascadeurId === c.id).sort((a: any, b: any) => a.date.localeCompare(b.date));
  let maxConsec = 0;
  let current = 0;
  for (const e of entries) {
    if (e.assignation.type === 'travail') {
      current++;
      maxConsec = Math.max(maxConsec, current);
    } else {
      current = 0;
    }
  }
  console.log(`${c.prenom} ${c.nom} (${c.typeRepos}): max ${maxConsec}j consécutifs`);
}
