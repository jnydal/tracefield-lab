// Types using generated OpenAPI types as base
// Since OpenAPI doesn't define exact response shapes, we use flexible types
// that extend the generated Record<string, never> with expected fields

import type { paths } from '../../../generated/api/types';

// Use generated response types
export type LoginResponse = paths['/user/login']['post']['responses']['200']['content']['application/json'];
export type LoginStateResponse = paths['/auth/loginstate']['get']['responses']['200']['content']['application/json'];
export type LogoutResponse = paths['/user/logout']['post']['responses']['200']['content']['application/json'];

// User type - extends the flexible response with expected fields
export interface AuthUser {
  id?: string;
  email?: string;
  username?: string;
  displayName?: string;
  [key: string]: unknown;
}

// Request types for UI layer
export interface LoginRequest {
  identifier: string;
  password: string;
}

export type LoginPayload =
  | { username: string; password: string }
  | { email: string; password: string };

