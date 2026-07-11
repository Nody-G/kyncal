"use client";

import { useEffect, useState } from "react";
import { getCascadeurs, getSpectacles, getSaisons } from "@/lib/store";
import type { Cascadeur, Spectacle, Saison } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Theater, CalendarRange, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [cascadeurs, setCascadeurs] = useState<Cascadeur[]>([]);
  const [spectacles, setSpectacles] = useState<Spectacle[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);

  useEffect(() => {
    setCascadeurs(getCascadeurs());
    setSpectacles(getSpectacles());
    setSaisons(getSaisons());
  }, []);

  const cascadeursActifs = cascadeurs.filter((c) => c.actif).length;
  const spectaclesActifs = spectacles.filter((s) => s.actif).length;
  const totalRoles = spectacles.reduce(
    (acc, s) => acc + s.roles.length,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre gestion de plannings cascadeurs
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/cascadeurs">
          <Card className="transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cascadeurs actifs
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cascadeursActifs}</div>
              <p className="text-xs text-muted-foreground">
                {cascadeurs.length} au total
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/spectacles">
          <Card className="transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Spectacles actifs
              </CardTitle>
              <Theater className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spectaclesActifs}</div>
              <p className="text-xs text-muted-foreground">
                {totalRoles} rôles au total
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/saisons">
          <Card className="transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saisons</CardTitle>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{saisons.length}</div>
              <p className="text-xs text-muted-foreground">
                Configurées au total
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/planning">
          <Card className="transition-colors hover:bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planning</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">📅</div>
              <p className="text-xs text-muted-foreground">
                Générer un planning
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick start guide */}
      {cascadeurs.length === 0 && spectacles.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🚀 Démarrage rapide</CardTitle>
            <CardDescription>
              Commencez par configurer vos données pour générer des plannings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </span>
              <div>
                <p className="font-medium">Créez vos spectacles</p>
                <p className="text-sm text-muted-foreground">
                  Définissez les spectacles et leurs rôles
                </p>
              </div>
              <Link
                href="/spectacles"
                className="ml-auto text-sm text-primary hover:underline"
              >
                → Spectacles
              </Link>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </span>
              <div>
                <p className="font-medium">Ajoutez vos cascadeurs</p>
                <p className="text-sm text-muted-foreground">
                  Attribuez-leur des rôles et des contraintes de repos
                </p>
              </div>
              <Link
                href="/cascadeurs"
                className="ml-auto text-sm text-primary hover:underline"
              >
                → Cascadeurs
              </Link>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </span>
              <div>
                <p className="font-medium">Configurez une saison</p>
                <p className="text-sm text-muted-foreground">
                  Définissez la période et les spectacles inclus
                </p>
              </div>
              <Link
                href="/saisons"
                className="ml-auto text-sm text-primary hover:underline"
              >
                → Saisons
              </Link>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                4
              </span>
              <div>
                <p className="font-medium">Générez le planning</p>
                <p className="text-sm text-muted-foreground">
                  L&apos;algorithme créera automatiquement le calendrier
                </p>
              </div>
              <Link
                href="/planning"
                className="ml-auto text-sm text-primary hover:underline"
              >
                → Planning
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
