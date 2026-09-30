"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(useGSAP, MotionPathPlugin, CustomEase);

/** The skill's default curve, `cubic-bezier(.44,0,.56,1)`. */
export const EASE_FRAMER = CustomEase.create("framer", "0.44,0,0.56,1");
/** Enters decelerate (skill: "ease-out for enters"). */
export const EASE_ENTER = "power3.out";
/** The orb lands with one soft overshoot, a spring without the wobble. */
export const EASE_LAND = "back.out(1.1)";

/**
 * Skill duration tokens. Long sequences are built by overlapping these on a
 * timeline, never by stretching a single tween.
 */
export const DURATION = {
  micro: 0.15,
  fast: 0.2,
  base: 0.3,
  /** Skill: 300–500ms for page transitions. */
  transition: 0.5,
} as const;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches;

export { gsap, useGSAP };
