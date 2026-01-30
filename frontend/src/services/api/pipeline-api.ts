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
    createAnalysisJob: builder.mutation<AnalysisJob, AnalysisJobRequest>({
      query: (body) => ({ url: '/analysis-jobs', method: 'POST', body }),
      invalidatesTags: ['AnalysisJobs'],
    }),
    getAnalysisJob: builder.query<AnalysisJob, string>({
      query: (id) => ({ url: `/analysis-jobs/${id}`, method: 'GET' }),
      providesTags: ['AnalysisJobs'],
    }),
    getAnalysisResults: builder.query<AnalysisResult[], string>({
      query: (jobId) => ({
        url: '/analysis-results',
        method: 'GET',
        params: { jobId },
      }),
      providesTags: ['AnalysisResults'],
    }),
  }),
});

export const {
  useListDatasetsQuery,
  useCreateDatasetMutation,
  useDeleteDatasetMutation,
  useListEntityMappingsQuery,
  useCreateEntityMappingMutation,
  useDeleteEntityMappingMutation,
  useListFeatureDefinitionsQuery,
  useCreateFeatureDefinitionMutation,
  useDeleteFeatureDefinitionMutation,
  useCreateAnalysisJobMutation,
  useLazyGetAnalysisJobQuery,
  useLazyGetAnalysisResultsQuery,
} = pipelineApi;
