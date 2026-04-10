import { baseApi } from './base-api';

export type Dataset = {
  id: string;
  name: string;
  description?: string;
  source?: string;
  license?: string;
  schema?: Record<string, unknown>;
  refreshSchedule?: string;
  createdAt: string;
  updatedAt: string;
  fileCount?: number;
  mappingsCount?: number;
  /** Column names saved at last ingest (≤1MB files also cached for read). */
  latestFileColumns?: string[];
};

export type FeatureExtractRequest = {
  datasetId: string;
  module?: string;
  inputs: {
    textColumn?: string;
    textColumns?: string[];
    idColumn?: string;
  };
};

export type FeatureExtractResponse = {
  jobId: string;
};

export type ScalarExtractColumnRequest = {
  column: string;
  featureDefinitionName?: string;
};

export type ScalarExtractRequest = {
  idColumn: string;
  columns: ScalarExtractColumnRequest[];
};

export type ScalarExtractResponse = {
  jobId: string;
};

export type JobStatus = {
  id: string;
  status: string;
  enqueuedAt?: string;
  startedAt?: string;
  endedAt?: string;
  excInfo?: string;
  result?: string;
};

export type DatasetRequest = {
  name: string;
  description?: string;
  source?: string;
  license?: string;
  schema?: Record<string, unknown>;
  refreshSchedule?: string;
};

export type EntityMapping = {
  id: string;
  datasetId: string;
  entityId: string;
  datasetName?: string;
  entityDisplayName?: string;
  sourceRecordId?: string;
  sourceKeys?: Record<string, unknown>;
  method?: string;
  score?: number;
  createdAt: string;
};

export type EntityMappingRequest = {
  datasetId: string;
  entityId: string;
  sourceRecordId?: string;
  sourceKeys?: Record<string, unknown>;
  method?: string;
  score?: number;
};

export type FeatureDefinition = {
  id: string;
  name: string;
  description?: string;
  valueType: string;
  unit?: string;
  owner?: string;
  config?: Record<string, unknown>;
  createdAt: string;
};

export type FeatureSummary = {
  id: string;
  name: string;
  description?: string;
  valueType: string;
  unit?: string;
  computedCount: number;
};

export type FeatureDefinitionRequest = {
  name: string;
  description?: string;
  valueType: string;
  unit?: string;
  owner?: string;
  config?: Record<string, unknown>;
};

export type AnalysisJob = {
  id: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  excInfo?: string | null;
};

export type AnalysisJobRequest = {
  name: string;
  config: Record<string, unknown>;
  status?: string;
};

export type ResolutionJob = {
  id: string;
  name: string;
  status: string;
  datasetId: string;
  entityType: string;
  config: Record<string, unknown>;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  resultSummary?: Record<string, unknown> | null;
  excInfo?: string | null;
  warnings?: string[] | null;
};

export type ResolutionJobRequest = {
  name: string;
  datasetId: string;
  entityType: string;
  config: Record<string, unknown>;
};

export type AnalysisResult = {
  id: string;
  jobId: string;
  featureXId: string;
  featureYId: string;
  stats: Record<string, unknown>;
  pValue?: number;
  effectSize?: number;
  correction?: string;
  createdAt: string;
};

export type SimilarEntityResult = {
  entityId: string;
  datasetId: string;
  datasetName: string;
  sourceRecordId?: string;
  entityDisplayName?: string;
  similarity: number;
  rank: number;
};

export type SimilaritySearchResponse = {
  queryEntityId: string;
  model: string;
  results: SimilarEntityResult[];
};

export type SimilaritySearchParams = {
  entityId: string;
  limit?: number;
  datasetIds?: string[];
};

export type SchemaInferRequest = {
  sampleContent: string;
  format?: 'csv' | 'json';
};

export type SchemaColumn = { name: string; type: string };

export type SchemaInferSuggestions = {
  textColumn?: string;
  idColumn?: string;
  joinKeys?: string[];
  semanticFields?: string[];
};

export type SchemaInferResponse = {
  columns: SchemaColumn[];
  suggestions: SchemaInferSuggestions;
};

export type IngestResponse = {
  jobId?: string;
  objectUri: string;
};

export const pipelineApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDatasets: builder.query<Dataset[], void>({
      query: () => ({ url: '/datasets', method: 'GET' }),
      providesTags: ['Datasets'],
    }),
    createDataset: builder.mutation<Dataset, DatasetRequest>({
      query: (body) => ({ url: '/datasets', method: 'POST', body }),
      invalidatesTags: ['Datasets'],
    }),
    deleteDataset: builder.mutation<void, string>({
      query: (id) => ({ url: `/datasets/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Datasets'],
    }),
    getDataset: builder.query<Dataset, string>({
      query: (id) => ({ url: `/datasets/${id}`, method: 'GET' }),
      providesTags: (result, _, id) =>
        result ? [{ type: 'Datasets', id }] : ['Datasets'],
    }),
    getDatasetPreviewRows: builder.query<
      { rowCount: number; columns: string[] },
      string
    >({
      query: (datasetId) => ({
        url: `/datasets/${datasetId}/preview-rows`,
        method: 'GET',
      }),
    }),
    triggerFeatureExtract: builder.mutation<
      FeatureExtractResponse,
      FeatureExtractRequest
    >({
      query: (body) => ({
        url: '/features/extract',
        method: 'POST',
        body: {
          ...body,
          module: body.module ?? 'embeddings',
        },
      }),
    }),
    getJobStatus: builder.query<JobStatus, string>({
      query: (jobId) => ({ url: `/jobs/${jobId}`, method: 'GET' }),
    }),
    triggerScalarExtract: builder.mutation<
      ScalarExtractResponse,
      { datasetId: string; body: ScalarExtractRequest }
    >({
      query: ({ datasetId, body }) => ({
        url: `/datasets/${datasetId}/extract-scalar`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FeatureDefinitions'],
    }),
    scalarExtractUpload: builder.mutation<
      ScalarExtractResponse,
      {
        datasetId: string;
        idColumn: string;
        columns: ScalarExtractColumnRequest[];
        file: File;
      }
    >({
      query: ({ datasetId, idColumn, columns, file }) => {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('idColumn', idColumn);
        formData.append('columns', JSON.stringify(columns));
        return {
          url: `/datasets/${datasetId}/extract-scalar-upload`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['FeatureDefinitions'],
    }),
    listEntityMappings: builder.query<EntityMapping[], void>({
      query: () => ({ url: '/entity-mappings', method: 'GET' }),
      providesTags: ['EntityMappings'],
    }),
    createEntityMapping: builder.mutation<EntityMapping, EntityMappingRequest>({
      query: (body) => ({ url: '/entity-mappings', method: 'POST', body }),
      invalidatesTags: ['EntityMappings'],
    }),
    deleteEntityMapping: builder.mutation<void, string>({
      query: (id) => ({ url: `/entity-mappings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['EntityMappings'],
    }),
    listFeatureDefinitions: builder.query<FeatureDefinition[], void>({
      query: () => ({ url: '/features/definitions', method: 'GET' }),
      providesTags: ['FeatureDefinitions'],
    }),
    listFeaturesSummary: builder.query<FeatureSummary[], void>({
      query: () => ({ url: '/features/summary', method: 'GET' }),
      providesTags: ['FeatureDefinitions'],
    }),
    createFeatureDefinition: builder.mutation<FeatureDefinition, FeatureDefinitionRequest>({
      query: (body) => ({ url: '/features/definitions', method: 'POST', body }),
      invalidatesTags: ['FeatureDefinitions'],
    }),
    deleteFeatureDefinition: builder.mutation<void, string>({
      query: (id) => ({ url: `/features/definitions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['FeatureDefinitions'],
    }),
    listAnalysisJobs: builder.query<AnalysisJob[], void>({
      query: () => ({ url: '/analysis-jobs', method: 'GET' }),
      providesTags: ['AnalysisJobs'],
    }),
    createAnalysisJob: builder.mutation<AnalysisJob, AnalysisJobRequest>({
      query: (body) => ({ url: '/analysis-jobs', method: 'POST', body }),
      invalidatesTags: ['AnalysisJobs'],
    }),
    getAnalysisJob: builder.query<AnalysisJob, string>({
      query: (id) => ({ url: `/analysis-jobs/${id}`, method: 'GET' }),
      providesTags: ['AnalysisJobs'],
    }),
    listAnalysisResults: builder.query<AnalysisResult[], void>({
      query: () => ({ url: '/analysis-results', method: 'GET' }),
      providesTags: ['AnalysisResults'],
    }),
    getAnalysisResults: builder.query<AnalysisResult[], string>({
      query: (jobId) => ({
        url: '/analysis-results',
        method: 'GET',
        params: { jobId },
      }),
      providesTags: ['AnalysisResults'],
    }),
    listResolutionJobs: builder.query<ResolutionJob[], void>({
      query: () => ({ url: '/resolution/jobs', method: 'GET' }),
      providesTags: ['ResolutionJobs'],
    }),
    createResolutionJob: builder.mutation<ResolutionJob, ResolutionJobRequest>({
      query: (body) => ({ url: '/resolution/jobs', method: 'POST', body }),
      invalidatesTags: ['ResolutionJobs'],
    }),
    getResolutionJob: builder.query<ResolutionJob, string>({
      query: (id) => ({ url: `/resolution/jobs/${id}`, method: 'GET' }),
      providesTags: ['ResolutionJobs'],
    }),
    similaritySearch: builder.query<SimilaritySearchResponse, SimilaritySearchParams>({
      query: ({ entityId, limit = 10, datasetIds }) => ({
        url: `/entities/${entityId}/similar`,
        method: 'GET',
        params: {
          ...(limit != null && { limit }),
          ...(datasetIds?.length && { datasetIds: datasetIds.join(',') }),
        },
      }),
    }),
    inferSchema: builder.mutation<SchemaInferResponse, SchemaInferRequest>({
      query: ({ sampleContent, format = 'csv' }) => ({
        url: '/schema/infer',
        method: 'POST',
        body: { sampleContent, format },
      }),
    }),
    uploadDatasetFile: builder.mutation<IngestResponse, { datasetId: string; file: File }>({
      query: ({ datasetId, file }) => {
        const formData = new FormData();
        formData.append('datasetId', datasetId);
        formData.append('file', file, file.name);
        return {
          url: '/ingest',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (_r, _e, { datasetId }) => ['Datasets', { type: 'Datasets', id: datasetId }],
    }),
    syncDatasetFileMetadata: builder.mutation<
      { columns: string[]; synced: boolean; reason: string },
      string
    >({
      query: (datasetId) => ({
        url: `/datasets/${datasetId}/sync-file-metadata`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, datasetId) => [{ type: 'Datasets', id: datasetId }],
    }),
  }),
});

export const {
  useListDatasetsQuery,
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useGetDatasetQuery,
  useLazyGetDatasetQuery,
  useGetDatasetPreviewRowsQuery,
  useTriggerFeatureExtractMutation,
  useTriggerScalarExtractMutation,
  useScalarExtractUploadMutation,
  useGetJobStatusQuery,
  useLazyGetJobStatusQuery,
  useListEntityMappingsQuery,
  useCreateEntityMappingMutation,
  useDeleteEntityMappingMutation,
  useListFeatureDefinitionsQuery,
  useListFeaturesSummaryQuery,
  useCreateFeatureDefinitionMutation,
  useDeleteFeatureDefinitionMutation,
  useListAnalysisJobsQuery,
  useCreateAnalysisJobMutation,
  useLazyGetAnalysisJobQuery,
  useListAnalysisResultsQuery,
  useLazyGetAnalysisResultsQuery,
  useListResolutionJobsQuery,
  useCreateResolutionJobMutation,
  useLazyGetResolutionJobQuery,
  useLazySimilaritySearchQuery,
  useInferSchemaMutation,
  useUploadDatasetFileMutation,
  useSyncDatasetFileMetadataMutation,
} = pipelineApi;
