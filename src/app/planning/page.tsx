"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getSaisons,
  getSpectacles,
  getCascadeurs,
  getPlanningBySaison,
  savePlanning,
  deletePlanning,
} from "@/lib/store";
import { genererPlanning, detecterConflits } from "@/lib/planning-algorithm";
import type { Conflit } from "@/lib/planning-algorithm";
import { exportCSV, exportExcel, exportPDF } from "@/lib/export";
import type {
  Saison,
  Spectacle,
  Cascadeur,
  Planning,
  EntreePlanning,
  ContrainteEnchainement,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Play,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Settings2,
} from "lucide-react";
import {
  format,
  parseISO,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";

export default function PlanningPage() {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [cascadeurs, setCascadeurs] = useState<Cascadeur[]>([]);
  const [selectedSaisonId, setSelectedSaisonId] = useState<string>("");
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [viewMode, setViewMode] = useState<"calendrier" | "cascadeur">("calendrier");
  const [showContraintes, setShowContraintes] = useState(false);
  const [contraintes, setContraintes] = useState<ContrainteEnchainement[]>([]);

  const reload = useCallback(() => {
    setSaisons(getSaisons());
    setSpectacles(getSpectacles());
    setCascadeurs(getCascadeurs());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Charger le planning quand la saison change
  useEffect(() => {
    if (selectedSaisonId) {
      const existing = getPlanningBySaison(selectedSaisonId);
      setPlanning(existing || null);
      const saison = saisons.find((s) => s.id === selectedSaisonId);
      if (saison) {
        setCurrentWeekStart(
          startOfWeek(parseISO(saison.dateDebut), { weekStartsOn: 1 })
        );
      }
    } else {
      setPlanning(null);
    }
  }, [selectedSaisonId, saisons]);

  const selectedSaison = saisons.find((s) => s.id === selectedSaisonId);
  const spectaclesSaison = spectacles.filter(
    (s) => selectedSaison?.spectacleIds.includes(s.id)
  );

  // Initialiser les contraintes quand les spectacles de la saison changent
  useEffect(() => {
    if (spectaclesSaison.length === 0) {
      setContraintes([]);
      return;
    }
    setContraintes((prev) => {
      const nouvelles: ContrainteEnchainement[] = [];
      for (const sp of spectaclesSaison) {
        for (const role of sp.roles) {
          const existante = prev.find(
            (c) => c.spectacleId === sp.id && c.roleId === role.id
          );
          nouvelles.push({
            spectacleId: sp.id,
            roleId: role.id,
            joursMin: existante?.joursMin ?? 3,
            joursMax: existante?.joursMax ?? 14,
          });
        }
      }
      return nouvelles;
    });
  }, [spectaclesSaison]);

  // Jours de la semaine courante
  const weekDays = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  }, [currentWeekStart]);

  // Entrées pour la semaine courante
  const entreesSemaine = useMemo(() => {
    if (!planning) return [];
    const dates = weekDays.map((d) => format(d, "yyyy-MM-dd"));
    return planning.entrees.filter((e) => dates.includes(e.date));
  }, [planning, weekDays]);

  // Map date → entrées
  const entreesParDate = useMemo(() => {
    const map = new Map<string, EntreePlanning[]>();
    for (const entry of entreesSemaine) {
      if (!map.has(entry.date)) map.set(entry.date, []);
      map.get(entry.date)!.push(entry);
    }
    return map;
  }, [entreesSemaine]);

  function handleGenerate() {
    if (!selectedSaison) return;

    setGenerating(true);

    // Petit délai pour montrer le loading
    setTimeout(() => {
      const nouveauPlanning = genererPlanning(
        selectedSaison,
        spectacles,
        cascadeurs,
        { contraintesEnchainement: contraintes }
      );

      savePlanning(nouveauPlanning);
      setPlanning(nouveauPlanning);
      setGenerating(false);
    }, 100);
  }

  function handleDelete() {
    if (planning) {
      deletePlanning(planning.id);
      setPlanning(null);
      setDeleteDialogOpen(false);
    }
  }

  function getSpectacleColor(spectacleId: string): string {
    return spectacles.find((s) => s.id === spectacleId)?.couleur || "#888";
  }

  function getSpectacleName(spectacleId: string): string {
    return spectacles.find((s) => s.id === spectacleId)?.nom || "?";
  }

  function getRoleName(spectacleId: string, roleId: string): string {
    const sp = spectacles.find((s) => s.id === spectacleId);
    return sp?.roles.find((r) => r.id === roleId)?.nom || "?";
  }

  function getCascadeurName(id: string): string {
    const c = cascadeurs.find((c) => c.id === id);
    return c ? `${c.prenom} ${c.nom}` : "?";
  }

  function getEntreeLabel(entry: EntreePlanning): string {
    if (entry.assignation.type === "repos") return "REPOS";
    if (entry.assignation.type === "absent") return `ABS (${entry.assignation.motif})`;
    return getRoleName(entry.assignation.spectacleId, entry.assignation.roleId);
  }

  function getEntreeColor(entry: EntreePlanning): string {
    if (entry.assignation.type === "repos") return "bg-muted text-muted-foreground";
    if (entry.assignation.type === "absent") return "bg-destructive/20 text-destructive";
    const color = getSpectacleColor(entry.assignation.spectacleId);
    return "";
  }

  // Stats rapides
  const stats = useMemo(() => {
    if (!planning) return null;
    const total = planning.entrees.length;
    const travail = planning.entrees.filter((e) => e.assignation.type === "travail").length;
    const repos = planning.entrees.filter((e) => e.assignation.type === "repos").length;
    const absents = planning.entrees.filter((e) => e.assignation.type === "absent").length;
    return { total, travail, repos, absents };
  }, [planning]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning</h1>
          <p className="text-muted-foreground">
            Générez et consultez les plannings de vos cascadeurs
          </p>
        </div>
      </div>

      {/* Sélection de saison + actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Saison</label>
              <Select
                value={selectedSaisonId}
                onValueChange={(v) => v && setSelectedSaisonId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une saison">
                    {(val) => {
                      const s = saisons.find((x) => x.id === val);
                      return s ? s.nom : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {saisons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nom} ({format(parseISO(s.dateDebut), "dd/MM")} -{" "}
                      {format(parseISO(s.dateFin), "dd/MM")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSaisonId && (
              <>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || spectaclesSaison.length === 0}
                >
                  {generating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {planning ? "Régénérer" : "Générer le planning"}
                </Button>

                {planning && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>

                    <div className="flex gap-1 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          selectedSaison &&
                          exportCSV(planning, cascadeurs, spectacles, selectedSaison)
                        }
                      >
                        <Download className="mr-1 h-3 w-3" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          selectedSaison &&
                          exportExcel(planning, cascadeurs, spectacles, selectedSaison)
                        }
                      >
                        <FileSpreadsheet className="mr-1 h-3 w-3" />
                        Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          selectedSaison &&
                          exportPDF(planning, cascadeurs, spectacles, selectedSaison)
                        }
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {selectedSaison && spectaclesSaison.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Aucun spectacle actif dans cette saison.
            </div>
          )}

          {/* Contraintes d'enchaînement */}
          {selectedSaisonId && spectaclesSaison.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowContraintes(!showContraintes)}
              >
                <Settings2 className="h-4 w-4" />
                Contraintes d&apos;enchaînement (jours consécutifs par rôle)
                {showContraintes ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showContraintes && (
                <div className="mt-3 space-y-3 border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Définissez le nombre minimum et maximum de jours consécutifs qu&apos;un cascadeur passe dans chaque rôle avant de pouvoir changer.
                  </p>
                  {spectaclesSaison.map((sp) => (
                    <div key={sp.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: sp.couleur }}
                        />
                        <span className="text-sm font-semibold">{sp.nom}</span>
                      </div>
                      <div className="ml-5 space-y-2">
                        {sp.roles.map((role) => {
                          const contrainte = contraintes.find(
                            (c) => c.spectacleId === sp.id && c.roleId === role.id
                          );
                          const min = contrainte?.joursMin ?? 3;
                          const max = contrainte?.joursMax ?? 14;

                          return (
                            <div
                              key={role.id}
                              className="flex items-center gap-3 text-sm"
                            >
                              <span className="w-32 truncate">{role.nom}</span>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-muted-foreground">Min</label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={max}
                                  value={min}
                                  onChange={(e) => {
                                    const val = Math.max(1, Math.min(max, parseInt(e.target.value) || 1));
                                    setContraintes((prev) =>
                                      prev.map((c) =>
                                        c.spectacleId === sp.id && c.roleId === role.id
                                          ? { ...c, joursMin: val }
                                          : c
                                      )
                                    );
                                  }}
                                  className="w-16 h-8 text-center"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-muted-foreground">Max</label>
                                <Input
                                  type="number"
                                  min={min}
                                  max={60}
                                  value={max}
                                  onChange={(e) => {
                                    const val = Math.max(min, Math.min(60, parseInt(e.target.value) || min));
                                    setContraintes((prev) =>
                                      prev.map((c) =>
                                        c.spectacleId === sp.id && c.roleId === role.id
                                          ? { ...c, joursMax: val }
                                          : c
                                      )
                                    );
                                  }}
                                  className="w-16 h-8 text-center"
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">jours</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{stats.travail}</div>
              <p className="text-xs text-muted-foreground">Jours de travail</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{stats.repos}</div>
              <p className="text-xs text-muted-foreground">Jours de repos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{stats.absents}</div>
              <p className="text-xs text-muted-foreground">Absences</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">
                {planning?.entrees
                  ? new Set(
                      planning.entrees
                        .filter((e) => e.assignation.type === "travail")
                        .map((e) => e.date)
                    ).size
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">Jours couverts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conflits */}
      {planning && (() => {
        const contraintes = spectaclesSaison.flatMap((sp) =>
          sp.roles.map((r) => ({
            spectacleId: sp.id,
            roleId: r.id,
            joursMin: 3,
            joursMax: 14,
          }))
        );
        const conflits = detecterConflits(planning, cascadeurs, spectacles, contraintes);
        if (conflits.length === 0) return null;
        return (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {conflits.length} conflit{conflits.length > 1 ? "s" : ""} détecté{conflits.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {conflits.slice(0, 10).map((c, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                    • {c.message}
                  </p>
                ))}
                {conflits.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    ... et {conflits.length - 10} autres conflits
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Vue toggle + navigation semaine */}
      {planning && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "calendrier" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendrier")}
            >
              Vue calendrier
            </Button>
            <Button
              variant={viewMode === "cascadeur" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("cascadeur")}
            >
              Vue par cascadeur
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {format(currentWeekStart, "d MMM", { locale: fr })} -{" "}
              {format(
                endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
                "d MMM yyyy",
                { locale: fr }
              )}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                selectedSaison &&
                setCurrentWeekStart(
                  startOfWeek(parseISO(selectedSaison.dateDebut), {
                    weekStartsOn: 1,
                  })
                )
              }
            >
              Début saison
            </Button>
          </div>
        </div>
      )}

      {/* Vue Calendrier */}
      {planning && viewMode === "calendrier" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[120px]">
                      Cascadeur
                    </th>
                    {weekDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isToday = isSameDay(day, new Date());
                      return (
                        <th
                          key={dateStr}
                          className={`p-3 text-center text-sm font-medium min-w-[100px] ${
                            isToday ? "bg-primary/10" : ""
                          }`}
                        >
                          <div>{format(day, "EEE", { locale: fr })}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(day, "d MMM", { locale: fr })}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {cascadeurs
                    .filter((c) => c.actif)
                    .sort((a, b) => a.nom.localeCompare(b.nom))
                    .map((c) => (
                      <tr key={c.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm font-medium sticky left-0 bg-card z-10">
                          {c.prenom} {c.nom}
                          <div className="text-xs text-muted-foreground">
                            {c.typeRepos}
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const entry = entreesParDate
                            .get(dateStr)
                            ?.find((e) => e.cascadeurId === c.id);
                          const isToday = isSameDay(day, new Date());

                          return (
                            <td
                              key={dateStr}
                              className={`p-2 text-center text-xs ${
                                isToday ? "bg-primary/5" : ""
                              }`}
                            >
                              {entry ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-normal whitespace-nowrap"
                                  style={
                                    entry.assignation.type === "travail"
                                      ? {
                                          borderColor: getSpectacleColor(
                                            entry.assignation.spectacleId
                                          ),
                                          color: getSpectacleColor(
                                            entry.assignation.spectacleId
                                          ),
                                        }
                                      : undefined
                                  }
                                >
                                  {getEntreeLabel(entry)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vue par Cascadeur */}
      {planning && viewMode === "cascadeur" && (
        <div className="space-y-4">
          {cascadeurs
            .filter((c) => c.actif)
            .sort((a, b) => a.nom.localeCompare(b.nom))
            .map((c) => {
              const entreesCascadeur = planning.entrees.filter(
                (e) => e.cascadeurId === c.id
              );
              const joursTravail = entreesCascadeur.filter(
                (e) => e.assignation.type === "travail"
              ).length;
              const joursRepos = entreesCascadeur.filter(
                (e) => e.assignation.type === "repos"
              ).length;
              const joursAbsence = entreesCascadeur.filter(
                (e) => e.assignation.type === "absent"
              ).length;

              return (
                <Card key={c.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {c.prenom} {c.nom}
                        </CardTitle>
                        <CardDescription>
                          Repos {c.typeRepos} • {joursTravail}j travail •{" "}
                          {joursRepos}j repos • {joursAbsence}j absence
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {weekDays.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const entry = entreesCascadeur.find(
                          (e) => e.date === dateStr
                        );
                        return (
                          <div
                            key={dateStr}
                            className="flex flex-col items-center min-w-[60px]"
                          >
                            <span className="text-xs text-muted-foreground">
                              {format(day, "EEE d", { locale: fr })}
                            </span>
                            {entry ? (
                              <Badge
                                variant="outline"
                                className="text-xs mt-1"
                                style={
                                  entry.assignation.type === "travail"
                                    ? {
                                        borderColor: getSpectacleColor(
                                          entry.assignation.spectacleId
                                        ),
                                        color: getSpectacleColor(
                                          entry.assignation.spectacleId
                                        ),
                                      }
                                    : undefined
                                }
                              >
                                {getEntreeLabel(entry)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground mt-1">
                                -
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Empty state */}
      {!planning && selectedSaisonId && (
        <Card>
          <CardContent className="text-center py-12">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucun planning généré</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cliquez sur &quot;Générer le planning&quot; pour créer automatiquement
              le calendrier de la saison.
            </p>
          </CardContent>
        </Card>
      )}

      {!selectedSaisonId && (
        <Card>
          <CardContent className="text-center py-12">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Sélectionnez une saison</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez une saison dans le menu déroulant ci-dessus pour
              commencer.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le planning</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce planning ? Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
