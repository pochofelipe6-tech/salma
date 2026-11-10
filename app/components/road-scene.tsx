"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
export default function RoadScene() {
  const ref = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const cars = useRef<(SVGGElement | null)[]>([]);
  const pauseRef = useRef(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPaused(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    pauseRef.current = paused;
    if (paused) ref.current?.pauseAnimations();
    else ref.current?.unpauseAnimations();
  }, [paused]);
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    let frame = 0,
      previous = 0,
      elapsed = 0;
    const render = (time: number) => {
      if (previous && !pauseRef.current)
        elapsed += Math.min(time - previous, 60);
      previous = time;
      cars.current.forEach((car, index) => {
        if (!car) return;
        const progress = (elapsed / 42000 + index / 3) % 1;
        // Ease into the distance: farther cars cover fewer image pixels per second.
        const position = 1 - Math.pow(1 - progress, 1.65);
        const distance = position * length;
        const p = path.getPointAtLength(distance),
          next = path.getPointAtLength(Math.min(length, distance + 2)),
          before = path.getPointAtLength(Math.max(0, distance - 2));
        const dx = next.x - before.x,
          dy = next.y - before.y;
        const left = dx < 0;
        const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
        const angle = Math.max(
          -24,
          Math.min(24, heading - (left ? -155 : -25)),
        );
        const depth = Math.max(0, (p.y - 505) / 445);
        const scale = Math.max(0.055, 1.1 * Math.pow(depth, 1.4));
        const opacity = Math.min(1, progress / 0.045, (1 - progress) / 0.07);
        car.setAttribute(
          "transform",
          `translate(${p.x} ${p.y}) rotate(${angle}) scale(${left ? -scale : scale} ${scale})`,
        );
        car.setAttribute("opacity", String(opacity));
        car.dataset.roadX = String(p.x);
        car.dataset.roadY = String(p.y);
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <>
      <div
        className={"road-scene " + (paused ? "scene-paused" : "")}
        aria-hidden="true"
      >
        <div className="moving-sky" />
        <svg ref={ref} className="road-traffic" viewBox="0 0 1536 1024">
          <defs>
            <path
              id="traffic-road"
              ref={pathRef}
              d="M 760 950 C 800 865 891 790 1032 740 C 1140 685 1245 667 1300 628 C 1350 593 1347 574 1285 558 C 1228 544 1104 531 1117 521 C 1128 513 1170 511 1201 510"
            />
          </defs>
          {[0, 1, 2].map((i) => (
            <g
              key={i}
              ref={(element) => {
                cars.current[i] = element;
              }}
              opacity="0"
            >
              <image
                className="real-traffic-car"
                href="/images/rear-sportscar.webp"
                x="-76"
                y="-78"
                width="152"
                height="84"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          ))}
        </svg>
      </div>
      <button
        type="button"
        className="scene-toggle"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
        aria-label={
          paused
            ? "Reanudar animación del paisaje"
            : "Pausar animación del paisaje"
        }
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
        <span>{paused ? "Reanudar paisaje" : "Pausar paisaje"}</span>
      </button>
    </>
  );
}
