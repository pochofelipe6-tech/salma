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
            <filter
              id="headlight-glow"
              x="-100%"
              y="-200%"
              width="400%"
              height="500%"
            >
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <animateMotion
                dur="28s"
                begin={`${i * -7}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href="#traffic-road" />
              </animateMotion>
              <g>
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1.6;1.25;.75;.38"
                  keyTimes="0;.4;.75;1"
                  dur="28s"
                  begin={`${i * -7}s`}
                  repeatCount="indefinite"
                />
                <ellipse
                  cx="1"
                  cy="1"
                  rx="16"
                  ry="8"
                  fill="#000"
                  opacity=".65"
                />
                <path
                  d="M-12-4Q-14 0-12 4L8 5Q14 4 14 0Q14-4 8-5Z"
                  fill={i % 2 ? "#becdd0" : "#e6f1e0"}
                  stroke="#5e7a6b"
                  strokeWidth="1"
                />
                <path d="M-6-3L4-3L7 0L4 3L-6 3L-8 0Z" fill="#183c40" />
                <path d="M10-3L35-9L35 9L10 3Z" fill="#eaffba" opacity=".1" />
                <path
                  d="M11-3L14-3M11 3L14 3"
                  stroke="#edffd7"
                  strokeWidth="2"
                />
                <path
                  d="M-12-3L-14-3M-12 3L-14 3"
                  stroke="#ff6955"
                  strokeWidth="2"
                />
                <circle
                  cx="14"
                  cy="-3"
                  r="3"
                  fill="#d4ffab"
                  filter="url(#headlight-glow)"
                />
                <circle
                  cx="14"
                  cy="3"
                  r="3"
                  fill="#d4ffab"
                  filter="url(#headlight-glow)"
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
