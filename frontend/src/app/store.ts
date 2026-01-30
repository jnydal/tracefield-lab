import { configureStore } from '@reduxjs/toolkit';
import { baseApi, setAuthClearHandler } from '../services/api/base-api';
import authReducer, { clearAuth } from '../features/auth/redux/auth-slice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

// Set auth clear handler for 401/403 handling in baseApi
setAuthClearHandler(() => {
  store.dispatch(clearAuth());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

