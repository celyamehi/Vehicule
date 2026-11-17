import type { ClientApi } from "./client-api.js";

const POIDS_MAX = 300 * 1024; // section 12 : photos < 300 Ko

/**
 * Compresse une image côté navigateur (JPEG, 1600 px max) jusqu'à passer sous 300 Ko,
 * pour économiser la 3G des agences et des clients.
 */
export async function compresserImage(fichier: File, poidsMax = POIDS_MAX): Promise<Blob> {
  if (!fichier.type.startsWith("image/")) return fichier;
  const image = await createImageBitmap(fichier);
  let cote = 1600;
  let qualite = 0.82;
  for (let essai = 0; essai < 8; essai++) {
    const echelle = Math.min(1, cote / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * echelle);
    canvas.height = Math.round(image.height * echelle);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((ok) =>
      canvas.toBlob((b) => ok(b!), "image/jpeg", qualite),
    );
    if (blob.size <= poidsMax || essai === 7) return blob;
    if (qualite > 0.55) qualite -= 0.1;
    else cote = Math.round(cote * 0.8);
  }
  return fichier;
}

export type Usage =
  "photo_vehicule" | "document_identite" | "justificatif_agence" | "photo_etat_des_lieux" | "logo";

/** Envoie un fichier directement vers le stockage via une URL signée ; renvoie sa clé. */
export async function televerser(api: ClientApi, fichier: File, usage: Usage): Promise<string> {
  const contenu = fichier.type === "application/pdf" ? fichier : await compresserImage(fichier);
  const typeMime = fichier.type === "application/pdf" ? "application/pdf" : "image/jpeg";
  const { cle, url } = await api.post<{ cle: string; url: string }>("/fichiers/televersement", {
    usage,
    typeMime,
    taille: contenu.size,
  });
  const r = await fetch(url, {
    method: "PUT",
    body: contenu,
    headers: { "Content-Type": typeMime },
  });
  if (!r.ok) throw new Error(`Téléversement échoué (${r.status})`);
  return cle;
}
