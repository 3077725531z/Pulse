import { create } from 'zustand';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConvId: null,
  messages: {},          // { convId: [messages] }
  typingUsers: {},       // { convId: Set<userId> }
  onlineUsers: new Set(),

  // 好友请求通知
  friendRequestCount: 0,
  incrementFriendRequest: () => set((s) => ({ friendRequestCount: s.friendRequestCount + 1 })),
  clearFriendRequest: () => set({ friendRequestCount: 0 }),

  // 被加入新群聊时，重新加载会话列表并让 socket 加入新房间
  onGroupJoined: (conversationId) => {
    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('rejoin');
    }
    get().loadConversations();
  },

  // 全局来电状态
  incomingCall: null,    // null | { from, callType, signal, conversationId }
  activeCall: null,      // null | { callType, peerUserId, conversationId, incomingSignal }

  // 加载会话列表
  loadConversations: async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      set({ conversations: data });
    } catch {}
  },

  // 加载消息
  loadMessages: async (convId) => {
    try {
      const { data } = await api.get(`/chat/messages/${convId}?limit=50`);
      set((state) => ({
        messages: { ...state.messages, [convId]: data }
      }));
    } catch {}
  },

  // 选择会话
  setCurrentConv: (convId) => {
    set({ currentConvId: convId });
    const socket = getSocket();
    if (socket && convId) {
      socket.emit('message:read', { conversationId: convId });
    }
  },

  // 发送消息
  sendMessage: (conversationId, content, type = 'text') => {
    const socket = getSocket();
    if (socket) {
      socket.emit('message:send', { conversationId, content, type });
    }
  },

  // 接收新消息（由 socket 调用）
  addMessage: (message) => {
    set((state) => {
      const convId = message.conversation_id;
      const existing = state.messages[convId] || [];

      // 更新会话列表的最后消息
      const convs = state.conversations.map(c =>
        c.id === convId
          ? { ...c, last_message: message.content, last_time: message.created_at, last_sender_id: message.sender_id }
          : c
      );
      // 把该会话移到最前面
      const idx = convs.findIndex(c => c.id === convId);
      if (idx > 0) {
        const [conv] = convs.splice(idx, 1);
        convs.unshift(conv);
      }

      return {
        messages: { ...state.messages, [convId]: [...existing, message] },
        conversations: convs,
      };
    });
  },

  // 输入状态
  setTyping: (convId, userId, isTyping) => {
    set((state) => {
      const typing = { ...state.typingUsers };
      if (!typing[convId]) typing[convId] = new Set();
      if (isTyping) typing[convId].add(userId);
      else typing[convId].delete(userId);
      return { typingUsers: typing };
    });
  },

  // 在线状态
  setUserOnline: (userId, online) => {
    set((state) => {
      const s = new Set(state.onlineUsers);
      if (online) s.add(userId); else s.delete(userId);
      return { onlineUsers: s };
    });
  },

  createPrivate: async (targetUserId) => {
    try {
      const { data } = await api.post('/chat/private', { targetUserId });
      await get().loadConversations();
      return data.id;
    } catch {}
  },

  createGroup: async (name, memberIds) => {
    try {
      const { data } = await api.post('/chat/group', { name, memberIds });
      await get().loadConversations();
      return data.id;
    } catch {}
  },

  // 来电通知（socket 调用）
  setIncomingCall: (call) => set({ incomingCall: call }),
  clearIncomingCall: () => set({ incomingCall: null }),

  // 接听来电
  acceptCall: () => {
    const { incomingCall } = get();
    if (!incomingCall) return;
    set({
      activeCall: {
        callType: incomingCall.callType,
        peerUserId: incomingCall.from,
        conversationId: incomingCall.conversationId,
        incomingSignal: incomingCall.signal,
      },
      incomingCall: null,
    });
  },

  // 拒绝来电
  rejectCall: () => {
    const { incomingCall } = get();
    if (incomingCall) {
      const socket = getSocket();
      socket?.emit('call:reject', { to: incomingCall.from, conversationId: incomingCall.conversationId });
      // 记录拒绝通话消息
      socket?.emit('message:send', {
        conversationId: incomingCall.conversationId,
        content: JSON.stringify({ action: 'reject', callType: incomingCall.callType }),
        type: 'system',
      });
    }
    set({ incomingCall: null });
  },

  // 发起通话
  startCall: (callType, peerUserId, conversationId) => {
    set({ activeCall: { callType, peerUserId, conversationId, incomingSignal: null } });
  },

  // 结束通话
  endCall: (peerUserId, conversationId) => {
    const socket = getSocket();
    if (socket && peerUserId) {
      socket.emit('call:end', { to: peerUserId, conversationId });
    }
    set({ activeCall: null });
  },

  // 根据 conversationId 找会话头像
  getConversationPeer: (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return { name: '未知', avatar: '' };
    if (conv.type === 'private' && conv.other) {
      return { name: conv.other.nickname || '未知', avatar: conv.other.avatar || '' };
    }
    return { name: conv.name || '群聊', avatar: conv.avatar || '' };
  },
}));
