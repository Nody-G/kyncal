// ============================================================
// Kyncal — Store de données local
// Utilise localStorage côté client + API routes pour persister
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type {
  Cascadeur,
  Spectacle,
  Saison,
  Planning,
  Absence,
  RoleCascadeur,
  RoleSpectacle,
} from "@/types";

const STORAGE_KEYS = {
  cascadeurs: "kyncal_cascadeurs",
  spectacles: "kyncal_spectacles",
  saisons: "kyncal_saisons",
  plannings: "kyncal_plannings",
} as const;

// ---- Helpers localStorage ----

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================================
// CASCADEURS
// ============================================================

export function getCascadeurs(): Cascadeur[] {
  return loadFromStorage<Cascadeur>(STORAGE_KEYS.cascadeurs);
}

export function getCascadeur(id: string): Cascadeur | undefined {
  return getCascadeurs().find((c) => c.id === id);
}

export function saveCascadeur(cascadeur: Omit<Cascadeur, "id"> & { id?: string }): Cascadeur {
  const cascadeurs = getCascadeurs();
  const id = cascadeur.id || uuidv4();
  const updated: Cascadeur = { ...cascadeur, id };
  const index = cascadeurs.findIndex((c) => c.id === id);

  if (index >= 0) {
    cascadeurs[index] = updated;
  } else {
    cascadeurs.push(updated);
  }

  saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
  return updated;
}

export function deleteCascadeur(id: string): void {
  const cascadeurs = getCascadeurs().filter((c) => c.id !== id);
  saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
}

// ---- Absences ----

export function addAbsence(
  cascadeurId: string,
  absence: Omit<Absence, "id">
): Absence | null {
  const cascadeurs = getCascadeurs();
  const cascadeur = cascadeurs.find((c) => c.id === cascadeurId);
  if (!cascadeur) return null;

  const newAbsence: Absence = { ...absence, id: uuidv4() };
  cascadeur.absences.push(newAbsence);
  saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
  return newAbsence;
}

export function removeAbsence(cascadeurId: string, absenceId: string): void {
  const cascadeurs = getCascadeurs();
  const cascadeur = cascadeurs.find((c) => c.id === cascadeurId);
  if (!cascadeur) return;

  cascadeur.absences = cascadeur.absences.filter((a) => a.id !== absenceId);
  saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
}

// ---- Rôles cascadeur ----

export function addRoleCascadeur(
  cascadeurId: string,
  role: RoleCascadeur
): void {
  const cascadeurs = getCascadeurs();
  const cascadeur = cascadeurs.find((c) => c.id === cascadeurId);
  if (!cascadeur) return;

  // Éviter les doublons
  const exists = cascadeur.roles.some(
    (r) =>
      r.spectacleId === role.spectacleId &&
      r.roleId === role.roleId &&
      r.priorite === role.priorite
  );
  if (!exists) {
    cascadeur.roles.push(role);
    saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
  }
}

export function removeRoleCascadeur(
  cascadeurId: string,
  spectacleId: string,
  roleId: string
): void {
  const cascadeurs = getCascadeurs();
  const cascadeur = cascadeurs.find((c) => c.id === cascadeurId);
  if (!cascadeur) return;

  cascadeur.roles = cascadeur.roles.filter(
    (r) => !(r.spectacleId === spectacleId && r.roleId === roleId)
  );
  saveToStorage(STORAGE_KEYS.cascadeurs, cascadeurs);
}

// ============================================================
// SPECTACLES
// ============================================================

export function getSpectacles(): Spectacle[] {
  return loadFromStorage<Spectacle>(STORAGE_KEYS.spectacles);
}

export function getSpectacle(id: string): Spectacle | undefined {
  return getSpectacles().find((s) => s.id === id);
}

export function saveSpectacle(
  spectacle: Omit<Spectacle, "id"> & { id?: string }
): Spectacle {
  const spectacles = getSpectacles();
  const id = spectacle.id || uuidv4();
  const updated: Spectacle = { ...spectacle, id };
  const index = spectacles.findIndex((s) => s.id === id);

  if (index >= 0) {
    spectacles[index] = updated;
  } else {
    spectacles.push(updated);
  }

  saveToStorage(STORAGE_KEYS.spectacles, spectacles);
  return updated;
}

export function deleteSpectacle(id: string): void {
  const spectacles = getSpectacles().filter((s) => s.id !== id);
  saveToStorage(STORAGE_KEYS.spectacles, spectacles);
}

// ---- Rôles spectacle ----

export function addRoleSpectacle(
  spectacleId: string,
  role: Omit<RoleSpectacle, "id">
): RoleSpectacle | null {
  const spectacles = getSpectacles();
  const spectacle = spectacles.find((s) => s.id === spectacleId);
  if (!spectacle) return null;

  const newRole: RoleSpectacle = { ...role, id: uuidv4() };
  spectacle.roles.push(newRole);
  saveToStorage(STORAGE_KEYS.spectacles, spectacles);
  return newRole;
}

export function updateRoleSpectacle(
  spectacleId: string,
  roleId: string,
  updates: Partial<Omit<RoleSpectacle, "id">>
): void {
  const spectacles = getSpectacles();
  const spectacle = spectacles.find((s) => s.id === spectacleId);
  if (!spectacle) return;

  const role = spectacle.roles.find((r) => r.id === roleId);
  if (!role) return;

  Object.assign(role, updates);
  saveToStorage(STORAGE_KEYS.spectacles, spectacles);
}

export function removeRoleSpectacle(
  spectacleId: string,
  roleId: string
): void {
  const spectacles = getSpectacles();
  const spectacle = spectacles.find((s) => s.id === spectacleId);
  if (!spectacle) return;

  spectacle.roles = spectacle.roles.filter((r) => r.id !== roleId);
  saveToStorage(STORAGE_KEYS.spectacles, spectacles);
}

// ============================================================
// SAISONS
// ============================================================

export function getSaisons(): Saison[] {
  return loadFromStorage<Saison>(STORAGE_KEYS.saisons);
}

export function getSaison(id: string): Saison | undefined {
  return getSaisons().find((s) => s.id === id);
}

export function saveSaison(
  saison: Omit<Saison, "id"> & { id?: string }
): Saison {
  const saisons = getSaisons();
  const id = saison.id || uuidv4();
  const updated: Saison = { ...saison, id };
  const index = saisons.findIndex((s) => s.id === id);

  if (index >= 0) {
    saisons[index] = updated;
  } else {
    saisons.push(updated);
  }

  saveToStorage(STORAGE_KEYS.saisons, saisons);
  return updated;
}

export function deleteSaison(id: string): void {
  const saisons = getSaisons().filter((s) => s.id !== id);
  saveToStorage(STORAGE_KEYS.saisons, saisons);
}

// ============================================================
// PLANNINGS
// ============================================================

export function getPlannings(): Planning[] {
  return loadFromStorage<Planning>(STORAGE_KEYS.plannings);
}

export function getPlanning(id: string): Planning | undefined {
  return getPlannings().find((p) => p.id === id);
}

export function getPlanningBySaison(saisonId: string): Planning | undefined {
  return getPlannings().find((p) => p.saisonId === saisonId);
}

export function savePlanning(
  planning: Omit<Planning, "id"> & { id?: string }
): Planning {
  const plannings = getPlannings();
  const id = planning.id || uuidv4();
  const updated: Planning = { ...planning, id };
  const index = plannings.findIndex((p) => p.id === id);

  if (index >= 0) {
    plannings[index] = updated;
  } else {
    plannings.push(updated);
  }

  saveToStorage(STORAGE_KEYS.plannings, plannings);
  return updated;
}

export function deletePlanning(id: string): void {
  const plannings = getPlannings().filter((p) => p.id !== id);
  saveToStorage(STORAGE_KEYS.plannings, plannings);
}

// ============================================================
// EXPORT / IMPORT complet
// ============================================================

export function exportAllData(): string {
  const data = {
    cascadeurs: getCascadeurs(),
    spectacles: getSpectacles(),
    saisons: getSaisons(),
    plannings: getPlannings(),
    exportDate: new Date().toISOString(),
    version: "1.0.0",
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.cascadeurs) saveToStorage(STORAGE_KEYS.cascadeurs, data.cascadeurs);
    if (data.spectacles) saveToStorage(STORAGE_KEYS.spectacles, data.spectacles);
    if (data.saisons) saveToStorage(STORAGE_KEYS.saisons, data.saisons);
    if (data.plannings) saveToStorage(STORAGE_KEYS.plannings, data.plannings);
    return true;
  } catch {
    return false;
  }
}
