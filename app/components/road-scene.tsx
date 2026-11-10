"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
export default function RoadScene() {
  const ref = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPaused(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (paused) ref.current?.pauseAnimations();
    else ref.current?.unpauseAnimations();
  }, [paused]);
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
              d="M 280 1050 C 520 890 830 819 1107 729 C 1260 680 1301 663 1246 638 C 1190 607 1085 593 1090 568 C 1095 546 1210 552 1290 536 C 1324 528 1310 517 1230 511"
            />
          </defs>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <animateMotion
                dur="34s"
                begin={`${i * -(34 / 3)}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href="#traffic-road" />
              </animateMotion>
              <g>
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1.25;.9;.5;.22"
                  keyTimes="0;.4;.75;1"
                  dur="34s"
                  begin={`${i * -(34 / 3)}s`}
                  repeatCount="indefinite"
                />
                <image
                  className="real-traffic-car"
                  href="/images/real-car.webp"
                  x="-22"
                  y="-12"
                  width="44"
                  height="24"
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
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
