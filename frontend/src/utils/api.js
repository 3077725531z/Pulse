import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// 请求拦截器：自动加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pulse_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器：401 自动跳登录
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pulse_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
