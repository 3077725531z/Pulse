import { create } from 'zustand';
import api from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('pulse_token'),
  isLoggedIn: !!localStorage.getItem('pulse_token'),
  theme: localStorage.getItem('pulse_theme') || 'dark',
  settings: {
    onlineVisibility: 'friends',
    showReadReceipts: true,
    showTyping: true,
    showLastSeen: true,
    notiSound: true,
    notiPreview: true,
  },

  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pulse_token', data.token);
    localStorage.setItem('pulse_theme', data.user.theme || 'dark');
    document.documentElement.setAttribute('data-theme', data.user.theme || 'dark');
    set({ user: data.user, token: data.token, isLoggedIn: true, theme: data.user.theme || 'dark' });
    return data;
  },

  register: async ({ username, password, nickname, email, emailCode }) => {
    const { data } = await api.post('/auth/register', { username, password, nickname, email, emailCode });
    localStorage.setItem('pulse_token', data.token);
    localStorage.setItem('pulse_theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    set({ user: data.user, token: data.token, isLoggedIn: true, theme: 'dark' });
    return data;
  },

  logout: () => {
    localStorage.removeItem('pulse_token');
    set({ user: null, token: null, isLoggedIn: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/user/me');
      const theme = data.theme || 'dark';
      localStorage.setItem('pulse_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      set({ user: { ...data, isAdmin: !!data.isAdmin }, theme });
    } catch {}
  },

  updateProfile: async (updates) => {
    const { data } = await api.put('/user/me', updates);
    set({ user: { ...get().user, ...data } });
    return data;
  },

  updateTheme: async (theme) => {
    await api.put('/user/theme', { theme });
    localStorage.setItem('pulse_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  updatePulseId: async (pulseId) => {
    const { data } = await api.put('/user/pulse-id', { pulseId });
    set({ user: { ...get().user, pulseId: data.pulseId, pulseIdChangedAt: data.pulseIdChangedAt } });
    return data;
  },

  initTheme: () => {
    const theme = localStorage.getItem('pulse_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  fetchSettings: async () => {
    try {
      const { data } = await api.get('/user/settings');
      set({ settings: data });
      // 同步到 localStorage 供离线使用
      localStorage.setItem('pulse_read_receipts', String(data.showReadReceipts));
      localStorage.setItem('pulse_show_typing', String(data.showTyping));
      localStorage.setItem('pulse_show_last_seen', String(data.showLastSeen));
      localStorage.setItem('pulse_online_visibility', data.onlineVisibility);
      localStorage.setItem('pulse_noti_sound', String(data.notiSound));
      localStorage.setItem('pulse_noti_preview', String(data.notiPreview));
    } catch {}
  },

  updateSettings: async (updates) => {
    const { data } = await api.put('/user/settings', updates);
    set({ settings: data });
    localStorage.setItem('pulse_read_receipts', String(data.showReadReceipts));
    localStorage.setItem('pulse_show_typing', String(data.showTyping));
    localStorage.setItem('pulse_show_last_seen', String(data.showLastSeen));
    localStorage.setItem('pulse_online_visibility', data.onlineVisibility);
    localStorage.setItem('pulse_noti_sound', String(data.notiSound));
    localStorage.setItem('pulse_noti_preview', String(data.notiPreview));
    return data;
  },
}));
