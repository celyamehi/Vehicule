"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Chargement,
  Message,
  Pastille,
  formaterDate,
  formaterMontant,
  useSession,
  useTempsReel,
  Periode,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { GardeClient } from "@/components/garde-client";
import { Link } from "@/i18n/navigation";
import { useDonneesClient } from "@/lib/client";
import { URL_API } from "@/lib/config";

type Ligne = {
  id: string;
  code: string;
  statut: string;
  debut: string;
  fin: string;
  prixTotal: number;
  vehicule: { marque: string; modele: string };
  agence: { raisonSociale: string };
};

function Liste() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { jetonAcces, deconnecter } = useSession();
  const { donnees, erreur, recharger } = useDonneesClient<Ligne[]>("/moi/reservations");
  useTempsReel(URL_API, jetonAcces, {
    "reservation.statut_change": () => void recharger(),
    "reservation.modifiee": () => void recharger(),
  });
  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!donnees) return <Chargement />;
  const maintenant = Date.now();
  const groupes = [
    ["enCours", donnees.filter((r) => r.statut === "en_cours")],
    [
      "aVenir",
      donnees.filter(
        (r) =>
          ["en_attente_agence", "en_attente_paiement", "confirmee"].includes(r.statut) &&
          new Date(r.fin).getTime() > maintenant,
      ),
    ],
    [
      "passees",
      donnees.filter(
        (r) =>
          !["en_cours", "en_attente_agence", "en_attente_paiement", "confirmee"].includes(
            r.statut,
          ) || new Date(r.fin).getTime() <= maintenant,
      ),
    ],
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("client.mesReservations.titre")}</h1>
        <div className="flex gap-2">
          <Link
            href="/profil"
            className="inline-flex h-9 items-center rounded-full bg-champ px-4 text-sm font-medium"
          >
            {t("ui.profil")}
          </Link>
          <Bouton variante="fantome" taille="petite" onClick={() => void deconnecter()}>
            {t("commun.deconnexion")}
          </Bouton>
        </div>
      </div>
      {donnees.length === 0 && (
        <Carte>
          <p className="text-sm text-attenue">{t("client.mesReservations.aucune")}</p>
        </Carte>
      )}
      {groupes.map(([cle, lignes]) =>
        lignes.length === 0 ? null : (
          <section key={cle}>
            <h2 className="mb-2 font-semibold">{t(`client.mesReservations.${cle}`)}</h2>
            <div className="flex flex-col gap-2">
              {lignes.map((r) => (
                <Link
                  key={r.id}
                  href={`/compte/${r.id}`}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-carte)] bg-surface shadow-[var(--shadow-douce)] p-3 transition hover:shadow-[var(--shadow-relief)]"
                >
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold">
                      {r.vehicule.marque} {r.vehicule.modele}
                    </div>
                    <div className="text-attenue">{r.agence.raisonSociale}</div>
                    <div className="text-xs">
                      <Periode
                        debut={formaterDate(r.debut, langue)}
                        fin={formaterDate(r.fin, langue)}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                    <span className="text-sm font-semibold">
                      {formaterMontant(r.prixTotal, langue)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

export default function Compte() {
  return (
    <GardeClient>
      <Liste />
    </GardeClient>
  );
}
