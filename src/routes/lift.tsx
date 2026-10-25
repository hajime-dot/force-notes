import { createFileRoute } from "@tanstack/react-router";
import { LiftSim } from "@/components/lift-sim";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/lift")({
  component: LiftPage,
});

function LiftPage() {
  return (
    <Shell
      title="Lift and apparent weight"
      lede="Six motions only. Choose a balance (reading R) or a spring balance (reading T). The arrows, the net force, and the acceleration follow the case. The graph is that reading against time."
    >
      <LiftSim />
    </Shell>
  );
}
