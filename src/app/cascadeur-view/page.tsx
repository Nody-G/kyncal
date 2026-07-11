"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getCascadeurs,
  getSpectacles,
  getSaisons,
  getPlannings,
} from "@/lib/store";
import type {
  Cascadeur,
  Spectacle,
  Saison,
  Planning,
  EntreePlanning,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  User,
  CalendarDays,
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

export default function CascadeurViewPage() {
  const [cascadeurs, setCascadeurs] = useState<Cascadeur[]>([]);
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [selectedCascadeurId, setSelectedCascadeurId] = useState<string>("");
  const [selectedSaisonId, setSelectedSaisonId] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  useEffect(() => {
    setCascadeurs(getCascadeurs());
    setSpectacles(getSpectacles());
    setSaisons(getSaisons());
    setPlannings(getPlannings());
  }, []);

  const selectedCascadeur = cascadeurs.find((c) => c.id === selectedCascadeurId);
  const selectedSaison = saisons.find((s) => s.id === selectedSaisonId);

  // Trouver le planning pour la saison sélectionnée
  const planning = plannings.find((p) => p.saisonId === selectedSaisonId);

  // Quand on sélectionne une saison, aller au début
  useEffect(() => {
    if (selectedSaison) {
      setCurrentWeekStart(
        startOfWeek(parseISO(selectedSaison.dateDebut), { weekStartsOn: 1 })
      );
    }
  }, [selectedSaisonId, selectedSaison]);

  // Jours de la semaine courante
  const weekDays = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  }, [currentWeekStart]);

  // Entrées du cascadeur pour la semaine
  const entreesSemaine = useMemo(() => {
    if (!planning || !selectedCascadeurId) return [];
    const dates = weekDays.map((d) => format(d, "yyyy-MM-dd"));
    return planning.entrees.filter(
      (e) => e.cascadeurId === selectedCascadeurId && dates.includes(e.date)
    );
  }, [planning, selectedCascadeurId, weekDays]);

  // Toutes les entrées du cascadeur
  const toutesEntrees = useMemo(() => {
    if (!planning || !selectedCascadeurId) return [];
    return planning.entrees.filter(
      (e) => e.cascadeurId === selectedCascadeurId
    );
  }, [planning, selectedCascadeurId]);

  // Stats
  const stats = useMemo(() => {
    const travail = toutesEntrees.filter(
      (e) => e.assignation.type === "travail"
    ).length;
    const repos = toutesEntrees.filter(
      (e) => e.assignation.type === "repos"
    ).length;
    const absences = toutesEntrees.filter(
      (e) => e.assignation.type === "absent"
    ).length;

    // Par spectacle
    const parSpectacle = new Map<string, number>();
    for (const entry of toutesEntrees) {
      if (entry.assignation.type === "travail") {
        const id = entry.assignation.spectacleId;
        parSpectacle.set(id, (parSpectacle.get(id) || 0) + 1);
      }
    }

    return { travail, repos, absences, parSpectacle };
  }, [toutesEntrees]);

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

  function getEntreeLabel(entry: EntreePlanning): string {
    if (entry.assignation.type === "repos") return "REPOS";
    if (entry.assignation.type === "absent")
      return `ABS (${entry.assignation.motif})`;
    return getRoleName(
      entry.assignation.spectacleId,
      entry.assignation.roleId
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <User className="h-8 w-8" />
          Vue Cascadeur
        </h1>
        <p className="text-muted-foreground">
          Consultez le planning d&apos;un cascadeur spécifique
        </p>
      </div>

      {/* Sélection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Cascadeur</label>
              <Select
                value={selectedCascadeurId}
                onValueChange={(v) => v && setSelectedCascadeurId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un cascadeur" />
                </SelectTrigger>
                <SelectContent>
                  {cascadeurs
                    .filter((c) => c.actif)
                    .sort((a, b) => a.nom.localeCompare(b.nom))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.prenom} {c.nom}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Saison</label>
              <Select
                value={selectedSaisonId}
                onValueChange={(v) => v && setSelectedSaisonId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une saison" />
                </SelectTrigger>
                <SelectContent>
                  {saisons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCascadeur && planning && (
        <>
          {/* Info cascadeur + stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{stats.travail}</div>
                <p className="text-xs text-muted-foreground">Jours travail</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{stats.repos}</div>
                <p className="text-xs text-muted-foreground">Jours repos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{stats.absences}</div>
                <p className="text-xs text-muted-foreground">Absences</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-sm font-bold">
                  <Badge variant="outline">{selectedCascadeur.typeRepos}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Type de repos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Répartition par spectacle */}
          {stats.parSpectacle.size > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Répartition par spectacle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {[...stats.parSpectacle.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([spectacleId, count]) => (
                      <div
                        key={spectacleId}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: getSpectacleColor(spectacleId),
                          }}
                        />
                        <span className="text-sm font-medium">
                          {getSpectacleName(spectacleId)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {count}j
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation semaine */}
          <div className="flex items-center justify-between">
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
          </div>

          {/* Vue semaine */}
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 divide-x">
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const entry = entreesSemaine.find(
                    (e) => e.date === dateStr
                  );
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateStr}
                      className={`p-4 min-h-[120px] ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="text-center mb-3">
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: fr })}
                        </div>
                        <div
                          className={`text-lg font-semibold ${
                            isToday ? "text-primary" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                      </div>

                      {entry ? (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="w-full justify-center text-xs"
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
                          {entry.assignation.type === "travail" && (
                            <p className="text-xs text-center text-muted-foreground">
                              {getSpectacleName(
                                entry.assignation.spectacleId
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-center text-muted-foreground">
                          -
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Absences à venir */}
          {selectedCascadeur.absences.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Absences enregistrées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedCascadeur.absences.map((a) => (
                    <Badge key={a.id} variant="destructive">
                      {a.dateDebut} → {a.dateFin} ({a.motif})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedCascadeurId && (
        <Card>
          <CardContent className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Sélectionnez un cascadeur</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez un cascadeur et une saison pour voir son planning.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
