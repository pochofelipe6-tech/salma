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
              d="M 850 740 C 930 700 1015 665 1107 629 C 1160 609 1215 594 1242 579"
            />
          </defs>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;.08;.86;1"
                dur="19s"
                begin={`${i * -(19 / 3)}s`}
                repeatCount="indefinite"
              />
              <animateMotion
                dur="19s"
                begin={`${i * -(19 / 3)}s`}
                repeatCount="indefinite"
              >
                <mpath href="#traffic-road" />
              </animateMotion>
              <g>
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1.15;.85;.55;.3"
                  keyTimes="0;.4;.75;1"
                  dur="19s"
                  begin={`${i * -(19 / 3)}s`}
                  repeatCount="indefinite"
                />
                <image
                  className="real-traffic-car"
                  href="/images/rear-sportscar.webp"
                  x="-76"
                  y="-62"
                  width="152"
                  height="84"
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
