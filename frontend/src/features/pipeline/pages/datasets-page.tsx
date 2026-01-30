import { useState } from 'react';
import {
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useListDatasetsQuery,
} from '../../../services/api/pipeline-api';

export function DatasetsPage() {
  const { data = [], isLoading } = useListDatasetsQuery();
  const [createDataset, { isLoading: isCreating }] = useCreateDatasetMutation();
  const [deleteDataset] = useDeleteDatasetMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await createDataset({ name, description: description || undefined }).unwrap();
    setName('');
    setDescription('');
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Datasets</h1>
        <p className="text-sm text-slate-500">
          Register data sources and manage dataset metadata.
        </p>
      </header>

      <form onSubmit={handleCreate} className="space-y-3 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="dataset-name">
            Dataset name
          </label>
          <input
            id="dataset-name"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Census 2024"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="dataset-description">
            Description
          </label>
          <textarea
            id="dataset-description"
            className="w-full rounded border border-slate-300 px-3 py-2"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short summary of this dataset."
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          disabled={isCreating}
        >
          {isCreating ? 'Creating…' : 'Create dataset'}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Registered datasets</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">No datasets yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {data.map((dataset) => (
              <li key={dataset.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{dataset.name}</p>
                  {dataset.description && (
                    <p className="text-sm text-slate-500">{dataset.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteDataset(dataset.id)}
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
