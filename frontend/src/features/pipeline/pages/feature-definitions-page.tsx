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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Feature definitions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Describe the features produced by your pipeline modules.
        </p>
      </header>

      <form onSubmit={handleCreate} className="space-y-3 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="feature-name">
            Feature name
          </label>
          <input
            id="feature-name"
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. numeric_score"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="feature-type">
            Value type
          </label>
          <input
            id="feature-type"
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={valueType}
            onChange={(event) => setValueType(event.target.value)}
            placeholder="e.g. float, text, boolean"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="feature-owner">
            Owner (optional)
          </label>
          <input
            id="feature-owner"
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Module or team"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white dark:bg-violet-600 dark:hover:bg-violet-700"
          disabled={isCreating}
        >
          {isCreating ? 'Creating…' : 'Create definition'}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Definitions</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No definitions yet.</p>
        ) : (
          <div className="rounded border border-slate-200 overflow-hidden dark:border-slate-600">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Value type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Owner
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200 dark:[&>tr+tr>td]:border-slate-600">
                {data.map((definition) => (
                  <tr key={definition.id}>
                    <td className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {definition.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                      {definition.valueType}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {definition.owner ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline dark:text-red-400"
                        onClick={() => deleteDefinition(definition.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
