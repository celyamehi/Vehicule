import type { CodeErreur } from "@lvb/shared";

/** Erreur renvoyée par l'API au format `{ code, message, details }`. */
export class ErreurApi extends Error {
  constructor(
    public readonly code: CodeErreur | "RESEAU",
    message: string,
    public readonly statut: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export type Jetons = { jetonAcces: string; jetonRafraichissement: string };

export type OptionsClient = {
  urlApi: string;
  langue: () => string;
  jetons: () => Jetons | null;
  /** Appelé après une rotation réussie ou une déconnexion forcée (null). */
  surNouveauxJetons: (j: Jetons | null) => void;
  agenceId?: () => string | null;
};

/** Client HTTP de l'API, avec rafraîchissement automatique du jeton d'accès. */
export class ClientApi {
  private rafraichissement: Promise<boolean> | null = null;

  constructor(private readonly options: OptionsClient) {}

  get urlApi() {
    return this.options.urlApi;
  }

  private async rafraichir(): Promise<boolean> {
    const jetons = this.options.jetons();
    if (!jetons) return false;
    this.rafraichissement ??= fetch(`${this.options.urlApi}/auth/rafraichir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jetonRafraichissement: jetons.jetonRafraichissement }),
    })
      .then(async (r) => {
        if (!r.ok) {
          this.options.surNouveauxJetons(null);
          return false;
        }
        const corps = (await r.json()) as Jetons;
        this.options.surNouveauxJetons({
          jetonAcces: corps.jetonAcces,
          jetonRafraichissement: corps.jetonRafraichissement,
        });
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.rafraichissement = null;
      });
    return this.rafraichissement;
  }

  private entetes(json: boolean): Record<string, string> {
    const h: Record<string, string> = { "Accept-Language": this.options.langue() };
    if (json) h["Content-Type"] = "application/json";
    const j = this.options.jetons();
    if (j) h.Authorization = `Bearer ${j.jetonAcces}`;
    const agence = this.options.agenceId?.();
    if (agence) h["X-Agence-Id"] = agence;
    return h;
  }

  async requete<T>(methode: string, chemin: string, corps?: unknown, deja = false): Promise<T> {
    let reponse: Response;
    try {
      reponse = await fetch(`${this.options.urlApi}${chemin}`, {
        method: methode,
        headers: this.entetes(corps !== undefined),
        body: corps === undefined ? undefined : JSON.stringify(corps),
      });
    } catch {
      throw new ErreurApi("RESEAU", "", 0);
    }
    if (reponse.status === 401 && !deja && this.options.jetons()) {
      if (await this.rafraichir()) return this.requete<T>(methode, chemin, corps, true);
    }
    if (reponse.status === 204) return undefined as T;
    const texte = await reponse.text();
    const donnees = texte ? JSON.parse(texte) : undefined;
    if (!reponse.ok) {
      const e = donnees as { code?: CodeErreur; message?: string; details?: unknown } | undefined;
      throw new ErreurApi(
        e?.code ?? "ERREUR_INTERNE",
        e?.message ?? reponse.statusText,
        reponse.status,
        e?.details,
      );
    }
    return donnees as T;
  }

  get<T>(chemin: string, params?: Record<string, string | number | boolean | undefined | null>) {
    const q = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => [k, String(v)]),
        )}`
      : "";
    return this.requete<T>("GET", `${chemin}${q}`);
  }
  post<T>(chemin: string, corps: unknown = {}) {
    return this.requete<T>("POST", chemin, corps);
  }
  patch<T>(chemin: string, corps: unknown) {
    return this.requete<T>("PATCH", chemin, corps);
  }
  delete<T = void>(chemin: string) {
    return this.requete<T>("DELETE", chemin);
  }

  /** Télécharge un fichier protégé (PDF) et l'ouvre dans un nouvel onglet. */
  async ouvrirFichier(chemin: string) {
    const fenetre = window.open("", "_blank");
    let r = await fetch(`${this.options.urlApi}${chemin}`, { headers: this.entetes(false) });
    if (r.status === 401 && (await this.rafraichir()))
      r = await fetch(`${this.options.urlApi}${chemin}`, { headers: this.entetes(false) });
    if (!r.ok) {
      fenetre?.close();
      throw new ErreurApi("INTROUVABLE", r.statusText, r.status);
    }
    const url = URL.createObjectURL(await r.blob());
    if (fenetre) fenetre.location.href = url;
    else window.location.href = url;
  }
}
