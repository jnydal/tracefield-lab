import { useState } from 'react';
import {
  useListAnalysisJobsQuery,
  useCreateAnalysisJobMutation,
  useListFeatureDefinitionsQuery,
} from '../../../services/api/pipeline-api';

type TestType = 'anova' | 'spearman' | 'embedding_clustering';

function isEmbeddingFeature(name: string): boolean {
  return (name || '').startsWith('embeddings.');
}

export function AnalysisJobsPage() {
  const { data: jobs = [], isLoading: isLoadingJobs } =
    useListAnalysisJobsQuery();
  const { data: featureDefs = [], isLoading: isLoadingDefs } =
    useListFeatureDefinitionsQuery();
  const [createJob, { isLoading: isCreating }] = useCreateAnalysisJobMutation();
  const [name, setName] = useState('');
  const [testType, setTestType] = useState<TestType>('spearman');
  const [leftFeature, setLeftFeature] = useState('');
  const [rightFeature, setRightFeature] = useState('');
  const [leftDimension, setLeftDimension] = useState(0);
  const [rightDimension, setRightDimension] = useState(0);
  const [embeddingDef, setEmbeddingDef] = useState('');
  const [nClusters, setNClusters] = useState(3);
  const [outcomeFeature, setOutcomeFeature] = useState('');
  const [correction, setCorrection] = useState('benjamini-hochberg');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scalarFeatures = featureDefs.filter((f) => f.valueType !== 'vector');
  const embeddingFeatures = featureDefs.filter((f) =>
    f.name.startsWith('embeddings.')
  );

  const buildConfig = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {
      test: testType,
      correction: correction || undefined,
    };
    if (testType === 'embedding_clustering') {
      return {
        ...base,
        embeddingDef: embeddingDef || undefined,
        nClusters,
        outcomeFeature: outcomeFeature || undefined,
      };
    }
    return {
      ...base,
      leftFeatureSet: leftFeature || undefined,
      rightFeatureSet: rightFeature || undefined,
      leftDimension: isEmbeddingFeature(leftFeature) ? leftDimension : undefined,
      rightDimension: isEmbeddingFeature(rightFeature)
        ? rightDimension
        : undefined,
    };
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    if (testType === 'embedding_clustering') {
      if (!embeddingDef || !outcomeFeature) {
        setError('Embedding definition and outcome feature are required.');
        return;
      }
    } else {
      if (!leftFeature || !rightFeature) {
        setError('Left and right features are required.');
        return;
      }
    }
    try {
      const config = buildConfig();
      await createJob({ name: name.trim(), config }).unwrap();
      setName('');
      setLeftFeature('');
      setRightFeature('');
      setEmbeddingDef('');
      setOutcomeFeature('');
    } catch {
      setError('Failed to create analysis job.');
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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analysis jobs</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Submit analysis jobs and inspect their status.
        </p>
      </header>

      <section aria-labelledby="job-status-heading" className="space-y-3">
        <h2 id="job-status-heading" className="app-form-section-title">
          Job status
        </h2>
        {isLoadingJobs ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No analysis jobs yet.</p>
        ) : (
          <div className="rounded border border-slate-200 overflow-hidden dark:border-slate-600">
            <table className="min-w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Job name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider dark:text-slate-300">
                    ID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200 dark:[&>tr+tr>td]:border-slate-600">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2 text-sm font-medium truncate max-w-[12rem] text-slate-900 dark:text-slate-100">
                      {job.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          job.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                            : job.status === 'running'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                              : job.status === 'failed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-slate-500 truncate max-w-[8rem] dark:text-slate-400">
                      {job.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form onSubmit={handleCreate} className="max-w-3xl">
        <fieldset className="app-form-fieldset grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <legend className="app-form-legend sm:col-span-2">
            Create new job
          </legend>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="analysis-name">
            Job name
          </label>
          <input
            id="analysis-name"
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Correlation run 01"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="test-type">
            Test type
          </label>
          <select
            id="test-type"
            className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={testType}
            onChange={(e) => setTestType(e.target.value as TestType)}
          >
            <option value="anova">ANOVA</option>
            <option value="spearman">Spearman</option>
            <option value="embedding_clustering">Embedding clustering</option>
          </select>
        </div>

        {testType === 'embedding_clustering' ? (
          <>
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-slate-900 dark:text-slate-200"
                htmlFor="embedding-def"
              >
                Embedding definition
              </label>
              <select
                id="embedding-def"
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                value={embeddingDef}
                onChange={(e) => setEmbeddingDef(e.target.value)}
              >
                <option value="">Select…</option>
                {embeddingFeatures.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
                {embeddingFeatures.length === 0 && !isLoadingDefs && (
                  <option value="embeddings.bge_large">
                    embeddings.bge_large (if defined)
                  </option>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-slate-900 dark:text-slate-200"
                htmlFor="n-clusters"
              >
                Number of clusters
              </label>
              <input
                id="n-clusters"
                type="number"
                min={2}
                max={20}
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                value={nClusters}
                onChange={(e) => setNClusters(Number(e.target.value) || 3)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label
                className="text-sm font-medium text-slate-900 dark:text-slate-200"
                htmlFor="outcome-feature"
              >
                Outcome feature (scalar)
              </label>
              <select
                id="outcome-feature"
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                value={outcomeFeature}
                onChange={(e) => setOutcomeFeature(e.target.value)}
              >
                <option value="">Select…</option>
                {scalarFeatures.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-slate-900 dark:text-slate-200"
                htmlFor="left-feature"
              >
                Left feature
              </label>
              <select
                id="left-feature"
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                value={leftFeature}
                onChange={(e) => setLeftFeature(e.target.value)}
              >
                <option value="">Select…</option>
                {featureDefs.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-slate-900 dark:text-slate-200"
                htmlFor="right-feature"
              >
                Right feature
              </label>
              <select
                id="right-feature"
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                value={rightFeature}
                onChange={(e) => setRightFeature(e.target.value)}
              >
                <option value="">Select…</option>
                {featureDefs.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            {isEmbeddingFeature(leftFeature) && (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-slate-900 dark:text-slate-200"
                  htmlFor="left-dimension"
                >
                  Left dimension (0–1023)
                </label>
                <input
                  id="left-dimension"
                  type="number"
                  min={0}
                  max={1023}
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  value={leftDimension}
                  onChange={(e) =>
                    setLeftDimension(Math.max(0, Math.min(1023, Number(e.target.value) || 0)))
                  }
                />
              </div>
            )}
            {isEmbeddingFeature(rightFeature) && (
              <div className="space-y-1">
                <label
                  className="text-sm font-medium text-slate-900 dark:text-slate-200"
                  htmlFor="right-dimension"
                >
                  Right dimension (0–1023)
                </label>
                <input
                  id="right-dimension"
                  type="number"
                  min={0}
                  max={1023}
                  className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  value={rightDimension}
                  onChange={(e) =>
                    setRightDimension(Math.max(0, Math.min(1023, Number(e.target.value) || 0)))
                  }
                />
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="correction">
            Correction (optional)
          </label>
          <input
            id="correction"
            className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="benjamini-hochberg"
          />
        </div>

        {showAdvanced && (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-slate-900 dark:text-slate-200">Config (JSON)</label>
            <pre className="rounded border border-slate-200 bg-slate-50 p-3 text-xs font-mono overflow-x-auto dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {JSON.stringify(buildConfig(), null, 2)}
            </pre>
          </div>
        )}
        <button
          type="button"
          className="justify-self-start text-left text-sm text-slate-600 hover:underline sm:col-span-2 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={() => setShowAdvanced((s) => !s)}
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced (raw JSON)
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>
        )}
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 sm:col-span-2 w-fit dark:bg-violet-600 dark:hover:bg-violet-700"
          disabled={isCreating || isLoadingDefs}
        >
          {isCreating ? 'Submitting…' : 'Create analysis job'}
        </button>
        </fieldset>
      </form>
    </section>
  );
}
