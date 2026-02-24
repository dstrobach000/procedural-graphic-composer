import { useProjectStore } from '../store/useProjectStore';

export function SnapshotTray() {
  const snapshots = useProjectStore((state) => state.project.snapshots);
  const loadSnapshot = useProjectStore((state) => state.loadSnapshot);

  return (
    <section className="snapshot-tray">
      <div className="panel-header">
        <h2>Snapshots</h2>
      </div>
      <div className="snapshot-list">
        {snapshots.length === 0 ? <p className="snapshot-empty">No snapshots yet.</p> : null}
        {snapshots.map((snapshot) => (
          <button key={snapshot.id} type="button" className="snapshot-card" onClick={() => loadSnapshot(snapshot.id)}>
            <div className="snapshot-thumb">No Thumb</div>
            <div className="snapshot-meta">
              <strong>{snapshot.name}</strong>
              <span>Seed {snapshot.seed}</span>
              <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
