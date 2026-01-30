import { useState } from 'react';
import {
  useCreateEntityMappingMutation,
  useDeleteEntityMappingMutation,
  useListEntityMappingsQuery,
} from '../../../services/api/pipeline-api';

export function EntityMappingsPage() {
  const { data = [], isLoading } = useListEntityMappingsQuery();
  const [createMapping, { isLoading: isCreating }] =
    useCreateEntityMappingMutation();
  const [deleteMapping] = useDeleteEntityMappingMutation();
  const [datasetId, setDatasetId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [method, setMethod] = useState('');

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!datasetId.trim() || !entityId.trim()) return;
    await createMapping({
      datasetId,
      entityId,
      method: method || undefined,
    }).unwrap();
    setDatasetId('');
    setEntityId('');
    setMethod('');
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Entity mappings</h1>
        <p className="text-sm text-slate-500">
          Link dataset rows to canonical entities.
        </p>
      </header>

      <form onSubmit={handleCreate} className="space-y-3 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="mapping-dataset">
            Dataset ID
          </label>
          <input
            id="mapping-dataset"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
            placeholder="Dataset UUID"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="mapping-entity">
            Entity ID
          </label>
          <input
            id="mapping-entity"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            placeholder="Entity UUID"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="mapping-method">
            Method
          </label>
          <input
            id="mapping-method"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="e.g. exact, fuzzy"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          disabled={isCreating}
        >
          {isCreating ? 'Creating…' : 'Create mapping'}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Mappings</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">No mappings yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {data.map((mapping) => (
              <li key={mapping.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{mapping.id}</p>
                  <p className="text-sm text-slate-500">
                    Dataset {mapping.datasetId} → Entity {mapping.entityId}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteMapping(mapping.id)}
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
