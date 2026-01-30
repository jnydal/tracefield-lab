import { useState } from 'react';
import {
  useCreateAnalysisJobMutation,
  useLazyGetAnalysisJobQuery,
} from '../../../services/api/pipeline-api';

export function AnalysisJobsPage() {
  const [createJob, { isLoading: isCreating }] = useCreateAnalysisJobMutation();
  const [fetchJob, { data: fetchedJob, isFetching }] =
    useLazyGetAnalysisJobQuery();
  const [name, setName] = useState('');
  const [config, setConfig] = useState('{\n  "featureSetA": [],\n  "featureSetB": []\n}');
  const [jobId, setJobId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>;
      const result = await createJob({ name, config: parsed }).unwrap();
      setJobId(result.id);
    } catch (err) {
      setError('Invalid JSON config. Please fix and try again.');
    }
  };

  const handleFetch = async () => {
    if (!jobId.trim()) return;
    await fetchJob(jobId).unwrap();
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analysis jobs</h1>
        <p className="text-sm text-slate-500">
          Submit analysis jobs and inspect their status.
        </p>
      </header>

      <form onSubmit={handleCreate} className="space-y-3 max-w-2xl">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="analysis-name">
            Job name
          </label>
          <input
            id="analysis-name"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Correlation run 01"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="analysis-config">
            Config (JSON)
          </label>
          <textarea
            id="analysis-config"
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
            rows={6}
            value={config}
            onChange={(event) => setConfig(event.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          disabled={isCreating}
        >
          {isCreating ? 'Submitting…' : 'Create analysis job'}
        </button>
      </form>

      <div className="space-y-3 max-w-xl">
        <h2 className="text-lg font-semibold">Fetch job</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-300 px-3 py-2"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Job ID"
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 text-sm"
            onClick={handleFetch}
            disabled={isFetching}
          >
            {isFetching ? 'Loading…' : 'Fetch'}
          </button>
        </div>
        {fetchedJob && (
          <div className="rounded border border-slate-200 p-3 text-sm">
            <p className="font-medium">{fetchedJob.name}</p>
            <p>Status: {fetchedJob.status}</p>
            <p>Created: {fetchedJob.createdAt}</p>
          </div>
        )}
      </div>
    </section>
  );
}
