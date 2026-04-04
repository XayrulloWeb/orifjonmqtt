import axios from 'axios';

export const api = axios.create({
  baseURL: '/api', // Просто /api, без http:// и IP
});