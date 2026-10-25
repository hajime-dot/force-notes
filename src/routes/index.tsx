import { createFileRoute } from "@tanstack/react-router";
import { FrictionSim } from "@/components/friction-sim";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/")({
  component: FrictionPage,
});

function FrictionPage() {
  return (
    <Shell
      title="Static and kinetic friction"
      lede="While the block is still, friction is static and equal to the applied force — up to a maximum μₛN. Once it slides, friction is kinetic and stays constant at μₖN, whichever way you push."
    >
      <FrictionSim />
    </Shell>
  );
}
