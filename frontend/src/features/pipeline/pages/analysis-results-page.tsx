import { useState } from 'react';
import { useLazyGetAnalysisResultsQuery } from '../../../services/api/pipeline-api';

export function AnalysisResultsPage() {
  const [jobId, setJobId] = useState('');
  const [fetchResults, { data, isFetching }] = useLazyGetAnalysisResultsQuery();

  const handleFetch = async () => {
    if (!jobId.trim()) return;
    await fetchResults(jobId).unwrap();
  };

  return (
    <section className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Analysis results</h1>
        <p className="text-sm text-slate-500">
          Retrieve results for a submitted analysis job.
        </p>
      </header>

      <div className="space-y-3 max-w-xl">
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
      </div>

      <div className="space-y-2">
        {data && data.length === 0 && (
          <p className="text-sm text-slate-500">No results yet.</p>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {data.map((result) => (
              <li key={result.id} className="p-3">
                <p className="text-sm font-medium">
                  {result.featureXId} × {result.featureYId}
                </p>
                <p className="text-xs text-slate-500">
                  p={result.pValue ?? 'n/a'} • effect={result.effectSize ?? 'n/a'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
