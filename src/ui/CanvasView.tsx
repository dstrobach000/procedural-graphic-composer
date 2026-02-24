import { useEffect, useRef } from 'react';
import { Engine } from '../core/engine/Engine';
import { useProjectStore } from '../store/useProjectStore';

export function CanvasView() {
  const project = useProjectStore((state) => state.project);
  const notify = useProjectStore((state) => state.notify);
  const setEngine = useProjectStore((state) => state.setEngine);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const engine = new Engine(canvasRef.current, {
      onError(error) {
        notify(`Engine error: ${error.message}`, 'error');
      },
    });

    engineRef.current = engine;
    setEngine(engine);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setEngine(null);
    };
  }, [notify, setEngine]);

  useEffect(() => {
    if (!engineRef.current) {
      return;
    }
    void engineRef.current.syncProject(project);
  }, [project]);

  useEffect(() => {
    if (!containerRef.current || !engineRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      engineRef.current?.resize(width, height);
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="canvas-wrapper" ref={containerRef}>
      <canvas ref={canvasRef} className="composer-canvas" />
    </div>
  );
}
