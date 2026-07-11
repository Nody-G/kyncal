// ============================================================
// Kyncal — Types de données
// ============================================================

export type TypeRepos = "6j/1" | "5j/1";

export type PrioriteRole = "primaire" | "secondaire";

export type JourSemaine = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche";

export const JOURS_SEMAINE: JourSemaine[] = [
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
];

export const JOUR_SEMAINE_LABELS: Record<JourSemaine, string> = {
  lundi: "Lun",
  mardi: "Mar",
  mercredi: "Mer",
  jeudi: "Jeu",
  vendredi: "Ven",
  samedi: "Sam",
  dimanche: "Dim",
};

export function getJourSemaine(dateStr: string): JourSemaine {
  const day = new Date(dateStr + "T00:00:00").getDay();
  // JS: 0=dim, 1=lun, ..., 6=sam
  const map: JourSemaine[] = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return map[day];
}

export type MotifAbsence =
  | "maladie"
  | "blessure"
  | "conges"
  | "formation"
  | "personnel"
  | "autre";

// ---- Cascadeur ----

export interface RoleCascadeur {
  spectacleId: string;
  roleId: string;
  priorite: PrioriteRole;
}

export interface Absence {
  id: string;
  dateDebut: string; // ISO date YYYY-MM-DD
  dateFin: string;   // ISO date YYYY-MM-DD
  motif: MotifAbsence;
  commentaire?: string;
}

export interface Cascadeur {
  id: string;
  nom: string;
  prenom: string;
  typeRepos: TypeRepos;
  roles: RoleCascadeur[];
  absences: Absence[];
  actif: boolean;
}

// ---- Spectacle ----

export interface RoleSpectacle {
  id: string;
  nom: string;
  description?: string;
  nbCascadeursRequis: number; // combien de cascadeurs simultanés pour ce rôle
}

export interface Spectacle {
  id: string;
  nom: string;
  description?: string;
  roles: RoleSpectacle[];
  couleur: string; // hex color pour le calendrier
  joursDiffusion: JourSemaine[]; // jours de la semaine où le spectacle joue
  actif: boolean;
}

// ---- Saison ----

export interface Saison {
  id: string;
  nom: string;
  dateDebut: string; // ISO date YYYY-MM-DD
  dateFin: string;   // ISO date YYYY-MM-DD
  spectacleIds: string[]; // spectacles inclus dans cette saison
}

// ---- Planning ----

export type TypeEntree =
  | { type: "travail"; spectacleId: string; roleId: string }
  | { type: "repos" }
  | { type: "absent"; motif: MotifAbsence };

export interface EntreePlanning {
  date: string; // ISO date YYYY-MM-DD
  cascadeurId: string;
  assignation: TypeEntree;
}

export interface Planning {
  id: string;
  saisonId: string;
  entrees: EntreePlanning[];
  dateGeneration: string; // ISO datetime
}

// ---- Contraintes d'enchaînement ----

export interface ContrainteEnchainement {
  spectacleId: string;
  roleId: string;
  joursMin: number; // minimum de jours consécutifs dans ce rôle
  joursMax: number; // maximum de jours consécutifs dans ce rôle
}
