import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ShaderCompileValidationResult } from '../core/engine/Engine';
import { DEFAULT_SHADER_TEMPLATE_ID, getShaderTemplateById, SHADER_TEMPLATES } from '../core/shaders/templates';

type ShaderEditorProps = {
  fragment: string;
  onApply(fragment: string): Promise<ShaderCompileValidationResult>;
};

export function ShaderEditor({ fragment, onApply }: ShaderEditorProps) {
  const [draft, setDraft] = useState(fragment);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_SHADER_TEMPLATE_ID);

  useEffect(() => {
    setDraft(fragment);
  }, [fragment]);

  const hasChanges = useMemo(() => draft !== fragment, [draft, fragment]);

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
          {isApplying ? 'Compiling...' : 'Apply Shader'}
        </button>

        <button
          type="button"
          disabled={isApplying}
          onClick={() => {
            setDraft(fragment);
            setError(null);
          }}
        >
          Revert
        </button>

        <label className="inline-field" htmlFor="shader-template">
          Template
          <select
            id="shader-template"
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
          >
            {SHADER_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={isApplying}
          onClick={() => {
            const template = getShaderTemplateById(selectedTemplateId);
            if (!template) {
              return;
            }
            setDraft(template.fragment);
            setError(null);
          }}
        >
          Load Template
        </button>
      </div>

      <Editor
        height="320px"
        language="cpp"
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
