import axios from 'axios';

export const AUTH_TOKEN_STORAGE_KEY = 'agroiot_auth_token';

export const api = axios.create({
  baseURL: '/api',
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeAuthToken(token) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }
  setAuthToken(token);
}

export function clearStoredAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
  setAuthToken(null);
}

setAuthToken(getStoredAuthToken());
