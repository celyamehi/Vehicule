export const URL_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
/** Adresse de l'API vue depuis le serveur Next.js (rendu côté serveur). */
export const URL_API_SERVEUR = process.env.API_URL_INTERNE ?? URL_API;
