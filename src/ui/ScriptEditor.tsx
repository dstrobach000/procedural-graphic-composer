import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ScriptCompileValidationResult } from '../core/engine/Engine';

type ScriptEditorProps = {
  source: string;
  onApply(source: string): Promise<ScriptCompileValidationResult>;
};

export function ScriptEditor({ source, onApply }: ScriptEditorProps) {
  const [draft, setDraft] = useState(source);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(source);
  }, [source]);

  const hasChanges = useMemo(() => draft !== source, [draft, source]);

  return (
    <div className="shader-editor">
      <div className="shader-editor-toolbar">
        <button
          type="button"
          disabled={!hasChanges || isApplying}
          onClick={() => {
            void (async () => {
              setIsApplying(true);
              const result = await onApply(draft);
              setIsApplying(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
            })();
          }}
        >
          {isApplying ? 'Compiling...' : 'Apply Script'}
        </button>

        <button
          type="button"
          disabled={isApplying}
          onClick={() => {
            setDraft(source);
            setError(null);
          }}
        >
          Revert
        </button>
      </div>

      <Editor
        height="220px"
        language="javascript"
        theme="vs-dark"
        value={draft}
        onChange={(value) => setDraft(value ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />

      {error ? <div className="shader-error">{error}</div> : null}
    </div>
  );
}
