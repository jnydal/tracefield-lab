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
  }),
});

export const {
  useListDatasetsQuery,
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useGetDatasetQuery,
  useLazyGetDatasetQuery,
  useTriggerFeatureExtractMutation,
  useGetJobStatusQuery,
  useLazyGetJobStatusQuery,
  useListEntityMappingsQuery,
  useCreateEntityMappingMutation,
  useDeleteEntityMappingMutation,
  useListFeatureDefinitionsQuery,
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
} = pipelineApi;
