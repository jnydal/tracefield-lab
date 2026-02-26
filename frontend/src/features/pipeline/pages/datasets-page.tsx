import { useState, useEffect, useRef } from 'react';
import {
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useListDatasetsQuery,
  useGetDatasetQuery,
  useTriggerFeatureExtractMutation,
  useLazyGetJobStatusQuery,
  useInferSchemaMutation,
  useUploadDatasetFileMutation,
} from '../../../services/api/pipeline-api';
import type { SchemaColumn } from '../../../services/api/pipeline-api';
import { Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';

export function DatasetsPage() {
  const { data = [], isLoading } = useListDatasetsQuery();
  const [createDataset, { isLoading: isCreating }] = useCreateDatasetMutation();
  const [deleteDataset] = useDeleteDatasetMutation();
  const [inferSchema, { isLoading: isInferring }] = useInferSchemaMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inferredSchema, setInferredSchema] = useState<{ columns: SchemaColumn[] } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [uploadDatasetId, setUploadDatasetId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [inferModalOpen, setInferModalOpen] = useState(false);
  const [inferMode, setInferMode] = useState<'create' | 'extract'>('create');
  const [sampleContent, setSampleContent] = useState('');
  const [sampleFormat, setSampleFormat] = useState<'csv' | 'json'>('csv');
  const [inferError, setInferError] = useState<string | null>(null);
  const sampleContentRef = useRef<HTMLTextAreaElement>(null);

  const [extractDatasetId, setExtractDatasetId] = useState<string | null>(null);
  const [textColumn, setTextColumn] = useState('');
  const [idColumn, setIdColumn] = useState('id');
  const [extractJobId, setExtractJobId] = useState<string | null>(null);

  const { data: extractDataset } = useGetDatasetQuery(extractDatasetId ?? '', {
    skip: !extractDatasetId,
  });
  const [triggerExtract, { isLoading: isExtracting }] =
    useTriggerFeatureExtractMutation();
  const [uploadDatasetFile, { isLoading: isUploading }] =
    useUploadDatasetFileMutation();
  const [getJobStatus] = useLazyGetJobStatusQuery();
  const [jobStatus, setJobStatus] = useState<{
    status: string;
    excInfo?: string;
  } | null>(null);

  useEffect(() => {
    if (!inferModalOpen) return;
    const timer = setTimeout(() => sampleContentRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [inferModalOpen]);

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
    setCreateError(null);
    if (!name.trim()) return;
    try {
      const dataset = await createDataset({
        name,
        description: description || undefined,
        schema: inferredSchema ?? undefined,
      }).unwrap();
      if (selectedFile) {
        await uploadDatasetFile({
          datasetId: dataset.id,
          file: selectedFile,
        }).unwrap();
      }
      setName('');
      setDescription('');
      setInferredSchema(null);
      setSelectedFile(null);
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Failed to create dataset';
      setCreateError(msg);
    }
  };

  const openInferModal = (mode: 'create' | 'extract') => {
    setInferMode(mode);
    setSampleContent('');
    setSampleFormat('csv');
    setInferError(null);
    setInferModalOpen(true);
  };

  const handleInferSchema = async (event: React.FormEvent) => {
    event.preventDefault();
    setInferError(null);
    if (!sampleContent.trim()) {
      setInferError('Paste a sample (CSV or JSON) to infer schema.');
      return;
    }
    try {
      const result = await inferSchema({
        sampleContent: sampleContent.trim(),
        format: sampleFormat,
      }).unwrap();
      if (inferMode === 'create') {
        setInferredSchema({ columns: result.columns });
        setInferModalOpen(false);
      } else {
        if (result.suggestions.textColumn) setTextColumn(result.suggestions.textColumn);
        if (result.suggestions.idColumn) setIdColumn(result.suggestions.idColumn);
        setInferModalOpen(false);
      }
    } catch {
      setInferError('Schema inference failed. Check the sample format and try again.');
    }
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

  const closeUploadModal = () => {
    setUploadDatasetId(null);
    setUploadFile(null);
    setUploadError(null);
  };

  const handleUploadFile = async (event: React.FormEvent) => {
    event.preventDefault();
    setUploadError(null);
    if (!uploadDatasetId || !uploadFile) return;
    try {
      await uploadDatasetFile({
        datasetId: uploadDatasetId,
        file: uploadFile,
      }).unwrap();
      closeUploadModal();
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Upload failed';
      setUploadError(msg);
    }
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
            className="w-full rounded border border-slate-300 !bg-white px-3 py-2 text-slate-900"
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
            className="w-full rounded border border-slate-300 !bg-white px-3 py-2 text-slate-900"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short summary of this dataset."
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="dataset-file">
            Data file
          </label>
          <div className="flex items-center gap-2">
            <input
              id="dataset-file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile && (
              <button
                type="button"
                className="text-sm text-slate-500 hover:underline"
                onClick={() => setSelectedFile(null)}
              >
                Remove
              </button>
            )}
          </div>
          {selectedFile && (
            <p className="text-xs text-slate-500">{selectedFile.name}</p>
          )}
        </div>
        {createError && (
          <p className="text-sm text-red-600">{createError}</p>
        )}
        {inferredSchema && inferredSchema.columns.length > 0 && (
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">Inferred schema ({inferredSchema.columns.length} columns)</p>
            <p className="text-slate-500 mt-1">
              {inferredSchema.columns.map((c) => `${c.name}: ${c.type}`).join(', ')}
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-slate-600 hover:underline"
              onClick={() => setInferredSchema(null)}
            >
              Clear
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
            disabled={isCreating}
          >
            {isCreating ? 'Creating…' : 'Create dataset'}
          </button>
          <button
            type="button"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
            onClick={() => openInferModal('create')}
          >
            Infer schema from sample
          </button>
        </div>
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
                      {Number(dataset.fileCount ?? 0) === 0 ? (
                        <button
                          type="button"
                          className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
                          onClick={() => {
                            setUploadDatasetId(dataset.id);
                            setUploadFile(null);
                            setUploadError(null);
                          }}
                        >
                          Upload file
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
                          onClick={() => openExtractModal(dataset.id)}
                        >
                          Extract embeddings
                        </button>
                      )}
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
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium"
                  htmlFor="extract-text-column"
                >
                  Text column (required)
                </label>
                <button
                  type="button"
                  className="text-xs text-slate-600 hover:underline"
                  onClick={() => openInferModal('extract')}
                >
                  Suggest from sample
                </button>
              </div>
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

      <Modal show={!!uploadDatasetId} onClose={closeUploadModal} size="md">
        <ModalHeader>Upload file</ModalHeader>
        <form onSubmit={handleUploadFile}>
          <ModalBody className="space-y-3">
            <p className="text-sm text-slate-600">
              Select a CSV or JSON file to ingest into this dataset.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="upload-file">
                File
              </label>
              <input
                id="upload-file"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <p className="text-xs text-slate-500">{uploadFile.name}</p>
              )}
            </div>
            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!uploadFile || isUploading}
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={closeUploadModal}
            >
              Cancel
            </button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal
        show={inferModalOpen}
        onClose={() => setInferModalOpen(false)}
        size="md"
        aria-labelledby="infer-schema-title"
        aria-describedby="infer-schema-desc"
        theme={{
          root: {
            show: {
              on: 'flex bg-slate-900/50',
              off: 'hidden',
            },
          },
          content: {
            inner:
              'relative flex max-h-[90dvh] flex-col rounded-2xl border border-white/60 bg-white/85 shadow-lg backdrop-blur-sm dark:border-white/60 dark:bg-white/85',
          },
          header: {
            base: 'flex items-start justify-between rounded-t border-b border-slate-200 p-5 dark:border-slate-200',
            title: 'text-xl font-medium text-slate-900 dark:text-slate-900',
          },
          footer: {
            base: 'flex items-center gap-2 rounded-b border-slate-200 p-6 dark:border-slate-200',
          },
        }}
      >
        <div className="infer-schema-modal flex min-h-0 flex-1 flex-col rounded-2xl border border-white/60 bg-white/85 text-slate-900 shadow-lg backdrop-blur-sm dark:border-white/60 dark:bg-white/85 dark:text-slate-900">
          <ModalHeader id="infer-schema-title" className="border-slate-200 text-slate-900 dark:border-slate-200 dark:text-slate-900">
            {inferMode === 'create' ? 'Infer schema from sample' : 'Suggest columns from sample'}
          </ModalHeader>
          <form onSubmit={handleInferSchema} className="flex min-h-0 flex-1 flex-col">
            <ModalBody className="space-y-3">
              <p id="infer-schema-desc" className="text-sm text-slate-600 dark:text-slate-600">
                Paste a few rows of CSV or JSON data. Column types and mapping suggestions will be inferred. Press{' '}
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-900 dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900">
                  Ctrl+Enter
                </kbd>
                {' '}to infer.
              </p>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-900 dark:text-slate-900" htmlFor="sample-format">
                  Format
                </label>
                <select
                  id="sample-format"
                  className="w-full rounded border border-slate-300 !bg-white px-3 py-2 text-slate-900 dark:!bg-white dark:text-slate-900"
                  style={{ backgroundColor: '#ffffff' }}
                  value={sampleFormat}
                  onChange={(e) => setSampleFormat(e.target.value as 'csv' | 'json')}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-900 dark:text-slate-900" htmlFor="sample-content">
                    Sample content
                  </label>
                  {sampleContent.trim() && (
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-600 dark:hover:text-slate-900"
                      onClick={() => {
                        setSampleContent('');
                        setInferError(null);
                        sampleContentRef.current?.focus();
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  ref={sampleContentRef}
                  id="sample-content"
                  className="w-full rounded border border-slate-300 !bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:!bg-white dark:text-slate-900"
                  style={{ backgroundColor: '#ffffff' }}
                  rows={8}
                  value={sampleContent}
                  onChange={(e) => setSampleContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleInferSchema({ preventDefault: () => {} } as React.FormEvent);
                    }
                  }}
                  placeholder={
                    sampleFormat === 'csv'
                      ? 'id,name,description\n1,Alice,Researcher\n2,Bob,Engineer'
                      : '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'
                  }
                  aria-describedby="infer-schema-desc"
                />
              </div>
              {inferError && (
                <p className="text-sm text-red-600 dark:text-red-600" role="alert">
                  {inferError}
                </p>
              )}
            </ModalBody>
            <ModalFooter className="gap-2 border-t border-slate-200 pt-4 dark:border-slate-200">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!sampleContent.trim() || isInferring}
            >
              {isInferring ? 'Inferring…' : 'Infer schema'}
            </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-300 dark:text-slate-900 dark:hover:bg-slate-100"
                onClick={() => setInferModalOpen(false)}
              >
                Cancel
              </button>
            </ModalFooter>
          </form>
        </div>
      </Modal>
    </section>
  );
}
