# CLAUDE.md — Conventions du projet

Plateforme de location de véhicules (Béjaïa → Algérie) : marketplace client + logiciel de gestion
pour les agences + back-office, sur une seule base PostgreSQL et une seule API.

**Source de vérité : [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md).** Les choix faits face à une
ambiguïté sont dans [`DECISIONS.md`](DECISIONS.md).

## Méthode de travail

- Construire **phase par phase** (section 13 du cahier). Phase en cours : **Phase 1**.
  Ne rien construire d'une phase suivante sans validation explicite.
- Ordre dans une phase : **base de données → API → interfaces**.
- Avancer étape par étape et demander validation à la fin de chaque étape.
- En cas d'ambiguïté : choisir une option par défaut raisonnable, l'écrire dans `DECISIONS.md`
  (date, contexte, choix, alternative), et continuer plutôt que bloquer.

## Structure du monorepo (pnpm + Turborepo)

| Dossier           | Rôle                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `apps/web-client` | Site client Next.js (rendu serveur, SEO)                                 |
| `apps/web-loueur` | Logiciel loueur Next.js (web + tablette)                                 |
| `apps/admin`      | Back-office administrateur Next.js                                       |
| `apps/mobile`     | Apps React Native / Expo — **Phase 2**, vide en Phase 1                  |
| `packages/api`    | API NestJS, REST `/api/v1` + OpenAPI + Socket.IO, seule à écrire en base |
| `packages/db`     | Schéma Drizzle, migrations SQL versionnées, seed                         |
| `packages/shared` | Types, schémas Zod, règles métier pures, traductions (i18n)              |

Paquets internes nommés `@lvb/<nom>`, référencés en `workspace:*`.

## Règles impératives

- **TypeScript strict partout.** Types partagés via `@lvb/shared` ; validation des entrées avec Zod.
- **Multilingue dès le départ** : français (`fr`), arabe (`ar`, interface **RTL**), tamazight
  (`kab`). **Aucun texte en dur** dans les interfaces, les PDF ou les messages d'erreur : tout passe
  par les fichiers de traduction. Utiliser les propriétés CSS logiques (`margin-inline-start`…).
- **Montants** en dinars algériens (DZD), **entiers**, sans décimales, jamais de `float`.
- **Dates** en `timestamptz`, calculs et affichage dans le fuseau **`Africa/Algiers`**.
- **Anti-double réservation** : garantie par la contrainte d'exclusion PostgreSQL
  `pas_de_chevauchement` (btree_gist) écrite en SQL dans les migrations. Le temps tampon
  (battement, 2 h par défaut) est ajouté à la fin de `periode` à l'insertion. L'API traduit la
  violation en erreur `VEHICULE_INDISPONIBLE`.
- **Isolation par agence** : toute table métier a `agence_id` ; chaque route vérifie côté serveur
  que l'utilisateur n'accède qu'aux données de son agence (tests dédiés obligatoires).
- Chaque table : `id` UUID, `created_at`, `updated_at`.
- Erreurs d'API au format unique `{ code, message, details }`, messages traduits.
- Fichiers (photos, documents) dans le stockage S3 (SeaweedFS en dev), **jamais en base** ; documents d'identité
  accessibles uniquement par URL signée à durée courte.
- Secrets uniquement dans les variables d'environnement (`.env`, voir `.env.example`).
- Journaliser les actions sensibles (prix, annulation, remboursement, accès aux documents).
- Intégrations externes isolées derrière une interface (`FournisseurSms`, `FournisseurPaiement`,
  stockage) pour pouvoir changer de prestataire.

## Tests

- Toute règle métier de la section 6 est testée ; **priorité absolue à l'anti-double réservation**
  (test de concurrence sur une vraie base PostgreSQL). Couverture cible ≥ 90 % sur ces règles.
- Les tests de base de données tournent sur `DATABASE_URL_TEST`, jamais sur la base de dev.

## Commandes

```bash
pnpm install          # dépendances
pnpm infra:up         # PostgreSQL + PostGIS, Redis, stockage S3 (Docker)
pnpm build            # build de tous les paquets
pnpm typecheck        # vérification des types
pnpm lint             # ESLint
pnpm test             # tests
pnpm format           # Prettier
```
