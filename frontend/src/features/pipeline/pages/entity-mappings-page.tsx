import { useState } from 'react';
import {
  useCreateEntityMappingMutation,
  useDeleteEntityMappingMutation,
  useListEntityMappingsQuery,
  useListDatasetsQuery,
  useListResolutionJobsQuery,
  useCreateResolutionJobMutation,
  useLazySimilaritySearchQuery,
} from '../../../services/api/pipeline-api';

type ResolutionRecord = {
  source_record_id: string;
  keys: Record<string, string>;
};

function parseKeysString(s: string): Record<string, string> {
  const keys: Record<string, string> = {};
  if (!s.trim()) return keys;
  const pairs = s.split(',').map((p) => p.trim()).filter(Boolean);
  for (const p of pairs) {
    const colon = p.indexOf(':');
    if (colon >= 0) {
      keys[p.slice(0, colon).trim()] = p.slice(colon + 1).trim();
    }
  }
  return keys;
}

function formatKeysForInput(keys: Record<string, string>): string {
  return Object.entries(keys)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

export function EntityMappingsPage() {
  const [mode, setMode] = useState<'manual' | 'automated'>('manual');

  const { data: mappings = [], isLoading } = useListEntityMappingsQuery();
  const { data: datasets = [] } = useListDatasetsQuery();
  const { data: resolutionJobs = [], isLoading: isLoadingJobs } =
    useListResolutionJobsQuery();

  const [createMapping, { isLoading: isCreating }] =
    useCreateEntityMappingMutation();
  const [deleteMapping] = useDeleteEntityMappingMutation();
  const [createResolutionJob, { isLoading: isCreatingJob }] =
    useCreateResolutionJobMutation();

  const [datasetId, setDatasetId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [method, setMethod] = useState('');

  const [jobName, setJobName] = useState('');
  const [resolutionDatasetId, setResolutionDatasetId] = useState('');
  const [entityType, setEntityType] = useState('person');
  const [joinKeys, setJoinKeys] = useState('id');
  const [semanticFields, setSemanticFields] = useState('name');
  const [threshold, setThreshold] = useState(0.85);
  const [createIfNoMatch, setCreateIfNoMatch] = useState(false);
  const [records, setRecords] = useState<ResolutionRecord[]>([
    { source_record_id: 'rec-1', keys: { id: '1', name: 'Example' } },
  ]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [similarModalEntityId, setSimilarModalEntityId] = useState<string | null>(null);
  const [similaritySearch, { data: similarData, isLoading: isSimilarLoading, error: similarError }] =
    useLazySimilaritySearchQuery();

  const handleFindSimilar = (entityId: string) => {
    setSimilarModalEntityId(entityId);
    similaritySearch({ entityId, limit: 10 });
  };

  const handleCreateMapping = async (event: React.FormEvent) => {
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

  const buildConfig = (): Record<string, unknown> => ({
    joinKeys: joinKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    semanticFields: semanticFields
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    threshold: Number(threshold),
    createIfNoMatch,
    records: records
      .filter((r) => r.source_record_id.trim())
      .map((r) => ({
        source_record_id: r.source_record_id.trim(),
        keys: Object.fromEntries(
          Object.entries(r.keys).filter(([, v]) => v != null && String(v).trim() !== '')
        ),
      })),
  });

  const handleCreateResolutionJob = async (event: React.FormEvent) => {
    event.preventDefault();
    setConfigError(null);
    if (!jobName.trim() || !resolutionDatasetId.trim()) return;
    const config = buildConfig();
    if (!Array.isArray(config.records) || config.records.length === 0) {
      setConfigError('Add at least one record.');
      return;
    }
    try {
      await createResolutionJob({
        name: jobName,
        datasetId: resolutionDatasetId,
        entityType: entityType || 'person',
        config,
      }).unwrap();
      setJobName('');
      setResolutionDatasetId('');
      setEntityType('person');
      setJoinKeys('id');
      setSemanticFields('name');
      setThreshold(0.85);
      setCreateIfNoMatch(false);
      setRecords([{ source_record_id: 'rec-1', keys: { id: '1', name: 'Example' } }]);
    } catch {
      setConfigError('Failed to create resolution job. Try again.');
    }
  };

  const addRecord = () => {
    setRecords((prev) => [
      ...prev,
      { source_record_id: `rec-${prev.length + 1}`, keys: {} },
    ]);
  };

  const updateRecord = (index: number, updates: Partial<ResolutionRecord>) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const updateRecordKeys = (index: number, keysStr: string) => {
    setRecords((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, keys: parseKeysString(keysStr) } : r
      )
    );
  };

  const removeRecord = (index: number) => {
    setRecords((prev) => prev.filter((_, i) => i !== index));
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
        <h1 className="text-2xl font-semibold">Entity mappings</h1>
        <p className="text-sm text-slate-500">
          Link dataset rows to canonical entities. Choose manual mapping or
          automated resolution with embeddings.
        </p>
      </header>

      <div className="flex gap-2 p-1 rounded-lg bg-slate-100 w-fit">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode('automated')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'automated'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Automated (embeddings)
        </button>
      </div>

      {mode === 'manual' && (
        <form
          onSubmit={handleCreateMapping}
          className="space-y-3 max-w-xl"
        >
          <h2 className="text-lg font-semibold">Create mapping manually</h2>
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
      )}

      {mode === 'automated' && (
        <>
          <form
            onSubmit={handleCreateResolutionJob}
            className="space-y-4 max-w-3xl rounded-lg bg-slate-50 border border-slate-200 p-5"
          >
            <h2 className="text-lg font-semibold">Run resolution job</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="resolution-name">
                  Job name
                </label>
                <input
                  id="resolution-name"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={jobName}
                  onChange={(event) => setJobName(event.target.value)}
                  placeholder="e.g. Resolve survey 2024"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="resolution-dataset"
                >
                  Dataset
                </label>
                <select
                  id="resolution-dataset"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={resolutionDatasetId}
                  onChange={(event) => setResolutionDatasetId(event.target.value)}
                >
                  <option value="">Select a dataset</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  className="text-sm font-medium"
                  htmlFor="resolution-entity-type"
                >
                  Entity type
                </label>
                <input
                  id="resolution-entity-type"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={entityType}
                  onChange={(event) => setEntityType(event.target.value)}
                  placeholder="e.g. person"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="resolution-join-keys">
                  Join keys
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  Comma-separated for exact matching.
                </p>
                <input
                  id="resolution-join-keys"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={joinKeys}
                  onChange={(event) => setJoinKeys(event.target.value)}
                  placeholder="id, name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="resolution-semantic-fields">
                  Semantic fields
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  Comma-separated for embeddings.
                </p>
                <input
                  id="resolution-semantic-fields"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={semanticFields}
                  onChange={(event) => setSemanticFields(event.target.value)}
                  placeholder="name"
                />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium" htmlFor="resolution-threshold">
                  Similarity threshold
                </label>
                <p className="text-xs text-slate-500 mb-1">
                  Min cosine (0–1) for semantic match.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <input
                    id="resolution-threshold"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-20 rounded border border-slate-300 px-3 py-2"
                    value={threshold}
                    onChange={(event) => setThreshold(Number(event.target.value))}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createIfNoMatch}
                      onChange={(event) => setCreateIfNoMatch(event.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">Create if no match</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Records</label>
                <button
                  type="button"
                  onClick={addRecord}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  + Add record
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Each record needs a source_record_id and keys (e.g. id: 1, name: John).
              </p>
              <div className="space-y-2 rounded border border-slate-200 p-3 bg-white">
                {records.map((rec, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap gap-3 items-start p-3 rounded bg-slate-50 border border-slate-100"
                  >
                    <div className="flex-1 min-w-[120px] space-y-1">
                      <label className="text-xs font-medium text-slate-500">
                        source_record_id
                      </label>
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={rec.source_record_id}
                        onChange={(event) =>
                          updateRecord(index, {
                            source_record_id: event.target.value,
                          })
                        }
                        placeholder="rec-1"
                      />
                    </div>
                    <div className="flex-[2] min-w-[180px] space-y-1">
                      <label className="text-xs font-medium text-slate-500">
                        keys (key: value, key: value)
                      </label>
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        value={formatKeysForInput(rec.keys)}
                        onChange={(event) =>
                          updateRecordKeys(index, event.target.value)
                        }
                        placeholder="id: 1, name: John Smith"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRecord(index)}
                      className="text-sm text-red-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {configError && (
              <p className="text-sm text-red-600">{configError}</p>
            )}
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
              disabled={isCreatingJob}
            >
              {isCreatingJob ? 'Submitting…' : 'Create resolution job'}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Resolution jobs</h2>
            {isLoadingJobs ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : resolutionJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No resolution jobs yet.</p>
            ) : (
              <div className="rounded border border-slate-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Job name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Dataset
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200">
                    {resolutionJobs.map((job) => {
                      const summary =
                        job.status === 'completed' &&
                        job.resultSummary &&
                        typeof job.resultSummary === 'object'
                          ? (job.resultSummary as Record<string, unknown>)
                          : null;
                      return (
                        <tr key={job.id}>
                          <td className="px-4 py-2 text-sm font-medium truncate max-w-[12rem]">
                            {job.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-500">
                            {formatDate(job.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-sm font-mono text-slate-600 truncate max-w-[8rem]">
                            {job.datasetId ? `${job.datasetId.slice(0, 8)}…` : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">
                            {summary
                              ? `exact: ${String(summary.exact ?? 0)} · semantic: ${String(summary.semantic ?? 0)} · created: ${String(summary.created ?? 0)} · unmatched: ${String(summary.unmatched ?? 0)}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Mappings</h2>
        <p className="text-sm text-slate-500">
          All mappings (manual and from resolution jobs).
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-slate-500">No mappings yet.</p>
        ) : (
          <div className="rounded border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Dataset
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-4 py-2 text-sm font-medium truncate max-w-[12rem]">
                      {mapping.datasetName ?? mapping.datasetId}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium truncate max-w-[12rem]">
                      {mapping.entityDisplayName ?? mapping.entityId}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {formatDate(mapping.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      {mapping.method ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
                        onClick={() => handleFindSimilar(mapping.entityId)}
                      >
                        Find similar
                      </button>
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => deleteMapping(mapping.id)}
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

      {similarModalEntityId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSimilarModalEntityId(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSimilarModalEntityId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="similar-modal-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 id="similar-modal-title" className="text-lg font-semibold">
                Similar entities
              </h2>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 text-xl leading-none"
                onClick={() => setSimilarModalEntityId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {isSimilarLoading ? (
                <p className="text-sm text-slate-500">Searching…</p>
              ) : similarError ? (
                <p className="text-sm text-red-600">
                  {typeof (similarError as { data?: unknown })?.data === 'string'
                    ? (similarError as { data: string }).data
                    : (similarError as { data?: { message?: string } })?.data?.message ??
                      'No embedding found for this entity. Extract embeddings first.'}
                </p>
              ) : similarData ? (
                similarData.results.length === 0 ? (
                  <p className="text-sm text-slate-500">No similar entities found.</p>
                ) : (
                  <div className="rounded border border-slate-200 overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                            Rank
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                            Similarity
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                            Entity
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                            Dataset
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase">
                            Source record
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200">
                        {similarData.results.map((r) => (
                          <tr key={`${r.entityId}-${r.datasetId}`}>
                            <td className="px-4 py-2 text-sm">{r.rank}</td>
                            <td className="px-4 py-2 text-sm font-mono">
                              {(r.similarity * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-2 text-sm truncate max-w-[10rem]">
                              {r.entityDisplayName ?? r.entityId}
                            </td>
                            <td className="px-4 py-2 text-sm truncate max-w-[10rem]">
                              {r.datasetName}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono text-slate-500">
                              {r.sourceRecordId ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
