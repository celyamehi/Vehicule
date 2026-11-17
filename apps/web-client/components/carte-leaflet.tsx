"use client";

import { formaterMontant } from "@lvb/ui";
import type { Langue } from "@lvb/shared";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocale } from "next-intl";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Link } from "@/i18n/navigation";
import type { PointCarte } from "./vue-resultats";

const BEJAIA: [number, number] = [36.7509, 5.0567];

/** Carte OpenStreetMap + Leaflet (sans licence), un repère de prix par véhicule. */
export function CarteLeaflet({ points, requete }: { points: PointCarte[]; requete: string }) {
  const langue = useLocale() as Langue;
  const places = points.filter(
    (p): p is PointCarte & { lat: number; lon: number } => p.lat !== null && p.lon !== null,
  );
  // Plusieurs véhicules au même point de retrait : léger décalage pour les distinguer.
  const decales = places.map((p, i) => ({
    ...p,
    lat: p.lat + (i % 5) * 0.0004,
    lon: p.lon + Math.floor(i / 5) * 0.0004,
  }));
  return (
    <div dir="ltr" className="h-[70vh] overflow-hidden rounded-xl border border-trait">
      <MapContainer
        center={decales[0] ? [decales[0].lat, decales[0].lon] : BEJAIA}
        zoom={12}
        className="size-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {decales.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lon]}
            icon={L.divIcon({
              className: "",
              html: `<span style="background:#0b63ce;color:#fff;padding:2px 6px;border-radius:9999px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">${formaterMontant(p.prix, langue)}</span>`,
            })}
          >
            <Popup>
              <Link href={`/vehicules/${p.id}?${requete}`}>{p.libelle}</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
