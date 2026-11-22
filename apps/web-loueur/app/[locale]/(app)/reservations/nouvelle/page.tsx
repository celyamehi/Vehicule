"use client";

import { MS_JOUR, OPTIONS_RESERVABLES, type Langue } from "@lvb/shared";
import {
  Bouton,
  Carte,
  Case,
  Champ,
  Liste,
  Message,
  Saisie,
  depuisChampLocal,
  formaterMontant,
  useSession,
  versChampLocal,
  Pastille,
  cx,
} from "@lvb/ui";
import { Building2, CheckCircle2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { EnTete } from "@/components/coquille";
import { type Entreprise, ModaleEntreprise } from "@/components/entreprise";
import { useRouter } from "@/i18n/navigation";
import { useAction, useDonnees } from "@/lib/donnees";
import type { Vehicule } from "@/lib/types";

type ClientTrouve = {
  utilisateurId: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  listeNoire: boolean;
};

export default function NouvelleReservation() {
  const t = useTranslations();
  const langue = useLocale() as Langue;
  const { api } = useSession();
  const routeur = useRouter();
  const { executer, enCours, erreur } = useAction();
  const { donnees: vehicules } = useDonnees<Vehicule[]>("/agence/vehicules");
  const [vehiculeId, setVehiculeId] = useState("");
  const [debut, setDebut] = useState(versChampLocal(new Date()));
  const [fin, setFin] = useState(versChampLocal(new Date(Date.now() + 3 * MS_JOUR)));
  const [origine, setOrigine] = useState<"comptoir" | "telephone">("comptoir");
  const [options, setOptions] = useState<string[]>([]);
  const [departImmediat, setDepartImmediat] = useState(false);
  const [prixNegocie, setPrixNegocie] = useState("");
  const [modeClient, setModeClient] = useState<"existant" | "nouveau">("nouveau");
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<ClientTrouve[]>([]);
  const [clientId, setClientId] = useState("");
  const [nouveau, setNouveau] = useState({
    telephone: "",
    nom: "",
    prenom: "",
    dateNaissance: "",
    numeroPermis: "",
    dateDelivrance: "",
  });
  const [prix, setPrix] = useState<number | null>(null);
  const [pourEntreprise, setPourEntreprise] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [creationEntreprise, setCreationEntreprise] = useState(false);
  const { donnees: entreprises, recharger: rechargerEntreprises } =
    useDonnees<Entreprise[]>("/agence/entreprises");

  // Arrivée depuis la fiche d'une entreprise : ?entreprise=<id> la présélectionne.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("entreprise");
    if (id) {
      setPourEntreprise(true);
      setEntrepriseId(id);
    }
  }, []);

  useEffect(() => {
    if (!vehiculeId && vehicules?.length) setVehiculeId(vehicules[0]!.id);
  }, [vehicules, vehiculeId]);

  useEffect(() => {
    if (modeClient !== "existant" || recherche.length < 2) return;
    const id = setTimeout(
      () =>
        void api
          .get<ClientTrouve[]>("/agence/clients", { recherche })
          .then(setTrouves)
          .catch(() => setTrouves([])),
      300,
    );
    return () => clearTimeout(id);
  }, [api, recherche, modeClient]);

  // Prix calculé par l'API (mêmes règles que le site), à titre indicatif.
  useEffect(() => {
    setPrix(null);
    if (!vehiculeId || !debut || !fin) return;
    const v = vehicules?.find((x) => x.id === vehiculeId);
    if (!v?.visiblePlateforme) return;
    void api
      .get<{ total: number }>(`/vehicules/${vehiculeId}/prix`, {
        debut: depuisChampLocal(debut),
        fin: depuisChampLocal(fin),
        options: options.join(","),
      })
      .then((r) => setPrix(r.total))
      .catch(() => setPrix(null));
  }, [api, vehiculeId, debut, fin, options, vehicules]);

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    void executer(async () => {
      const client =
        modeClient === "existant"
          ? { id: clientId }
          : {
              telephone: nouveau.telephone,
              nom: nouveau.nom,
              prenom: nouveau.prenom,
              dateNaissance: nouveau.dateNaissance || undefined,
              permis:
                nouveau.numeroPermis && nouveau.dateDelivrance
                  ? { numero: nouveau.numeroPermis, dateDelivrance: nouveau.dateDelivrance }
                  : undefined,
            };
      const r = await api.post<{ id: string }>("/agence/reservations", {
        vehiculeId,
        debut: depuisChampLocal(debut),
        fin: depuisChampLocal(fin),
        origine,
        client,
        options,
        departImmediat,
        prixTotal: prixNegocie ? Number(prixNegocie) : undefined,
        entrepriseId: pourEntreprise && entrepriseId ? entrepriseId : null,
      });
      routeur.push(`/reservations/${r.id}`);
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <EnTete titre={t("loueur.comptoir.titre")} />
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        <Carte titre={t("loueur.reservations.vehicule")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ libelle={t("loueur.reservations.vehicule")} className="sm:col-span-2">
              <Liste required value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)}>
                {vehicules?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marque} {v.modele} — {v.immatriculation} ({t(`categories.${v.categorie}`)})
                  </option>
                ))}
              </Liste>
            </Champ>
            <Champ libelle={t("commun.du")}>
              <Saisie
                type="datetime-local"
                required
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
              />
            </Champ>
            <Champ libelle={t("commun.au")}>
              <Saisie
                type="datetime-local"
                required
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </Champ>
            <Champ libelle={t("loueur.reservations.origine")}>
              <Liste
                value={origine}
                onChange={(e) => setOrigine(e.target.value as "comptoir" | "telephone")}
              >
                <option value="comptoir">{t("origines.comptoir")}</option>
                <option value="telephone">{t("origines.telephone")}</option>
              </Liste>
            </Champ>
            <div className="flex flex-col gap-2 pt-6">
              <Case
                libelle={t("loueur.comptoir.departImmediat")}
                checked={departImmediat}
                onChange={(e) => setDepartImmediat(e.target.checked)}
              />
            </div>
            <div className="flex flex-wrap gap-4 sm:col-span-2">
              {OPTIONS_RESERVABLES.map((o) => (
                <Case
                  key={o}
                  libelle={t(`options.${o}`)}
                  checked={options.includes(o)}
                  onChange={(e) =>
                    setOptions(e.target.checked ? [...options, o] : options.filter((x) => x !== o))
                  }
                />
              ))}
            </div>
            <div className="text-sm">
              {t("loueur.comptoir.prixCalcule")} :{" "}
              <strong>{prix === null ? "—" : formaterMontant(prix, langue)}</strong>
            </div>
            <Champ libelle={t("loueur.comptoir.prixNegocie")}>
              <Saisie
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                dir="ltr"
                value={prixNegocie}
                onChange={(e) => setPrixNegocie(e.target.value)}
              />
            </Champ>
          </div>
        </Carte>

        <Carte
          titre={t("loueur.reservations.client")}
          actions={
            <div className="flex gap-1">
              {(["nouveau", "existant"] as const).map((m) => (
                <Bouton
                  key={m}
                  taille="petite"
                  variante={modeClient === m ? "principal" : "secondaire"}
                  onClick={() => setModeClient(m)}
                >
                  {t(
                    m === "nouveau"
                      ? "loueur.comptoir.nouveauClient"
                      : "loueur.comptoir.clientExistant",
                  )}
                </Bouton>
              ))}
            </div>
          }
        >
          {modeClient === "existant" ? (
            <div className="flex flex-col gap-2">
              <Saisie
                placeholder={t("loueur.comptoir.rechercherClient")}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              {recherche.trim().length < 2 ? (
                <p className="ps-1 text-xs text-attenue">{t("loueur.comptoir.rechercheAide")}</p>
              ) : trouves.length === 0 ? (
                <Message ton="info">{t("loueur.comptoir.aucunClient")}</Message>
              ) : (
                <ul className="flex flex-col gap-2">
                  {trouves.map((c) => {
                    const choisi = clientId === c.utilisateurId;
                    const nom = [c.prenom, c.nom].filter(Boolean).join(" ") || "—";
                    return (
                      <li key={c.utilisateurId}>
                        <button
                          type="button"
                          disabled={c.listeNoire}
                          onClick={() => setClientId(c.utilisateurId)}
                          aria-pressed={choisi}
                          className={cx(
                            "flex w-full items-center gap-3 rounded-2xl p-3 text-start transition disabled:cursor-not-allowed disabled:opacity-60",
                            choisi
                              ? "bg-marque-50 ring-2 ring-marque-500"
                              : "bg-champ hover:bg-[#ececf1]",
                          )}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavande-100 text-sm font-semibold uppercase text-lavande-800">
                            {(c.prenom?.[0] ?? "") + (c.nom?.[0] ?? "") || "?"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{nom}</span>
                            <span className="ltr block text-sm text-attenue">{c.telephone}</span>
                          </span>
                          {c.listeNoire ? (
                            <Pastille statut="liste_noire">
                              {t("loueur.clients.listeNoire")}
                            </Pastille>
                          ) : (
                            choisi && (
                              <CheckCircle2 className="size-5 text-marque-600" strokeWidth={2} />
                            )
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ libelle={t("commun.telephone")}>
                <Saisie
                  type="tel"
                  required
                  dir="ltr"
                  value={nouveau.telephone}
                  onChange={(e) => setNouveau({ ...nouveau, telephone: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.dateNaissance")}>
                <Saisie
                  type="date"
                  value={nouveau.dateNaissance}
                  onChange={(e) => setNouveau({ ...nouveau, dateNaissance: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.prenom")}>
                <Saisie
                  required
                  value={nouveau.prenom}
                  onChange={(e) => setNouveau({ ...nouveau, prenom: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("commun.nom")}>
                <Saisie
                  required
                  value={nouveau.nom}
                  onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.comptoir.numeroPermis")}>
                <Saisie
                  dir="ltr"
                  value={nouveau.numeroPermis}
                  onChange={(e) => setNouveau({ ...nouveau, numeroPermis: e.target.value })}
                />
              </Champ>
              <Champ libelle={t("loueur.comptoir.dateDelivrance")}>
                <Saisie
                  type="date"
                  value={nouveau.dateDelivrance}
                  onChange={(e) => setNouveau({ ...nouveau, dateDelivrance: e.target.value })}
                />
              </Champ>
            </div>
          )}
        </Carte>

        <Carte>
          <div className="flex flex-col gap-3">
            <Case
              libelle={
                <span className="inline-flex items-center gap-2 font-medium">
                  <Building2 className="size-4 text-ciel-800" />
                  {t("entreprises.pourEntreprise")}
                </span>
              }
              aide={t("entreprises.pourEntrepriseAide")}
              checked={pourEntreprise}
              onChange={(e) => setPourEntreprise(e.target.checked)}
            />
            {pourEntreprise && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Champ libelle={t("entreprises.choisir")} className="min-w-0 flex-1">
                  <Liste value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)}>
                    <option value="">—</option>
                    {entreprises
                      ?.filter((x) => !x.listeNoire)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.raisonSociale}
                          {x.nif ? ` — ${x.nif}` : ""}
                        </option>
                      ))}
                  </Liste>
                </Champ>
                <Bouton
                  variante="secondaire"
                  icone={Plus}
                  onClick={() => setCreationEntreprise(true)}
                >
                  {t("entreprises.nouvelle")}
                </Bouton>
              </div>
            )}
          </div>
        </Carte>
        {erreur && <Message ton="erreur">{erreur}</Message>}
        <Bouton
          type="submit"
          chargement={enCours}
          disabled={
            !vehiculeId ||
            (modeClient === "existant" && !clientId) ||
            (pourEntreprise && !entrepriseId)
          }
        >
          {t("loueur.comptoir.creer")}
        </Bouton>
      </form>
      <ModaleEntreprise
        ouverte={creationEntreprise}
        onFermer={() => setCreationEntreprise(false)}
        onEnregistree={(x) => {
          setCreationEntreprise(false);
          setEntrepriseId(x.id);
          void rechargerEntreprises();
        }}
      />
    </div>
  );
}
