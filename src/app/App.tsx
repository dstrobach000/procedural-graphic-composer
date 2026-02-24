import { CanvasView } from '../ui/CanvasView';
import { Inspector } from '../ui/Inspector';
import { LayerPanel } from '../ui/LayerPanel';
import { Notifications } from '../ui/Notifications';
import { SnapshotTray } from '../ui/SnapshotTray';
import { TopBar } from '../ui/TopBar';

export function App() {
  return (
    <div className="app-shell">
      <TopBar />

      <main className="workspace">
        <LayerPanel />
        <CanvasView />
        <Inspector />
      </main>

      <SnapshotTray />
      <Notifications />
    </div>
  );
}
