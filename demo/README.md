# Démonstration

| Fichier                                                | Contenu                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| [`Demo-Location-Bejaia.pdf`](Demo-Location-Bejaia.pdf) | 42 écrans commentés : site client, logiciel des agences, back-office |
| [`Demo-Location-Bejaia.mp4`](Demo-Location-Bejaia.mp4) | Visite guidée en vidéo, avec une légende sur chaque écran            |
| [`captures/`](captures)                                | Les captures d'écran une par une (ordinateur et téléphone)           |

Les données sont fictives (scénario `pnpm --filter @lvb/db db:demo`).

## Régénérer la démo

Avec l'API, le site (3000, logiciel sous `/agence`) et le back-office (3002) lancés, et Google
Chrome installé, depuis un dossier où `playwright-core` est installé
(`npm i playwright-core@1.49.1`) :

```bash
DEMO_SORTIE=<chemin du dépôt>/demo node outils/demo/capturer.mjs tout   # captures + images de la vidéo
DEMO_SORTIE=<chemin du dépôt>/demo node outils/demo/pdf.mjs             # PDF
ffmpeg -f concat -safe 0 -i demo/video/images.ffconcat -vf "fps=25,format=yuv420p" \
  -c:v libx264 -crf 22 -movflags +faststart demo/Demo-Location-Bejaia.mp4   # vidéo
```

Les connexions utilisent les comptes de test et le code SMS fixe, qui n'existent qu'en
développement.
