"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  LocateFixed,
  MapPin,
  Mountain,
  Navigation,
  Route,
  School,
  ShieldCheck,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import TripMap, { type TrackPoint } from "./components/trip-map";
import {
  ZONES,
  distanceKm,
  isOverLimit,
  type SpeedEvent,
} from "./driver-model";
import "./driver.css";
type Trip = {
  id: number;
  driver: string;
  plate: string;
  startedAt: number;
  endedAt: number;
  points: TrackPoint[];
  events: SpeedEvent[];
  distance: number;
};
type Status = "idle" | "locating" | "ready" | "running" | "finished" | "error";
const icons = [Building2, Route, Mountain, School];
export default function Driver() {
  const [name, setName] = useState(""),
    [plate, setPlate] = useState(""),
    [status, setStatus] = useState<Status>("idle"),
    [zone, setZone] = useState(0),
    [points, setPoints] = useState<TrackPoint[]>([]),
    [events, setEvents] = useState<SpeedEvent[]>([]),
    [speed, setSpeed] = useState<number | null>(null),
    [accuracy, setAccuracy] = useState<number | null>(null),
    [follow, setFollow] = useState(true),
    [sound, setSound] = useState(true),
    [message, setMessage] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [distance, setDistance] = useState(0),
    [history, setHistory] = useState<Trip[]>([]),
    [summary, setSummary] = useState<Trip | null>(null),
    [fresh, setFresh] = useState(false),
    [notice, setNotice] = useState(""),
    [notifications, setNotifications] = useState(false);
  const watch = useRef<number | null>(null),
    generation = useRef(0),
    ctx = useRef<AudioContext | null>(null),
    running = useRef(false),
    start = useRef(0),
    lastFix = useRef(0),
    lastPoint = useRef<TrackPoint | null>(null),
    over = useRef(false),
    lastBeep = useRef(0),
    tripPoints = useRef<TrackPoint[]>([]),
    tripEvents = useRef<SpeedEvent[]>([]),
    tripDistance = useRef(0),
    currentSpeed = useRef<number | null>(null),
    settings = useRef({ zone, sound, name, plate });
  settings.current = { zone, sound, name, plate };
  useEffect(() => {
    try {
      const profile = JSON.parse(
        localStorage.getItem("velo-driver-profile") || "null",
      );
      if (profile) {
        setName(profile.name || "");
        setPlate(profile.plate || "");
      }
      setHistory(JSON.parse(localStorage.getItem("velo-trips") || "[]"));
    } catch {
      setNotice("No se pudieron recuperar los datos guardados.");
    }
    return () => {
      generation.current++;
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      void ctx.current?.close();
    };
  }, []);
  function save(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setNotice(
        "El navegador no pudo guardar los datos. Descarga tu recorrido antes de cerrar.",
      );
    }
  }
  const beep = useCallback(() => {
    if (!settings.current.sound) return;
    try {
      const c = ctx.current;
      if (!c) return;
      void c.resume();
      [0, 0.25, 0.5].forEach((t) => {
        const o = c.createOscillator(),
          g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.frequency.value = 900;
        g.gain.setValueAtTime(0.16, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.16);
        o.start(c.currentTime + t);
        o.stop(c.currentTime + t + 0.18);
      });
      lastBeep.current = Date.now();
    } catch {}
  }, []);
  const evaluate = useCallback(
    (v: number | null, p: TrackPoint) => {
      const s = settings.current,
        z = ZONES[s.zone];
      if (isOverLimit(v, z.limit)) {
        if (!over.current) {
          const now = Date.now();
          const e: SpeedEvent = {
            id: now,
            plate: s.plate,
            driver: s.name,
            zone: z.name,
            sector: `GPS ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
            speed: Math.round(v! * 10) / 10,
            limit: z.limit,
            time: new Date(now).toLocaleTimeString("es-CO", { hour12: false }),
            latitude: p.lat,
            longitude: p.lng,
            tripId: start.current,
          };
          tripEvents.current = [e, ...tripEvents.current];
          setEvents([...tripEvents.current]);
          try {
            const stored = JSON.parse(
              localStorage.getItem("velo-events") || "[]",
            );
            localStorage.setItem("velo-events", JSON.stringify([e, ...stored]));
          } catch {
            setNotice("No se pudo guardar la alerta en el navegador.");
          }
          beep();
          if ("Notification" in window && Notification.permission === "granted")
            try {
              new Notification("VÉLO · Reduce la velocidad", {
                body: `${s.plate}: ${Math.round(v!)} km/h. Límite ${z.limit} km/h · ${z.name}`,
              });
            } catch {}
        }
        over.current = true;
      } else over.current = false;
    },
    [beep],
  );
  useEffect(() => {
    over.current = false;
    if (
      running.current &&
      lastPoint.current &&
      Date.now() - lastFix.current < 15000
    )
      evaluate(currentSpeed.current, lastPoint.current);
  }, [zone, evaluate]);
  useEffect(() => {
    const timer = setInterval(() => {
      const valid = lastFix.current > 0 && Date.now() - lastFix.current < 15000;
      setFresh(valid);
      if (running.current) {
        setElapsed(Math.floor((Date.now() - start.current) / 1000));
        if (valid && over.current && Date.now() - lastBeep.current > 5000)
          beep();
        if (!valid) {
          setSpeed(null);
          over.current = false;
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [beep]);
  function stopWatch() {
    generation.current++;
    if (watch.current !== null) {
      navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    }
  }
  function locate() {
    stopWatch();
    if (!running.current) setStatus("locating");
    setMessage("");
    const gen = generation.current;
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Este dispositivo no admite ubicación GPS.");
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (gen !== generation.current) return;
        const raw = p.coords.speed;
        const point: TrackPoint = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          time: p.timestamp,
          accuracy: p.coords.accuracy,
          speed:
            raw !== null && Number.isFinite(raw) && raw >= 0 ? raw * 3.6 : null,
        };
        setAccuracy(point.accuracy);
        lastFix.current = Date.now();
        setFresh(true);
        setMessage("");
        if (point.accuracy > 80) {
          setMessage(
            "Señal GPS poco precisa. Busca un lugar con mejor recepción.",
          );
          currentSpeed.current = null;
          setSpeed(null);
          over.current = false;
          return;
        }
        lastPoint.current = point;
        if (!running.current) {
          setStatus("ready");
          setPoints([point]);
          return;
        }
        setStatus("running");
        currentSpeed.current = point.speed;
        setSpeed(point.speed);
        const prev = tripPoints.current.at(-1);
        if (prev && point.time <= prev.time) return;
        if (prev) tripDistance.current += distanceKm(prev, point);
        tripPoints.current = [...tripPoints.current, point];
        setPoints([...tripPoints.current]);
        setDistance(tripDistance.current);
        evaluate(point.speed, point);
      },
      (e) => {
        if (gen !== generation.current) return;
        lastFix.current = 0;
        setFresh(false);
        setSpeed(null);
        currentSpeed.current = null;
        over.current = false;
        setMessage(
          e.code === 1
            ? "Acceso a ubicación denegado. Habilítalo en los permisos del navegador y vuelve a intentar."
            : e.code === 3
              ? "El GPS está tardando. Comprueba que la ubicación del dispositivo esté activada."
              : "No encontramos señal GPS. Revisa la ubicación de tu dispositivo.",
        );
        if (!running.current) setStatus("error");
        if (e.code === 1) stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }
  function begin() {
    if (
      !name.trim() ||
      !plate.trim() ||
      !lastPoint.current ||
      !fresh ||
      accuracy === null ||
      accuracy > 80
    ) {
      setMessage(
        "Completa tu nombre y placa y activa una ubicación precisa antes de iniciar.",
      );
      return;
    }
    try {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
    } catch {
      setNotice(
        "No fue posible activar el audio. Las alertas visuales seguirán disponibles.",
      );
    }
    start.current = Date.now();
    tripPoints.current = [lastPoint.current];
    tripEvents.current = [];
    tripDistance.current = 0;
    over.current = false;
    running.current = true;
    setPoints([...tripPoints.current]);
    setEvents([]);
    setDistance(0);
    setElapsed(0);
    setSpeed(null);
    setSummary(null);
    setStatus("running");
    save("velo-driver-profile", { name: name.trim(), plate: plate.trim() });
  }
  function finish() {
    running.current = false;
    stopWatch();
    over.current = false;
    setFresh(false);
    setSpeed(null);
    const trip: Trip = {
      id: start.current,
      driver: name,
      plate,
      startedAt: start.current,
      endedAt: Date.now(),
      points: tripPoints.current,
      events: tripEvents.current,
      distance: tripDistance.current,
    };
    const next = [trip, ...history].slice(0, 20);
    setHistory(next);
    save("velo-trips", next);
    setSummary(trip);
    setStatus("finished");
    setFollow(false);
  }
  function download(t: Trip) {
    const blob = new Blob([JSON.stringify(t, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `velo-recorrido-${t.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotice(
        "Este navegador no admite notificaciones. Las alertas visuales y sonoras funcionan dentro de la app.",
      );
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotifications(p === "granted");
      setNotice(
        p === "granted"
          ? "Notificaciones activadas para tus recorridos."
          : "Notificaciones no autorizadas. Puedes habilitarlas desde los permisos del navegador.",
      );
    } catch {
      setNotice("No fue posible solicitar notificaciones.");
    }
  }
  const active = status === "running",
    limit = ZONES[zone].limit,
    danger = active && fresh && isOverLimit(speed, limit),
    minutes = String(Math.floor(elapsed / 60)).padStart(2, "0"),
    seconds = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="driver-app">
      <div className="driver-top">
        <Link href="/" className="driver-logo">
          <span>
            <Zap size={22} fill="currentColor" />
          </span>
          vélo<span className="driver-edition">CONDUCTOR</span>
        </Link>
        <div className="driver-top-right">
          <span className="driver-sst">
            <ShieldCheck size={15} /> Tu seguridad va primero
          </span>
          <Link href="/admin">
            Panel administrador <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="driver-body">
        <div className="driver-heading">
          <div>
            <span className="driver-kicker">TU COPILOTO DE SEGURIDAD</span>
            <h1>
              Un buen viaje empieza contigo<span>.</span>
            </h1>
            <p>
              Conecta tu ubicación, inicia tu recorrido y llega con
              tranquilidad.
            </p>
          </div>
          <span className={"trip-status " + (active ? "on" : "")}>
            <i />
            {active
              ? "Recorrido en curso"
              : status === "finished"
                ? "Recorrido finalizado"
                : "Listo para tu próximo viaje"}
          </span>
        </div>
        <div className="driver-layout">
          <div className="driver-sidebar">
            <section className="driver-card driver-setup">
              <div className="driver-card-title">
                <span className="driver-step">01</span>
                <div>
                  <h2>Antes de salir</h2>
                  <p>Conozcamos a quien va al volante.</p>
                </div>
                <CarSymbol />
              </div>
              <label>
                Tu nombre
                <input
                  autoComplete="name"
                  maxLength={80}
                  placeholder="Ej. Felipe García"
                  value={name}
                  disabled={active}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Placa del vehículo
                <input
                  autoCapitalize="characters"
                  maxLength={12}
                  className="plate-input"
                  placeholder="ABC 123"
                  value={plate}
                  disabled={active}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                />
              </label>
              <div className={"location-state " + (fresh ? "connected" : "")}>
                <div>
                  <LocateFixed size={19} />
                </div>
                <span>
                  <strong>
                    {fresh
                      ? "Ubicación conectada"
                      : status === "locating"
                        ? "Buscando señal GPS…"
                        : "Activa tu ubicación"}
                  </strong>
                  <small>
                    {fresh
                      ? `Precisión aproximada: ${Math.round(accuracy ?? 0)} m`
                      : "Necesaria para registrar tu recorrido"}
                  </small>
                </span>
                {fresh && <Check size={16} />}
              </div>
              {!active && (
                <button
                  className="driver-button secondary"
                  onClick={locate}
                  disabled={status === "locating"}
                >
                  <LocateFixed size={16} />
                  {fresh ? "Actualizar ubicación" : "Permitir ubicación"}
                </button>
              )}
              <div className="driver-divider" />
              <label>
                Zona por la que circulas
                <select
                  value={zone}
                  onChange={(e) => setZone(Number(e.target.value))}
                >
                  {ZONES.map((z, i) => (
                    <option key={z.name} value={i}>
                      {z.name} · {z.limit} km/h
                    </option>
                  ))}
                </select>
              </label>
              <p className="manual-zone">
                <MapPin size={13} /> Selección manual. Actualiza la zona al
                cambiar de vía.
              </p>
              {message && (
                <div className="driver-error" role="alert">
                  {message}
                  {active && <button onClick={locate}>Reconectar GPS</button>}
                </div>
              )}
              {!active ? (
                <button
                  className="driver-button start"
                  disabled={
                    !name.trim() ||
                    !plate.trim() ||
                    !fresh ||
                    accuracy === null ||
                    accuracy > 80
                  }
                  onClick={begin}
                >
                  <Navigation size={17} />
                  {status === "finished"
                    ? "Iniciar otro recorrido"
                    : "Iniciar recorrido"}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button className="driver-button stop" onClick={finish}>
                  <Square size={15} fill="currentColor" /> Finalizar recorrido
                </button>
              )}
              <p className="driver-privacy">
                <ShieldCheck size={12} /> Tus recorridos se guardan en este
                navegador.
              </p>
            </section>
            <div className="driver-tip">
              <ShieldCheck size={23} />
              <div>
                <strong>Lo importante es llegar bien.</strong>
                <p>
                  Configura todo antes de conducir. Mantén tu atención en la
                  vía.
                </p>
              </div>
            </div>
          </div>
          <div className="driver-main">
            <section
              className={"driver-map-card " + (danger ? "over-speed" : "")}
            >
              <div className="driver-map-head">
                <div>
                  <span className="driver-kicker">TU RECORRIDO</span>
                  <h2>
                    {active
                      ? "En movimiento, con cuidado."
                      : summary
                        ? "Un viaje más, a salvo."
                        : "Tu camino comienza aquí."}
                  </h2>
                </div>
                <span className={"gps-pill " + (fresh ? "connected" : "")}>
                  <i />
                  {fresh ? "GPS conectado" : "Esperando GPS"}
                </span>
              </div>
              <div className="driver-map-wrap">
                <TripMap points={points} follow={follow} />
                {!points.length && (
                  <div className="map-welcome">
                    <span>
                      <Navigation size={24} />
                    </span>
                    <strong>El próximo destino lo pones tú.</strong>
                    <p>Activa tu ubicación para ver dónde estás.</p>
                  </div>
                )}
                <button
                  className={"map-follow " + (follow ? "selected" : "")}
                  onClick={() => setFollow(!follow)}
                  aria-label={
                    follow
                      ? "Explorar mapa libremente"
                      : "Centrar en mi ubicación"
                  }
                  title={
                    follow ? "Explorar mapa libremente" : "Seguir mi ubicación"
                  }
                >
                  <LocateFixed size={19} />
                </button>
                <div className="driver-speed">
                  <span>VELOCIDAD ACTUAL</span>
                  <strong>
                    {active && fresh && speed !== null
                      ? Math.round(speed)
                      : "—"}
                    <small>km/h</small>
                  </strong>
                  <p>
                    {!active
                      ? "Inicia tu recorrido"
                      : !fresh
                        ? "Esperando señal GPS"
                        : speed === null
                          ? "Esperando lectura de velocidad"
                          : danger
                            ? "Reduce la velocidad"
                            : "Dentro del límite preventivo"}
                  </p>
                </div>
                <div className="driver-limit">
                  <div>{limit}</div>
                  <span>
                    LÍMITE SST<strong>{ZONES[zone].name}</strong>
                  </span>
                </div>
              </div>
              <div className="trip-metrics">
                <div>
                  <Route size={18} />
                  <span>
                    DISTANCIA
                    <strong>
                      {distance.toFixed(2)} <small>km</small>
                    </strong>
                  </span>
                </div>
                <div>
                  <Clock3 size={18} />
                  <span>
                    TIEMPO DE RECORRIDO
                    <strong>
                      {minutes}
                      <small>:</small>
                      {seconds}
                    </strong>
                  </span>
                </div>
                <div>
                  <Bell size={18} />
                  <span>
                    ALERTAS DEL VIAJE
                    <strong>{String(events.length).padStart(2, "0")}</strong>
                  </span>
                </div>
              </div>
            </section>
            {active && (
              <div
                className={"driver-alert " + (danger ? "warning" : "safe")}
                role="status"
                aria-live="polite"
              >
                <ShieldCheck size={24} />
                <div>
                  <strong>
                    {danger
                      ? `Reduce la velocidad · Límite ${limit} km/h`
                      : !fresh
                        ? "Sin señal GPS reciente"
                        : speed === null
                          ? "Esperando velocidad del dispositivo"
                          : "Vas bien. Sigue cuidando tu camino."}
                  </strong>
                  <p>
                    {danger
                      ? `Circulas a ${Math.round(speed!)} km/h en ${ZONES[zone].name}. La alerta sonará mientras continúe el exceso.`
                      : !fresh
                        ? "Las alertas se reactivarán cuando regrese una lectura GPS válida."
                        : "El límite preventivo se aplica según la zona que seleccionaste."}
                  </p>
                </div>
              </div>
            )}
            <section className="driver-card driver-zones">
              <div className="driver-section-title">
                <div>
                  <span className="driver-kicker">
                    MENOS VELOCIDAD, MÁS SEGURIDAD
                  </span>
                  <h2>Límites que protegen.</h2>
                </div>
                <ShieldCheck size={22} />
              </div>
              <div className="driver-zone-grid">
                {ZONES.map((z, i) => {
                  const Icon = icons[i];
                  return (
                    <button
                      key={z.name}
                      className={"driver-zone " + (zone === i ? "chosen" : "")}
                      onClick={() => setZone(i)}
                    >
                      <div>
                        <Icon size={20} />
                        {zone === i && <span>ACTUAL</span>}
                      </div>
                      <strong>
                        {z.limit}
                        <small>km/h</small>
                      </strong>
                      <h3>{z.name}</h3>
                      <p>{z.detail}</p>
                    </button>
                  );
                })}
              </div>
              <p className="driver-zone-note">
                Límites preventivos SST definidos para esta aplicación. Respeta
                siempre la señalización de la vía.
              </p>
            </section>
            <section className="driver-card driver-alert-settings">
              <div>
                <span className="settings-bell">
                  <Volume2 size={20} />
                </span>
                <span>
                  <h2>Tu copiloto también se hace escuchar.</h2>
                  <p>Alertas sonoras al superar el límite de la zona.</p>
                </span>
              </div>
              <button
                aria-pressed={sound}
                className={"sound-toggle " + (sound ? "enabled" : "")}
                onClick={() => {
                  setSound(!sound);
                  if (!sound) {
                    try {
                      ctx.current ??= new AudioContext();
                      void ctx.current.resume();
                    } catch {}
                  }
                }}
              >
                {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{" "}
                {sound ? "Sonido activado" : "Sonido desactivado"}
              </button>
            </section>
            <button
              className="notification-link"
              onClick={requestNotifications}
            >
              <Bell size={14} />
              {notifications
                ? "Notificaciones activadas"
                : "Activar también notificaciones del dispositivo"}
              <ChevronRight size={13} />
            </button>
            {summary && (
              <section className="driver-card trip-summary">
                <Flag size={24} />
                <div>
                  <h2>Recorrido finalizado, {summary.driver.split(" ")[0]}.</h2>
                  <p>
                    {summary.distance.toFixed(2)} km · {summary.events.length}{" "}
                    alertas · {summary.plate}
                  </p>
                </div>
                <button
                  className="driver-button secondary"
                  onClick={() => download(summary)}
                >
                  Descargar recorrido
                </button>
              </section>
            )}
            {events.length > 0 && (
              <section className="driver-card driver-events">
                <h2>Alertas de este recorrido</h2>
                {events.map((e) => (
                  <div key={e.id}>
                    <span className="event-speed">
                      +{(e.speed - e.limit).toFixed(1)}
                    </span>
                    <div>
                      <strong>
                        {e.zone} · {e.speed} km/h
                      </strong>
                      <p>
                        {e.sector} · Límite {e.limit} km/h
                      </p>
                    </div>
                    <time>{e.time}</time>
                  </div>
                ))}
              </section>
            )}
            {history.length > 0 && (
              <section className="driver-card driver-history">
                <h2>Tus últimos recorridos</h2>
                {history.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (active) {
                        setNotice(
                          "Finaliza el recorrido actual antes de consultar otro.",
                        );
                        return;
                      }
                      setSummary(t);
                      setPoints(t.points);
                      setDistance(t.distance);
                      setElapsed(Math.floor((t.endedAt - t.startedAt) / 1000));
                      setEvents(t.events);
                      setFollow(false);
                      setStatus("finished");
                    }}
                  >
                    <span>
                      <Route size={17} />
                      {t.plate} ·{" "}
                      {new Date(t.startedAt).toLocaleString("es-CO")}
                    </span>
                    <span>
                      {t.distance.toFixed(2)} km <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
              </section>
            )}
            <div className="driver-footnote">
              <span>
                <Zap size={13} /> Seguridad en movimiento.
              </span>
              <p>
                Mantén esta página abierta y la pantalla encendida durante el
                recorrido. El GPS y el mapa necesitan permisos y conexión; las
                alertas no funcionan con la app cerrada.
              </p>
            </div>
          </div>
        </div>
      </div>
      {notice && (
        <div className="driver-notice" role="status">
          <Bell size={18} />
          {notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function CarSymbol() {
  return (
    <span className="driver-setup-icon">
      <Navigation size={20} />
    </span>
  );
}
