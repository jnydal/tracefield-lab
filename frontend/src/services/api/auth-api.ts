import type { paths } from '../../generated/api/types';
import { baseApi } from './base-api';

// Use generated types from OpenAPI spec
type AuthLoginResponse = paths['/user/login']['post']['responses']['200']['content']['application/json'];
type AuthLoginStateResponse = paths['/auth/loginstate']['get']['responses']['200']['content']['application/json'];
type AuthLogoutResponse = paths['/user/logout']['post']['responses']['200']['content']['application/json'];
type AuthRegisterResponse = paths['/user/register']['post']['responses']['200']['content']['application/json'];

// Request types - OpenAPI doesn't define them, so we use flexible types for now
type LoginRequest = {
  identifier: string;
  password: string;
};

type RegisterRequest = {
  email: string;
  password: string;
};

type LoginPayload =
  | { username: string; password: string }
  | { email: string; password: string };

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthLoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/user/login',
        method: 'POST',
        // Backend currently expects username OR email; map the identifier accordingly.
        // Keep payload flexible so it can be replaced when backend confirms the contract.
        body: mapIdentifierToPayload(credentials),
      }),
      invalidatesTags: ['Auth'],
    }),
    register: builder.mutation<AuthRegisterResponse, RegisterRequest>({
      query: (payload) => ({
        url: '/user/register',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Auth'],
    }),
    getMe: builder.query<AuthLoginStateResponse, void>({
      query: () => ({
        url: '/auth/loginstate',
        method: 'GET',
      }),
      providesTags: ['Auth'],
    }),
    refresh: builder.mutation<AuthLoginResponse, void>({
      query: () => ({
        url: '/user/login',
        method: 'POST',
        // Refresh typically re-authenticates with existing session
        // Adjust based on actual backend contract
      }),
      invalidatesTags: ['Auth'],
    }),
    logout: builder.mutation<AuthLogoutResponse, void>({
      query: () => ({
        url: '/user/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useRefreshMutation,
  useLogoutMutation,
} = authApi;

function mapIdentifierToPayload(credentials: LoginRequest): LoginPayload {
  const { identifier, password } = credentials;

  const isEmail = identifier.includes('@');
  return isEmail
    ? { email: identifier, password }
    : { username: identifier, password };
}

