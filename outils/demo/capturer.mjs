/**
 * Démo automatique : captures d'écran de toutes les pages et vidéo commentée.
 *
 * Prérequis : API (4000), site client (3000, avec /agence) et back-office (3002) lancés,
 * scénario de démonstration chargé (`pnpm --filter @lvb/db db:demo`), Google Chrome installé.
 * Les connexions utilisent les comptes de test (code SMS fixe en développement uniquement).
 *
 *   node capturer.mjs captures   → demo/captures/*.png + demo/captures/index.json
 *   node capturer.mjs video      → demo/video/img-*.jpg + images.ffconcat (voir README de demo)
 *   node capturer.mjs tout       → les deux (une seule connexion par compte)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const SITE = "http://localhost:3000";
const ADMIN = "http://localhost:3002";
const API = "http://localhost:4000/api/v1";
const SORTIE = process.env.DEMO_SORTIE ?? join(process.cwd(), "demo");
const CODE_TEST = "123456";
const COMPTES = {
  client: "+213550000010", // Amel Test
  gerant: "+213550000002",
  admin: "+213550000001",
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Jetons de connexion d'un compte de test (code SMS fixe en développement). */
async function connecter(telephone) {
  const appel = async (chemin, corps) => {
    const r = await fetch(`${API}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!r.ok) throw new Error(`${chemin} : ${r.status} ${await r.text()}`);
    return r.json();
  };
  await appel("/auth/otp/envoyer", { telephone });
  const j = await appel("/auth/otp/verifier", { telephone, code: CODE_TEST, appareil: "demo" });
  return { jetonAcces: j.jetonAcces, jetonRafraichissement: j.jetonRafraichissement };
}

async function get(chemin, jetons) {
  const r = await fetch(`${API}${chemin}`, {
    headers: { Authorization: `Bearer ${jetons.jetonAcces}` },
  });
  if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
  return r.json();
}

/** Dates de recherche : demain 10 h → dans 4 jours 10 h (heure d'Alger). */
function periode() {
  const jour = (n) => {
    const d = new Date(Date.now() + n * 86_400_000);
    return d.toISOString().slice(0, 10);
  };
  return { debut: `${jour(1)}T10:00:00+01:00`, fin: `${jour(4)}T10:00:00+01:00` };
}

/** Prépare les identifiants utiles (véhicule, réservations, entreprise…). */
async function preparer() {
  const jetons = {
    client: await connecter(COMPTES.client),
    gerant: await connecter(COMPTES.gerant),
    admin: await connecter(COMPTES.admin),
  };
  const p = periode();
  const q = new URLSearchParams({ wilaya: "6", debut: p.debut, fin: p.fin }).toString();
  const resultats = await fetch(`${API}/recherche?${q}`).then((r) => r.json());
  const liste = resultats.resultats ?? resultats.vehicules ?? resultats;
  const vehicule = Array.isArray(liste) ? liste[0] : null;
  const mesResas = await get("/moi/reservations", jetons.client);
  const resasClient = mesResas.reservations ?? mesResas;
  const avenir = resasClient.find((r) => r.code === "DEMO-AVENIR") ?? resasClient[0];
  const moi = await get("/moi", jetons.gerant);
  const agenceId = moi.agences[0].id;
  const avecAgence = (chemin) =>
    fetch(`${API}${chemin}`, {
      headers: { Authorization: `Bearer ${jetons.gerant.jetonAcces}`, "X-Agence-Id": agenceId },
    }).then((r) => r.json());
  const resas = await avecAgence("/agence/reservations?parPage=100");
  const lignes = resas.resultats ?? resas;
  const encours = Array.isArray(lignes) ? lignes.find((r) => r.code === "DEMO-ENCOURS") : null;
  const entreprises = await avecAgence("/agence/entreprises");
  const flotte = await avecAgence("/agence/vehicules");
  const agences = await fetch(`${API}/admin/agences`, {
    headers: { Authorization: `Bearer ${jetons.admin.jetonAcces}` },
  }).then((r) => r.json());
  return {
    jetons,
    periode: p,
    requete: q,
    vehiculeId: vehicule?.id ?? vehicule?.vehiculeId ?? flotte[0]?.id,
    avenirId: avenir?.id,
    encoursId: encours?.id,
    entrepriseId: entreprises[0]?.id,
    flotteId: flotte[0]?.id,
    agenceId,
    agenceAdminId: (agences.agences ?? agences)[0]?.id,
    slug: moi.agences[0].slug ?? "yemma-gouraya-location-901d",
  };
}

/** Pose les jetons dans le navigateur pour l'origine courante. */
async function poserSession(page, origine, cle, jetons) {
  await page.goto(`${origine}/favicon.ico`).catch(() => {});
  await page.evaluate(
    ([c, j]) => {
      if (j) localStorage.setItem(c, JSON.stringify(j));
      else localStorage.removeItem(c);
    },
    [cle, jetons],
  );
}

/** Attend la fin des chargements visibles (indicateurs « Chargement »). */
async function stabiliser(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"], .animate-spin'), null, {
      timeout: 8_000,
    })
    .catch(() => {});
  await attendre(ms);
}

// ---------------------------------------------------------------------------
// Liste des écrans
// ---------------------------------------------------------------------------

function ecrans(d) {
  const { requete, periode: p } = d;
  const reserver = `/fr/reserver/${d.vehiculeId}?${new URLSearchParams({ debut: p.debut, fin: p.fin })}`;
  return [
    // Site client — visiteur
    {
      partie: "site",
      session: null,
      titre: "Accueil du site",
      texte: "Recherche par ville et par dates, en français, arabe ou tamazight.",
      url: `${SITE}/fr`,
    },
    {
      partie: "site",
      session: null,
      titre: "Résultats de recherche",
      texte: "Seules les voitures libres sur toute la période s'affichent, avec le prix total.",
      url: `${SITE}/fr/recherche?${requete}`,
    },
    {
      partie: "site",
      session: null,
      titre: "Fiche d'une voiture",
      texte: "Photos, caractéristiques, prix détaillé, caution, conditions et avis de l'agence.",
      url: `${SITE}/fr/vehicules/${d.vehiculeId}?${new URLSearchParams({ debut: p.debut, fin: p.fin })}`,
    },
    {
      partie: "site",
      session: null,
      titre: "Page publique d'une agence",
      texte: "Chaque agence a sa page à partager (lien et QR code), avec ses voitures et ses avis.",
      url: `${SITE}/fr/agences/${d.slug}`,
    },
    {
      partie: "site",
      session: null,
      titre: "Page par ville (référencement Google)",
      texte: "« Location voiture Béjaïa » : pages rendues côté serveur pour Google.",
      url: `${SITE}/fr/location-voiture/bejaia`,
    },
    {
      partie: "site",
      session: null,
      titre: "Connexion par SMS",
      texte: "Un numéro de téléphone et un code reçu par SMS : pas de mot de passe.",
      url: `${SITE}/fr/connexion`,
    },
    // Site client — client connecté
    {
      partie: "site",
      session: "client",
      titre: "Réserver",
      texte:
        "Options, livraison à une adresse, paiement sur place. L'agence confirme sous 2 heures.",
      url: `${SITE}${reserver}`,
    },
    {
      partie: "site",
      session: "client",
      titre: "Mes réservations",
      texte: "À venir, en cours, passées. Annulation selon la politique de l'agence.",
      url: `${SITE}/fr/compte`,
    },
    {
      partie: "site",
      session: "client",
      titre: "Suivi d'une réservation",
      texte:
        "Statut, contrat PDF, messagerie avec l'agence, appel et WhatsApp, avis après le retour.",
      url: `${SITE}/fr/compte/${d.avenirId}`,
    },
    {
      partie: "site",
      session: "client",
      titre: "Mon profil et mes documents",
      texte: "Permis et pièce d'identité, vérifiés par l'agence ou l'administrateur.",
      url: `${SITE}/fr/profil`,
    },
    {
      partie: "site",
      session: null,
      titre: "Version arabe (de droite à gauche)",
      texte: "Toute l'interface existe en arabe, avec la mise en page inversée.",
      url: `${SITE}/ar`,
    },
    {
      partie: "site",
      session: null,
      mobile: true,
      titre: "Sur téléphone",
      texte: "Le site est conçu d'abord pour le téléphone.",
      url: `${SITE}/fr`,
    },
    {
      partie: "site",
      session: null,
      mobile: true,
      titre: "Fiche voiture sur téléphone",
      texte: "",
      url: `${SITE}/fr/vehicules/${d.vehiculeId}?${new URLSearchParams({ debut: p.debut, fin: p.fin })}`,
    },

    // Logiciel des agences
    {
      partie: "loueur",
      session: "gerant",
      titre: "Tableau de bord",
      texte:
        "Départs, retours, demandes à confirmer, retards, chiffre d'affaires, entretien à surveiller, voitures les plus rentables.",
      url: `${SITE}/agence/fr/tableau-de-bord`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Planning",
      texte:
        "Une ligne par voiture ; glisser-déposer pour changer de véhicule ; blocage de périodes.",
      url: `${SITE}/agence/fr/planning`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Réservations",
      texte: "Toutes les réservations du site et du comptoir, filtres et export Excel.",
      url: `${SITE}/agence/fr/reservations`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Fiche d'une réservation",
      texte:
        "Contrat signé sur tablette, états des lieux, encaissements, facture, messagerie, entreprise facturée.",
      url: `${SITE}/agence/fr/reservations/${d.encoursId}`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Réservation au comptoir",
      texte:
        "Client existant ou nouveau, prix calculé automatiquement, location pour une entreprise.",
      url: `${SITE}/agence/fr/reservations/nouvelle`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Messages",
      texte: "Toutes les conversations avec les clients ; un clic sur le nom ouvre son profil.",
      url: `${SITE}/agence/fr/messages`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Flotte",
      texte: "Les voitures de l'agence, leur statut et leur visibilité sur le site.",
      url: `${SITE}/agence/fr/flotte`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Fiche d'une voiture",
      texte: "Caractéristiques, photos, point de retrait, rentabilité.",
      url: `${SITE}/agence/fr/flotte/${d.flotteId}`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Entretien",
      texte:
        "Rappels vidange, assurance, contrôle technique, vignette, pneus — par date et kilométrage.",
      url: `${SITE}/agence/fr/entretien`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Caisse",
      texte:
        "Les paiements entrent automatiquement ; dépenses et remboursements sortent ; cautions à part.",
      url: `${SITE}/agence/fr/caisse`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Dépenses",
      texte: "Pneus, réparations, carburant, loyer, salaires… par voiture ou générales.",
      url: `${SITE}/agence/fr/depenses`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Amendes",
      texte: "Le logiciel retrouve qui conduisait à la date de l'infraction.",
      url: `${SITE}/agence/fr/amendes`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Clients particuliers",
      texte: "Historique, notes internes, liste noire propre à l'agence.",
      url: `${SITE}/agence/fr/clients`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Clients entreprises",
      texte: "Sociétés facturées à leur nom (NIF, NIS, RC, article d'imposition).",
      url: `${SITE}/agence/fr/clients?type=entreprises`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Fiche d'une entreprise",
      texte: "Conducteurs, locations, chiffre d'affaires et reste à payer.",
      url: `${SITE}/agence/fr/clients/entreprises/${d.entrepriseId}`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Tarifs",
      texte: "Prix par jour, dégressifs, saisons, suppléments, caution.",
      url: `${SITE}/agence/fr/tarifs`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Avis des clients",
      texte: "Réponse publique de l'agence, signalement à l'administrateur.",
      url: `${SITE}/agence/fr/avis`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Ma page",
      texte: "La page publique de l'agence, son lien et son QR code.",
      url: `${SITE}/agence/fr/ma-page`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Équipe",
      texte: "Employés, droits par rôle, journal des actions.",
      url: `${SITE}/agence/fr/equipe`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Paramètres",
      texte: "Informations de l'agence, points de retrait, règles de location.",
      url: `${SITE}/agence/fr/parametres`,
    },
    {
      partie: "loueur",
      session: "gerant",
      titre: "Logiciel en arabe",
      texte: "",
      url: `${SITE}/agence/ar/tableau-de-bord`,
    },
    {
      partie: "loueur",
      session: "gerant",
      mobile: true,
      titre: "Logiciel sur téléphone",
      texte: "Le gérant suit son agence depuis son téléphone, sans se reconnecter.",
      url: `${SITE}/agence/fr/tableau-de-bord`,
    },

    // Back-office
    {
      partie: "admin",
      session: "admin",
      titre: "Indicateurs de la plateforme",
      texte: "Agences actives, réservations, chiffre d'affaires, délai de confirmation.",
      url: `${ADMIN}/fr/indicateurs`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Validation des agences",
      texte: "Une agence n'apparaît sur le site qu'après validation de son dossier.",
      url: `${ADMIN}/fr/agences`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Dossier d'une agence",
      texte: "Justificatifs, suspension, taux de commission.",
      url: `${ADMIN}/fr/agences/${d.agenceAdminId}`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Toutes les réservations",
      texte: "",
      url: `${ADMIN}/fr/reservations`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Vérification des documents",
      texte: "Permis et pièces d'identité des clients.",
      url: `${ADMIN}/fr/documents`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Modération des avis",
      texte: "",
      url: `${ADMIN}/fr/avis`,
    },
    {
      partie: "admin",
      session: "admin",
      titre: "Utilisateurs",
      texte: "Blocage des comptes frauduleux.",
      url: `${ADMIN}/fr/utilisateurs`,
    },
  ];
}

const CLES = { site: "lvb.jetons", loueur: "lvb.jetons", admin: "admin.jetons" };

async function ouvrirEcran(page, e, d, etat) {
  const origine = e.url.startsWith(ADMIN) ? ADMIN : SITE;
  const cle = origine === ADMIN ? "admin.jetons" : "lvb.jetons";
  const voulu = `${origine}|${e.session ?? "aucune"}`;
  if (etat.session !== voulu) {
    await poserSession(page, origine, cle, e.session ? d.jetons[e.session] : null);
    etat.session = voulu;
  }
  await page.goto(e.url, { waitUntil: "domcontentloaded" });
  await stabiliser(page);
}

// ---------------------------------------------------------------------------
// Captures d'écran
// ---------------------------------------------------------------------------

async function captures(navigateur, d) {
  const dossier = join(SORTIE, "captures");
  mkdirSync(dossier, { recursive: true });
  const index = [];
  const contextes = {
    bureau: await navigateur.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      permissions: ["notifications"],
    }),
    mobile: await navigateur.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      permissions: ["notifications"],
    }),
  };
  const pages = {
    bureau: await contextes.bureau.newPage(),
    mobile: await contextes.mobile.newPage(),
  };
  const etats = { bureau: {}, mobile: {} };
  let n = 0;
  for (const e of ecrans(d)) {
    n += 1;
    const type = e.mobile ? "mobile" : "bureau";
    const page = pages[type];
    try {
      await ouvrirEcran(page, e, d, etats[type]);
      const fichier = `${String(n).padStart(2, "0")}-${e.partie}.png`;
      const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
      const max = e.mobile ? 1700 : 1500;
      await page.screenshot({
        path: join(dossier, fichier),
        fullPage: hauteur <= max,
        clip:
          hauteur > max ? { x: 0, y: 0, width: page.viewportSize().width, height: max } : undefined,
      });
      index.push({ ...e, fichier, url: undefined, chemin: new URL(e.url).pathname });
      console.log(`✓ ${fichier} ${e.titre}`);
    } catch (err) {
      console.log(`✗ ${e.titre} : ${err.message}`);
    }
  }
  writeFileSync(join(dossier, "index.json"), JSON.stringify(index, null, 2));
  await contextes.bureau.close();
  await contextes.mobile.close();
}

// ---------------------------------------------------------------------------
// Vidéo commentée
// ---------------------------------------------------------------------------

/** Bandeau de légende posé sur la page pendant l'enregistrement. */
async function legende(page, titre, texte, partie) {
  const couleurs = { site: "#4c5de4", loueur: "#1e6b44", admin: "#7a5800" };
  await page.evaluate(
    ([titre, texte, couleur]) => {
      document.getElementById("demo-legende")?.remove();
      const b = document.createElement("div");
      b.id = "demo-legende";
      b.style.cssText = `position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;
        max-width:min(880px,92vw);padding:14px 22px;border-radius:18px;background:rgba(29,29,31,.88);
        color:#fff;font:500 15px/1.45 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);
        backdrop-filter:blur(8px);direction:ltr;text-align:left`;
      b.innerHTML = `<div style="display:flex;align-items:center;gap:10px;font-weight:650;font-size:17px">
        <span style="width:10px;height:10px;border-radius:99px;background:${couleur}"></span>${titre}</div>
        ${texte ? `<div style="opacity:.85;margin-top:4px">${texte}</div>` : ""}`;
      document.body.appendChild(b);
    },
    [titre, texte, couleurs[partie] ?? "#4c5de4"],
  );
}

/** Carton de titre plein écran entre deux parties. */
async function carton(page, titre, sousTitre) {
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;
    align-items:center;justify-content:center;background:linear-gradient(135deg,#eef0ff,#fff5ee);
    font-family:Inter,system-ui,sans-serif;color:#1d1d1f"><div style="text-align:center">
    <div style="font-size:46px;font-weight:700;letter-spacing:-.02em">${titre}</div>
    <div style="font-size:20px;color:#6e6e73;margin-top:12px">${sousTitre}</div></div></body></html>`);
  await attendre(2800);
}

async function defiler(page, duree = 2500) {
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (hauteur < 80) return attendre(duree);
  const pas = 20;
  for (let i = 1; i <= pas; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y }), Math.min(hauteur, 1400) * (i / pas));
    await attendre(duree / pas);
  }
  await attendre(600);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await attendre(500);
}

/**
 * Enregistreur : captures d'écran en continu (l'enregistrement intégré de Chrome rogne
 * l'image en mode sans fenêtre), assemblées ensuite par ffmpeg avec leur durée réelle.
 */
function enregistreur(page, dossier) {
  const images = [];
  let actif = true;
  let n = 0;
  const boucle = (async () => {
    while (actif) {
      const debut = Date.now();
      try {
        const fichier = join(dossier, `img-${String(n).padStart(6, "0")}.jpg`);
        await page.screenshot({ path: fichier, type: "jpeg", quality: 82 });
        images.push({ fichier, t: Date.now() });
        n += 1;
      } catch {
        /* page en cours de navigation : on garde l'image précédente */
      }
      await attendre(Math.max(0, 90 - (Date.now() - debut)));
    }
  })();
  return {
    async arreter() {
      actif = false;
      await boucle;
      // Liste ffmpeg « concat » : chaque image dure jusqu'à la suivante.
      const lignes = ["ffconcat version 1.0"];
      images.forEach((im, i) => {
        const suivante = images[i + 1]?.t ?? im.t + 100;
        lignes.push(
          `file '${im.fichier.replaceAll("\\", "/")}'`,
          `duration ${((suivante - im.t) / 1000).toFixed(3)}`,
        );
      });
      lignes.push(`file '${images.at(-1).fichier.replaceAll("\\", "/")}'`);
      writeFileSync(join(dossier, "images.ffconcat"), lignes.join("\n"));
      return images.length;
    },
  };
}

async function video(navigateur, d) {
  const dossier = join(SORTIE, "video");
  mkdirSync(dossier, { recursive: true });
  const contexte = await navigateur.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    permissions: ["notifications"],
  });
  const page = await contexte.newPage();
  const enreg = enregistreur(page, dossier);
  const etat = {};
  const titres = {
    site: ["Le site client", "Rechercher, réserver, suivre sa location"],
    loueur: ["Le logiciel des agences", "Gérer la flotte, les réservations et l'argent"],
    admin: ["Le back-office", "Contrôler la qualité et piloter la plateforme"],
  };
  await carton(page, "Location Béjaïa", "Démonstration de la plateforme — Phase 1");
  let partie = null;
  for (const e of ecrans(d).filter((x) => !x.mobile)) {
    if (e.partie !== partie) {
      partie = e.partie;
      etat.session = undefined; // la page de titre a quitté le site
      await carton(page, ...titres[partie]);
    }
    try {
      await ouvrirEcran(page, e, d, etat);
      await legende(page, e.titre, e.texte, e.partie);
      await defiler(page, e.texte ? 3200 : 2200);
    } catch (err) {
      console.log(`✗ ${e.titre} : ${err.message}`);
    }
    console.log(`▶ ${e.titre}`);
  }
  await carton(page, "Merci", "Location Béjaïa — site client, logiciel des agences, back-office");
  console.log(`${await enreg.arreter()} images enregistrées`);
  await page.close();
  await contexte.close();
}

// ---------------------------------------------------------------------------

const mode = process.argv[2] ?? "captures";
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
try {
  const d = await preparer();
  console.log("Identifiants :", { ...d, jetons: "…" });
  if (mode !== "video") await captures(navigateur, d);
  if (mode !== "captures") await video(navigateur, d);
} finally {
  await navigateur.close();
}
