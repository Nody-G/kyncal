"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getCascadeurs,
  getSpectacles,
  saveCascadeur,
} from "@/lib/store";
import type {
  Cascadeur,
  Spectacle,
  RoleSpectacle,
  PrioriteRole,
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
import { Users, UserPlus, Star, Shield, Trash2 } from "lucide-react";

interface RoleAffectation {
  cascadeurId: string;
  priorite: PrioriteRole;
}

export default function RolesPage() {
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [cascadeurs, setCascadeurs] = useState<Cascadeur[]>([]);
  const [selectedSpectacleId, setSelectedSpectacleId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addRoleId, setAddRoleId] = useState<string>("");
  const [addPriorite, setAddPriorite] = useState<PrioriteRole>("primaire");
  const [addCascadeurId, setAddCascadeurId] = useState<string>("");

  const reload = useCallback(() => {
    setSpectacles(getSpectacles());
    setCascadeurs(getCascadeurs());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const spectaclesActifs = spectacles.filter((s) => s.actif);
  const selectedSpectacle = spectacles.find((s) => s.id === selectedSpectacleId);

  // Pour un rôle donné, trouver tous les cascadeurs affectés
  function getAffectations(
    spectacleId: string,
    roleId: string
  ): RoleAffectation[] {
    const result: RoleAffectation[] = [];
    for (const c of cascadeurs) {
      for (const r of c.roles) {
        if (r.spectacleId === spectacleId && r.roleId === roleId) {
          result.push({ cascadeurId: c.id, priorite: r.priorite });
        }
      }
    }
    return result;
  }

  // Cascadeurs disponibles pour un rôle (qui ne l'ont pas déjà)
  function getCascadeursDisponibles(
    spectacleId: string,
    roleId: string
  ): Cascadeur[] {
    return cascadeurs.filter(
      (c) =>
        c.actif &&
        !c.roles.some(
          (r) => r.spectacleId === spectacleId && r.roleId === roleId
        )
    );
  }

  function handleAddRole() {
    if (!addCascadeurId || !addRoleId || !selectedSpectacleId) return;

    const cascadeur = cascadeurs.find((c) => c.id === addCascadeurId);
    if (!cascadeur) return;

    // Vérifier si le cascadeur a déjà ce rôle avec une autre priorité
    const existing = cascadeur.roles.find(
      (r) =>
        r.spectacleId === selectedSpectacleId && r.roleId === addRoleId
    );

    let newRoles;
    if (existing) {
      // Mettre à jour la priorité
      newRoles = cascadeur.roles.map((r) =>
        r.spectacleId === selectedSpectacleId && r.roleId === addRoleId
          ? { ...r, priorite: addPriorite }
          : r
      );
    } else {
      newRoles = [
        ...cascadeur.roles,
        {
          spectacleId: selectedSpectacleId,
          roleId: addRoleId,
          priorite: addPriorite,
        },
      ];
    }

    saveCascadeur({ ...cascadeur, roles: newRoles });
    setAddDialogOpen(false);
    setAddCascadeurId("");
    reload();
  }

  function handleRemoveRole(
    cascadeurId: string,
    spectacleId: string,
    roleId: string
  ) {
    const cascadeur = cascadeurs.find((c) => c.id === cascadeurId);
    if (!cascadeur) return;

    const newRoles = cascadeur.roles.filter(
      (r) => !(r.spectacleId === spectacleId && r.roleId === roleId)
    );
    saveCascadeur({ ...cascadeur, roles: newRoles });
    reload();
  }

  function getCascadeurName(id: string): string {
    const c = cascadeurs.find((c) => c.id === id);
    return c ? `${c.prenom} ${c.nom}` : "?";
  }

  function openAddDialog(roleId: string) {
    setAddRoleId(roleId);
    setAddPriorite("primaire");
    setAddCascadeurId("");
    setAddDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rôles</h1>
          <p className="text-muted-foreground">
            Consultez et gérez les affectations des cascadeurs par spectacle et
            rôle
          </p>
        </div>
      </div>

      {/* Sélection de spectacle */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium">Spectacle</label>
            <Select
              value={selectedSpectacleId}
              onValueChange={(v) => v && setSelectedSpectacleId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un spectacle">
                  {(val) => {
                    const s = spectaclesActifs.find((x) => x.id === val);
                    return s ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: s.couleur }}
                        />
                        {s.nom}
                      </span>
                    ) : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {spectaclesActifs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.couleur }}
                      />
                      {s.nom}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rôles du spectacle sélectionné */}
      {selectedSpectacle && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {selectedSpectacle.roles.map((role) => {
            const affectations = getAffectations(
              selectedSpectacle.id,
              role.id
            );
            const primaires = affectations.filter(
              (a) => a.priorite === "primaire"
            );
            const secondaires = affectations.filter(
              (a) => a.priorite === "secondaire"
            );

            return (
              <Card key={role.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{role.nom}</CardTitle>
                      {role.description && (
                        <CardDescription className="mt-1">
                          {role.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline">
                      {role.nbCascadeursRequis} requis
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Primaires */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Primaires</span>
                      <span className="text-xs text-muted-foreground">
                        ({primaires.length})
                      </span>
                    </div>
                    {primaires.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-5">
                        Aucun cascadeur assigné
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {primaires.map((a) => (
                          <div
                            key={a.cascadeurId}
                            className="flex items-center justify-between pl-5 group"
                          >
                            <span className="text-sm">
                              {getCascadeurName(a.cascadeurId)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                handleRemoveRole(
                                  a.cascadeurId,
                                  selectedSpectacle.id,
                                  role.id
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Secondaires */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Secondaires</span>
                      <span className="text-xs text-muted-foreground">
                        ({secondaires.length})
                      </span>
                    </div>
                    {secondaires.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-5">
                        Aucun cascadeur assigné
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {secondaires.map((a) => (
                          <div
                            key={a.cascadeurId}
                            className="flex items-center justify-between pl-5 group"
                          >
                            <span className="text-sm">
                              {getCascadeurName(a.cascadeurId)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                handleRemoveRole(
                                  a.cascadeurId,
                                  selectedSpectacle.id,
                                  role.id
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bouton ajouter */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openAddDialog(role.id)}
                  >
                    <UserPlus className="mr-2 h-3 w-3" />
                    Ajouter un cascadeur
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!selectedSpectacleId && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p>Sélectionnez un spectacle pour voir ses rôles et affectations.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog d'ajout de cascadeur à un rôle */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un cascadeur</DialogTitle>
            <DialogDescription>
              {selectedSpectacle && (
                <>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: selectedSpectacle.couleur }}
                  />
                  {selectedSpectacle.nom} —{" "}
                  {selectedSpectacle.roles.find((r) => r.id === addRoleId)?.nom}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cascadeur</label>
              <Select
                value={addCascadeurId}
                onValueChange={(v) => v && setAddCascadeurId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un cascadeur">
                    {(val) => {
                      const c = cascadeurs.find((x) => x.id === val);
                      return c ? `${c.prenom} ${c.nom}` : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {getCascadeursDisponibles(
                    selectedSpectacleId,
                    addRoleId
                  ).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.prenom} {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priorité</label>
              <Select
                value={addPriorite}
                onValueChange={(v) => v && setAddPriorite(v as PrioriteRole)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(val) =>
                      val === "primaire" ? "⭐ Primaire" : "Secondaire"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primaire">⭐ Primaire</SelectItem>
                  <SelectItem value="secondaire">Secondaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddRole} disabled={!addCascadeurId}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
