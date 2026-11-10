export const ZONES = [
  {
    name: "Zona urbana",
    limit: 50,
    detail: "Calles y avenidas de la ciudad",
    icon: "urban",
  },
  {
    name: "Vía nacional",
    limit: 70,
    detail: "Carreteras y vías nacionales",
    icon: "road",
  },
  { name: "Curvas", limit: 35, detail: "Tramos con curvas", icon: "curve" },
  {
    name: "Escolar / residencial",
    limit: 30,
    detail: "Entornos escolares y barrios",
    icon: "school",
  },
] as const;
export type SpeedEvent = {
  id: number;
  plate: string;
  driver: string;
  zone: string;
  sector: string;
  speed: number;
  limit: number;
  time: string;
  latitude: number;
  longitude: number;
  tripId: number;
};
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function isOverLimit(speed: number | null, limit: number) {
  return speed !== null && Number.isFinite(speed) && speed > limit;
}
