"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polyline, CircleMarker } from "leaflet";
export type TrackPoint = {
  lat: number;
  lng: number;
  time: number;
  accuracy: number;
  speed: number | null;
};
export default function TripMap({
  points,
  follow,
}: {
  points: TrackPoint[];
  follow: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    line = useRef<Polyline | null>(null),
    marker = useRef<CircleMarker | null>(null);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const m = L.map(container.current, { zoomControl: false }).setView(
          [4.65, -74.08],
          12,
        );
        map.current = m;
        L.control.zoom({ position: "bottomright" }).addTo(m);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          },
        ).addTo(m);
        tiles.on("tileerror", () =>
          setError(
            "No se pudieron cargar algunas partes del mapa. Revisa tu conexión.",
          ),
        );
        tiles.on("load", () => setError(""));
        line.current = L.polyline([], {
          color: "#1b9475",
          weight: 6,
          opacity: 0.85,
        }).addTo(m);
        marker.current = L.circleMarker([4.65, -74.08], {
          radius: 9,
          fillColor: "#167e62",
          color: "#fff",
          weight: 4,
          fillOpacity: 1,
        });
        setLoaded(true);
      })
      .catch(() => setError("No se pudo cargar el mapa."));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !map.current || !points.length) return;
    const last = points[points.length - 1];
    line.current?.setLatLngs(points.map((p) => [p.lat, p.lng]));
    marker.current?.setLatLng([last.lat, last.lng]).addTo(map.current);
    if (follow)
      map.current.setView(
        [last.lat, last.lng],
        Math.max(map.current.getZoom(), 16),
        { animate: true },
      );
    else if (points.length > 1)
      map.current.fitBounds(line.current!.getBounds(), {
        padding: [35, 35],
        maxZoom: 16,
      });
  }, [points, follow, loaded]);
  return (
    <>
      <div
        ref={container}
        className="trip-leaflet"
        aria-label="Mapa del recorrido con ubicación GPS"
      />
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
    </>
  );
}
