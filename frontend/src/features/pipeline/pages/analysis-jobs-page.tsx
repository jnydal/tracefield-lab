import { useState } from 'react';
import {
  useListAnalysisJobsQuery,
  useCreateAnalysisJobMutation,
} from '../../../services/api/pipeline-api';

export function AnalysisJobsPage() {
  const { data: jobs = [], isLoading: isLoadingJobs } = useListAnalysisJobsQuery();
  const [createJob, { isLoading: isCreating }] = useCreateAnalysisJobMutation();
  const [name, setName] = useState('');
  const [config, setConfig] = useState('{\n  "featureSetA": [],\n  "featureSetB": []\n}');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const parsed = JSON.parse(config) as Record<string, unknown>;
      await createJob({ name, config: parsed }).unwrap();
    } catch {
      setError('Invalid JSON config. Please fix and try again.');
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analysis jobs</h1>
        <p className="text-sm text-slate-500">
          Submit analysis jobs and inspect their status.
        </p>
      </header>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Job status</h2>
        {isLoadingJobs ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No analysis jobs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{job.name}</p>
                  <p className="text-sm text-slate-500">{formatDate(job.createdAt)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : job.status === 'running'
                        ? 'bg-blue-100 text-blue-800'
                        : job.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {job.status}
                </span>
                <code className="hidden sm:inline shrink-0 text-xs text-slate-500 font-mono truncate max-w-[8rem]">
                  {job.id}
                </code>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleCreate} className="space-y-3 max-w-2xl">
        <h2 className="text-lg font-semibold">Create new job</h2>
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
    </section>
  );
}
