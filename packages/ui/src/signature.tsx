"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/** Zone de signature au doigt ou au stylet (tablette, téléphone) ; renvoie une image PNG en data URL. */
export function PadSignature({
  onChange,
  hauteur = 180,
}: {
  onChange: (dataUrl: string | null) => void;
  hauteur?: number;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = hauteur * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, [hauteur]);

  const position = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const exporter = () => {
    const c = ref.current!;
    // Image réduite (fond blanc, JPEG non nécessaire) pour rester légère.
    const sortie = document.createElement("canvas");
    sortie.width = 600;
    sortie.height = Math.round((600 * c.height) / c.width);
    const ctx = sortie.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, sortie.width, sortie.height);
    ctx.drawImage(c, 0, 0, sortie.width, sortie.height);
    onChange(sortie.toDataURL("image/png"));
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={ref}
        style={{ height: hauteur, touchAction: "none" }}
        className="w-full rounded-lg border-2 border-dashed border-trait bg-white"
        aria-label={t("ui.signerIci")}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dessin.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = position(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!dessin.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = position(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          setVide(false);
        }}
        onPointerUp={() => {
          dessin.current = false;
          if (!vide) exporter();
        }}
      />
      <div className="flex items-center justify-between text-xs text-attenue">
        <span>{t("ui.signerIci")}</span>
        <button
          type="button"
          className="text-marque-700 underline"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setVide(true);
            onChange(null);
          }}
        >
          {t("ui.effacer")}
        </button>
      </div>
    </div>
  );
}
