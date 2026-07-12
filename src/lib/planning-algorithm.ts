// ============================================================
// Kyncal — Algorithme de génération de planning
// ============================================================

import { v4 as uuidv4 } from "uuid";
import {
  addDays,
  format,
  parseISO,
  eachDayOfInterval,
  differenceInDays,
} from "date-fns";
import type {
  Cascadeur,
  Spectacle,
  Saison,
  Planning,
  EntreePlanning,
  TypeEntree,
  ContrainteEnchainement,
} from "@/types";
import { getJourSemaine } from "@/types";

// ============================================================
// TYPES INTERNES
// ============================================================

interface CascadeurState {
  cascadeurId: string;
  joursTravaillesConsecutifs: number;
  joursReposConsecutifs: number;
  dernierRoleSpectacleId: string | null;
  dernierRoleId: string | null;
  joursDansRoleActuel: number;
  reposPrisCycle: number;
  joursDepuisDernierRepos: number;
  totalJoursTravailles: number;
}

interface AlgorithmeConfig {
  contraintesEnchainement: ContrainteEnchainement[];
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function getMaxJoursAvantRepos(typeRepos: string): number {
  if (typeRepos === "5j/1") return 5;
  return 6; // défaut "6j/1"
}

function getRoleName(spectacle: Spectacle, roleId: string): string {
  return spectacle.roles.find((r) => r.id === roleId)?.nom || roleId;
}

/**
 * Vérifie si un cascadeur est absent à une date donnée
 */
function isAbsent(cascadeur: Cascadeur, dateStr: string): boolean {
  return cascadeur.absences.some(
    (a) => dateStr >= a.dateDebut && dateStr <= a.dateFin
  );
}

/**
 * Vérifie si un cascadeur peut jouer un rôle donné
 * (a ce rôle en primaire ou secondaire)
 */
function peutJouerRole(
  cascadeur: Cascadeur,
  spectacleId: string,
  roleId: string
): "primaire" | "secondaire" | null {
  const role = cascadeur.roles.find(
    (r) => r.spectacleId === spectacleId && r.roleId === roleId
  );
  return role?.priorite || null;
}

/**
 * Vérifie les contraintes d'enchaînement min/max
 */
function respecteEnchainement(
  state: CascadeurState,
  spectacleId: string,
  roleId: string,
  contraintes: ContrainteEnchainement[]
): boolean {
  const contrainte = contraintes.find(
    (c) => c.spectacleId === spectacleId && c.roleId === roleId
  );
  if (!contrainte) return true;

  // Si le cascadeur est dans un autre rôle, vérifier qu'il a atteint le min
  if (
    state.dernierRoleSpectacleId &&
    state.dernierRoleId &&
    (state.dernierRoleSpectacleId !== spectacleId ||
      state.dernierRoleId !== roleId)
  ) {
    const contrainteActuelle = contraintes.find(
      (c) =>
        c.spectacleId === state.dernierRoleSpectacleId &&
        c.roleId === state.dernierRoleId
    );
    if (
      contrainteActuelle &&
      state.joursDansRoleActuel < contrainteActuelle.joursMin
    ) {
      return false;
    }
  }

  // Vérifier le maximum
  if (
    state.dernierRoleSpectacleId === spectacleId &&
    state.dernierRoleId === roleId
  ) {
    if (
      contrainte.joursMax > 0 &&
      state.joursDansRoleActuel >= contrainte.joursMax
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================
// SCORE D'ÉQUITÉ — totalJoursTravailles DOMINE
// ============================================================

/**
 * Calcule le score d'équité pour un cascadeur.
 * Score plus BAS = meilleur candidat.
 *
 * Le facteur DOMINANT est totalJoursTravailles (×100000).
 * Le cascadeur avec le MOINS de jours travaillés gagne TOUJOURS.
 * Les critères secondaires ne départagent qu'à égalité parfaite.
 */
function calculerScoreEquite(
  cascadeur: Cascadeur,
  state: CascadeurState,
  spectacleId: string,
  roleId: string,
  contraintes: ContrainteEnchainement[],
  dateStr: string
): number {
  // Exclusions → score infini
  if (!peutJouerRole(cascadeur, spectacleId, roleId)) return Infinity;
  if (isAbsent(cascadeur, dateStr)) return Infinity;
  const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);
  if (state.joursDepuisDernierRepos >= maxJours) return Infinity;

  // ── Équilibrage : totalJoursTravailles × 100000 ──
  // Le cascadeur avec le MOINS de jours travaillés gagne TOUJOURS.
  const scoreEquilibrage = state.totalJoursTravailles * 100000;

  // ── Critères secondaires légers ──
  let scoreSecondaire = 0;

  // Primaire a priorité sur secondaire
  const priorite = peutJouerRole(cascadeur, spectacleId, roleId);
  if (priorite === "primaire") scoreSecondaire -= 100;
  else scoreSecondaire -= 50;

  // Moins de jours depuis le dernier repos = moins urgent de repos
  scoreSecondaire += state.joursDepuisDernierRepos * 10;

  return scoreEquilibrage + scoreSecondaire;
}

// ============================================================
// ALGORITHME PRINCIPAL
// ============================================================

/**
 * Génère un planning complet pour une saison.
 *
 * APPROCHE PAR JOUR (pas rôle par rôle) :
 * 1. Pour chaque jour, collecter TOUS les postes ouverts (spectacle+roleId)
 * 2. Pour chaque cascadeur disponible, calculer son MEILLEUR score parmi
 *    tous les postes (en tenant compte de primaire/secondaire)
 * 3. Trier les cascadeurs par totalJoursTravailles croissant
 * 4. Assigner le cascadeur le moins travaillé à son meilleur poste disponible
 * 5. Répéter jusqu'à remplir tous les postes ou épuiser les cascadeurs
 */
export function genererPlanning(
  saison: Saison,
  spectacles: Spectacle[],
  cascadeurs: Cascadeur[],
  config: AlgorithmeConfig
): Planning {
  const dateDebut = parseISO(saison.dateDebut);
  const dateFin = parseISO(saison.dateFin);
  const jours = eachDayOfInterval({ start: dateDebut, end: dateFin });

  // Filtrer les spectacles actifs de la saison
  const spectaclesSaison = spectacles.filter(
    (s) => s.actif && saison.spectacleIds.includes(s.id)
  );

  // Filtrer les cascadeurs actifs
  const cascadeursActifs = cascadeurs.filter((c) => c.actif);

  // Initialiser les états des cascadeurs
  const etats = new Map<string, CascadeurState>();
  for (const c of cascadeursActifs) {
    etats.set(c.id, {
      cascadeurId: c.id,
      joursTravaillesConsecutifs: 0,
      joursReposConsecutifs: 0,
      dernierRoleSpectacleId: null,
      dernierRoleId: null,
      joursDansRoleActuel: 0,
      reposPrisCycle: 0,
      joursDepuisDernierRepos: 0,
      totalJoursTravailles: 0,
    });
  }

  const entrees: EntreePlanning[] = [];

  for (const jour of jours) {
    const dateStr = format(jour, "yyyy-MM-dd");
    const jourSemaine = getJourSemaine(dateStr);

    // ── Étape 1 : Gérer les absences ──
    const absents = new Set<string>();
    for (const c of cascadeursActifs) {
      if (isAbsent(c, dateStr)) {
        absents.add(c.id);
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: {
            type: "absent",
            motif: c.absences.find(
              (a) => dateStr >= a.dateDebut && dateStr <= a.dateFin
            )!.motif,
          },
        });
        const state = etats.get(c.id)!;
        state.joursTravaillesConsecutifs = 0;
        state.joursReposConsecutifs = 0;
        state.joursDepuisDernierRepos = 0;
        state.joursDansRoleActuel = 0;
        state.dernierRoleSpectacleId = null;
        state.dernierRoleId = null;
      }
    }

    // ── Étape 2 : Déterminer qui DOIT prendre un repos ──
    const doiventReposer = new Set<string>();
    const disponibles = cascadeursActifs.filter((c) => {
      if (absents.has(c.id)) return false;
      const state = etats.get(c.id)!;
      const maxJours = getMaxJoursAvantRepos(c.typeRepos);
      if (state.joursDepuisDernierRepos >= maxJours) {
        doiventReposer.add(c.id);
        // Assigner le repos obligatoire
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "repos" },
        });
        state.joursTravaillesConsecutifs = 0;
        state.joursReposConsecutifs = 1;
        state.joursDepuisDernierRepos = 0;
        state.joursDansRoleActuel = 0;
        state.dernierRoleSpectacleId = null;
        state.dernierRoleId = null;
        return false;
      }
      return true;
    });

    // ── Étape 3 : Collecter les postes ouverts ce jour ──
    interface PosteOuvert {
      spectacleId: string;
      roleId: string;
      spectacle: Spectacle;
    }
    const postesOuverts: PosteOuvert[] = [];

    for (const spectacle of spectaclesSaison) {
      if (
        spectacle.joursDiffusion &&
        spectacle.joursDiffusion.length > 0 &&
        !spectacle.joursDiffusion.includes(jourSemaine)
      ) {
        continue;
      }
      for (const role of spectacle.roles) {
        for (let i = 0; i < role.nbCascadeursRequis; i++) {
          postesOuverts.push({
            spectacleId: spectacle.id,
            roleId: role.id,
            spectacle,
          });
        }
      }
    }

    // ── Étape 4 : Assignation équitable par jour ──
    // On assigne les cascadeurs un par un, en priorisant ceux avec le
    // MOINS de totalJoursTravailles. Chaque cascadeur est assigné au
    // MEILLEUR poste pour lui (primaire > secondaire, continuité, etc.)
    const assignesCeJour = new Set<string>();
    const postesRestants = [...postesOuverts]; // copie mutable

    while (postesRestants.length > 0) {
      // Chercher le meilleur cascadeur pour le prochain poste
      // On teste chaque cascadeur contre chaque poste et on prend
      // la meilleure combinaison (score le plus bas)
      let meilleurScore = Infinity;
      let meilleurCascadeur: (typeof disponibles)[number] | null = null;
      let meilleurPosteIdx = -1;

      for (const c of disponibles) {
        if (assignesCeJour.has(c.id)) continue;
        const state = etats.get(c.id)!;

        for (let pi = 0; pi < postesRestants.length; pi++) {
          const poste = postesRestants[pi];
          const score = calculerScoreEquite(
            c,
            state,
            poste.spectacleId,
            poste.roleId,
            config.contraintesEnchainement,
            dateStr
          );
          if (score < meilleurScore) {
            meilleurScore = score;
            meilleurCascadeur = c;
            meilleurPosteIdx = pi;
          }
        }
      }

      if (!meilleurCascadeur || meilleurScore === Infinity) {
        // Plus aucun cascadeur ne peut remplir les postes restants
        break;
      }

      // Assigner le meilleur cascadeur au poste
      const poste = postesRestants[meilleurPosteIdx];
      postesRestants.splice(meilleurPosteIdx, 1);
      assignesCeJour.add(meilleurCascadeur.id);

      const state = etats.get(meilleurCascadeur.id)!;

      // Si le cascadeur change de rôle, réinitialiser le compteur
      if (
        state.dernierRoleSpectacleId !== poste.spectacleId ||
        state.dernierRoleId !== poste.roleId
      ) {
        state.joursDansRoleActuel = 0;
      }

      state.joursTravaillesConsecutifs++;
      state.joursReposConsecutifs = 0;
      state.joursDepuisDernierRepos++;
      state.joursDansRoleActuel++;
      state.totalJoursTravailles++;
      state.dernierRoleSpectacleId = poste.spectacleId;
      state.dernierRoleId = poste.roleId;

      entrees.push({
        date: dateStr,
        cascadeurId: meilleurCascadeur.id,
        assignation: {
          type: "travail",
          spectacleId: poste.spectacleId,
          roleId: poste.roleId,
        },
      });
    }

    // ── Étape 5 : Cascadeurs non assignés → repos ──
    const auMoinsUnSpectacleJoue = spectaclesSaison.some((s) => {
      if (!s.joursDiffusion || s.joursDiffusion.length === 0) return true;
      return s.joursDiffusion.includes(jourSemaine);
    });

    for (const c of disponibles) {
      if (!assignesCeJour.has(c.id)) {
        if (auMoinsUnSpectacleJoue) {
          entrees.push({
            date: dateStr,
            cascadeurId: c.id,
            assignation: { type: "repos" },
          });
          const state = etats.get(c.id)!;
          state.joursTravaillesConsecutifs = 0;
          state.joursReposConsecutifs++;
        }
      }
    }
  }

  // ── Étape 6 : REPAIR PASS — Équilibrage final PAR GROUPE typeRepos ──
  // On tente de swapmer des cascadeurs en avance avec des postes occupés
  // par des cascadeurs en retard DANS LE MÊME GROUPE typeRepos.
  const REPAIR_ITERATIONS = 10;
  for (let iter = 0; iter < REPAIR_ITERATIONS; iter++) {
    // Recalculer les totaux par cascadeur
    const totaux = new Map<string, number>();
    for (const c of cascadeurs) {
      totaux.set(c.id, 0);
    }
    for (const e of entrees) {
      if (e.assignation.type === "travail") {
        totaux.set(e.cascadeurId, (totaux.get(e.cascadeurId) || 0) + 1);
      }
    }

    // Grouper par typeRepos
    const groupes = new Map<string, Cascadeur[]>();
    for (const c of cascadeurs) {
      if (!groupes.has(c.typeRepos)) groupes.set(c.typeRepos, []);
      groupes.get(c.typeRepos)!.push(c);
    }

    let anySwap = false;

    for (const [, membres] of groupes) {
      // Trouver le cascadeur avec le MAX et celui avec le MIN dans ce groupe
      let maxId = "";
      let maxVal = -1;
      let minId = "";
      let minVal = Infinity;
      for (const m of membres) {
        const val = totaux.get(m.id) || 0;
        if (val > maxVal) { maxVal = val; maxId = m.id; }
        if (val < minVal) { minVal = val; minId = m.id; }
      }

      if (maxVal - minVal <= 1) continue; // Déjà équilibré dans ce groupe

      const cascadeurMax = membres.find((c) => c.id === maxId)!;
      const cascadeurMin = membres.find((c) => c.id === minId)!;

      // Indexer les entrées par date+cascadeur
      const entreesIndex = new Map<string, EntreePlanning>();
      for (const e of entrees) {
        entreesIndex.set(`${e.date}|${e.cascadeurId}`, e);
      }

      let swapped = false;
      const allDates = Array.from(new Set(entrees.map((e) => e.date))).sort();
      for (const dateStr of allDates) {
        const entryMax = entreesIndex.get(`${dateStr}|${maxId}`);
        const entryMin = entreesIndex.get(`${dateStr}|${minId}`);

        if (!entryMax || !entryMin) continue;
        if (entryMax.assignation.type !== "travail") continue;
        if (entryMin.assignation.type !== "repos") continue;

        // Vérifier que minId peut jouer le rôle de maxId
        const spectacleId = entryMax.assignation.spectacleId;
        const roleId = entryMax.assignation.roleId;
        if (!peutJouerRole(cascadeurMin, spectacleId, roleId)) continue;
        if (isAbsent(cascadeurMin, dateStr)) continue;

        // SWAP : maxId → repos, minId → travail
        entryMax.assignation = { type: "repos" };
        entryMin.assignation = {
          type: "travail",
          spectacleId,
          roleId,
        };
        swapped = true;
        anySwap = true;
        break; // Un swap par groupe par itération
      }

      if (swapped) break; // Recommencer le recalcul des totaux
    }

    // Si aucun swap n'a été possible dans AUCUN groupe, essayer de forcer
    // le repos du cascadeur MAX même sans remplaçant (poste non-pourvu)
    if (!anySwap) {
      let forced = false;
      for (const [, membres] of groupes) {
        let maxId = "";
        let maxVal = -1;
        let minVal = Infinity;
        for (const m of membres) {
          const val = totaux.get(m.id) || 0;
          if (val > maxVal) { maxVal = val; }
          if (val < minVal) { minVal = val; }
        }
        if (maxVal - minVal <= 1) continue;

        // Forcer le repos du cascadeur MAX un jour où il travaille
        const entreesIndex2 = new Map<string, EntreePlanning>();
        for (const e of entrees) {
          entreesIndex2.set(`${e.date}|${e.cascadeurId}`, e);
        }
        const allDates2 = Array.from(new Set(entrees.map((e) => e.date))).sort();
        for (const dateStr of allDates2) {
          const entryMax = entreesIndex2.get(`${dateStr}|${maxId}`);
          if (!entryMax || entryMax.assignation.type !== "travail") continue;
          // Forcer en repos sans remplaçant
          entryMax.assignation = { type: "repos" };
          forced = true;
          break;
        }
        if (forced) break;
      }
      if (!forced) break; // Rien à faire
    }
  }

  return {
    id: uuidv4(),
    saisonId: saison.id,
    entrees,
    dateGeneration: new Date().toISOString(),
  };
}

// ============================================================
// DÉTECTION DE CONFLITS
// ============================================================

export interface Conflit {
  type:
    | "double_assignation"
    | "repos_non_respecte"
    | "enchainement_min"
    | "enchainement_max"
    | "role_manquant";
  date: string;
  cascadeurId: string;
  detail: string;
}

/**
 * Détecte les conflits dans un planning existant
 */
export function detecterConflits(
  planning: Planning,
  cascadeurs: Cascadeur[],
  spectacles: Spectacle[],
  config: AlgorithmeConfig
): Conflit[] {
  const conflits: Conflit[] = [];

  // Grouper les entrées par date
  const entreesParDate = new Map<string, EntreePlanning[]>();
  for (const entree of planning.entrees) {
    const existing = entreesParDate.get(entree.date) || [];
    existing.push(entree);
    entreesParDate.set(entree.date, existing);
  }

  // État par cascadeur pour détecter les enchaînements
  const etatsDetect = new Map<
    string,
    {
      joursDepuisDernierRepos: number;
      dernierRoleSpectacleId: string | null;
      dernierRoleId: string | null;
      joursDansRoleActuel: number;
    }
  >();

  for (const c of cascadeurs) {
    etatsDetect.set(c.id, {
      joursDepuisDernierRepos: 0,
      dernierRoleSpectacleId: null,
      dernierRoleId: null,
      joursDansRoleActuel: 0,
    });
  }

  const dates = Array.from(entreesParDate.keys()).sort();

  for (const dateStr of dates) {
    const entrees = entreesParDate.get(dateStr)!;

    // Vérifier les double assignations (même cascadeur, 2 rôles le même jour)
    const parCascadeur = new Map<string, EntreePlanning[]>();
    for (const e of entrees) {
      const existing = parCascadeur.get(e.cascadeurId) || [];
      existing.push(e);
      parCascadeur.set(e.cascadeurId, existing);
    }

    for (const [cascadeurId, entreesC] of parCascadeur) {
      const rolesCeJour = entreesC.filter((e) => e.assignation.type === "travail");
      if (rolesCeJour.length > 1) {
        conflits.push({
          type: "double_assignation",
          date: dateStr,
          cascadeurId,
          detail: `Assigné à ${rolesCeJour.length} rôles le même jour`,
        });
      }
    }

    // Mettre à jour les états et vérifier les contraintes
    for (const entree of entrees) {
      const cascadeur = cascadeurs.find((c) => c.id === entree.cascadeurId);
      if (!cascadeur) continue;

      const state = etatsDetect.get(entree.cascadeurId)!;

      if (entree.assignation.type === "travail") {
        // Vérifier le repos obligatoire
        const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);
        if (state.joursDepuisDernierRepos >= maxJours) {
          conflits.push({
            type: "repos_non_respecte",
            date: dateStr,
            cascadeurId: entree.cascadeurId,
            detail: `Devrait être en repos après ${state.joursDepuisDernierRepos} jours consécutifs (max: ${maxJours})`,
          });
        }

        // Vérifier les contraintes d'enchaînement
        const { spectacleId, roleId } = entree.assignation;

        // Changement de rôle → vérifier min
        if (
          state.dernierRoleSpectacleId &&
          state.dernierRoleId &&
          (state.dernierRoleSpectacleId !== spectacleId ||
            state.dernierRoleId !== roleId)
        ) {
          const contrainteActuelle = config.contraintesEnchainement.find(
            (c) =>
              c.spectacleId === state.dernierRoleSpectacleId &&
              c.roleId === state.dernierRoleId
          );
          if (
            contrainteActuelle &&
            state.joursDansRoleActuel < contrainteActuelle.joursMin
          ) {
            conflits.push({
              type: "enchainement_min",
              date: dateStr,
              cascadeurId: entree.cascadeurId,
              detail: `Quitte le rôle après ${state.joursDansRoleActuel} jours (min: ${contrainteActuelle.joursMin})`,
            });
          }
        }

        // Même rôle → vérifier max
        if (
          state.dernierRoleSpectacleId === spectacleId &&
          state.dernierRoleId === roleId
        ) {
          const contrainte = config.contraintesEnchainement.find(
            (c) => c.spectacleId === spectacleId && c.roleId === roleId
          );
          if (
            contrainte &&
            contrainte.joursMax > 0 &&
            state.joursDansRoleActuel >= contrainte.joursMax
          ) {
            conflits.push({
              type: "enchainement_max",
              date: dateStr,
              cascadeurId: entree.cascadeurId,
              detail: `Dépasse le max de jours consécutifs dans ce rôle (${state.joursDansRoleActuel} >= ${contrainte.joursMax})`,
            });
          }
        }

        // Mettre à jour l'état
        if (
          state.dernierRoleSpectacleId !== spectacleId ||
          state.dernierRoleId !== roleId
        ) {
          state.joursDansRoleActuel = 0;
        }
        state.joursDepuisDernierRepos++;
        state.joursDansRoleActuel++;
        state.dernierRoleSpectacleId = spectacleId;
        state.dernierRoleId = roleId;
      } else if (entree.assignation.type === "repos") {
        state.joursDepuisDernierRepos = 0;
        state.joursDansRoleActuel = 0;
        state.dernierRoleSpectacleId = null;
        state.dernierRoleId = null;
      }
      // "absent" → on ne touche pas aux compteurs (géré dans l'algo principal)
    }
  }

  return conflits;
}
