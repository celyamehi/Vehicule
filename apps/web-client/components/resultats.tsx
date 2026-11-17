import type { Langue } from "@lvb/shared";
import { getTranslations } from "next-intl/server";
import { CarteVehicule } from "@/components/carte-vehicule";
import { VueResultats } from "@/components/vue-resultats";
import type { ReponseRecherche } from "@/lib/recherche";

/** Liste des résultats (serveur) + bascule liste / carte (client). */
export async function Resultats({
  reponse,
  langue,
  requete,
}: {
  reponse: ReponseRecherche | null;
  langue: Langue;
  requete: string;
}) {
  const t = await getTranslations({ locale: langue });
  if (!reponse) return <p className="text-sm text-danger-700">{t("commun.erreurInattendue")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{t("client.recherche.resultats", { n: reponse.total })}</p>
      {reponse.total === 0 ? (
        <p className="rounded-xl border border-trait bg-surface p-4 text-sm text-attenue">
          {t("client.recherche.aucun")}
        </p>
      ) : (
        <VueResultats
          points={reponse.resultats.map((v) => ({
            id: v.id,
            lat: v.pointRetrait.lat,
            lon: v.pointRetrait.lon,
            prix: v.prix.total,
            libelle: `${v.marque} ${v.modele}`,
          }))}
          requete={requete}
        >
          <div className="flex flex-col gap-3">
            {reponse.resultats.map((v) => (
              <CarteVehicule key={v.id} v={v} langue={langue} requete={requete} />
            ))}
          </div>
        </VueResultats>
      )}
    </div>
  );
}
