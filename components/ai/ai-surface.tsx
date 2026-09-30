"use client";

import { useEffect, useRef } from "react";
import { useAI } from "@/components/ai/ai-provider";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { AmbientOrb } from "@/components/ai/ambient-orb";
import { ConversationStage, STAGE_ORB_SIZE } from "@/components/ai/conversation-stage";
import {
  DURATION,
  EASE_ENTER,
  EASE_FRAMER,
  EASE_LAND,
  gsap,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  useGSAP,
} from "@/lib/motion";

/** Idle drift loop, in seconds. Long and slow, like the skill's ambient loops. */
const DRIFT_SECONDS = 44;

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

const isInteractive = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest("button, a, [role='tab'], [role='button'], [tabindex]:not([tabindex='-1'])");

/**
 * Owns the AI's physical presence: the ambient orb behind the hero, the stage
 * in front, and the single GSAP timeline that carries the orb between them.
 */
export function AISurface() {
  const { open, summon, dismiss, turns, spotlight, homeListening, aiState, amplitude } = useAI();
  const { editorOpen } = usePortfolio();

  const orbRootRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const orbSlotRef = useRef<HTMLDivElement>(null);
  const stageOrbRef = useRef<HTMLDivElement>(null);

  const drift = useRef<gsap.core.Tween | null>(null);
  const summonTl = useRef<gsap.core.Timeline | null>(null);
  const invoker = useRef<HTMLElement | null>(null);
  /** Page scroll when the stage opened; restored on dismiss so the orb lands home. */
  const savedScroll = useRef(0);

  /* ---- idle drift ------------------------------------------------------- */

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        desktop: "(min-width: 810px)",
        mobile: "(max-width: 809px)",
        reduce: REDUCED_MOTION_QUERY,
      },
      (context) => {
        const { desktop, reduce } = context.conditions as { desktop: boolean; reduce: boolean };
        if (reduce) {
          return;
        }
        // A lazy figure-eight across the hero, returning to its start so the loop is seamless.
        const k = desktop ? 1 : 0.4;
        drift.current = gsap.to(driftRef.current, {
          duration: DRIFT_SECONDS,
          ease: "none",
          repeat: -1,
          motionPath: {
            path: [
              { x: 0, y: 0 },
              { x: 180 * k, y: 40 * k },
              { x: 380 * k, y: -20 * k },
              { x: 260 * k, y: -90 * k },
              { x: 90 * k, y: -40 * k },
              { x: 0, y: 0 },
            ],
            curviness: 1.4,
          },
        });
        return () => {
          drift.current = null;
        };
      }
    );
  });

  /* ---- summon / dismiss ------------------------------------------------- */

  useGSAP(
    () => {
      const reduce = prefersReducedMotion();

      if (open) {
        invoker.current = document.activeElement as HTMLElement | null;
        savedScroll.current = window.scrollY;

        const tlNow = summonTl.current;
        if (tlNow && tlNow.reversed() && tlNow.progress() > 0) {
          // Reopened mid-dismiss: just play forward again, no snapping.
          tlNow.timeScale(1).play();
          return;
        }
        summonTl.current?.kill();
        drift.current?.pause();

        const flight = flightRef.current!;
        const driftBox = driftRef.current!.getBoundingClientRect();
        const flightBox = flight.getBoundingClientRect();
        const slot = orbSlotRef.current!.getBoundingClientRect();

        // Scale around wherever the drift has carried the orb, then fly to the slot.
        const originX = driftBox.left + driftBox.width / 2 - flightBox.left;
        const originY = driftBox.top + driftBox.height / 2 - flightBox.top;
        const dx = slot.left + slot.width / 2 - (driftBox.left + driftBox.width / 2);
        const dy = slot.top + slot.height / 2 - (driftBox.top + driftBox.height / 2);
        const scale = STAGE_ORB_SIZE / driftBox.width;
        const items = stageRef.current!.querySelectorAll("[data-stage-item]");

        const tl = gsap.timeline({
          defaults: { ease: EASE_FRAMER },
          onReverseComplete: () => {
            gsap.set(orbRootRef.current, { zIndex: 0 });
            gsap.set(stageRef.current, { visibility: "hidden" });
            gsap.set(flight, { clearProps: "transform,transformOrigin" });
            drift.current?.resume();
          },
        });

        // Visible right away, not on the first animation frame, so the input can
        // take focus even if frames are delayed (background tab, slow device).
        gsap.set(stageRef.current, { visibility: "visible" });
        tl.set(flight, { transformOrigin: `${originX}px ${originY}px` })
          .set(orbRootRef.current, { zIndex: 7 })
          // 1. The page recedes (cells dim via CSS as `open` flips).
          .to(backdropRef.current, { opacity: 1, duration: DURATION.base }, 0)
          // 2. The orb comes forward: brighter, smaller, up to the stage.
          .to(visualRef.current, { opacity: 1, duration: DURATION.fast }, 0.05)
          .to(flight, { x: dx, y: dy, scale, duration: DURATION.transition, ease: EASE_LAND }, 0.05)
          // 3. It sharpens: the crisp stage orb takes over from the soft one.
          .to(stageOrbRef.current, { opacity: 1, duration: DURATION.fast }, 0.4)
          .to(visualRef.current, { opacity: 0, duration: DURATION.fast }, 0.45)
          // 4. The conversation arrives.
          .fromTo(
            items,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: DURATION.base, stagger: 0.05, ease: EASE_ENTER },
            0.35
          );

        summonTl.current = tl;
        if (reduce) {
          tl.progress(1);
        }
      } else if (summonTl.current) {
        const tl = summonTl.current;
        // Undo any scrolling done to reveal lit cards, under cover of the stage,
        // so the ambient orb flies back to the exact spot it left.
        window.scrollTo({ top: savedScroll.current, behavior: "instant" });
        // Dismiss is the same timeline in reverse, a touch quicker.
        if (reduce) {
          tl.progress(0).pause();
          tl.eventCallback("onReverseComplete")?.();
        } else {
          tl.timeScale(1.3).reverse();
        }
        // Return focus to whatever opened the stage.
        const target = invoker.current;
        if (target && document.contains(target) && !stageRef.current?.contains(target)) {
          target.dataset.returningFocus = "true";
          target.focus({ preventScroll: true });
          delete target.dataset.returningFocus;
        }
      }
    },
    { dependencies: [open] }
  );

  /* ---- bring the lit card into view behind the stage --------------------- */

  const current = turns[turns.length - 1];
  const focusId =
    open && current && current.phase !== "thinking"
      ? current.response.highlights.find((id) => document.getElementById(id)?.classList.contains("cell"))
      : undefined;

  useEffect(() => {
    if (!focusId) {
      return;
    }
    const el = document.getElementById(focusId);
    if (!el) {
      return;
    }
    const box = el.getBoundingClientRect();
    const visible = box.top >= 64 && box.top < window.innerHeight * 0.6;
    if (visible) {
      return;
    }
    const top = Math.max(0, window.scrollY + box.top - Math.max(80, (window.innerHeight - box.height) / 2));
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "instant" : "smooth" });
  }, [focusId]);

  // "Show on dashboard": once the stage is gone, glide to the card it pointed at.
  useEffect(() => {
    if (!spotlight || open) {
      return;
    }
    const el = document.getElementById(spotlight);
    if (!el) {
      return;
    }
    const id = window.setTimeout(() => {
      const box = el.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + box.top - Math.max(80, (window.innerHeight - box.height) / 2));
      window.scrollTo({ top, behavior: prefersReducedMotion() ? "instant" : "smooth" });
    }, prefersReducedMotion() ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [spotlight, open]);

  /* ---- save the GPU: pause the orb while nobody can see it ------------- */

  // The ambient orb is a large blurred, rotating gradient. Off-screen, or
  // hidden behind the open stage (it's faded out there), it pauses entirely.
  useEffect(() => {
    const root = orbRootRef.current;
    if (!root) {
      return;
    }
    let visible = true;
    const apply = () => {
      const paused = !visible || open;
      root.toggleAttribute("data-orb-paused", paused);
      // While the dismiss timeline runs, it owns the drift and resumes it itself.
      if (!open && !summonTl.current?.isActive()) {
        if (visible) {
          drift.current?.resume();
        } else {
          drift.current?.pause();
        }
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      apply();
    });
    observer.observe(root);
    apply();
    return () => observer.disconnect();
  }, [open]);

  /* ---- keyboard ---------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        dismiss();
        return;
      }
      if (open || editorOpen || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        summon();
      } else if (event.key === " " && !isTypingTarget(event.target) && !isInteractive(event.target)) {
        event.preventDefault();
        summon();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editorOpen, summon, dismiss]);

  /* ---- scroll lock ------------------------------------------------------ */

  useEffect(() => {
    if (!open) {
      return;
    }
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <AmbientOrb
        amplitude={homeListening ? amplitude : undefined}
        driftRef={driftRef}
        flightRef={flightRef}
        onSummon={summon}
        rootRef={orbRootRef}
        state={homeListening ? aiState : "idle"}
        visualRef={visualRef}
      />
      <ConversationStage
        backdropRef={backdropRef}
        orbRef={stageOrbRef}
        orbSlotRef={orbSlotRef}
        rootRef={stageRef}
      />
    </>
  );
}
