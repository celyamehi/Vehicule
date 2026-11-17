/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Code de réservation lisible, ex. « BJA-7K3QX9 ». Le préfixe est l'abréviation de la wilaya.
 * `aleatoire` est injectable pour les tests ; par défaut crypto.getRandomValues.
 */
export function genererCodeReservation(
  prefixe = "BJA",
  aleatoire: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const octets = aleatoire(6);
  let corps = "";
  for (const o of octets) corps += ALPHABET[o % ALPHABET.length];
  return `${prefixe}-${corps}`;
}
