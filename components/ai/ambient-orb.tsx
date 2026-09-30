"use client";

import { type Ref, useEffect, useState } from "react";
import type { AIAmplitude, AIState } from "@/components/ui/smoothui/ai-core";
import SiriOrb from "@/components/ui/smoothui/siri-orb";

/** Skill palette: brand blue, info blue, violet, a touch of success green. */
export const ORB_COLORS = {
  bg: "#000000",
  c1: "#0099ff",
  c2: "#0000ee",
  c3: "#8856ff",
  c4: "#00bb88",
};

export const AMBIENT_SIZE = { desktop: 600, mobile: 360 } as const;


/**
 * The AI at rest: a large, low-opacity Siri Orb drifting behind the hero so
 * the portfolio value reads as lit from behind. Clicking its glow summons the
 * conversation.
 */
export function AmbientOrb({
  rootRef,
  flightRef,
  driftRef,
  visualRef,
  onSummon,
  state = "idle",
  amplitude,
}: {
  rootRef: Ref<HTMLDivElement>;
  /** Summon/dismiss moves and scales this layer. */
  flightRef: Ref<HTMLDivElement>;
  /** The slow idle drift animates this layer. */
  driftRef: Ref<HTMLDivElement>;
  /** Opacity: soft at rest, full while flying, faded once the stage orb takes over. */
  visualRef: Ref<HTMLDivElement>;
  onSummon: () => void;
  /** `listening` while you speak from the home screen; `idle` otherwise. */
  state?: AIState;
  amplitude?: AIAmplitude;
}) {
  const [size, setSize] = useState<number>(AMBIENT_SIZE.desktop);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 809px)");
    const update = () => setSize(query.matches ? AMBIENT_SIZE.mobile : AMBIENT_SIZE.desktop);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 mx-auto h-[760px] max-w-[1200px]"
      ref={rootRef}
    >
      <div
        className="absolute top-[40px] left-[-120px] max-md:top-[120px] max-md:left-[-40px]"
        ref={flightRef}
        style={{ width: size, height: size }}
      >
        <div className="size-full" ref={driftRef}>
          <div className="relative size-full opacity-45" ref={visualRef}>
            <SiriOrb
              amplitude={amplitude}
              animationDuration={28}
              colors={ORB_COLORS}
              size={`${size}px`}
              state={state}
            />
            {/* The glow is the button. Everything in front of it lets clicks through. */}
            <button
              aria-keyshortcuts="/"
              aria-label="Ask Aurum about your portfolio"
              className="pointer-events-auto absolute inset-[18%] rounded-full focus-visible:outline-offset-8"
              onClick={onSummon}
              type="button"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
