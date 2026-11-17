import type { Langue } from "../constantes.js";
import { ar } from "./ar.js";
import { fr, type Messages } from "./fr.js";
import { kab } from "./kab.js";

export type { Messages };
export const MESSAGES: Record<Langue, Messages> = { fr, ar, kab };

type Valeurs = Record<string, string | number>;

/** Toutes les clés « a.b.c » d'un objet de messages. */
export type CleTraduction<T = Messages, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : CleTraduction<T[K], `${P}${K}.`>;
}[keyof T & string];

function lire(messages: Messages, cle: string): string | undefined {
  let n: unknown = messages;
  for (const p of cle.split(".")) {
    if (typeof n !== "object" || n === null) return undefined;
    n = (n as Record<string, unknown>)[p];
  }
  return typeof n === "string" ? n : undefined;
}

/** Trouve la fin d'un bloc { … } en tenant compte des accolades imbriquées. */
function finBloc(s: string, debut: number): number {
  let profondeur = 0;
  for (let i = debut; i < s.length; i++) {
    if (s[i] === "{") profondeur++;
    else if (s[i] === "}" && --profondeur === 0) return i;
  }
  return -1;
}

/**
 * Formatage ICU minimal (sous-ensemble utilisé par nos fichiers, compatible next-intl) :
 * `{nom}` et `{n, plural, one {…} other {…}}` avec `#`.
 */
export function formaterMessage(
  modele: string,
  valeurs: Valeurs = {},
  langue: Langue = "fr",
): string {
  let sortie = "";
  let i = 0;
  while (i < modele.length) {
    const c = modele[i]!;
    if (c !== "{") {
      sortie += c;
      i++;
      continue;
    }
    const fin = finBloc(modele, i);
    if (fin < 0) {
      sortie += modele.slice(i);
      break;
    }
    const contenu = modele.slice(i + 1, fin);
    const pluriel = /^\s*(\w+)\s*,\s*plural\s*,(.*)$/s.exec(contenu);
    if (pluriel) {
      const n = Number(valeurs[pluriel[1]!] ?? 0);
      const variantes: Record<string, string> = {};
      const corps = pluriel[2]!;
      let j = 0;
      while (j < corps.length) {
        const m = /^\s*(=\d+|\w+)\s*\{/.exec(corps.slice(j));
        if (!m) break;
        const ouverture = j + m[0].length - 1;
        const fermeture = finBloc(corps, ouverture);
        variantes[m[1]!] = corps.slice(ouverture + 1, fermeture);
        j = fermeture + 1;
      }
      const categorie = new Intl.PluralRules(langue === "kab" ? "fr" : langue).select(n);
      const choisie = variantes[`=${n}`] ?? variantes[categorie] ?? variantes.other ?? "";
      sortie += formaterMessage(choisie.replace(/#/g, String(n)), valeurs, langue);
    } else {
      const v = valeurs[contenu.trim()];
      sortie += v === undefined ? `{${contenu}}` : String(v);
    }
    i = fin + 1;
  }
  return sortie;
}

/** Traduit une clé ; retombe sur le français puis sur la clé elle-même. */
export function traduire(
  langue: Langue,
  cle: CleTraduction | (string & {}),
  valeurs?: Valeurs,
): string {
  const modele = lire(MESSAGES[langue], cle) ?? lire(MESSAGES.fr, cle) ?? cle;
  return formaterMessage(modele, valeurs, langue);
}

/** Choisit la langue à partir d'un en-tête Accept-Language ou d'un code. */
export function langueDepuis(valeur: string | null | undefined): Langue {
  if (!valeur) return "fr";
  for (const partie of valeur.toLowerCase().split(",")) {
    const code = partie
      .trim()
      .slice(0, 3)
      .replace(/[-;_].*$/, "");
    if (code === "ar" || code === "kab" || code === "fr") return code;
    if (code === "ber" || code === "tzm") return "kab";
  }
  return "fr";
}
