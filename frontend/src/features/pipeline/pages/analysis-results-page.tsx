import {
  useListAnalysisJobsQuery,
  useListAnalysisResultsQuery,
} from '../../../services/api/pipeline-api';

export function AnalysisResultsPage() {
  const { data: jobs = [], isLoading: isLoadingJobs } = useListAnalysisJobsQuery();
  const { data: allResults = [], isLoading: isLoadingResults } =
    useListAnalysisResultsQuery();

  const completedJobs = jobs.filter(
    (j) => j.status === 'completed' || j.status === 'finished'
  );
  const resultsByJob = allResults.reduce<Record<string, typeof allResults>>(
    (acc, r) => {
      (acc[r.jobId] ??= []).push(r);
      return acc;
    },
    {}
  );

  const formatNum = (n: number | undefined | null) =>
    n != null ? n.toFixed(4) : '—';

  if (isLoadingJobs || isLoadingResults) {
    return (
      <section className="p-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analysis results</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </header>
      </section>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <section className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analysis results</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Results for completed analysis jobs appear here.
          </p>
        </header>
        <p className="text-sm text-slate-500 dark:text-slate-400">No completed jobs yet.</p>
      </section>
    );
  }

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analysis results</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Results for completed analysis jobs.
        </p>
      </header>

      <div className="space-y-6">
        {completedJobs.map((job) => {
          const results = resultsByJob[job.id] ?? [];
          return (
            <div key={job.id} className="rounded border border-slate-200 overflow-hidden dark:border-slate-600">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 dark:bg-slate-700 dark:border-slate-600">
                <p className="font-medium text-slate-900 dark:text-slate-100">{job.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Job ID: {job.id} · Status: {job.status}
                </p>
              </div>
              {results.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                  No result rows for this job.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                          Feature X
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                          Feature Y
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                          p-value
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                          Effect size
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                          Correction
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200 dark:[&>tr+tr>td]:border-slate-600">
                      {results.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 text-sm font-mono text-slate-900 dark:text-slate-100">
                            {r.featureXId.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-2 text-sm font-mono text-slate-900 dark:text-slate-100">
                            {r.featureYId.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100">
                            {formatNum(r.pValue)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100">
                            {formatNum(r.effectSize)}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                            {r.correction ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
