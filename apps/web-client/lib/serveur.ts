import "server-only";
import { URL_API_SERVEUR } from "./config";

/** Appel de l'API depuis le serveur Next.js (rendu côté serveur, référencement). */
export async function apiServeur<T>(
  chemin: string,
  langue: string,
  revalider = 0,
): Promise<T | null> {
  try {
    const r = await fetch(`${URL_API_SERVEUR}${chemin}`, {
      headers: { "Accept-Language": langue },
      ...(revalider ? { next: { revalidate: revalider } } : { cache: "no-store" as const }),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
