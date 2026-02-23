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
          <h1 className="text-2xl font-semibold">Analysis results</h1>
          <p className="text-sm text-slate-500">Loading…</p>
        </header>
      </section>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <section className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Analysis results</h1>
          <p className="text-sm text-slate-500">
            Results for completed analysis jobs appear here.
          </p>
        </header>
        <p className="text-sm text-slate-500">No completed jobs yet.</p>
      </section>
    );
  }

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analysis results</h1>
        <p className="text-sm text-slate-500">
          Results for completed analysis jobs.
        </p>
      </header>

      <div className="space-y-6">
        {completedJobs.map((job) => {
          const results = resultsByJob[job.id] ?? [];
          return (
            <div key={job.id} className="rounded border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="font-medium">{job.name}</p>
                <p className="text-xs text-slate-500">
                  Job ID: {job.id} · Status: {job.status}
                </p>
              </div>
              {results.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  No result rows for this job.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Feature X
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Feature Y
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                          p-value
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Effect size
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Correction
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200">
                      {results.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2 text-sm font-mono">
                            {r.featureXId.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-2 text-sm font-mono">
                            {r.featureYId.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums">
                            {formatNum(r.pValue)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right tabular-nums">
                            {formatNum(r.effectSize)}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-500">
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
