import { useState } from 'react';
import {
  useCreateFeatureDefinitionMutation,
  useDeleteFeatureDefinitionMutation,
  useListFeatureDefinitionsQuery,
} from '../../../services/api/pipeline-api';

export function FeatureDefinitionsPage() {
  const { data = [], isLoading } = useListFeatureDefinitionsQuery();
  const [createDefinition, { isLoading: isCreating }] =
    useCreateFeatureDefinitionMutation();
  const [deleteDefinition] = useDeleteFeatureDefinitionMutation();
  const [name, setName] = useState('');
  const [valueType, setValueType] = useState('');
  const [owner, setOwner] = useState('');

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !valueType.trim()) return;
    await createDefinition({
      name,
      valueType,
      owner: owner || undefined,
    }).unwrap();
    setName('');
    setValueType('');
    setOwner('');
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Feature definitions</h1>
        <p className="text-sm text-slate-500">
          Describe the features produced by your pipeline modules.
        </p>
      </header>

      <form onSubmit={handleCreate} className="space-y-3 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="feature-name">
            Feature name
          </label>
          <input
            id="feature-name"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. numeric_score"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="feature-type">
            Value type
          </label>
          <input
            id="feature-type"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={valueType}
            onChange={(event) => setValueType(event.target.value)}
            placeholder="e.g. float, text, boolean"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="feature-owner">
            Owner (optional)
          </label>
          <input
            id="feature-owner"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Module or team"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          disabled={isCreating}
        >
          {isCreating ? 'Creating…' : 'Create definition'}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Definitions</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">No definitions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {data.map((definition) => (
              <li key={definition.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{definition.name}</p>
                  <p className="text-sm text-slate-500">{definition.valueType}</p>
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteDefinition(definition.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
