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
  reposPrisCycle: number; // repos pris dans le cycle actuel (6 ou 5 jours)
  joursDepuisDernierRepos: number;
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
      return false; // n'a pas atteint le minimum dans le rôle actuel
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
      return false; // a atteint le maximum dans ce rôle
    }
  }

  return true;
}

/**
 * Calcule le score de priorité pour attribuer un cascadeur à un rôle
 * Score plus bas = meilleure priorité
 */
function calculerScore(
  cascadeur: Cascadeur,
  state: CascadeurState,
  spectacleId: string,
  roleId: string,
  contraintes: ContrainteEnchainement[],
  dateStr: string
): number {
  // Ne peut pas jouer ce rôle → score infini
  const priorite = peutJouerRole(cascadeur, spectacleId, roleId);
  if (!priorite) return Infinity;

  // Absent → score infini
  if (isAbsent(cascadeur, dateStr)) return Infinity;

  // Doit prendre un repos aujourd'hui
  const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);
  if (state.joursDepuisDernierRepos >= maxJours) return Infinity;

  // Ne respecte pas les contraintes d'enchaînement
  if (!respecteEnchainement(state, spectacleId, roleId, contraintes))
    return Infinity;

  let score = 0;

  // Primaire a priorité sur secondaire
  if (priorite === "primaire") score -= 1000;
  else score -= 500;

  // Bonus si le cascadeur est déjà dans ce rôle (continuité)
  if (
    state.dernierRoleSpectacleId === spectacleId &&
    state.dernierRoleId === roleId
  ) {
    score -= 200; // forte préférence pour la continuité
  }

  // Moins de jours depuis le dernier repos = moins urgent de repos
  score += state.joursDepuisDernierRepos * 10;

  // Moins de jours travaillés consécutifs = mieux réparti
  score += state.joursTravaillesConsecutifs * 5;

  return score;
}

// ============================================================
// ALGORITHME PRINCIPAL
// ============================================================

/**
 * Génère un planning complet pour une saison
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
    });
  }

  const entrees: EntreePlanning[] = [];
  // Map: "date_spectacleId_roleId" → cascadeurIds assignés
  const assignations = new Map<string, string[]>();

  for (const jour of jours) {
    const dateStr = format(jour, "yyyy-MM-dd");

    // ---- Étape 1 : Gérer les absences ----
    for (const c of cascadeursActifs) {
      if (isAbsent(c, dateStr)) {
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "absent", motif: c.absences.find((a) => dateStr >= a.dateDebut && dateStr <= a.dateFin)!.motif },
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

    // ---- Étape 2 : Déterminer qui DOIT prendre un repos ----
    const cascadeursDisponibles = cascadeursActifs.filter(
      (c) => !isAbsent(c, dateStr)
    );

    const cascadeursDoiventReposer: Set<string> = new Set();
    const cascadeursPeuventTravailler: typeof cascadeursActifs = [];

    for (const c of cascadeursDisponibles) {
      const state = etats.get(c.id)!;
      const maxJours = getMaxJoursAvantRepos(c.typeRepos);

      if (state.joursDepuisDernierRepos >= maxJours) {
        cascadeursDoiventReposer.add(c.id);
        // Assigner le repos
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "repos" },
        });
        // Mettre à jour l'état
        state.joursTravaillesConsecutifs = 0;
        state.joursReposConsecutifs = 1;
        state.joursDepuisDernierRepos = 0;
        state.joursDansRoleActuel = 0;
        state.dernierRoleSpectacleId = null;
        state.dernierRoleId = null;
      } else {
        cascadeursPeuventTravailler.push(c);
      }
    }

    // ---- Étape 3 : Assigner les rôles pour chaque spectacle ----
    const jourSemaine = getJourSemaine(dateStr);
    for (const spectacle of spectaclesSaison) {
      // Ne planifier que les jours de diffusion du spectacle
      if (
        spectacle.joursDiffusion &&
        spectacle.joursDiffusion.length > 0 &&
        !spectacle.joursDiffusion.includes(jourSemaine)
      ) {
        continue; // Ce spectacle ne joue pas ce jour
      }

      for (const role of spectacle.roles) {
        const key = `${dateStr}_${spectacle.id}_${role.id}`;
        const assignes: string[] = [];

        // Combien de cascadeurs sont nécessaires ?
        const nbRequis = role.nbCascadeursRequis;

        // Trier les cascadeurs disponibles par score (meilleur d'abord)
        const candidats = cascadeursPeuventTravailler
          .filter((c) => !assignes.includes(c.id))
          .map((c) => ({
            cascadeur: c,
            score: calculerScore(
              c,
              etats.get(c.id)!,
              spectacle.id,
              role.id,
              config.contraintesEnchainement,
              dateStr
            ),
          }))
          .filter((c) => c.score < Infinity)
          .sort((a, b) => a.score - b.score);

        for (const candidat of candidats) {
          if (assignes.length >= nbRequis) break;

          assignes.push(candidat.cascadeur.id);

          const state = etats.get(candidat.cascadeur.id)!;

          // Si le cascadeur change de rôle, réinitialiser le compteur
          if (
            state.dernierRoleSpectacleId !== spectacle.id ||
            state.dernierRoleId !== role.id
          ) {
            state.joursDansRoleActuel = 0;
          }

          state.joursTravaillesConsecutifs++;
          state.joursReposConsecutifs = 0;
          state.joursDepuisDernierRepos++;
          state.joursDansRoleActuel++;
          state.dernierRoleSpectacleId = spectacle.id;
          state.dernierRoleId = role.id;

          entrees.push({
            date: dateStr,
            cascadeurId: candidat.cascadeur.id,
            assignation: {
              type: "travail",
              spectacleId: spectacle.id,
              roleId: role.id,
            },
          });
        }

        assignations.set(key, assignes);
      }
    }

    // ---- Étape 4 : Les cascadeurs non assignés prennent un repos ----
    const tousAssignes = new Set<string>();
    for (const entry of entrees.filter((e) => e.date === dateStr)) {
      tousAssignes.add(entry.cascadeurId);
    }

    for (const c of cascadeursPeuventTravailler) {
      if (!tousAssignes.has(c.id)) {
        entrees.push({
          date: dateStr,
          cascadeurId: c.id,
          assignation: { type: "repos" },
        });
        const state = etats.get(c.id)!;
        state.joursTravaillesConsecutifs = 0;
        state.joursReposConsecutifs++;
        // Le repos ne réinitialise pas joursDepuisDernierRepos
        // car il n'a pas travaillé
      }
    }
  }

  return {
    id: uuidv4(),
    saisonId: saison.id,
    entrees,
    dateGeneration: new Date().toISOString(),
  };
}

/**
 * Recalcule partiellement un planning suite à une absence
 * Ne modifie que les jours affectés et les cascadeurs impactés
 */
export function recalculPartiel(
  planning: Planning,
  cascadeurId: string,
  dateDebut: string,
  dateFin: string,
  saison: Saison,
  spectacles: Spectacle[],
  cascadeurs: Cascadeur[],
  config: AlgorithmeConfig
): Planning {
  // Pour l'instant, on régénère tout
  // TODO: implémenter le vrai recalcul partiel
  const nouveauPlanning = genererPlanning(
    saison,
    spectacles,
    cascadeurs,
    config
  );
  nouveauPlanning.id = planning.id; // garder le même ID
  return nouveauPlanning;
}

// ============================================================
// DÉTECTION DE CONFLITS
// ============================================================

export interface Conflit {
  type: "repos_manque" | "double_assignation" | "role_indisponible" | "absence_travaille";
  date: string;
  cascadeurId: string;
  message: string;
}

/**
 * Détecte les conflits dans un planning existant
 */
export function detecterConflits(
  planning: Planning,
  cascadeurs: Cascadeur[],
  spectacles: Spectacle[],
  contraintes: ContrainteEnchainement[]
): Conflit[] {
  const conflits: Conflit[] = [];

  // Grouper les entrées par date
  const parDate = new Map<string, EntreePlanning[]>();
  for (const entry of planning.entrees) {
    if (!parDate.has(entry.date)) parDate.set(entry.date, []);
    parDate.get(entry.date)!.push(entry);
  }

  // Vérifier les double-assignations (même cascadeur, même jour, 2x travail)
  for (const [date, entries] of parDate) {
    const parCascadeur = new Map<string, EntreePlanning[]>();
    for (const entry of entries) {
      if (!parCascadeur.has(entry.cascadeurId)) parCascadeur.set(entry.cascadeurId, []);
      parCascadeur.get(entry.cascadeurId)!.push(entry);
    }

    for (const [cascadeurId, entreesC] of parCascadeur) {
      const travaux = entreesC.filter((e) => e.assignation.type === "travail");
      if (travaux.length > 1) {
        conflits.push({
          type: "double_assignation",
          date,
          cascadeurId,
          message: `${getCascadeurName(cascadeurs, cascadeurId)} est assigné à ${travaux.length} spectacles le ${date}`,
        });
      }
    }
  }

  // Vérifier les repos manquants
  const dates = [...parDate.keys()].sort();
  for (const cascadeur of cascadeurs.filter((c) => c.actif)) {
    let joursConsecutifs = 0;
    const maxJours = getMaxJoursAvantRepos(cascadeur.typeRepos);

    for (const date of dates) {
      const entries = parDate.get(date)?.filter((e) => e.cascadeurId === cascadeur.id) || [];
      const entry = entries[0];

      if (!entry) continue;

      if (entry.assignation.type === "travail") {
        joursConsecutifs++;
        if (joursConsecutifs > maxJours) {
          conflits.push({
            type: "repos_manque",
            date,
            cascadeurId: cascadeur.id,
            message: `${getCascadeurName(cascadeurs, cascadeur.id)} travaille depuis ${joursConsecutifs} jours (max: ${maxJours})`,
          });
        }
      } else {
        joursConsecutifs = 0;
      }
    }
  }

  return conflits;
}

function getCascadeurName(cascadeurs: Cascadeur[], id: string): string {
  const c = cascadeurs.find((c) => c.id === id);
  return c ? `${c.prenom} ${c.nom}` : id;
}
