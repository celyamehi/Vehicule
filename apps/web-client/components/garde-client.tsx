"use client";

import { Carte, Chargement, ConnexionOtp, useSession } from "@lvb/ui";
import type { ReactNode } from "react";

export function GardeClient({ children }: { children: ReactNode }) {
  const { pret, profil } = useSession();
  if (!pret) return <Chargement />;
  if (!profil)
    return (
      <div className="mx-auto max-w-sm py-6">
        <Carte>
          <ConnexionOtp avecConsentement />
        </Carte>
      </div>
    );
  return <>{children}</>;
}
