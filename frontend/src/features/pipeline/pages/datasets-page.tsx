import { useState, useEffect } from 'react';
import {
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useListDatasetsQuery,
  useGetDatasetQuery,
  useTriggerFeatureExtractMutation,
  useLazyGetJobStatusQuery,
} from '../../../services/api/pipeline-api';
import { Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';

export function DatasetsPage() {
  const { data = [], isLoading } = useListDatasetsQuery();
  const [createDataset, { isLoading: isCreating }] = useCreateDatasetMutation();
  const [deleteDataset] = useDeleteDatasetMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [extractDatasetId, setExtractDatasetId] = useState<string | null>(null);
  const [textColumn, setTextColumn] = useState('');
  const [idColumn, setIdColumn] = useState('id');
  const [extractJobId, setExtractJobId] = useState<string | null>(null);

  const { data: extractDataset } = useGetDatasetQuery(extractDatasetId ?? '', {
    skip: !extractDatasetId,
  });
  const [triggerExtract, { isLoading: isExtracting }] =
    useTriggerFeatureExtractMutation();
  const [getJobStatus] = useLazyGetJobStatusQuery();
  const [jobStatus, setJobStatus] = useState<{
    status: string;
    excInfo?: string;
  } | null>(null);

  useEffect(() => {
    if (!extractJobId) return;
    const interval = setInterval(async () => {
      const result = await getJobStatus(extractJobId).unwrap();
      setJobStatus({ status: result.status, excInfo: result.excInfo });
      const s = result.status.toLowerCase();
      if (s === 'finished' || s === 'failed') {
        clearInterval(interval);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [extractJobId, getJobStatus]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await createDataset({ name, description: description || undefined }).unwrap();
    setName('');
    setDescription('');
  };

  const openExtractModal = (datasetId: string) => {
    setExtractDatasetId(datasetId);
    setTextColumn('');
    setIdColumn('id');
    setExtractJobId(null);
    setJobStatus(null);
  };

  const closeExtractModal = () => {
    setExtractDatasetId(null);
    setExtractJobId(null);
    setJobStatus(null);
  };

  const handleExtract = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!extractDatasetId || !textColumn.trim()) return;
    try {
      const { jobId } = await triggerExtract({
        datasetId: extractDatasetId,
        module: 'embeddings',
        inputs: {
          textColumn: textColumn.trim(),
          idColumn: idColumn.trim() || undefined,
        },
      }).unwrap();
      setExtractJobId(jobId);
      setJobStatus({ status: 'queued' });
      const result = await getJobStatus(jobId).unwrap();
      setJobStatus({
        status: result.status,
        excInfo: result.excInfo,
      });
    } catch {
      setJobStatus({ status: 'failed', excInfo: 'Request failed' });
    }
  };

  const fileCount = Number(extractDataset?.fileCount ?? 0);
  const mappingsCount = Number(extractDataset?.mappingsCount ?? 0);
  const canExtract = fileCount > 0 && mappingsCount > 0;

  const schemaColumns =
    extractDataset?.schema && typeof extractDataset.schema === 'object' && 'columns' in extractDataset.schema
      ? (extractDataset.schema.columns as { name?: string }[]).map((c) => c.name).filter(Boolean) as string[]
      : [];

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
          <div className="rounded border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white [&>tr+tr>td]:border-t [&>tr+tr>td]:border-slate-200">
                {data.map((dataset) => (
                  <tr key={dataset.id}>
                    <td className="px-4 py-2 text-sm font-medium">
                      {dataset.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {dataset.description ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
                        onClick={() => openExtractModal(dataset.id)}
                      >
                        Extract embeddings
                      </button>
                      <span className="mx-2 text-slate-300">·</span>
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => deleteDataset(dataset.id)}
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

      <Modal
        show={!!extractDatasetId}
        onClose={closeExtractModal}
        size="md"
      >
        <ModalHeader>
          Extract embeddings
          {extractDataset && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              {extractDataset.name}
            </span>
          )}
        </ModalHeader>
        <form onSubmit={handleExtract}>
          <ModalBody className="space-y-3">
            {extractDataset && (
              <p className="text-sm text-slate-600">
                Files: {fileCount} · Mappings: {mappingsCount}
              </p>
            )}
            {extractDataset && !canExtract && (
              <p className="text-sm text-amber-600">
                Upload data and add entity mappings first.
              </p>
            )}
            <div className="space-y-1">
              <label
                className="text-sm font-medium"
                htmlFor="extract-text-column"
              >
                Text column (required)
              </label>
              <input
                id="extract-text-column"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={textColumn}
                onChange={(e) => setTextColumn(e.target.value)}
                placeholder={schemaColumns[0] ?? 'e.g. description'}
                list="text-column-suggestions"
              />
              {schemaColumns.length > 0 && (
                <datalist id="text-column-suggestions">
                  {schemaColumns.map((col) => (
                    <option key={col} value={col} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="extract-id-column">
                ID column (optional)
              </label>
              <input
                id="extract-id-column"
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={idColumn}
                onChange={(e) => setIdColumn(e.target.value)}
                placeholder="id"
              />
            </div>
            {extractJobId && jobStatus && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Job {extractJobId.slice(0, 8)}…</p>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
                    onClick={() =>
                      navigator.clipboard.writeText(extractJobId)
                    }
                  >
                    Copy ID
                  </button>
                </div>
                <span
                  className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    jobStatus.status.toLowerCase() === 'finished'
                      ? 'bg-green-100 text-green-800'
                      : jobStatus.status.toLowerCase() === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : jobStatus.status.toLowerCase() === 'started'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {jobStatus.status}
                </span>
                {jobStatus.excInfo && (
                  <p className="mt-2 text-red-600">{jobStatus.excInfo}</p>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!canExtract || !textColumn.trim() || isExtracting}
            >
              {isExtracting ? 'Starting…' : 'Start extraction'}
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={closeExtractModal}
            >
              Close
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </section>
  );
}
