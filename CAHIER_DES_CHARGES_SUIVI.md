# Cahier des charges — état d'avancement

Plateforme de location de véhicules (Béjaïa → Algérie) : **site client**, **logiciel des agences**
et **back-office**, sur une seule base de données et une seule API.

> Document de suivi au **22 novembre 2026**. Le cahier des charges complet (source de vérité) est
> [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md) ; les choix faits en cours de route sont dans
> [`DECISIONS.md`](DECISIONS.md) (D1 à D44).

**Légende :** ✅ fait · 🟡 partiel · ⏳ prévu (phase suivante)

---

## En résumé

| Phase                             | Contenu                                                                   | État                                                                       |
| --------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Phase 0** · Terrain             | Rencontres d'agences, cadre juridique, agences pilotes                    | ⏳ À mener par le porteur de projet                                        |
| **Phase 1** · Version minimale    | Logiciel loueur, site client avec paiement sur place, back-office de base | ✅ **Terminée**, en attente de validation                                  |
| **Phase 2** · Paiement et mobile  | Paiement Chargily, applications mobiles, mode hors ligne                  | 🟡 Une partie déjà faite en avance (avis, messagerie, entretien, finances) |
| **Phase 3** · Extension nationale | Autres wilayas, API publique, offres entreprises, chauffeur               | ⏳ Prévu (clients entreprises déjà faits)                                  |

**Chiffres clés :** 3 sites web · 3 langues (français, arabe en RTL, tamazight) · 158 tests
automatisés · 10 migrations de base de données versionnées.

---

## Critères d'acceptation de la Phase 1

| Critère                                                                            | État | Comment c'est vérifié                                                   |
| ---------------------------------------------------------------------------------- | :--: | ----------------------------------------------------------------------- |
| Une agence s'inscrit, ajoute 10 véhicules avec photos et tarifs en moins de 30 min |  ✅  | Inscription → flotte avec « Enregistrer et ajouter un autre »           |
| Une réservation faite sur le site apparaît dans le planning en moins de 2 secondes |  ✅  | Test automatisé (temps réel Socket.IO mesuré)                           |
| Deux réservations simultanées sur le même véhicule : une seule passe               |  ✅  | Contrainte PostgreSQL + test de concurrence (20 tentatives simultanées) |
| Contrat PDF bilingue et état des lieux avec photos, signés sur tablette            |  ✅  | Fiche réservation du logiciel ; test automatisé de génération PDF       |
| Une réservation non confirmée en 2 h expire et libère le véhicule                  |  ✅  | Tâche automatique toutes les 30 s ; test automatisé                     |
| Toute l'interface en français et en arabe (RTL)                                    |  ✅  | `/fr`, `/ar` et `/kab` sur les trois sites                              |
| L'administrateur valide une agence avant qu'elle soit visible sur le site          |  ✅  | Test automatisé ; back-office « Agences »                               |

---

## 3. Site client

| Fonction                                                                            | État | Détail                                                           |
| ----------------------------------------------------------------------------------- | :--: | ---------------------------------------------------------------- |
| Inscription et connexion par téléphone + code SMS                                   |  ✅  | Codes chiffrés, 5 envois par heure, 5 essais                     |
| Connexion Google                                                                    |  ⏳  | Reportée (D6)                                                    |
| Profil : nom, date de naissance, permis, pièce d'identité (photos)                  |  ✅  | Documents chiffrés, accès par lien signé de courte durée         |
| Vérification des documents et badge « Profil vérifié »                              |  ✅  | Par l'administrateur                                             |
| Recherche par ville, dates et heures                                                |  ✅  | Seuls les véhicules libres sur toute la période s'affichent      |
| Filtres (catégorie, boîte, carburant, places, prix…) et tri (prix, note, distance)  |  ✅  |                                                                  |
| Affichage en liste et sur carte                                                     |  ✅  | Carte OpenStreetMap                                              |
| Pages par ville pour Google (« location voiture Béjaïa »…)                          |  ✅  | Rendu serveur                                                    |
| Fiche véhicule : photos, prix total détaillé, caution, conditions, avis de l'agence |  ✅  |                                                                  |
| Page publique de chaque agence (lien et QR code à partager)                         |  ✅  |                                                                  |
| Réservation avec options et **paiement sur place**                                  |  ✅  | Confirmation par l'agence sous 2 h, sinon expiration automatique |
| **Livraison à une adresse**                                                         |  ✅  |                                                                  |
| Paiement en ligne (acompte)                                                         |  ⏳  | Phase 2 (Chargily)                                               |
| Mes réservations : à venir, en cours, passées ; annulation selon la politique       |  ✅  | Remboursement calculé selon la politique figée à la réservation  |
| Contrat et état des lieux en PDF                                                    |  ✅  |                                                                  |
| **Messagerie** avec l'agence, appel et WhatsApp                                     |  ✅  | Temps réel                                                       |
| **Avis** après le retour (1 à 5 étoiles + commentaire)                              |  ✅  | Un avis par location terminée                                    |
| Confirmation par SMS                                                                |  ✅  | Fournisseur SMS interchangeable (console en développement)       |
| Confirmation par e-mail                                                             |  ⏳  |                                                                  |
| Langues : français, arabe (RTL), tamazight                                          |  ✅  | Le tamazight doit être relu par un locuteur natif (D17)          |
| Anglais                                                                             |  ⏳  | Option                                                           |
| Site **responsive** (téléphone, tablette, ordinateur)                               |  ✅  | Vérifié à 375 px de large                                        |

## 4. Logiciel des agences

| Fonction                                                                                                | État | Détail                                                              |
| ------------------------------------------------------------------------------------------------------- | :--: | ------------------------------------------------------------------- |
| Inscription de l'agence (NIF, RC, agrément, justificatifs) ; logiciel utilisable avant validation       |  ✅  |                                                                     |
| **Même compte partout** : le gérant connecté sur le site ouvre le logiciel sans se reconnecter          |  ✅  | Logiciel servi sous `/agence` (D41)                                 |
| **Alerte à chaque réservation en ligne** : bandeau, son, notification, SMS au gérant                    |  ✅  | D35                                                                 |
| Tableau de bord : départs, retours, demandes, retards, occupation, chiffre d'affaires                   |  ✅  |                                                                     |
| **Statistiques des véhicules** : les plus rentables, les plus loués                                     |  ✅  | Marge, jours loués, taux d'occupation                               |
| Flotte : fiche complète, photos, statut, visible ou non sur le site                                     |  ✅  |                                                                     |
| Planning type Gantt, blocage de périodes, glisser-déposer pour changer de véhicule                      |  ✅  |                                                                     |
| Accepter / refuser les demandes, réservation au comptoir ou par téléphone                               |  ✅  | Client existant ou nouveau                                          |
| Prolongation, retour anticipé, changement de véhicule                                                   |  ✅  |                                                                     |
| Contrat PDF bilingue avec logo, **signature sur tablette**                                              |  ✅  |                                                                     |
| État des lieux : schéma des dommages, photos, kilométrage, carburant ; frais au retour calculés         |  ✅  |                                                                     |
| **Messages** : boîte de réception de toutes les conversations, profil du client en un clic              |  ✅  | D42                                                                 |
| Clients **particuliers** : historique, notes, liste noire propre à l'agence                             |  ✅  |                                                                     |
| Clients **entreprises** : NIF, NIS, RC, article d'imposition, conducteurs, facture au nom de la société |  ✅  | D44                                                                 |
| Tarifs : prix par jour, dégressifs, **saisons**, suppléments, caution, politique d'annulation           |  ✅  |                                                                     |
| Encaissements (espèces, CIB, Edahabia, virement, BaridiMob, chèque), caution encaissée/restituée        |  ✅  |                                                                     |
| **Caisse** : entrées automatiques, sorties, solde, cautions détenues, par moyen de paiement             |  ✅  | D43                                                                 |
| **Dépenses** : pneus, réparations, carburant, loyer, salaires… par véhicule ou générales                |  ✅  | D43                                                                 |
| **Factures PDF** numérotées et **export Excel** comptable                                               |  ✅  |                                                                     |
| **Amendes** : retrouve automatiquement le conducteur à la date de l'infraction                          |  ✅  |                                                                     |
| **Entretien** : rappels vidange, assurance, contrôle technique, vignette, pneus ; rentabilité           |  ✅  | Par date et par kilométrage (D37)                                   |
| **Avis** : réponse de l'agence, signalement                                                             |  ✅  |                                                                     |
| **Ma page** : page publique de l'agence, lien et QR code                                                |  ✅  |                                                                     |
| Équipe : employés avec droits, journal des actions                                                      |  ✅  |                                                                     |
| Plusieurs points de retrait                                                                             |  ✅  |                                                                     |
| Relevé des commissions dues à la plateforme                                                             |  🟡  | Taux par agence réglable ; relevé mensuel à faire (Phase 2)         |
| **Mode hors ligne** (logiciel installé, synchronisation au retour du réseau)                            |  ⏳  | Phase 2 (D36)                                                       |
| Application mobile du loueur                                                                            |  ⏳  | Phase 2 ; le logiciel web fonctionne déjà sur tablette et téléphone |

## 5. Back-office administrateur

| Fonction                                                     | État | Détail  |
| ------------------------------------------------------------ | :--: | ------- |
| Agences : file de validation, suspension, taux de commission |  ✅  |         |
| Clients : vérification des documents, blocage des comptes    |  ✅  |         |
| Réservations : recherche et suivi des statuts                |  ✅  |         |
| Avis : modération des signalements                           |  ✅  |         |
| Indicateurs : réservations, chiffre d'affaires, par wilaya   |  ✅  |         |
| Litiges (ouverture, pièces jointes, décision, remboursement) |  ⏳  | Phase 2 |
| Finances : commissions par période, versements aux agences   |  ⏳  | Phase 2 |
| Contenu : codes promo, pages d'information                   |  ⏳  | Phase 2 |

## 6. Règles métier et sécurité

| Règle                                                                                           | État |
| ----------------------------------------------------------------------------------------------- | :--: |
| **Anti-double réservation** garantie par la base de données (contrainte d'exclusion PostgreSQL) |  ✅  |
| Temps de battement entre deux locations (2 h par défaut, réglable)                              |  ✅  |
| Expiration automatique des demandes non confirmées en 2 h                                       |  ✅  |
| Prix et politique d'annulation figés au moment de la réservation                                |  ✅  |
| Conditions conducteur (âge, ancienneté du permis) vérifiées avant confirmation                  |  ✅  |
| **Isolation par agence** : une agence ne voit jamais les données d'une autre (tests dédiés)     |  ✅  |
| Montants en dinars entiers, dates dans le fuseau d'Alger                                        |  ✅  |
| Documents d'identité chiffrés, accès journalisé par lien signé de courte durée                  |  ✅  |
| Journal des actions sensibles (prix, annulations, remboursements, documents)                    |  ✅  |

---

## Ce qui reste à faire

### Phase 2 — Paiement et mobile

1. **Paiement en ligne Chargily** (acompte par CIB / Edahabia), remboursements automatiques.
   _Prérequis : compte marchand Chargily et clés de test._
2. **Applications mobiles** (Android et iPhone, Expo) : app client et app loueur, mêmes comptes et
   même API.
3. **Mode hors ligne** du logiciel des agences : base locale synchronisée, le comptoir est
   prioritaire en cas de conflit (D36).
4. **Relevé des commissions** mensuel pour chaque agence et suivi des versements.
5. Back-office : **litiges**, **codes promo**, pages d'information.
6. Confirmation par **e-mail**, connexion **Google**.

### Améliorations repérées (inspirées des logiciels du marché)

- Page **Paiements** : contrats avec reste à payer, bouton « Relancer » par WhatsApp ou SMS.
- Caisse avec comptes **espèces** et **banque** séparés, comptage de caisse, chèques à suivre.
- Tableau de bord avec les **photos des voitures** et leur état (louée, en retard, disponible).
- **Rapports** sur une période libre, avec graphiques et comparaison.
- **Apporteurs d'affaires** (hôtels, guides) avec commissions automatiques.
- **Approbation** par le gérant des contrats créés par les employés.
- **Accidents et sinistres**, **devis**, **import Excel** des voitures, clients et contrats.
- Conducteur supplémentaire sur le contrat.

### Avant le lancement

- Relecture des textes en tamazight par un locuteur natif (D17).
- Choix d'un fournisseur SMS réel et d'un hébergement (base, stockage, serveurs).
- Validation juridique des contrats et des mentions sur les factures (TVA non gérée pour l'instant).

---

## Technique

| Élément         | Choix                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Organisation    | Monorepo pnpm + Turborepo, TypeScript strict partout                   |
| Sites           | Next.js 15 (site client en rendu serveur pour Google), Tailwind CSS 4  |
| API             | NestJS 11, REST `/api/v1` documentée (OpenAPI), temps réel Socket.IO   |
| Base de données | PostgreSQL 16 + PostGIS, Drizzle ORM, migrations SQL versionnées       |
| Tâches          | BullMQ + Redis (expiration des demandes)                               |
| Fichiers        | Stockage compatible S3 (SeaweedFS en développement)                    |
| Documents       | PDF bilingues (pdfkit), Excel (exceljs)                                |
| Tests           | Vitest : 92 règles métier, 30 tests de base de données, 36 tests d'API |

Pour lancer le projet en local, voir [`README.md`](README.md).
