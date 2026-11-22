/**
 * Assemble les captures (demo/captures/index.json) en un PDF de démonstration.
 *   node pdf.mjs   → demo/Demo-Location-Bejaia.pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const SORTIE = process.env.DEMO_SORTIE ?? join(process.cwd(), "demo");
const dossier = join(SORTIE, "captures");
const ecrans = JSON.parse(readFileSync(join(dossier, "index.json"), "utf8"));

const PARTIES = {
  site: {
    titre: "Le site client",
    texte:
      "Le client cherche une voiture par ville et par dates, voit le prix total, réserve en quelques minutes et suit sa location. Paiement sur place en Phase 1.",
    couleur: "#4c5de4",
    fond: "#eef0ff",
  },
  loueur: {
    titre: "Le logiciel des agences",
    texte:
      "L'agence gère sa flotte, son planning, ses réservations du site et du comptoir, ses contrats, sa caisse, ses dépenses et ses clients — sur ordinateur, tablette ou téléphone.",
    couleur: "#1e6b44",
    fond: "#dcf4e6",
  },
  admin: {
    titre: "Le back-office",
    texte:
      "L'équipe de la plateforme valide les agences, vérifie les documents des clients, modère les avis et suit l'activité.",
    couleur: "#7a5800",
    fond: "#fff3c4",
  },
};

const echapper = (t) =>
  String(t ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Africa/Algiers",
}).format(new Date());

let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #1d1d1f; }
  .page { width: 297mm; height: 210mm; padding: 12mm 14mm; page-break-after: always; position: relative;
          display: flex; flex-direction: column; background: #f5f5f7; overflow: hidden; }
  .couverture { justify-content: center; background: linear-gradient(135deg,#eef0ff 0%,#f5f2ff 45%,#fff5ee 100%); }
  .logo { width: 64px; height: 64px; border-radius: 20px; background: #4c5de4; color: #fff; display: flex;
          align-items: center; justify-content: center; font-size: 34px; box-shadow: 0 12px 30px -12px rgba(76,93,228,.9); }
  h1 { font-size: 46px; letter-spacing: -.02em; margin: 22px 0 8px; }
  .sous { font-size: 20px; color: #6e6e73; max-width: 190mm; line-height: 1.45; }
  .pastilles { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
  .pastille { padding: 8px 16px; border-radius: 99px; font-size: 14px; font-weight: 600; }
  .pied { position: absolute; bottom: 9mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between;
          font-size: 11px; color: #8e8e93; }
  .partie { justify-content: center; }
  .partie h2 { font-size: 40px; margin: 0 0 12px; letter-spacing: -.02em; }
  .partie p { font-size: 19px; color: #3a3a3c; max-width: 200mm; line-height: 1.5; margin: 0; }
  .partie ol { margin: 26px 0 0; padding: 0; columns: 2; column-gap: 14mm; font-size: 14px; color: #3a3a3c;
               list-style: none; max-width: 230mm; }
  .partie li { padding: 4px 0; break-inside: avoid; }
  .partie li span { display: inline-block; min-width: 26px; font-weight: 600; }
  .entete { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
  .num { font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
  .entete h3 { font-size: 24px; margin: 0; letter-spacing: -.01em; }
  .texte { font-size: 14px; color: #48484a; margin: 2px 0 8px; min-height: 18px; }
  .cadre { flex: 1; min-height: 0; display: flex; align-items: flex-start; justify-content: center; }
  .cadre img { max-width: 100%; max-height: 100%; object-fit: contain; object-position: top; border-radius: 14px;
               box-shadow: 0 2px 6px rgba(0,0,0,.05), 0 18px 48px rgba(31,39,102,.14); background: #fff; }
  .mobile .cadre img { border-radius: 26px; border: 6px solid #1d1d1f; }
  .chemin { font-family: ui-monospace, Consolas, monospace; }
</style></head><body>`;

html += `<section class="page couverture">
  <div class="logo"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/></svg></div>
  <h1>Location Béjaïa</h1>
  <div class="sous">Plateforme de location de véhicules : site client, logiciel des agences et back-office,
  reliés par une seule base de données. Démonstration de la Phase 1.</div>
  <div class="pastilles">
    ${Object.values(PARTIES)
      .map(
        (p) =>
          `<span class="pastille" style="background:${p.fond};color:${p.couleur}">${p.titre}</span>`,
      )
      .join("")}
    <span class="pastille" style="background:#fff;color:#3a3a3c">Français · العربية · Taqbaylit</span>
  </div>
  <div class="pied"><span>Démonstration — données fictives</span><span>${date}</span></div>
</section>`;

let n = 0;
for (const [cle, p] of Object.entries(PARTIES)) {
  const liste = ecrans.filter((e) => e.partie === cle);
  if (!liste.length) continue;
  html += `<section class="page partie" style="background:linear-gradient(135deg,${p.fond},#fff)">
    <div class="num" style="background:#fff;color:${p.couleur};width:max-content;margin-bottom:16px">Partie ${
      Object.keys(PARTIES).indexOf(cle) + 1
    }</div>
    <h2 style="color:${p.couleur}">${p.titre}</h2><p>${p.texte}</p>
    <ol>${liste.map((e, i) => `<li><span>${n + i + 1}.</span>${echapper(e.titre)}</li>`).join("")}</ol>
  </section>`;
  for (const e of liste) {
    n += 1;
    const image = pathToFileURL(join(dossier, e.fichier)).href;
    html += `<section class="page${e.mobile ? " mobile" : ""}">
      <div class="entete"><span class="num" style="background:${p.fond};color:${p.couleur}">${n}</span>
        <h3>${echapper(e.titre)}</h3></div>
      <div class="texte">${echapper(e.texte)}</div>
      <div class="cadre"><img src="${image}"></div>
      <div class="pied"><span>${p.titre}</span><span class="chemin">${echapper(e.chemin)}</span></div>
    </section>`;
  }
}

html += `<section class="page couverture">
  <h1 style="margin-top:0">Et ensuite ?</h1>
  <div class="sous">Phase 2 : paiement en ligne Chargily (acompte par CIB / Edahabia), applications mobiles
  client et loueur, mode hors ligne du logiciel des agences, relevé des commissions.</div>
  <div class="pied"><span>Location Béjaïa</span><span>${date}</span></div>
</section></body></html>`;

const fichierHtml = join(dossier, "demo.html");
writeFileSync(fichierHtml, html);
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const page = await navigateur.newPage();
await page.goto(pathToFileURL(fichierHtml).href, { waitUntil: "load" });
const pdf = join(SORTIE, "Demo-Location-Bejaia.pdf");
await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
await navigateur.close();
console.log(`PDF : ${pdf} (${n} écrans)`);
