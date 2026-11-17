# Cahier des charges — Plateforme de location de véhicules (Béjaïa → Algérie)

Version du 16 novembre 2026

## 0. Instructions pour Claude Code

Ce document est la source de vérité du projet. Construis-le phase par phase (section 13), en commençant par la Phase 1 uniquement, et demande validation avant de passer à la suivante.

- Monorepo unique : `apps/web-client`, `apps/web-loueur`, `apps/admin`, `apps/mobile`, `packages/api`, `packages/db`, `packages/shared` (types, validation, i18n).
- Commence par le schéma de base de données (section 8) et ses migrations, puis l'API, puis les interfaces.
- Écris des tests pour toute règle métier de la section 6, en priorité l'anti-double réservation.
- Toute l'interface est multilingue dès le départ : français, arabe (RTL), tamazight. Aucun texte en dur.
- Montants en dinars algériens (DZD), stockés en nombres entiers, sans décimales. Fuseau horaire Africa/Algiers.
- Crée un fichier `CLAUDE.md` à la racine qui résume les conventions ci-dessus.
- En cas d'ambiguïté, propose une option par défaut et note-la dans `DECISIONS.md` plutôt que de bloquer.

## 1. Présentation du projet

Le projet est une plateforme unique à deux faces : une marketplace où les clients réservent un véhicule, et un logiciel de gestion où les agences de location gèrent leur activité. Les deux partagent la même base de données, ce qui garantit une synchronisation immédiate.

**Contexte.** En Algérie, la réservation de voiture de location passe surtout par le téléphone, Facebook et le déplacement en agence. Beaucoup d'agences gèrent leur flotte sur papier ou Excel. Il n'existe pas d'outil local qui réunisse réservation en ligne et gestion d'agence.

**Objectifs.**

1. Permettre à un client de trouver, comparer et réserver un véhicule en moins de 3 minutes.
2. Donner aux agences un logiciel qui remplace le papier et Excel, utile même sans les clients de la plateforme.
3. Supprimer les doubles réservations entre ventes en ligne et ventes au comptoir.
4. Lancer à Béjaïa, puis étendre aux principales wilayas.

**Périmètre initial.** Agences de location agréées uniquement (pas de particuliers en phase 1). Véhicules de tourisme et utilitaires légers. Location avec ou sans chauffeur en option.

**Hors périmètre (phase 1).** Location entre particuliers, vente de véhicules, assurance intégrée, international.

## 2. Acteurs et rôles

Cinq rôles, chacun avec ses droits. Un même compte peut être client et membre d'une agence.

| Rôle | Interface | Peut faire |
| --- | --- | --- |
| Visiteur | Site / app client | Rechercher, consulter les fiches, voir les prix |
| Client | Site / app client | Réserver, payer, annuler, laisser un avis, gérer ses documents |
| Gérant d'agence | Logiciel loueur | Tout gérer dans son agence : flotte, prix, employés, finances, paramètres |
| Employé d'agence | Logiciel loueur | Remise et retour des véhicules, contrats, états des lieux, encaissements (droits fixés par le gérant) |
| Administrateur plateforme | Back-office | Valider les agences, modérer, gérer les litiges, commissions, statistiques |

Une agence peut avoir plusieurs points de retrait (agence principale, aéroport, gare).

## 3. Plateforme client (site web + application mobile)

Le client doit pouvoir passer de la recherche à la réservation confirmée en moins de 3 minutes, sur mobile en priorité.

**3.1 Compte et identité**

- Inscription par numéro de téléphone + code SMS (OTP), e-mail facultatif, connexion Google en option.
- Profil : nom, date de naissance, photo du permis (recto/verso), photo de la carte d'identité ou du passeport.
- Vérification des documents par l'agence ou l'administrateur ; badge « Profil vérifié ».

**3.2 Recherche**

- Critères : wilaya / ville / point de retrait, dates et heures de départ et de retour, retour dans un autre lieu.
- Filtres : catégorie (citadine, berline, SUV, utilitaire, minibus), boîte manuelle ou automatique, carburant (essence, diesel, GPL), places, climatisation, prix, kilométrage inclus, avec chauffeur, note de l'agence.
- Affichage en liste et sur carte, tri par prix, note, distance.
- Seuls les véhicules réellement disponibles sur toute la période s'affichent.

**3.3 Fiche véhicule**

- Photos, caractéristiques, année, options (siège bébé, GPS, conducteur additionnel).
- Prix total détaillé pour la période : tarif par jour, dégressif, options, frais de livraison, montant de la caution.
- Conditions : âge minimum, ancienneté du permis, kilométrage, carburant, politique d'annulation.
- Fiche de l'agence : adresse, horaires, note, avis.

**3.4 Réservation**

1. Choix des options et du mode de paiement.
2. Blocage temporaire du véhicule pendant 15 minutes le temps du paiement.
3. Confirmation par l'agence : instantanée (si l'agence l'active) ou sous 2 heures maximum, sinon annulation automatique et remboursement.
4. Envoi de la confirmation par SMS, e-mail et notification, avec un code de réservation.

**3.5 Après réservation**

- Espace « Mes réservations » : à venir, en cours, passées.
- Modification de dates (soumise à disponibilité) et annulation selon la politique.
- Contrat et état des lieux consultables en PDF.
- Messagerie avec l'agence liée à la réservation, et bouton d'appel / WhatsApp.
- Avis après le retour (note 1 à 5 + commentaire), réservations terminées uniquement.

**3.6 Langues et accessibilité**

- Français, arabe (interface en RTL), tamazight. Anglais en option pour la diaspora et les étrangers.
- Fonctionne correctement en 3G et sur des téléphones d'entrée de gamme.

## 4. Logiciel loueur (web + tablette / mobile)

Le logiciel doit être assez utile pour qu'une agence l'adopte même si elle ne reçoit encore aucune réservation en ligne. C'est le principal levier d'acquisition des agences.

**4.1 Inscription de l'agence**

- Création du compte : raison sociale, NIF, numéro de registre du commerce, agrément, adresse, wilaya, téléphone, photos de l'agence.
- Envoi des justificatifs (scans) ; l'agence n'apparaît sur la marketplace qu'après validation par l'administrateur.
- Le logiciel de gestion est utilisable dès l'inscription, avant validation.

**4.2 Tableau de bord**

- Du jour : départs, retours, réservations en attente de confirmation, retards.
- Taux d'occupation de la flotte, chiffre d'affaires du mois, part en ligne / comptoir.

**4.3 Flotte**

- Fiche véhicule : marque, modèle, année, immatriculation, catégorie, boîte, carburant, places, options, photos, kilométrage, point de rattachement.
- Statut : disponible, loué, en entretien, hors service.
- Option « visible sur la plateforme » par véhicule (l'agence peut garder certains véhicules pour le comptoir).

**4.4 Calendrier et disponibilités**

- Planning type Gantt : une ligne par véhicule, réservations en ligne et comptoir de couleurs différentes.
- Blocage manuel de périodes (entretien, usage personnel).
- Glisser-déposer pour réaffecter une réservation à un autre véhicule de même catégorie.

**4.5 Réservations**

- Accepter / refuser les demandes en ligne, avec motif de refus.
- Créer une réservation au comptoir ou par téléphone (client existant ou nouveau).
- Prolongation, retour anticipé, changement de véhicule.

**4.6 Contrats et états des lieux**

- Génération du contrat de location en PDF (modèle personnalisable avec le logo de l'agence), bilingue français / arabe.
- Signature électronique sur tablette ou téléphone.
- État des lieux au départ et au retour : schéma du véhicule avec dommages pointés, photos horodatées, kilométrage, niveau de carburant.
- Comparaison automatique départ / retour et calcul des frais (kilomètres en plus, carburant, retard, dommages).

**4.7 Clients**

- Fichier clients avec documents, historique, notes internes.
- Liste noire interne à l'agence (non partagée entre agences en phase 1, voir section 16).

**4.8 Tarifs**

- Prix par jour par véhicule ou catégorie, tarifs dégressifs (semaine, mois), saisons (été, Aïd, fin d'année), suppléments (options, livraison, conducteur additionnel, chauffeur).
- Caution par catégorie, politique d'annulation au choix parmi des modèles.

**4.9 Finances**

- Encaissements : espèces, carte (CIB / Edahabia), virement, BaridiMob ; caution encaissée et restituée.
- Factures et reçus en PDF, export comptable Excel.
- Relevé des commissions dues à la plateforme et des versements reçus.

**4.10 Entretien**

- Rappels : vidange (par km ou date), assurance, contrôle technique, vignette, pneus.
- Historique des dépenses par véhicule et rentabilité (revenus moins coûts).

**4.11 Équipe**

- Comptes employés avec droits par rôle, journal des actions (qui a fait quoi).
- Plusieurs points de retrait sous une même agence.

**4.12 Mode hors ligne**

- État des lieux, contrat et remise des clés utilisables sans connexion, puis synchronisés au retour du réseau.

## 5. Back-office administrateur

Le back-office sert à contrôler la qualité de l'offre et à piloter l'activité.

- **Agences** : file de validation des dossiers, suspension, niveau de commission par agence.
- **Clients** : vérification des documents, blocage de comptes frauduleux.
- **Réservations** : recherche, suivi des statuts, intervention manuelle.
- **Litiges** : ouverture par le client ou l'agence, pièces jointes (photos d'état des lieux), décision et remboursement.
- **Avis** : modération et signalements.
- **Finances** : commissions par période, versements aux agences, remboursements.
- **Contenu** : villes et points de retrait, catégories de véhicules, codes promo, pages d'information.
- **Statistiques** : réservations, chiffre d'affaires, taux de conversion, par wilaya et par agence.

## 6. Synchronisation et règles métier

Un véhicule ne peut jamais avoir deux réservations actives qui se chevauchent : la base de données le refuse elle-même, quelle que soit l'origine (plateforme, comptoir, téléphone).

**6.1 Principe de synchronisation**

- Plateforme client et logiciel loueur lisent et écrivent dans la même base PostgreSQL via la même API. Il n'y a pas de copie à synchroniser.
- Toute création ou modification de réservation est diffusée en temps réel (WebSocket) aux écrans ouverts de l'agence et du client.
- Seul le mode hors ligne (section 4.12) nécessite une synchronisation différée : file d'actions locale, envoi au retour du réseau, rejet explicite en cas de conflit.

**6.2 Statuts d'une réservation**

| Statut | Bloque le véhicule | Passage suivant |
| --- | --- | --- |
| `en_attente_paiement` | Oui, 15 min max | `en_attente_agence` ou `expiree` |
| `en_attente_agence` | Oui, 2 h max | `confirmee`, `refusee` ou `expiree` |
| `confirmee` | Oui | `en_cours`, `annulee_client`, `annulee_agence`, `non_presentation` |
| `en_cours` | Oui | `terminee` |
| `terminee` | Non | `litige` possible sous 72 h |
| `refusee`, `expiree`, `annulee_*`, `non_presentation` | Non | — |

Une réservation au comptoir est créée directement en `confirmee` ou `en_cours`.

**6.3 Règles**

1. **Anti-chevauchement** : contrainte d'exclusion PostgreSQL sur (véhicule, période) pour les statuts qui bloquent.
2. **Battement** : temps tampon paramétrable entre deux locations (défaut 2 h) pour nettoyage et contrôle.
3. **Expiration** : un job planifié passe en `expiree` les réservations non payées ou non confirmées dans les délais et libère le véhicule.
4. **Annulation** : trois politiques au choix de l'agence (souple, modérée, stricte) qui fixent le remboursement selon le délai avant le départ.
5. **Annulation par l'agence** d'une réservation confirmée : remboursement intégral et pénalité sur le score de l'agence.
6. **Prix figé** : le prix et les conditions sont copiés dans la réservation au moment de la confirmation ; un changement de tarif ultérieur ne la modifie pas.
7. **Conditions conducteur** : âge et ancienneté du permis vérifiés avant paiement.
8. **Commission** : calculée uniquement sur les réservations venues de la plateforme, jamais sur celles du comptoir.
9. **Avis** : un avis par réservation terminée, dans les 14 jours.

## 7. Architecture technique et stack

Les trois interfaces passent par une seule API, qui seule écrit dans PostgreSQL. C'est ce qui rend la synchronisation automatique.

```
 ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
 │ Plateforme client  │   │  Logiciel loueur   │   │ Back-office admin  │
 │ web Next.js + app  │   │ web + app tablette │   │ validation, litiges│
 │ mobile             │   │ hors ligne: SQLite │   │ commissions, stats │
 └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘
           │                        │                        │
           ▼                        ▼                        ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │                       API backend (NestJS)                           │
 │   REST + WebSocket temps réel · authentification · règles métier     │
 │   tâches planifiées : expiration des réservations, rappels, notifs   │
 └───────┬─────────────────┬───────────────────┬────────────────┬───────┘
         ▼                 ▼                   ▼                ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ ┌───────────────────┐
 │ PostgreSQL   │  │ Redis        │  │ Stockage fichiers│ │ Services externes │
 │ + PostGIS    │  │ cache,       │  │ S3 / MinIO       │ │ Chargily (paiement)│
 │ source de    │  │ sessions,    │  │ photos,          │ │ SMS, e-mail,      │
 │ vérité       │  │ files tâches │  │ documents        │ │ cartes            │
 └──────────────┘  └──────────────┘  └──────────────────┘ └───────────────────┘
```

Les flèches vont dans les deux sens : l'API reçoit les actions et renvoie les mises à jour en temps réel.

| Couche | Choix | Remarque |
| --- | --- | --- |
| Langage | TypeScript partout | Types partagés entre front et back (`packages/shared`) |
| Monorepo | pnpm + Turborepo | Un dépôt, plusieurs applications |
| Backend | NestJS, REST documenté en OpenAPI, Socket.IO | Validation des entrées avec Zod |
| Base de données | PostgreSQL 16 + PostGIS + btree_gist | Contrainte d'exclusion écrite en SQL dans les migrations |
| ORM | Drizzle ORM | Migrations SQL versionnées |
| Tâches planifiées | BullMQ sur Redis | Expirations, rappels, notifications |
| Web client | Next.js (rendu serveur pour le référencement Google) | Pages par ville : « location voiture Béjaïa » |
| Web loueur et admin | Next.js | Interface dense, tableaux, planning |
| Mobile | React Native (Expo) : app client + app loueur | App loueur avec SQLite pour le hors ligne |
| Fichiers | Stockage compatible S3 (MinIO) | Images compressées côté client avant envoi |
| Cartes | OpenStreetMap + Leaflet | Pas de coût de licence |
| PDF | Génération côté serveur avec polices arabes | Contrats, factures, états des lieux |
| Déploiement | Docker + docker compose, CI GitHub Actions | Environnements dev, recette, production |

Pour un prototype rapide, une base PostgreSQL managée (Supabase) est acceptable ; la production doit tourner chez un hébergeur en Algérie (section 11).

## 8. Modèle de données

Seize tables couvrent la phase 1 et la phase 2. Chaque table a `id` (UUID), `created_at`, `updated_at` ; les tables métier ont `agence_id` pour isoler les données de chaque agence.

| Table | Champs principaux | Notes |
| --- | --- | --- |
| `utilisateurs` | telephone (unique), email, nom, prenom, date_naissance, langue, statut | Un compte par personne |
| `documents_identite` | utilisateur_id, type (permis, CNI, passeport), numero, date_delivrance, date_expiration, fichiers, statut_verification | Fichiers dans le stockage S3, jamais en base |
| `agences` | raison_sociale, nif, registre_commerce, agrement, wilaya, adresse, telephone, statut (en_attente, validee, suspendue), taux_commission, score | |
| `membres_agence` | agence_id, utilisateur_id, role (gerant, employe), permissions | |
| `points_retrait` | agence_id, nom, adresse, wilaya, commune, position (PostGIS), horaires | |
| `categories_vehicule` | code, libelles (fr, ar, ber) | Citadine, berline, SUV, utilitaire, minibus |
| `vehicules` | agence_id, point_retrait_id, categorie_id, marque, modele, annee, immatriculation, boite, carburant, places, options (JSONB), kilometrage, statut, visible_plateforme | |
| `photos_vehicule` | vehicule_id, url, ordre | |
| `tarifs` | vehicule_id ou categorie_id, prix_jour, paliers (JSONB), saison_debut, saison_fin, caution | |
| `reservations` | code, vehicule_id, client_id, agence_id, periode (TSTZRANGE), origine (plateforme, comptoir, telephone), statut, prix_total, detail_prix (JSONB figé), politique_annulation, caution | Contrainte d'exclusion ci-dessous |
| `contrats` | reservation_id, numero, pdf_url, signe_le, signature_client | |
| `etats_des_lieux` | reservation_id, moment (depart, retour), kilometrage, carburant, dommages (JSONB), photos, signe_par | |
| `paiements` | reservation_id, type (acompte, solde, caution, remboursement), moyen (cib, edahabia, especes, virement, baridimob), montant, statut, reference_externe | |
| `commissions` | reservation_id, agence_id, montant, statut (due, versee) | |
| `avis` | reservation_id (unique), auteur_id, note, commentaire, reponse_agence | |
| `entretiens` | vehicule_id, type, date, kilometrage, cout, prochaine_echeance | |

Tables techniques : `notifications`, `messages`, `litiges`, `journal_actions`, `codes_promo`.

**Contrainte anti-double réservation (obligatoire) :**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD CONSTRAINT pas_de_chevauchement
  EXCLUDE USING gist (vehicule_id WITH =, periode WITH &&)
  WHERE (statut IN ('en_attente_paiement', 'en_attente_agence', 'confirmee', 'en_cours'));
```

Le temps tampon entre deux locations (section 6.3) est ajouté à la fin de `periode` au moment de l'insertion.

Montants : entiers en dinars (DZD). Dates : `timestamptz`, affichées en Africa/Algiers.

## 9. API

Une API REST versionnée (`/api/v1`), documentée automatiquement en OpenAPI, sert les trois interfaces. Les droits sont vérifiés côté serveur sur chaque route : un membre d'agence n'accède qu'aux données de son agence.

| Groupe | Routes principales | Utilisé par |
| --- | --- | --- |
| Auth | `POST /auth/otp/envoyer`, `POST /auth/otp/verifier`, `POST /auth/rafraichir` | Tous |
| Recherche | `GET /recherche?wilaya=&debut=&fin=&categorie=&...`, `GET /vehicules/:id`, `GET /vehicules/:id/prix?debut=&fin=` | Client |
| Réservations client | `POST /reservations`, `GET /moi/reservations`, `POST /reservations/:id/annuler`, `PATCH /reservations/:id/dates` | Client |
| Paiement | `POST /paiements/session`, `POST /paiements/webhook/chargily` | Client, Chargily |
| Agence | `POST /agences`, `GET /agence/tableau-de-bord`, `GET /agence/planning?debut=&fin=` | Loueur |
| Flotte | `CRUD /agence/vehicules`, `CRUD /agence/tarifs`, `CRUD /agence/entretiens` | Loueur |
| Réservations agence | `POST /agence/reservations` (comptoir), `POST /agence/reservations/:id/accepter`, `.../refuser`, `.../depart`, `.../retour` | Loueur |
| Documents | `POST /agence/reservations/:id/etat-des-lieux`, `GET /contrats/:id/pdf` | Loueur, Client |
| Synchro hors ligne | `POST /agence/sync` (lot d'actions horodatées, réponse action par action) | App loueur |
| Admin | `/admin/agences`, `/admin/litiges`, `/admin/avis`, `/admin/commissions`, `/admin/stats` | Admin |

**Temps réel (WebSocket).** Canaux `agence:{id}` et `utilisateur:{id}`. Événements : `reservation.creee`, `reservation.statut_change`, `vehicule.disponibilite_change`, `message.nouveau`.

**Erreurs.** Format unique `{ code, message, details }`, messages traduits. Code `VEHICULE_INDISPONIBLE` renvoyé quand la contrainte d'exclusion refuse une réservation.

**Plus tard (phase 3).** API publique pour les agences qui ont déjà leur propre logiciel, afin qu'elles synchronisent leurs disponibilités sans changer d'outil.

## 10. Paiements

Le paiement accepte trois formules, parce qu'une grande partie des clients paie encore en espèces. L'agence choisit celles qu'elle accepte.

| Formule | Fonctionnement | Quand l'utiliser |
| --- | --- | --- |
| Acompte en ligne | Le client paie 20 à 30 % en ligne (CIB / Edahabia), le solde à l'agence | Par défaut, réduit les non-présentations |
| Paiement total en ligne | Le client paie tout à la réservation | Clients habitués, diaspora |
| Paiement sur place | Aucune somme en ligne, réservation confirmée par l'agence | Phase 1, et pour les agences qui le veulent |

- **Passerelle** : [Chargily Pay](https://dev.chargily.com/pay-v2/introduction.md) (CIB de la SATIM et Edahabia d'Algérie Poste), SDK disponible en JavaScript. Code de l'intégration isolé derrière une interface `FournisseurPaiement` pour pouvoir ajouter ou changer de passerelle.
- **Webhook** : la confirmation d'un paiement vient uniquement du webhook signé, jamais du retour navigateur. Traitement idempotent (un même événement reçu deux fois ne crée qu'un paiement).
- **Caution** : encaissée à l'agence au départ (espèces ou chèque) et enregistrée dans le logiciel ; restitution tracée au retour. Pas de pré-autorisation bancaire en phase 1.
- **Commission** : en phase 1, la plateforme facture ses commissions aux agences chaque mois (relevé automatique). Plus tard, retenue directe sur les acomptes encaissés en ligne, sous réserve de validation juridique (section 16).
- **Remboursements** : calculés automatiquement selon la politique d'annulation, exécutés via la passerelle ou manuellement, toujours tracés.
- **Sécurité** : aucune donnée de carte ne passe par nos serveurs ; vérifier sur chaque route que la réservation appartient bien à l'utilisateur (risque principal des API de paiement).

## 11. Sécurité, conformité, hébergement

La plateforme stocke des permis et des pièces d'identité : la protection de ces données est une exigence légale (loi 18-07 sur la protection des données personnelles) autant que commerciale.

**Données personnelles**

- Documents d'identité stockés chiffrés, accessibles par URL signée à durée courte, visibles uniquement par l'agence concernée par une réservation et par l'admin.
- Consentement explicite à l'inscription, politique de confidentialité en français et en arabe.
- Droit d'accès et de suppression du compte ; suppression des documents 12 mois après la dernière location (durée à confirmer par un juriste).
- Déclaration du traitement auprès de l'ANPDP avant la mise en production.

**Hébergement**

- Production hébergée en Algérie (Algérie Télécom, ICOSNET ou équivalent), le transfert de données personnelles à l'étranger étant encadré.
- Tout en conteneurs Docker, pour pouvoir changer d'hébergeur sans réécrire.
- Sauvegardes automatiques chiffrées quotidiennes de la base, conservées 30 jours, test de restauration mensuel.

**Sécurité applicative**

- HTTPS partout, jetons JWT courts + jeton de rafraîchissement, limitation du nombre d'essais OTP.
- Isolation stricte par agence dans chaque requête (tests automatiques dédiés).
- Validation de toutes les entrées, protection contre les injections, en-têtes de sécurité.
- Journal des actions sensibles (modification de prix, annulation, remboursement, accès aux documents).
- Mots de passe et clés d'API uniquement dans des variables d'environnement, jamais dans le code.

## 12. Exigences non fonctionnelles

La plateforme doit rester rapide sur un téléphone moyen en 3G, parce que c'est l'usage dominant des clients.

| Exigence | Cible |
| --- | --- |
| Chargement de la page de recherche (mobile, 3G) | Moins de 3 secondes |
| Réponse de l'API (95 % des requêtes) | Moins de 300 ms |
| Mise à jour du planning après une réservation | Moins de 2 secondes |
| Disponibilité du service | 99,5 % par mois |
| Poids des photos envoyées | Compressées à moins de 300 Ko chacune |
| Couverture de tests des règles métier (section 6) | 90 % minimum |
| Navigateurs | Chrome, Safari, Firefox, Samsung Internet récents |
| Mobile | Android 9+ (priorité), iOS 15+ |

Autres exigences : interface entièrement utilisable en arabe de droite à gauche ; journaux et suivi des erreurs (Sentry ou équivalent auto-hébergé) ; architecture prête pour toutes les wilayas et plusieurs centaines d'agences sans refonte.

## 13. Plan de livraison par phases

La Phase 1 se construit en 3 à 4 mois et suffit pour lancer à Béjaïa ; le paiement en ligne et les applications mobiles viennent ensuite. Chaque phase démarre seulement quand la précédente a atteint son critère de passage.

**Phase 0 · Terrain à Béjaïa (1 à 2 mois)**
- Rencontrer 15 à 20 agences, valider le cadre juridique, signer les agences pilotes.
- Maquettes des écrans testées avec les agences.
- ➜ Critère de passage : 10 agences pilotes signées, cadre juridique confirmé.

**Phase 1 · Version minimale (3 à 4 mois) — à construire en premier**
- Logiciel loueur : flotte, planning, réservations comptoir, contrats, états des lieux.
- Site client : recherche, fiche, réservation avec paiement sur place, back-office de base.
- ➜ Critère de passage : 100 réservations par mois via la plateforme à Béjaïa.

**Phase 2 · Paiement et mobile (2 à 3 mois)**
- Paiement en ligne Chargily (acompte), applications mobiles client et loueur, mode hors ligne.
- Avis, messagerie, tarifs saisonniers, entretien, finances et commissions.
- ➜ Critère de passage : 80 % des agences encore actives après 3 mois.

**Phase 3 · Extension nationale**
- Tizi Ouzou, Alger, Sétif, Oran, Constantine, puis les autres wilayas.
- API publique pour les logiciels existants, offres entreprises, location avec chauffeur.

Les durées supposent un développeur assisté par Claude Code ; elles sont indicatives.

**Critères d'acceptation de la Phase 1 (pour Claude Code)**

- [ ] Une agence s'inscrit, ajoute 10 véhicules avec photos et tarifs en moins de 30 minutes.
- [ ] Une réservation faite sur le site apparaît dans le planning de l'agence en moins de 2 secondes.
- [ ] Deux réservations simultanées sur le même véhicule et la même période : une seule passe (test automatisé).
- [ ] Le contrat PDF bilingue et l'état des lieux avec photos sont générés et signés sur tablette.
- [ ] Une réservation non confirmée en 2 h expire et libère le véhicule.
- [ ] Toute l'interface est disponible en français et en arabe (RTL).
- [ ] L'administrateur valide une agence avant qu'elle soit visible sur le site.

## 14. Vision marketing

La stratégie repose sur un ordre précis : d'abord les agences (grâce au logiciel gratuit), ensuite les clients. Une marketplace sans offre ne convertit personne.

Cercle vertueux : plus d'agences inscrites → plus de choix et de meilleurs prix → plus de clients qui réservent → plus de revenus pour les agences → plus d'agences inscrites. Le logiciel gratuit sert de point de départ.

**14.1 Positionnement**

- **Pour les clients** : « Réservez une voiture fiable à Béjaïa en 3 minutes, prix affiché sans surprise. » Promesse centrale : transparence du prix, agences vérifiées, confirmation rapide.
- **Pour les agences** : « Gérez votre agence depuis votre téléphone et recevez des clients en plus. » Le logiciel d'abord, la visibilité en bonus.
- **Différence** face à Facebook et au bouche-à-oreille : disponibilité réelle, comparaison des prix, avis vérifiés, contrat propre.
- **Marque** : un nom court, prononçable en français, en arabe et en kabyle, avec le nom de domaine `.dz` et `.com` disponibles. Ton proche, local, rassurant.

**14.2 Cibles clients**

| Segment | Besoin | Message |
| --- | --- | --- |
| Diaspora en vacances (été, fêtes) | Réserver depuis l'étranger avant d'arriver, voiture à l'aéroport | « Votre voiture vous attend à l'aéroport de Béjaïa » |
| Touristes algériens (été, côte) | Prix comparables, véhicule familial | « Vos vacances à Béjaïa, la voiture en plus » |
| Locaux sans voiture | Mariage, déménagement, déplacement ponctuel | « Une voiture pour un jour, sans appeler dix agences » |
| Professionnels et entreprises | Missions, véhicule de remplacement, facture | Offre entreprise et facturation mensuelle (phase 3) |

**14.3 Acquisition des agences (phase 0 et 1)**

1. Porte-à-porte à Béjaïa : démo de 15 minutes sur tablette, installation et saisie de la flotte faites par l'équipe.
2. Offre de lancement : logiciel gratuit et zéro commission pendant les 3 premiers mois pour les agences pilotes.
3. Statut « Agence partenaire fondatrice » : badge sur la plateforme et mise en avant.
4. Parrainage : un mois de commission offert par agence parrainée.
5. Groupe WhatsApp des agences partenaires pour le support et les retours.

**14.4 Acquisition des clients**

- **Réseaux sociaux** : Facebook et Instagram (principaux en Algérie), TikTok pour les vidéos courtes ; publicités ciblées sur Béjaïa et, pour la diaspora, sur la France et le Canada.
- **Référencement Google** : une page par ville et par catégorie (« location voiture Béjaïa aéroport », « location voiture pas cher Tichy »), en français et en arabe.
- **Partenariats** : hôtels, auberges, agences de voyage, organisateurs de mariages, avec un code promo par partenaire.
- **Présence physique** : affichage à l'aéroport Abane-Ramdane et au port, QR code dans les agences partenaires.
- **Influenceurs locaux** : créateurs kabyles et béjaïs, vidéos « road trip » (Cap Carbon, Gouraya, corniche de Jijel).
- **Fidélisation** : réduction sur la 2e location, programme de parrainage client, rappels avant l'été.

**14.5 Calendrier**

| Période | Enjeu | Action |
| --- | --- | --- |
| Mars – mai | Préparer l'été | Campagne diaspora « réservez tôt », recrutement d'agences |
| Juin – septembre | Pic de demande | Publicité maximale, partenariats hôtels et aéroport |
| Aïd, Yennayer, fin d'année | Pics courts | Offres spéciales, rappels aux anciens clients |
| Octobre – février | Basse saison | Clients locaux et entreprises, ouverture de nouvelles villes |

**14.6 Budget de lancement (répartition)**

Priorité au terrain avant la publicité : environ 40 % pour l'acquisition des agences (déplacements, tablettes de démo, supports), 40 % pour la publicité en ligne de l'été, 20 % pour les partenariats et l'affichage. Montants à fixer selon les moyens disponibles.

## 15. Modèle économique et indicateurs

Les revenus viennent surtout de la commission sur les réservations en ligne ; le logiciel reste gratuit ou peu cher pour attirer les agences.

| Source de revenu | Principe | Quand |
| --- | --- | --- |
| Commission | 8 à 12 % du montant des réservations venues de la plateforme (taux à valider sur le terrain) | Après les 3 mois offerts |
| Abonnement logiciel | Gratuit jusqu'à 5 véhicules, forfait mensuel au-delà (modules entretien, finances, multi-points) | Phase 2 |
| Mise en avant | Agence ou véhicule en tête des résultats | Phase 2 |
| Options client | Assurance complémentaire, livraison, siège bébé (part de commission) | Phase 3 |
| Offre entreprise | Facturation mensuelle des locations de sociétés | Phase 3 |

**Indicateurs suivis (tableau de bord admin)**

| Indicateur | Définition | Objectif fin Phase 1 à Béjaïa |
| --- | --- | --- |
| Agences actives | Agences avec au moins une action dans le logiciel sur 30 jours | 20 |
| Véhicules visibles | Véhicules publiés sur la plateforme | 150 |
| Réservations plateforme | Réservations confirmées venues du site ou de l'app, par mois | 100 |
| Taux de conversion | Réservations confirmées / visiteurs ayant fait une recherche | 3 % |
| Taux d'acceptation agences | Demandes acceptées / demandes reçues | 90 % |
| Délai de confirmation | Temps médian entre demande et confirmation | Moins de 30 min |
| Note moyenne | Moyenne des avis clients | 4,3 / 5 |
| Rétention agences | Agences encore actives 3 mois après inscription | 80 % |

Les objectifs chiffrés sont des cibles de départ à ajuster après la phase terrain.

## 16. Points à valider avant lancement

Ces décisions ne relèvent pas du code : elles sont à trancher avec un juriste, un comptable ou les agences pendant la Phase 0.

- [ ] Statut juridique de la plateforme : simple intermédiaire technique ou activité réglementée ? Code d'activité au registre du commerce (CNRC, Direction du commerce de Béjaïa).
- [ ] Ouverture future aux particuliers : autorisée ou non par la réglementation de la location de véhicules, et avec quelle assurance.
- [ ] Encaissement pour le compte des agences : la plateforme peut-elle recevoir l'argent puis le reverser, ou chaque agence doit-elle avoir son propre compte marchand ?
- [ ] Valeur juridique de la signature électronique du contrat de location.
- [ ] Déclaration ANPDP et durée de conservation des documents d'identité (loi 18-07).
- [ ] Partage d'une liste noire de clients entre agences : légal ou non.
- [ ] Choix de l'hébergeur en Algérie et du fournisseur SMS.
- [ ] Taux de commission et prix de l'abonnement acceptés par les agences pilotes.
- [ ] Nom de la marque, dépôt à l'INAPI et noms de domaine.

## Sources

- [Chargily Pay — documentation de l'API](https://dev.chargily.com/pay-v2/introduction.md)
- [Chargily sur GitHub (SDK JavaScript, PHP, Python, Dart…)](https://github.com/Chargily)
