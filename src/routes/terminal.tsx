import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { TerminalSim } from "@/components/terminal-sim";

export const Route = createFileRoute("/terminal")({
  component: TerminalPage,
});

function TerminalPage() {
  return (
    <Shell
      title="Terminal speed of a diver"
      lede="Weight stays constant. Air resistance grows with speed until it balances the weight. The parachute raises the drag, the diver slows, and a smaller terminal speed follows."
    >
      <TerminalSim />
    </Shell>
  );
}
