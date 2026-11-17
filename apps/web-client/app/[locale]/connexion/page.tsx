"use client";

import { Carte, ConnexionOtp } from "@lvb/ui";
import { useRouter } from "@/i18n/navigation";

export default function Connexion() {
  const routeur = useRouter();
  return (
    <div className="mx-auto max-w-sm py-6">
      <Carte>
        <ConnexionOtp avecConsentement onConnecte={() => routeur.push("/compte")} />
      </Carte>
    </div>
  );
}
