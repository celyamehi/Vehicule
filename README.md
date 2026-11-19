# Location véhicules Béjaïa

Marketplace de location de véhicules + logiciel de gestion pour agences (Algérie).

- Cahier des charges : [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md)
- Conventions : [`CLAUDE.md`](CLAUDE.md)
- Décisions : [`DECISIONS.md`](DECISIONS.md)

## Démarrage

Prérequis : Node.js ≥ 22, pnpm, Docker Desktop.

```bash
cp .env.example .env
pnpm install
pnpm infra:up                      # PostgreSQL + PostGIS, Redis, stockage S3
pnpm --filter @lvb/db db:migrer    # migrations
pnpm --filter @lvb/db db:seed      # données de démonstration
pnpm build
```

Puis, chacun dans son terminal :

| Application                   | Commande                              | Adresse                           |
| ----------------------------- | ------------------------------------- | --------------------------------- |
| API (+ documentation OpenAPI) | `pnpm --filter @lvb/api start`        | http://localhost:4000/api/v1/docs |
| Site client                   | `pnpm --filter @lvb/web-client start` | http://localhost:3000             |
| Logiciel loueur               | `pnpm --filter @lvb/web-loueur start` | http://localhost:3001             |
| Back-office                   | `pnpm --filter @lvb/admin start`      | http://localhost:3002             |

En développement, remplacer `start` par `dev`.

### Comptes de démonstration

Connexion par code SMS : en développement, les numéros de test ci-dessous utilisent le code **123456** (`OTP_CODE_TEST`). Données de démonstration : `pnpm --filter @lvb/db db:demo` (clients Amel 0550 00 00 10 et Yanis 0550 00 00 11).

| Rôle                     | Téléphone     |
| ------------------------ | ------------- |
| Administrateur           | 0550 00 00 01 |
| Gérant de l'agence démo  | 0550 00 00 02 |
| Employé de l'agence démo | 0550 00 00 04 |
| Client                   | 0550 00 00 03 |

## Tests

```bash
pnpm turbo run test --concurrency=1   # 123 tests (base de test : DATABASE_URL_TEST)
```

## Phase 1 — critères d'acceptation

| Critère                                                                            | Vérification                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Une agence s'inscrit, ajoute 10 véhicules avec photos et tarifs en moins de 30 min | Inscription → flotte avec « Enregistrer et ajouter un autre » (photos compressées, prix et caution dans la même fiche). À chronométrer avec une agence pilote. |
| Une réservation faite sur le site apparaît dans le planning en < 2 s               | Test automatisé `api.test.ts` (événement Socket.IO mesuré)                                                                                                     |
| Deux réservations simultanées : une seule passe                                    | Tests automatisés `anti-chevauchement.test.ts` (20 tentatives concurrentes) et `api.test.ts`                                                                   |
| Contrat PDF bilingue et état des lieux avec photos, signés sur tablette            | Fiche réservation du logiciel loueur ; test automatisé de génération PDF                                                                                       |
| Une réservation non confirmée en 2 h expire et libère le véhicule                  | Job BullMQ (30 s) ; test automatisé                                                                                                                            |
| Interface en français et en arabe (RTL)                                            | `/fr`, `/ar` (et `/kab`) sur les trois sites ; clés vérifiées par les tests                                                                                    |
| L'administrateur valide une agence avant qu'elle soit visible                      | Test automatisé ; back-office « Agences »                                                                                                                      |
