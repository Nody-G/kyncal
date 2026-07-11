"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSaisons,
  saveSaison,
  deleteSaison,
  getSpectacles,
} from "@/lib/store";
import type { Saison, Spectacle } from "@/types";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarRange,
  Theater,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export default function SaisonsPage() {
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSaison, setEditingSaison] = useState<Saison | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formNom, setFormNom] = useState("");
  const [formDateDebut, setFormDateDebut] = useState("");
  const [formDateFin, setFormDateFin] = useState("");
  const [formSpectacleIds, setFormSpectacleIds] = useState<string[]>([]);

  const reload = useCallback(() => {
    setSaisons(getSaisons());
    setSpectacles(getSpectacles());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function openCreateDialog() {
    setEditingSaison(null);
    setFormNom("");
    setFormDateDebut("");
    setFormDateFin("");
    setFormSpectacleIds([]);
    setDialogOpen(true);
  }

  function openEditDialog(saison: Saison) {
    setEditingSaison(saison);
    setFormNom(saison.nom);
    setFormDateDebut(saison.dateDebut);
    setFormDateFin(saison.dateFin);
    setFormSpectacleIds([...saison.spectacleIds]);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formNom.trim() || !formDateDebut || !formDateFin) return;

    const saison: Omit<Saison, "id"> & { id?: string } = {
      id: editingSaison?.id,
      nom: formNom.trim(),
      dateDebut: formDateDebut,
      dateFin: formDateFin,
      spectacleIds: formSpectacleIds,
    };

    saveSaison(saison);
    setDialogOpen(false);
    reload();
  }

  function handleDelete() {
    if (deletingId) {
      deleteSaison(deletingId);
      setDeletingId(null);
      setDeleteDialogOpen(false);
      reload();
    }
  }

  function toggleSpectacle(id: string) {
    setFormSpectacleIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function getSpectacleName(id: string) {
    return spectacles.find((s) => s.id === id)?.nom || "Inconnu";
  }

  function getSpectacleColor(id: string) {
    return spectacles.find((s) => s.id === id)?.couleur || "#888";
  }

  function getDurationDays(debut: string, fin: string) {
    const d = parseISO(debut);
    const f = parseISO(fin);
    return Math.ceil((f.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saisons</h1>
          <p className="text-muted-foreground">
            Configurez les périodes de spectacles et les spectacles inclus
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={spectacles.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Créer une saison
        </Button>
      </div>

      {spectacles.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Créez d&apos;abord des spectacles avant de configurer une saison.
          </CardContent>
        </Card>
      )}

      {/* Saisons list */}
      {saisons.length === 0 && spectacles.length > 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            Aucune saison configurée. Créez votre première saison !
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {saisons.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-5 w-5 text-primary" />
                    <CardTitle>{s.nom}</CardTitle>
                  </div>
                  <Badge variant="outline">
                    {getDurationDays(s.dateDebut, s.dateFin)} jours
                  </Badge>
                </div>
                <CardDescription>
                  Du{" "}
                  {format(parseISO(s.dateDebut), "d MMMM yyyy", { locale: fr })}{" "}
                  au{" "}
                  {format(parseISO(s.dateFin), "d MMMM yyyy", { locale: fr })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium mb-2">
                    <Theater className="h-4 w-4" />
                    Spectacles ({s.spectacleIds.length})
                  </div>
                  {s.spectacleIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun spectacle sélectionné
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.spectacleIds.map((id) => (
                        <Badge
                          key={id}
                          style={{
                            backgroundColor: getSpectacleColor(id),
                            color: "#fff",
                          }}
                        >
                          {getSpectacleName(id)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSaison ? "Modifier la saison" : "Nouvelle saison"}
            </DialogTitle>
            <DialogDescription>
              Définissez la période et sélectionnez les spectacles inclus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom de la saison</Label>
              <Input
                id="nom"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex : Saison Été 2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="debut">Date de début</Label>
                <Input
                  id="debut"
                  type="date"
                  value={formDateDebut}
                  onChange={(e) => setFormDateDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin">Date de fin</Label>
                <Input
                  id="fin"
                  type="date"
                  value={formDateFin}
                  onChange={(e) => setFormDateFin(e.target.value)}
                />
              </div>
            </div>

            {/* Spectacle selection */}
            <div className="space-y-3">
              <Label>Spectacles inclus</Label>
              {spectacles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun spectacle disponible.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  {spectacles.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => toggleSpectacle(sp.id)}
                    >
                      <Checkbox
                        checked={formSpectacleIds.includes(sp.id)}
                        onCheckedChange={() => toggleSpectacle(sp.id)}
                      />
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: sp.couleur }}
                      />
                      <span className="text-sm font-medium">{sp.nom}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {sp.roles.length} rôle{sp.roles.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formNom.trim() || !formDateDebut || !formDateFin}
            >
              {editingSaison ? "Enregistrer" : "Créer"}
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
              Êtes-vous sûr de vouloir supprimer cette saison ? Le planning
              associé sera aussi supprimé.
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
