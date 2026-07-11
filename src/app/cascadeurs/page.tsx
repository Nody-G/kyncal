"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getCascadeurs,
  saveCascadeur,
  deleteCascadeur,
  getSpectacles,
} from "@/lib/store";
import type { Cascadeur, Spectacle, TypeRepos, RoleCascadeur, PrioriteRole, MotifAbsence } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function CascadeursPage() {
  const [cascadeurs, setCascadeurs] = useState<Cascadeur[]>([]);
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCascadeur, setEditingCascadeur] = useState<Cascadeur | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Absence form state
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [absenceCascadeurId, setAbsenceCascadeurId] = useState<string>("");
  const [absenceDateDebut, setAbsenceDateDebut] = useState("");
  const [absenceDateFin, setAbsenceDateFin] = useState("");
  const [absenceMotif, setAbsenceMotif] = useState("");

  // Form state
  const [formNom, setFormNom] = useState("");
  const [formPrenom, setFormPrenom] = useState("");
  const [formTypeRepos, setFormTypeRepos] = useState<TypeRepos>("6j/1");
  const [formActif, setFormActif] = useState(true);
  const [formRoles, setFormRoles] = useState<RoleCascadeur[]>([]);

  const reload = useCallback(() => {
    setCascadeurs(getCascadeurs());
    setSpectacles(getSpectacles());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredCascadeurs = cascadeurs.filter(
    (c) =>
      c.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.prenom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function openCreateDialog() {
    setEditingCascadeur(null);
    setFormNom("");
    setFormPrenom("");
    setFormTypeRepos("6j/1");
    setFormActif(true);
    setFormRoles([]);
    setDialogOpen(true);
  }

  function openEditDialog(cascadeur: Cascadeur) {
    setEditingCascadeur(cascadeur);
    setFormNom(cascadeur.nom);
    setFormPrenom(cascadeur.prenom);
    setFormTypeRepos(cascadeur.typeRepos);
    setFormActif(cascadeur.actif);
    setFormRoles([...cascadeur.roles]);
    setDialogOpen(true);
  }

  function handleSave() {
    const cascadeur: Omit<Cascadeur, "id"> & { id?: string } = {
      id: editingCascadeur?.id,
      nom: formNom.trim(),
      prenom: formPrenom.trim(),
      typeRepos: formTypeRepos,
      actif: formActif,
      roles: formRoles,
      absences: editingCascadeur?.absences || [],
    };

    if (!cascadeur.nom || !cascadeur.prenom) return;

    saveCascadeur(cascadeur);
    setDialogOpen(false);
    reload();
  }

  function handleDelete() {
    if (deletingId) {
      deleteCascadeur(deletingId);
      setDeletingId(null);
      setDeleteDialogOpen(false);
      reload();
    }
  }

  function addRole() {
    setFormRoles([
      ...formRoles,
      {
        spectacleId: spectacles[0]?.id || "",
        roleId: spectacles[0]?.roles[0]?.id || "",
        priorite: "primaire" as PrioriteRole,
      },
    ]);
  }

  function updateRole(index: number, updates: Partial<RoleCascadeur>) {
    const newRoles = [...formRoles];
    newRoles[index] = { ...newRoles[index], ...updates };
    setFormRoles(newRoles);
  }

  function removeRole(index: number) {
    setFormRoles(formRoles.filter((_, i) => i !== index));
  }

  function getSpectacleName(id: string) {
    return spectacles.find((s) => s.id === id)?.nom || "Inconnu";
  }

  function getRoleName(spectacleId: string, roleId: string) {
    const spectacle = spectacles.find((s) => s.id === spectacleId);
    return spectacle?.roles.find((r) => r.id === roleId)?.nom || "Inconnu";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cascadeurs</h1>
          <p className="text-muted-foreground">
            Gérez vos cascadeurs, leurs rôles et contraintes de repos
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <UserPlus className="mr-2 h-4 w-4" />
          Ajouter un cascadeur
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un cascadeur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredCascadeurs.length} cascadeur
            {filteredCascadeurs.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCascadeurs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {cascadeurs.length === 0
                ? "Aucun cascadeur enregistré. Commencez par en ajouter un !"
                : "Aucun résultat pour cette recherche."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Repos</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCascadeurs.map((c) => (
                  <>
                    <TableRow key={c.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setExpandedId(expandedId === c.id ? null : c.id)
                          }
                        >
                          {expandedId === c.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{c.nom}</TableCell>
                      <TableCell>{c.prenom}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.typeRepos}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              Aucun
                            </span>
                          ) : (
                            c.roles.slice(0, 3).map((r, i) => (
                              <Badge
                                key={i}
                                variant={
                                  r.priorite === "primaire"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {getRoleName(r.spectacleId, r.roleId)}
                              </Badge>
                            ))
                          )}
                          {c.roles.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{c.roles.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.actif ? "default" : "destructive"}>
                          {c.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingId(c.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded details */}
                    {expandedId === c.id && (
                      <TableRow key={`${c.id}-detail`}>
                        <TableCell colSpan={7}>
                          <div className="py-3 px-2 space-y-3">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">
                                Tous les rôles
                              </h4>
                              {c.roles.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Aucun rôle attribué
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {c.roles.map((r, i) => (
                                    <Badge
                                      key={i}
                                      variant={
                                        r.priorite === "primaire"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {getSpectacleName(r.spectacleId)} →{" "}
                                      {getRoleName(r.spectacleId, r.roleId)}{" "}
                                      ({r.priorite})
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Absences */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold">
                                  Absences ({c.absences.length})
                                </h4>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setAbsenceCascadeurId(c.id);
                                    setAbsenceDateDebut("");
                                    setAbsenceDateFin("");
                                    setAbsenceMotif("");
                                    setAbsenceDialogOpen(true);
                                  }}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Ajouter
                                </Button>
                              </div>
                              {c.absences.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Aucune absence enregistrée
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {c.absences.map((a) => (
                                    <div
                                      key={a.id}
                                      className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge variant="destructive" className="text-xs">
                                          {a.dateDebut} → {a.dateFin}
                                        </Badge>
                                        <span className="text-muted-foreground">
                                          {a.motif}
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          const updated = {
                                            ...c,
                                            absences: c.absences.filter(
                                              (ab) => ab.id !== a.id
                                            ),
                                          };
                                          saveCascadeur(updated);
                                          reload();
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingCascadeur ? "Modifier le cascadeur" : "Nouveau cascadeur"}
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du cascadeur et attribuez-lui des
              rôles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={formPrenom}
                  onChange={(e) => setFormPrenom(e.target.value)}
                  placeholder="Jean"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de repos</Label>
                <Select
                  value={formTypeRepos}
                  onValueChange={(v) => v && setFormTypeRepos(v as TypeRepos)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6j/1">6 jours travaillés / 1 repos</SelectItem>
                    <SelectItem value="5j/1">5 jours travaillés / 1 repos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Label>Actif</Label>
                <Switch checked={formActif} onCheckedChange={setFormActif} />
              </div>
            </div>

            {/* Roles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rôles attribués</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRole}
                  disabled={spectacles.length === 0}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Ajouter un rôle
                </Button>
              </div>

              {spectacles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Créez d&apos;abord un spectacle avec des rôles pour pouvoir les
                  attribuer.
                </p>
              )}

              {formRoles.map((role, index) => {
                const spectacle = spectacles.find(
                  (s) => s.id === role.spectacleId
                );
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    <Select
                      value={role.spectacleId}
                      onValueChange={(v) => {
                        if (!v) return;
                        const sp = spectacles.find((s) => s.id === v);
                        updateRole(index, {
                          spectacleId: v,
                          roleId: sp?.roles[0]?.id || "",
                        });
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue>
                          {(val) => getSpectacleName(val || role.spectacleId)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {spectacles.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={role.roleId}
                      onValueChange={(v) =>
                        v && updateRole(index, { roleId: v })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue>
                          {(val) => getRoleName(role.spectacleId, val || role.roleId)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {spectacle?.roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={role.priorite}
                      onValueChange={(v) =>
                        v && updateRole(index, {
                          priorite: v as PrioriteRole,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primaire">⭐ Primaire</SelectItem>
                        <SelectItem value="secondaire">Secondaire</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRole(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formNom.trim() || !formPrenom.trim()}>
              {editingCascadeur ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce cascadeur ? Cette action est
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

      {/* Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une absence</DialogTitle>
            <DialogDescription>
              Enregistrez une période d&apos;absence pour ce cascadeur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="abs-debut">Date de début</Label>
                <Input
                  id="abs-debut"
                  type="date"
                  value={absenceDateDebut}
                  onChange={(e) => setAbsenceDateDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abs-fin">Date de fin</Label>
                <Input
                  id="abs-fin"
                  type="date"
                  value={absenceDateFin}
                  onChange={(e) => setAbsenceDateFin(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motif</Label>
              <Select
                value={absenceMotif}
                onValueChange={(v) => v && setAbsenceMotif(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un motif" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maladie">Maladie</SelectItem>
                  <SelectItem value="blessure">Blessure</SelectItem>
                  <SelectItem value="conges">Congés</SelectItem>
                  <SelectItem value="formation">Formation</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAbsenceDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (
                  !absenceCascadeurId ||
                  !absenceDateDebut ||
                  !absenceDateFin ||
                  !absenceMotif
                )
                  return;
                if (absenceDateFin < absenceDateDebut) return;

                const cascadeur = cascadeurs.find(
                  (c) => c.id === absenceCascadeurId
                );
                if (!cascadeur) return;

                const nouvelleAbsence = {
                  id: uuidv4(),
                  dateDebut: absenceDateDebut,
                  dateFin: absenceDateFin,
                  motif: absenceMotif as MotifAbsence,
                };

                saveCascadeur({
                  ...cascadeur,
                  absences: [...cascadeur.absences, nouvelleAbsence],
                });
                setAbsenceDialogOpen(false);
                reload();
              }}
              disabled={
                !absenceDateDebut ||
                !absenceDateFin ||
                !absenceMotif ||
                absenceDateFin < absenceDateDebut
              }
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
