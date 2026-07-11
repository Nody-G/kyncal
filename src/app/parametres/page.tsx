"use client";

import { useState, useRef } from "react";
import { exportAllData, importAllData } from "@/lib/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function ParametresPage() {
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyncal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importAllData(content);
      setImportStatus(success ? "success" : "error");

      // Reset after 3 seconds
      setTimeout(() => setImportStatus("idle"), 3000);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez vos données et configurez l&apos;application
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exporter les données
            </CardTitle>
            <CardDescription>
              Téléchargez toutes vos données (cascadeurs, spectacles, saisons,
              plannings) au format JSON. Utilisez-le comme sauvegarde ou pour
              transférer vos données.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Télécharger la sauvegarde
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer les données
            </CardTitle>
            <CardDescription>
              Importez un fichier de sauvegarde JSON. Les données existantes
              seront remplacées.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Fichier JSON</Label>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
              />
            </div>

            {importStatus === "success" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Données importées avec succès !
              </div>
            )}

            {importStatus === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Erreur lors de l&apos;import. Vérifiez le fichier.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>ℹ️ À propos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Kyncal v1.0</strong> — Application de gestion des calendriers
            de cascadeurs pour parcs à thèmes.
          </p>
          <p>
            Les données sont stockées localement dans votre navigateur
            (localStorage). Pensez à exporter régulièrement vos données pour
            éviter toute perte.
          </p>
          <p>
            <strong>Conseil :</strong> Exportez vos données avant de vider le
            cache de votre navigateur ou de changer d&apos;appareil.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
