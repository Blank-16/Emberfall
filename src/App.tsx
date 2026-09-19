import { PhaserGame } from "@ui/components/PhaserGame";
import { HUD } from "@ui/components/HUD";

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <PhaserGame />
      <HUD />
    </div>
  );
}
