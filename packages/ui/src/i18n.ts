import { LANGUES, type Langue, MESSAGES, estRtl } from "@lvb/shared";

/** Configuration next-intl commune aux trois applications. */
export const routageLangues = { locales: [...LANGUES], defaultLocale: "fr" as Langue };

export function configurationRequete(locale: string | undefined) {
  const langue = (LANGUES as readonly string[]).includes(locale ?? "") ? (locale as Langue) : "fr";
  return {
    locale: langue,
    messages: MESSAGES[langue] as unknown as Record<string, unknown>,
    timeZone: "Africa/Algiers",
    now: new Date(),
  };
}

export const direction = (langue: string) => (estRtl(langue as Langue) ? "rtl" : "ltr");
