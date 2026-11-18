"use client";

import { Bouton, Carte, Chargement, Message, PuceIcone } from "@lvb/ui";
import {
  Copy,
  Download,
  ExternalLink,
  Facebook,
  Link2,
  MessageCircle,
  QrCode,
  Store,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { EnTete } from "@/components/coquille";
import { URL_SITE } from "@/lib/config";
import { useDonnees } from "@/lib/donnees";

type Agence = {
  slug: string | null;
  raisonSociale: string;
  statut: "en_attente" | "validee" | "suspendue";
};

/** Lien de réservation de l'agence à partager (Facebook, Instagram, WhatsApp) et QR code. */
export default function MaPage() {
  const t = useTranslations();
  const langue = useLocale();
  const { donnees: a, erreur } = useDonnees<Agence>("/agence");
  const [qr, setQr] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const url = a?.slug ? `${URL_SITE}/${langue}/agences/${a.slug}` : null;

  useEffect(() => {
    if (!url) return;
    void QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      color: { dark: "#1f2766", light: "#ffffff" },
    }).then(setQr);
  }, [url]);

  if (erreur) return <Message ton="erreur">{erreur}</Message>;
  if (!a) return <Chargement />;
  const message = url ? t("pageAgence.message", { url }) : "";

  return (
    <div className="flex flex-col gap-6">
      <EnTete titre={t("pageAgence.titre")} sousTitre={t("pageAgence.sousTitre")} />
      {a.statut !== "validee" && <Message ton="alerte">{t("pageAgence.nonValidee")}</Message>}
      {url && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Carte titre={t("pageAgence.lien")} icone={Link2} ton="marque">
            <div className="flex flex-col gap-4">
              <div className="ltr flex items-center gap-2 overflow-hidden rounded-2xl bg-champ px-4 py-3 text-[15px] font-medium">
                <Store className="size-4 shrink-0 text-attenue" />
                <span className="truncate">{url}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Bouton
                  icone={Copy}
                  onClick={() =>
                    void navigator.clipboard.writeText(url).then(() => {
                      setCopie(true);
                      setTimeout(() => setCopie(false), 2000);
                    })
                  }
                >
                  {copie ? t("pageAgence.copie") : t("pageAgence.copier")}
                </Bouton>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-menthe-100 px-5 text-[15px] font-medium text-menthe-800 transition hover:bg-menthe-50"
                >
                  <MessageCircle className="size-[18px]" strokeWidth={2} />
                  {t("pageAgence.partagerWhatsapp")}
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-ciel-100 px-5 text-[15px] font-medium text-ciel-800 transition hover:bg-ciel-50"
                >
                  <Facebook className="size-[18px]" strokeWidth={2} />
                  {t("pageAgence.partagerFacebook")}
                </a>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-marque-700 hover:bg-marque-50"
                >
                  <ExternalLink className="size-[18px]" strokeWidth={2} />
                  {t("commun.voir")}
                </a>
              </div>
            </div>
          </Carte>
          <Carte titre={t("pageAgence.qr")} icone={QrCode} ton="lavande">
            <div className="flex flex-col items-center gap-4">
              {qr ? (
                <img
                  src={qr}
                  alt={t("pageAgence.qr")}
                  className="size-56 rounded-3xl bg-white p-2 shadow-[var(--shadow-douce)]"
                />
              ) : (
                <PuceIcone icone={QrCode} ton="neutre" taille="grande" />
              )}
              {qr && (
                <a
                  href={qr}
                  download={`qr-${a.slug}.png`}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-champ px-5 text-[15px] font-medium transition hover:bg-[#ececf1]"
                >
                  <Download className="size-[18px]" strokeWidth={2} />
                  {t("pageAgence.telechargerQr")}
                </a>
              )}
            </div>
          </Carte>
        </div>
      )}
    </div>
  );
}
