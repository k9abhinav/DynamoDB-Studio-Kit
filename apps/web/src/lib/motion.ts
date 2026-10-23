export type MotionKind = "hover" | "layer" | "route";

const durations: Record<MotionKind, string> = {
  hover: "150ms",
  layer: "200ms",
  route: "250ms",
};

const easing = "cubic-bezier(0.2, 0, 0, 1)";

export function motionTransition(reducedMotion: boolean, kind: MotionKind): string {
  const duration = durations[kind];
  if (reducedMotion) {
    return `opacity ${duration}`;
  }
  return `color ${duration} ${easing}, background-color ${duration} ${easing}, border-color ${duration} ${easing}, transform ${duration} ${easing}, opacity ${duration} ${easing}`;
}
