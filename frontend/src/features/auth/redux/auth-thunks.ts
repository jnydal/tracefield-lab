import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../../../app/store';
import { authApi } from '../../../services/api/auth-api';
import { setUser, clearAuth, setLoading } from './auth-slice';

// Bootstrap thunk to hydrate auth state on app start
export const bootstrapAuth = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch; state: RootState }
>('auth/bootstrap', async (_, { dispatch }) => {
  dispatch(setLoading(true));
  
  try {
    // Fetch current user/auth state
    const result = await dispatch(authApi.endpoints.getMe.initiate());
    
    if (result.data) {
      // Map response to user object
      // Since OpenAPI doesn't define exact shape, we use flexible mapping
      const userData = result.data as Record<string, unknown>;
      const user = {
        id: typeof userData.id === 'string' ? userData.id : undefined,
        email: typeof userData.email === 'string' ? userData.email : undefined,
        username: typeof userData.username === 'string' ? userData.username : undefined,
        displayName: typeof userData.displayName === 'string' 
          ? userData.displayName 
          : undefined,
        ...userData,
      };
      
      dispatch(setUser(user));
    } else {
      // No user data, clear auth state
      dispatch(clearAuth());
    }
  } catch (error) {
    // On error (401, etc.), clear auth state
    dispatch(clearAuth());
  } finally {
    dispatch(setLoading(false));
  }
});

