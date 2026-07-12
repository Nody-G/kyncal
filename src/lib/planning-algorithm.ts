// ============================================================
// Kyncal — Algorithme de génération de planning
// ============================================================

import { v4 as uuidv4 } from "uuid";
import {
  format,
  parseISO,
  eachDayOfInterval,
} from "date-fns";
import type {
  Cascadeur,
  Spectacle,
  Saison,
  Planning,
  EntreePlanning,
  ContrainteEnchainement,
} from "@/types";
import { getJourSemaine } from "@/types";

// ============================================================
// TYPES INTERNES
// ============================================================

interface CascadeurState {
  cascadeurId: string;
  dernierRoleSpectacleId: string | null;
  dernierRoleId: string | null;
  joursDansRoleActuel: number;
  joursDepuisDernierRepos: number;
  totalJoursTravailles: number;
}

interface AlgorithmeConfig {
  contraintesEnchainement: ContrainteEnchainement[];
}

/** Rapport de génération : warnings et diagnostics */
export interface LigneRapport {
  type: "warning" | "info";
  message: string;
}

export interface ResultatGeneration {
  planning: Planning;
  rapport: LigneRapport[];
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function getMaxJoursAvantRepos(typeRepos: string): number {
  if (typeRepos === "5j/1") return 5;
  return 6; // défaut "6j/1"
}

function isAbsent(cascadeur: Cascadeur, dateStr: string): boolean {
  return cascadeur.absences.some(
    (a) => dateStr >= a.dateDebut && dateStr <= a.dateFin
  );
}

function getPriorite(
  cascadeur: Cascadeur,
  spectacleId: string,
  roleId: string
): "primaire" | "secondaire" | null {
  const role = cascadeur.roles.find(
    (r) => r.spectacleId === spectacleId && r.roleId === roleId
  );
  return role?.priorite || null;
}

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

  // Si le cascadeur est dans un rôle différent, vérifier qu'il a atteint le min
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

  // Vérifier le maximum dans le même rôle
  if (
    state.dernierRoleSpectacleId === spectacleId &&
    state.dernierRoleId === roleId
  ) {
    if (contrainte.joursMax > 0 && state.joursDansRoleActuel >= contrainte.joursMax) {
      return false;
    }
  }

  return true;
}

// ============================================================
// SCORE D'ÉQUITÉ — SIMPLE
// Score = totalJoursTravailles × 1000 + pénalité secondaire
// Le cascadeur avec le MOINS de jours travaillés gagne TOUJOURS.
// ============================================================

function calculerScore(
  cascadeur: Cascadeur,
  state: CascadeurState,
  spectacleId: string,
  roleId: string,
  contraintes: ContrainteEnchainement[],
  dateStr: string
): number {
  // Exclusions → score infini
  if (!getPriorite(cascadeur, spectacleId, roleId)) return Infinity;
  if (isAbsent(cascadeur, dateStr)) return Infinity;
  const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);
  if (state.joursDepuisDernierRepos >= maxJours) return Infinity;
  if (!respecteEnchainement(state, spectacleId, roleId, contraintes)) return Infinity;

  // Équilibrage : totalJoursTravailles domine tout
  let score = state.totalJoursTravailles * 1000;

  // Primaire > secondaire (petit bonus)
  const priorite = getPriorite(cascadeur, spectacleId, roleId);
  if (priorite === "secondaire") score += 10;

  // Bonus pour cascadeurs avec peu de rôles primaires (rareté)
  // Moins de rôles = meilleur score (plus prioritaire)
  // Bonus significatif pour départager les cascadeurs avec le même totalJoursTravailles
  const nbRolesPrimaires = cascadeur.roles.filter(
    (r) => r.priorite === "primaire"
  ).length;
  // Cascadeur avec 1 rôle → bonus 500, 2 rôles → 400, ..., 5+ rôles → 0
  const bonusRareté = Math.max(0, (6 - nbRolesPrimaires) * 100);
  score -= bonusRareté;

  return score;
}

// ============================================================
// ALGORITHME PRINCIPAL
// ============================================================

export function genererPlanning(
  saison: Saison,
  spectacles: Spectacle[],
  cascadeurs: Cascadeur[],
  config: AlgorithmeConfig
): ResultatGeneration {
  const dateDebut = parseISO(saison.dateDebut);
  const dateFin = parseISO(saison.dateFin);
  const jours = eachDayOfInterval({ start: dateDebut, end: dateFin });
  const rapport: LigneRapport[] = [];

  // Filtrer les spectacles actifs de la saison
  const spectaclesSaison = spectacles.filter(
    (s) => s.actif && saison.spectacleIds.includes(s.id)
  );

  // Filtrer les cascadeurs actifs
  const cascadeursActifs = cascadeurs.filter((c) => c.actif);

  // ── VÉRIFICATION PRÉALABLE : rôles sans cascadeur ──
  for (const spectacle of spectaclesSaison) {
    for (const role of spectacle.roles) {
      const primaires = cascadeursActifs.filter(
        (c) => getPriorite(c, spectacle.id, role.id) === "primaire"
      );
      const secondaires = cascadeursActifs.filter(
        (c) => getPriorite(c, spectacle.id, role.id) === "secondaire"
      );

      if (primaires.length === 0 && secondaires.length === 0) {
        rapport.push({
          type: "warning",
          message: `Le rôle "${role.nom}" du spectacle "${spectacle.nom}" n'a AUCUN cascadeur assigné. Il sera toujours vide.`,
        });
      } else if (primaires.length === 0) {
        rapport.push({
          type: "warning",
          message: `Le rôle "${role.nom}" du spectacle "${spectacle.nom}" n'a que des cascadeurs secondaires (${secondaires.map((c) => c.prenom + " " + c.nom).join(", ")}). Le remplissage dépendra entièrement d'eux.`,
        });
      } else if (primaires.length < role.nbCascadeursRequis) {
        rapport.push({
          type: "warning",
          message: `Le rôle "${role.nom}" du spectacle "${spectacle.nom}" nécessite ${role.nbCascadeursRequis} cascadeur(s) mais n'a que ${primaires.length} primaire(s). Les secondaires devront compléter.`,
        });
      }
    }
  }

  // Initialiser les états des cascadeurs
  const etats = new Map<string, CascadeurState>();
  for (const c of cascadeursActifs) {
    etats.set(c.id, {
      cascadeurId: c.id,
      dernierRoleSpectacleId: null,
      dernierRoleId: null,
      joursDansRoleActuel: 0,
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
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "repos" },
        });
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
    // Prioriser les postes avec le MOINS de candidats primaires d'abord
    // (les rôles "critiques" sont remplis en premier)
    const assignesCeJour = new Set<string>();
    const postesRestants = [...postesOuverts];

    // Trier les postes : ceux avec le moins de candidats primaires d'abord
    postesRestants.sort((a, b) => {
      const candidatsA = disponibles.filter(
        (c) =>
          !assignesCeJour.has(c.id) &&
          getPriorite(c, a.spectacleId, a.roleId) === "primaire"
      ).length;
      const candidatsB = disponibles.filter(
        (c) =>
          !assignesCeJour.has(c.id) &&
          getPriorite(c, b.spectacleId, b.roleId) === "primaire"
      ).length;
      return candidatsA - candidatsB;
    });

    while (postesRestants.length > 0) {
      const poste = postesRestants[0]; // Prendre le poste le plus critique

      // Chercher le meilleur cascadeur pour ce poste
      let meilleurScore = Infinity;
      let meilleurCascadeur: (typeof disponibles)[number] | null = null;

      for (const c of disponibles) {
        if (assignesCeJour.has(c.id)) continue;
        const state = etats.get(c.id)!;
        const score = calculerScore(
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
        }
      }

      if (!meilleurCascadeur || meilleurScore === Infinity) {
        // Plus aucun cascadeur ne peut remplir ce poste
        // Passer au poste suivant
        postesRestants.shift();
        continue;
      }

      // Assigner
      postesRestants.shift();
      assignesCeJour.add(meilleurCascadeur.id);

      const state = etats.get(meilleurCascadeur.id)!;

      // Si le cascadeur change de rôle, réinitialiser le compteur
      if (
        state.dernierRoleSpectacleId !== poste.spectacleId ||
        state.dernierRoleId !== poste.roleId
      ) {
        state.joursDansRoleActuel = 0;
      }

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
    for (const c of disponibles) {
      if (!assignesCeJour.has(c.id)) {
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "repos" },
        });
        const state = etats.get(c.id)!;
        state.joursDepuisDernierRepos = 0;
        state.joursDansRoleActuel = 0;
        state.dernierRoleSpectacleId = null;
        state.dernierRoleId = null;
      }
    }
  }

  // ── Étape 6 : REPAIR PASS — Équilibrage final ──
  // Équilibrer SÉPARÉMENT par typeRepos (5j/1 et 6j/1).
  // Chaque swap vérifie les contraintes de repos obligatoire.

  const entreesIndex = new Map<string, EntreePlanning>();
  for (const e of entrees) {
    entreesIndex.set(`${e.date}|${e.cascadeurId}`, e);
  }
  const allDates = Array.from(new Set(entrees.map((e) => e.date))).sort();

  // Helper : vérifier si un cascadeur peut travailler un jour donné
  // (vérifie les contraintes de repos consécutifs)
  function peutTravaillerLe(
    cascadeurId: string,
    dateStr: string
  ): boolean {
    const cascadeur = cascadeursActifs.find((c) => c.id === cascadeurId);
    if (!cascadeur) return false;
    const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);

    // Trouver l'index de ce jour dans allDates
    const dateIdx = allDates.indexOf(dateStr);
    if (dateIdx < 0) return false;

    // Compter les jours de travail consécutifs AVANT cette date
    let consecutifs = 0;
    for (let i = dateIdx - 1; i >= 0; i--) {
      const e = entreesIndex.get(`${allDates[i]}|${cascadeurId}`);
      if (e && e.assignation.type === "travail") {
        consecutifs++;
      } else {
        break;
      }
    }
    return consecutifs < maxJours;
  }

  // Équilibrer chaque groupe typeRepos séparément
  for (const typeRepos of ["6j/1", "5j/1"]) {
    const membresGroupe = cascadeursActifs.filter(
      (c) => c.typeRepos === typeRepos
    );
    if (membresGroupe.length === 0) continue;

    const REPAIR_MAX_ITER = 200;
    let repairIter = 0;
    let ecartActuel = Infinity;

    while (repairIter < REPAIR_MAX_ITER) {
      repairIter++;

      // Recalculer les totaux du groupe
      const totaux = new Map<string, number>();
      for (const c of membresGroupe) {
        totaux.set(c.id, 0);
      }
      for (const e of entrees) {
        if (
          e.assignation.type === "travail" &&
          membresGroupe.some((c) => c.id === e.cascadeurId)
        ) {
          totaux.set(e.cascadeurId, (totaux.get(e.cascadeurId) || 0) + 1);
        }
      }

      const sorted = membresGroupe
        .map((c) => ({
          id: c.id,
          total: totaux.get(c.id) || 0,
          cascadeur: c,
        }))
        .sort((a, b) => a.total - b.total);

      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const nouvelEcart = max.total - min.total;

      if (nouvelEcart <= 1) break;
      if (ecartActuel !== Infinity && nouvelEcart >= ecartActuel) break;
      ecartActuel = nouvelEcart;

      let swapped = false;

      // Stratégie 1 : swap direct MAX travail ↔ MIN repos le même jour
      for (const dateStr of allDates) {
        if (max.total - min.total <= 1) break;
        const entryMax = entreesIndex.get(`${dateStr}|${max.id}`);
        const entryMin = entreesIndex.get(`${dateStr}|${min.id}`);

        if (!entryMax || !entryMin) continue;
        if (entryMax.assignation.type !== "travail") continue;
        if (entryMin.assignation.type !== "repos") continue;

        const { spectacleId, roleId } = entryMax.assignation;
        if (!getPriorite(min.cascadeur, spectacleId, roleId)) continue;
        if (isAbsent(min.cascadeur, dateStr)) continue;

        // Vérifier contraintes de repos pour min
        if (!peutTravaillerLe(min.id, dateStr)) continue;

        // SWAP : max → repos, min → travail
        entryMax.assignation = { type: "repos" };
        entryMin.assignation = { type: "travail", spectacleId, roleId };
        max.total--;
        min.total++;
        swapped = true;
      }

      // Stratégie 2 : swap en chaîne via cascadeur médian
      if (!swapped && max.total - min.total > 1) {
        for (const dateStr of allDates) {
          if (max.total - min.total <= 1) break;
          const entryMax = entreesIndex.get(`${dateStr}|${max.id}`);
          if (!entryMax || entryMax.assignation.type !== "travail") continue;

          const { spectacleId, roleId } = entryMax.assignation;

          for (const mid of sorted) {
            if (mid.id === max.id || mid.id === min.id) continue;
            if (mid.total >= max.total - 1) continue;
            const entryMid = entreesIndex.get(`${dateStr}|${mid.id}`);
            if (!entryMid || entryMid.assignation.type !== "repos") continue;
            if (!getPriorite(mid.cascadeur, spectacleId, roleId)) continue;
            if (isAbsent(mid.cascadeur, dateStr)) continue;

            // Vérifier contraintes de repos pour mid
            if (!peutTravaillerLe(mid.id, dateStr)) continue;

            entryMax.assignation = { type: "repos" };
            entryMid.assignation = { type: "travail", spectacleId, roleId };
            max.total--;
            mid.total++;
            swapped = true;
            break;
          }
        }
      }

      if (!swapped) break;
    }
  }

  // ── Étape 7 : Rapport d'équité ──
  // Recalculer les totaux finaux
  const totauxFinaux = new Map<string, number>();
  for (const c of cascadeursActifs) {
    totauxFinaux.set(c.id, 0);
  }
  for (const e of entrees) {
    if (e.assignation.type === "travail") {
      totauxFinaux.set(e.cascadeurId, (totauxFinaux.get(e.cascadeurId) || 0) + 1);
    }
  }

  // Grouper par typeRepos et vérifier l'équité
  const groupes = new Map<string, typeof cascadeursActifs>();
  for (const c of cascadeursActifs) {
    if (!groupes.has(c.typeRepos)) groupes.set(c.typeRepos, []);
    groupes.get(c.typeRepos)!.push(c);
  }

  for (const [typeRepos, membres] of groupes) {
    const vals = membres.map((c) => ({
      cascadeur: c,
      total: totauxFinaux.get(c.id) || 0,
    }));
    const minVal = Math.min(...vals.map((v) => v.total));
    const maxVal = Math.max(...vals.map((v) => v.total));
    const ecart = maxVal - minVal;

    if (ecart > 1) {
      // Inéquité détectée → expliquer pourquoi
      const trop = vals.filter((v) => v.total === maxVal);
      const peu = vals.filter((v) => v.total === minVal);

      rapport.push({
        type: "warning",
        message: `Équité ${typeRepos} non atteinte (écart ${ecart} jours) : ${trop.map((v) => v.cascadeur.prenom + " " + v.cascadeur.nom + " (" + v.total + "j)").join(", ")} travaillent plus que ${peu.map((v) => v.cascadeur.prenom + " " + v.cascadeur.nom + " (" + v.total + "j)").join(", ")}.`,
      });

      // Analyser pourquoi : quels rôles ne peuvent pas être swappés ?
      for (const t of trop) {
        // Pour chaque entrée travail de ce cascadeur, vérifier s'il a des remplaçants
        for (const e of entrees) {
          if (e.cascadeurId !== t.cascadeur.id || e.assignation.type !== "travail") continue;
          const { spectacleId, roleId } = e.assignation;
          const spectacle = spectaclesSaison.find((s) => s.id === spectacleId);
          const role = spectacle?.roles.find((r) => r.id === roleId);
          if (!spectacle || !role) continue;

          const remplaçantsPotentiels = membres.filter(
            (m) =>
              m.id !== t.cascadeur.id &&
              getPriorite(m, spectacleId, roleId) !== null &&
              !isAbsent(m, e.date)
          );

          if (remplaçantsPotentiels.length === 0) {
            rapport.push({
              type: "warning",
              message: `${t.cascadeur.prenom} ${t.cascadeur.nom} est surchargé(e) car le rôle "${role.nom}" de "${spectacle.nom}" n'a pas assez de remplaçants disponibles. Ajoutez des cascadeurs avec ce rôle (primaire ou secondaire) pour rééquilibrer.`,
            });
            break; // Un seul message par cascadeur surchargé
          }
        }
      }
    } else {
      rapport.push({
        type: "info",
        message: `Équité ${typeRepos} : OK (écart ≤ 1 jour, min=${minVal}, max=${maxVal}).`,
      });
    }
  }

  // Compter les postes non remplis
  // On vérifie si tous les postes ont été pourvus chaque jour
  let postesNonRemplis = 0;
  for (const jour of jours) {
    const dateStr = format(jour, "yyyy-MM-dd");
    const jourSemaine = getJourSemaine(dateStr);
    const entreesJour = entrees.filter((e) => e.date === dateStr);

    for (const spectacle of spectaclesSaison) {
      if (
        spectacle.joursDiffusion &&
        spectacle.joursDiffusion.length > 0 &&
        !spectacle.joursDiffusion.includes(jourSemaine)
      ) {
        continue;
      }
      for (const role of spectacle.roles) {
        const nbAssignes = entreesJour.filter(
          (e) =>
            e.assignation.type === "travail" &&
            e.assignation.spectacleId === spectacle.id &&
            e.assignation.roleId === role.id
        ).length;
        if (nbAssignes < role.nbCascadeursRequis) {
          postesNonRemplis += role.nbCascadeursRequis - nbAssignes;
        }
      }
    }
  }

  if (postesNonRemplis > 0) {
    rapport.push({
      type: "warning",
      message: `${postesNonRemplis} poste(s) n'ont pas pu être rempli(s) sur la saison. Cela signifie qu'il n'y a pas assez de cascadeurs disponibles pour couvrir tous les rôles. Ajoutez des cascadeurs ou réduisez le nombre de rôles requis.`,
    });
  }

  return {
    planning: {
      id: uuidv4(),
      saisonId: saison.id,
      entrees,
      dateGeneration: new Date().toISOString(),
    },
    rapport,
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
    }
  }

  return conflits;
}
