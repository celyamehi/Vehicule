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
pnpm infra:up
pnpm build
```
