"use client";

import type { Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Champ,
  Chargement,
  Message,
  Pastille,
  Saisie,
  Zone,
  formaterDate,
  formaterMontant,
  useSession,
} from "@lvb/ui";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { EnTete } from "@/components/coquille";
import { Link } from "@/i18n/navigation";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Reservation } from "@/lib/types";

type Fiche = {
  utilisateurId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  dateNaissance: string | null;
  notesInternes: string | null;
  listeNoire: boolean;
  motifListeNoire: string | null;
  historique: Reservation[];
};

export default function FicheClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api, agence } = useSession();
  const action = useAction();
  const { donnees: c, erreur, recharger } = useDonnees<Fiche>(`/agence/clients/${id}`);
  const [notes, setNotes] = useState("");
  const [motif, setMotif] = useState("");
  const [succes, setSucces] = useState(false);
  useEffect(() => {
    if (c) {
      setNotes(c.notesInternes ?? "");
      setMotif(c.motifListeNoire ?? "");
    }
  }, [c]);

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!c) return <Chargement />;
  const modifier = (corps: object) =>
    void action.executer(async () => {
      await api.patch(`/agence/clients/${id}`, corps);
      setSucces(true);
      await recharger();
    });

  return (
    <div className="flex flex-col gap-4">
      <EnTete
        titre={[c.prenom, c.nom].filter(Boolean).join(" ") || c.telephone}
        actions={
          c.listeNoire && <Pastille statut="liste_noire">{t("loueur.clients.listeNoire")}</Pastille>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={t("loueur.clients.notes")}>
          <div className="flex flex-col gap-3">
            <div className="text-sm">
              <a href={`tel:${c.telephone}`} className="ltr">
                {c.telephone}
              </a>
              {c.dateNaissance && (
                <div className="text-attenue">
                  {t("commun.dateNaissance")} : {c.dateNaissance}
                </div>
              )}
            </div>
            <Zone value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Bouton
              variante="secondaire"
              chargement={action.enCours}
              onClick={() => modifier({ notesInternes: notes })}
            >
              {t("commun.enregistrer")}
            </Bouton>
          </div>
        </Carte>
        {agence?.role === "gerant" && (
          <Carte titre={t("loueur.clients.listeNoire")}>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-attenue">{t("loueur.clients.listeNoireAide")}</p>
              <Champ libelle={t("loueur.clients.motif")}>
                <Saisie value={motif} onChange={(e) => setMotif(e.target.value)} />
              </Champ>
              <Bouton
                variante={c.listeNoire ? "secondaire" : "danger"}
                chargement={action.enCours}
                onClick={() =>
                  modifier({ listeNoire: !c.listeNoire, motifListeNoire: motif || null })
                }
              >
                {t(
                  c.listeNoire
                    ? "loueur.clients.retirerListeNoire"
                    : "loueur.clients.ajouterListeNoire",
                )}
              </Bouton>
            </div>
          </Carte>
        )}
      </div>
      {succes && <Message ton="succes">{t("ui.enregistre")}</Message>}
      {action.erreur && <Message ton="erreur">{action.erreur}</Message>}
      <Carte titre={t("loueur.clients.historique")}>
        <ul className="divide-y divide-trait text-sm">
          {c.historique.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reservations/${r.id}`}
                className="flex justify-between gap-2 py-2 hover:bg-fond"
              >
                <span>
                  <span className="ltr">{r.code}</span> · {formaterDate(r.debut, langue, false)}
                </span>
                <span className="flex items-center gap-2">
                  {formaterMontant(r.prixTotal, langue)}
                  <Pastille statut={r.statut}>{t(`statutsReservation.${r.statut}`)}</Pastille>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
