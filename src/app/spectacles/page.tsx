"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSpectacles,
  saveSpectacle,
  deleteSpectacle,
} from "@/lib/store";
import type { Spectacle, RoleSpectacle, JourSemaine } from "@/types";
import { JOURS_SEMAINE, JOUR_SEMAINE_LABELS } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
  Theater,
  Users,
  CalendarDays,
} from "lucide-react";

const COULEURS_PREDEFINIES = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
];

export default function SpectaclesPage() {
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSpectacle, setEditingSpectacle] = useState<Spectacle | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formNom, setFormNom] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCouleur, setFormCouleur] = useState(COULEURS_PREDEFINIES[0]);
  const [formActif, setFormActif] = useState(true);
  const [formRoles, setFormRoles] = useState<RoleSpectacle[]>([]);
  const [formJoursDiffusion, setFormJoursDiffusion] = useState<JourSemaine[]>([]);

  const reload = useCallback(() => {
    setSpectacles(getSpectacles());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = spectacles.filter((s) =>
    s.nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function openCreateDialog() {
    setEditingSpectacle(null);
    setFormNom("");
    setFormDescription("");
    setFormCouleur(COULEURS_PREDEFINIES[0]);
    setFormActif(true);
    setFormRoles([]);
    setFormJoursDiffusion([]);
    setDialogOpen(true);
  }

  function openEditDialog(spectacle: Spectacle) {
    setEditingSpectacle(spectacle);
    setFormNom(spectacle.nom);
    setFormDescription(spectacle.description || "");
    setFormCouleur(spectacle.couleur);
    setFormActif(spectacle.actif);
    setFormRoles([...spectacle.roles]);
    setFormJoursDiffusion([...(spectacle.joursDiffusion || [])]);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formNom.trim()) return;

    const spectacle: Omit<Spectacle, "id"> & { id?: string } = {
      id: editingSpectacle?.id,
      nom: formNom.trim(),
      description: formDescription.trim() || undefined,
      couleur: formCouleur,
      actif: formActif,
      roles: formRoles,
      joursDiffusion: formJoursDiffusion,
    };

    saveSpectacle(spectacle);
    setDialogOpen(false);
    reload();
  }

  function handleDelete() {
    if (deletingId) {
      deleteSpectacle(deletingId);
      setDeletingId(null);
      setDeleteDialogOpen(false);
      reload();
    }
  }

  function addRole() {
    setFormRoles([
      ...formRoles,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        nom: "",
        description: "",
        nbCascadeursRequis: 1,
      },
    ]);
  }

  function updateRole(index: number, updates: Partial<RoleSpectacle>) {
    const newRoles = [...formRoles];
    newRoles[index] = { ...newRoles[index], ...updates };
    setFormRoles(newRoles);
  }

  function removeRole(index: number) {
    setFormRoles(formRoles.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spectacles</h1>
          <p className="text-muted-foreground">
            Gérez les spectacles du parc et leurs rôles
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un spectacle
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un spectacle..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid of cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            {spectacles.length === 0
              ? "Aucun spectacle enregistré. Créez votre premier spectacle !"
              : "Aucun résultat pour cette recherche."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="relative overflow-hidden">
              {/* Color accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: s.couleur }}
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Theater className="h-5 w-5" style={{ color: s.couleur }} />
                    <CardTitle className="text-lg">{s.nom}</CardTitle>
                  </div>
                  <Badge variant={s.actif ? "default" : "destructive"}>
                    {s.actif ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                {s.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {s.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Roles list */}
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium mb-2">
                    <Users className="h-4 w-4" />
                    Rôles ({s.roles.length})
                  </div>
                  {s.roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun rôle défini
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs">
                          {r.nom} ({r.nbCascadeursRequis} cascadeur
                          {r.nbCascadeursRequis > 1 ? "s" : ""})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Jours de diffusion */}
                {s.joursDiffusion && s.joursDiffusion.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-sm font-medium mb-1">
                      <CalendarDays className="h-4 w-4" />
                      Jours de diffusion
                    </div>
                    <div className="flex gap-1">
                      {JOURS_SEMAINE.map((jour) => (
                        <span
                          key={jour}
                          className={`px-2 py-0.5 rounded text-xs ${
                            s.joursDiffusion.includes(jour)
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {JOUR_SEMAINE_LABELS[jour]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-1 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(s)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Modifier
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingId(s.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-1 h-3 w-3 text-destructive" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSpectacle ? "Modifier le spectacle" : "Nouveau spectacle"}
            </DialogTitle>
            <DialogDescription>
              Définissez le spectacle et ses rôles avec le nombre de cascadeurs
              requis par rôle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du spectacle</Label>
              <Input
                id="nom"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex : La Grande Cascade"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description du spectacle..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-2">
                  {COULEURS_PREDEFINIES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        formCouleur === color
                          ? "border-primary scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormCouleur(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Label>Actif</Label>
                <Switch checked={formActif} onCheckedChange={setFormActif} />
              </div>
            </div>

            {/* Jours de diffusion */}
            <div className="space-y-2">
              <Label>Jours de diffusion</Label>
              <p className="text-xs text-muted-foreground">
                Sélectionnez les jours de la semaine où ce spectacle est joué.
              </p>
              <div className="flex flex-wrap gap-2">
                {JOURS_SEMAINE.map((jour) => {
                  const selected = formJoursDiffusion.includes(jour);
                  return (
                    <button
                      key={jour}
                      type="button"
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setFormJoursDiffusion(
                          selected
                            ? formJoursDiffusion.filter((j) => j !== jour)
                            : [...formJoursDiffusion, jour]
                        );
                      }}
                    >
                      {JOUR_SEMAINE_LABELS[jour]}
                    </button>
                  );
                })}
              </div>
              {formJoursDiffusion.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Aucun jour sélectionné — le spectacle ne sera pas planifié.
                </p>
              )}
            </div>

            {/* Roles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Rôles du spectacle</Label>
                <Button variant="outline" size="sm" onClick={addRole}>
                  <Plus className="mr-1 h-3 w-3" />
                  Ajouter un rôle
                </Button>
              </div>

              {formRoles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun rôle ajouté. Cliquez sur &quot;Ajouter un rôle&quot; pour
                  commencer.
                </p>
              )}

              {formRoles.map((role, index) => (
                <div
                  key={role.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Nom du rôle (ex: Cascadeur principal)"
                      value={role.nom}
                      onChange={(e) =>
                        updateRole(index, { nom: e.target.value })
                      }
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={role.nbCascadeursRequis}
                      onChange={(e) =>
                        updateRole(index, {
                          nbCascadeursRequis: parseInt(e.target.value) || 1,
                        })
                      }
                      title="Nombre de cascadeurs requis"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRole(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!formNom.trim()}>
              {editingSpectacle ? "Enregistrer" : "Créer"}
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
              Êtes-vous sûr de vouloir supprimer ce spectacle et tous ses rôles ?
              Les rôles attribués aux cascadeurs seront aussi supprimés. Cette
              action est irréversible.
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
