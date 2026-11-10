import { getSupabase, cloudEnabled } from "./supabase";
import { storageKey } from "../auth";
import { ZONES, type SpeedEvent } from "../driver-model";
import type { TrackPoint } from "../components/trip-map";
export type Trip = {
  id: number;
  cloudId?: string;
  driverId?: string;
  driver: string;
  plate: string;
  startedAt: number;
  endedAt: number | null;
  points: TrackPoint[];
  events: SpeedEvent[];
  distance: number;
};
const zoneCodes = ["urban", "national", "curves", "school"];
type Queue = {
  tail: Promise<void>;
  pointCursor: number;
  eventIds: Set<number>;
};
const queues = new Map<string, Queue>();
function pendingTrips(): Trip[] {
  try {
    return JSON.parse(
      localStorage.getItem(storageKey("velo-pending-trips")) || "[]",
    );
  } catch {
    return [];
  }
}
function remember(trip: Trip) {
  const pending = pendingTrips().filter((t) => t.cloudId !== trip.cloudId);
  try {
    localStorage.setItem(
      storageKey("velo-pending-trips"),
      JSON.stringify([...pending, trip]),
    );
  } catch {}
}
export function syncTrip(trip: Trip): Promise<void> {
  if (!cloudEnabled) return Promise.resolve();
  if (!trip.cloudId || !trip.driverId)
    return Promise.reject(
      new Error("El recorrido no tiene propietario o identificador remoto."),
    );
  const pendingKey = storageKey("velo-pending-trips");
  remember(trip);
  let state = queues.get(trip.cloudId);
  if (!state) {
    state = { tail: Promise.resolve(), pointCursor: 0, eventIds: new Set() };
    queues.set(trip.cloudId, state);
  }
  const queue = state;
  const task = queue.tail
    .catch(() => {})
    .then(async () => {
      const db = getSupabase();
      const { data, error } = await db.auth.getUser();
      if (error || data.user?.id !== trip.driverId)
        throw new Error(
          "La sesión del conductor cambió. Vuelve a iniciar sesión para sincronizar.",
        );
      let cursor = queue.pointCursor;
      let unsent = trip.events.filter((e) => !queue.eventIds.has(e.id));
      do {
        const points = trip.points.slice(cursor, cursor + 500);
        const events = unsent.slice(0, 500);
        const last =
          cursor + points.length >= trip.points.length && unsent.length <= 500;
        const { error: saveError } = await db.rpc("sync_trip", {
          p_payload: {
            id: trip.cloudId,
            driver: trip.driver,
            plate: trip.plate,
            started_at: new Date(trip.startedAt).toISOString(),
            ended_at:
              last && trip.endedAt
                ? new Date(trip.endedAt).toISOString()
                : null,
            distance_km: trip.distance,
            points: points.map((p, i) => ({
              sequence: cursor + i,
              recorded_at: new Date(p.time).toISOString(),
              latitude: p.lat,
              longitude: p.lng,
              accuracy_m: p.accuracy,
              speed_kmh: p.speed,
            })),
            events: events.map((e) => ({
              client_id: e.id,
              zone_code: zoneCodes[ZONES.findIndex((z) => z.name === e.zone)],
              sector: e.sector,
              recorded_at: new Date(e.id).toISOString(),
              latitude: e.latitude,
              longitude: e.longitude,
              speed_kmh: e.speed,
            })),
          },
        });
        if (saveError) throw new Error(saveError.message);
        cursor += points.length;
        queue.pointCursor = cursor;
        events.forEach((e) => queue.eventIds.add(e.id));
        unsent = unsent.slice(events.length);
      } while (cursor < trip.points.length || unsent.length);
      try {
        const stored: Trip[] = JSON.parse(
          localStorage.getItem(pendingKey) || "[]",
        );
        localStorage.setItem(
          pendingKey,
          JSON.stringify(
            stored.filter(
              (t) =>
                t.cloudId !== trip.cloudId ||
                t.points.length > trip.points.length ||
                t.events.length > trip.events.length ||
                Boolean(t.endedAt && !trip.endedAt),
            ),
          ),
        );
      } catch {}
    });
  queue.tail = task;
  return task;
}
export async function retryPendingTrips() {
  for (const trip of pendingTrips()) await syncTrip(trip);
}
export async function loadTrips(): Promise<Trip[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from("trips")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return Promise.all(
    (data || []).map(async (t) => {
      const points: TrackPoint[] = [];
      let offset = 0;
      while (true) {
        const { data: batch, error: pointError } = await db
          .from("trip_points")
          .select("*")
          .eq("trip_id", t.id)
          .order("sequence")
          .range(offset, offset + 999);
        if (pointError) throw pointError;
        points.push(
          ...(batch || []).map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            time: Date.parse(p.recorded_at),
            accuracy: p.accuracy_m,
            speed: p.speed_kmh,
          })),
        );
        if (!batch || batch.length < 1000) break;
        offset += 1000;
      }
      const rawEvents = [];
      offset = 0;
      while (true) {
        const { data: batch, error: eventError } = await db
          .from("speed_events")
          .select("*")
          .eq("trip_id", t.id)
          .order("recorded_at", { ascending: false })
          .range(offset, offset + 999);
        if (eventError) throw eventError;
        rawEvents.push(...(batch || []));
        if (!batch || batch.length < 1000) break;
        offset += 1000;
      }
      return {
        id: Date.parse(t.started_at),
        cloudId: t.id,
        driverId: t.driver_id,
        driver: t.driver_name,
        plate: t.plate,
        startedAt: Date.parse(t.started_at),
        endedAt: t.ended_at ? Date.parse(t.ended_at) : null,
        distance: Number(t.distance_km),
        points,
        events: rawEvents.map((e) => ({
          id: Number(e.client_id),
          plate: t.plate,
          driver: t.driver_name,
          zone: ZONES[zoneCodes.indexOf(e.zone_code)]?.name || e.zone_code,
          sector: e.sector,
          speed: Number(e.speed_kmh),
          limit: e.limit_kmh,
          time: new Date(e.recorded_at).toLocaleTimeString("es-CO", {
            hour12: false,
          }),
          latitude: e.latitude,
          longitude: e.longitude,
          tripId: Date.parse(t.started_at),
        })),
      };
    }),
  );
}
export async function loadAdminEvents() {
  const db = getSupabase();
  const result = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from("speed_events")
      .select("*,trips!inner(plate,driver_name)")
      .order("recorded_at", { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    result.push(
      ...(data || []).map((e) => ({
        id: Date.parse(e.recorded_at),
        plate: e.trips.plate,
        driver: e.trips.driver_name,
        zone: ZONES[zoneCodes.indexOf(e.zone_code)]?.name || e.zone_code,
        sector: e.sector,
        speed: Number(e.speed_kmh),
        limit: e.limit_kmh,
        time: new Date(e.recorded_at).toLocaleTimeString("es-CO", {
          hour12: false,
        }),
      })),
    );
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  return result;
}
