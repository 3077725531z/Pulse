import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

// 通知音效（使用 Web Audio API 生成）
function playNotiSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function useSocket() {
  const token = useAuthStore(s => s.token);
  const settings = useAuthStore(s => s.settings);
  const addMessage = useChatStore(s => s.addMessage);
  const setTyping = useChatStore(s => s.setTyping);
  const setUserOnline = useChatStore(s => s.setUserOnline);
  const setIncomingCall = useChatStore(s => s.setIncomingCall);
  const clearIncomingCall = useChatStore(s => s.clearIncomingCall);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(token);

    const onMessage = (msg) => {
      addMessage(msg);
      // 消息通知音效
      const s = settingsRef.current;
      if (s.notiSound) {
        playNotiSound();
      }
      // 浏览器通知预览
      try {
        if (s.notiPreview && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(msg.sender_name || '新消息', {
            body: msg.type === 'text' ? msg.content : `[${msg.type === 'image' ? '图片' : msg.type === 'file' ? '文件' : '消息'}]`,
            icon: msg.sender_avatar ? `http://localhost:3000${msg.sender_avatar}` : undefined,
            silent: true,
          });
        }
      } catch {}
    };
    const onTypingStart = ({ userId, conversationId }) => setTyping(conversationId, userId, true);
    const onTypingStop = ({ userId, conversationId }) => setTyping(conversationId, userId, false);
    const onUserStatus = ({ userId, online }) => {
      console.log('[user:status]', userId, online);
      setUserOnline(userId, online);
    };
    const onCallOffer = ({ from, callType, signal, conversationId }) => {
      console.log('[call:offer] from', from, callType);
      setIncomingCall({ from, callType, signal, conversationId });
    };
    const onCallReject = () => clearIncomingCall();
    const onCallEnd = () => clearIncomingCall();

    socket.on('message:new', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('user:status', onUserStatus);
    socket.on('call:offer', onCallOffer);
    socket.on('call:reject', onCallReject);
    socket.on('call:end', onCallEnd);

    if (!socket.connected) {
      socket.connect();
    }

    // 请求浏览器通知权限
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {}

    return () => {
      socket.off('message:new', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('user:status', onUserStatus);
      socket.off('call:offer', onCallOffer);
      socket.off('call:reject', onCallReject);
      socket.off('call:end', onCallEnd);
    };
  }, [token]);
}
