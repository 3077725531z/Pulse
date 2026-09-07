import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n/useI18n';
import { getSocket } from '../utils/socket';
import { format } from 'date-fns';
import api from '../utils/api';

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0ea5e9)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#f472b6,#ec4899)',
  'linear-gradient(135deg,#22d3ee,#06b6d4)',
  'linear-gradient(135deg,#c084fc,#a855f7)',
  'linear-gradient(135deg,#fb923c,#f97316)',
];

function getGradient(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function Avatar({ name, avatar, size = 'w-9 h-9', textSize = 'text-sm' }) {
  if (avatar) {
    return <div className={`${size} rounded-full overflow-hidden shrink-0`}><img src={avatar} alt="" className="w-full h-full object-cover" /></div>;
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center ${textSize} font-bold text-white shrink-0`} style={{ background: getGradient(name) }}>
      {(name || '?')[0]}
    </div>
  );
}

// 常用表情列表
const EMOJI_LIST = [
  '😀','😂','🤣','😊','😍','🥰','😘','😜','🤪','😎',
  '🤔','😶','😏','😢','😭','😤','🤯','😱','😴','🤮',
  '🥳','🤩','😇','🤗','🤡','💀','👻','👽','🤖','💩',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💖',
  '👍','👎','👏','🙏','💪','✌️','🤝','👋','🫶','🤙',
  '🔥','⭐','🌟','💫','✨','🎉','🎊','💯','🏆','🥇',
  '😊','😇','🥰','😘','😋','😛','🤩','🥳','😎','🤗',
  '🫠','🫣','🫡','🫢','😤','😡','🤬','😈','👿','💀',
];

export default function ChatDetail({ conversation, onBack }) {
  const { t } = useI18n();
  const messages = useChatStore(s => s.messages);
  const loadMessages = useChatStore(s => s.loadMessages);
  const sendMessage = useChatStore(s => s.sendMessage);
  const typingUsers = useChatStore(s => s.typingUsers);
  const onlineUsers = useChatStore(s => s.onlineUsers);
  const startCall = useChatStore(s => s.startCall);
  const user = useAuthStore(s => s.user);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readStatus, setReadStatus] = useState({});  // { userId: true } 谁已读了我的消息
  const [showEmoji, setShowEmoji] = useState(false);
  const msgEndRef = useRef(null);
  const typingTimeout = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const convId = conversation.id;
  const msgs = messages[convId] || [];
  const typing = typingUsers[convId] && typingUsers[convId].size > 0;

  const otherUserId = conversation.other?.id;
  const isOtherOnline = otherUserId && onlineUsers.has(otherUserId);

  useEffect(() => {
    loadMessages(convId);
    getSocket()?.emit('message:read', { conversationId: convId });
    // 从后端加载已读状态
    api.get(`/chat/read-status/${convId}`).then(({ data }) => {
      if (data.read) setReadStatus(prev => ({ ...prev, [otherUserId]: true }));
      else setReadStatus(prev => ({ ...prev, [otherUserId]: false }));
    }).catch(() => {});
  }, [convId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // 监听已读状态
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ userId, conversationId }) => {
      if (conversationId === convId) {
        setReadStatus(prev => ({ ...prev, [userId]: true }));
      }
    };
    socket.on('message:read', handler);
    return () => socket.off('message:read', handler);
  }, [convId]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(convId, text);
    setInput('');
    handleTypingStop();
    setShowEmoji(false);
  };

  const handleEmojiClick = (emoji) => {
    setInput(prev => prev + emoji);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('chat_imageOnly'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('chat_imageSize'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', convId);

      const { data } = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      sendMessage(convId, data.url, 'image');
    } catch (err) {
      alert(t('chat_uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(t('chat_fileSize'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', convId);

      const { data } = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      sendMessage(convId, `${file.name}: ${data.url}`, 'file');
    } catch (err) {
      alert(t('chat_uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      getSocket()?.emit('typing:start', { conversationId: convId });
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(handleTypingStop, 2000);
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      getSocket()?.emit('typing:stop', { conversationId: convId });
    }
    clearTimeout(typingTimeout.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 发起通话（使用全局 store）
  const handleStartCall = (ct) => {
    if (!isOtherOnline) {
      alert(t('chat_peerOffline'));
      return;
    }
    // 检查是否支持音视频通话
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!window.isSecureContext) {
        alert('当前页面不是安全上下文(HTTPS)，无法使用音视频通话。请通过 HTTPS 访问。');
      } else {
        alert('当前浏览器不支持音视频通话，请使用 Chrome 或 Safari 浏览器');
      }
      return;
    }
    startCall(ct, otherUserId, convId);
  };

  const displayName = conversation.name || t('chat_unknown');
  const displayAvatar = conversation.avatar || '';

  const isRead = conversation.type === 'private'
    ? readStatus[otherUserId]
    : Object.keys(readStatus).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0">
        <button onClick={onBack} className="w-9 h-9 glass rounded-full flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <Avatar name={displayName} avatar={displayAvatar} />
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-t1">{displayName}</div>
          <div className={`text-[11px] ${isOtherOnline ? 'text-green' : 'text-t3'}`}>
            {isOtherOnline ? t('chat_online') : t('chat_offline')}
          </div>
        </div>
        {/* 语音通话按钮 */}
        <button onClick={() => handleStartCall('voice')} className="w-9 h-9 glass rounded-full flex items-center justify-center">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </button>
        {/* 视频通话按钮 */}
        <button onClick={() => handleStartCall('video')} className="w-9 h-9 glass rounded-full flex items-center justify-center">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scroll px-4 py-2 flex flex-col gap-1.5">
        <div className="text-center py-3">
          <span className="text-[11px] font-medium text-t3 glass px-3 py-1 rounded-full">{t('chat_today')}</span>
        </div>

        {msgs.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const isImage = msg.type === 'image';
          const isFile = msg.type === 'file';
          const isCall = msg.type === 'voice' || msg.type === 'video';
          const isSystem = msg.type === 'system';

          let callMeta = {};
          if (isCall) {
            try { callMeta = JSON.parse(msg.content); } catch { callMeta = {}; }
          }
          const callDuration = callMeta.duration || 0;
          const callMin = Math.floor(callDuration / 60);
          const callSec = (callDuration % 60).toString().padStart(2, '0');

          let systemText = '';
          if (isSystem) {
            try {
              const meta = JSON.parse(msg.content);
              const callTypeKey = meta.callType === 'video' ? 'chat_videoCall' : 'chat_voiceCall';
              const callName = t(callTypeKey);
              if (meta.action === 'reject') systemText = t('chat_callRejected', { type: callName });
              else if (meta.action === 'cancel') systemText = t('chat_callCancelled', { type: callName });
              else systemText = msg.content;
            } catch {
              systemText = msg.content;
            }
          }

          // 系统消息居中显示
          if (isSystem) {
            return (
              <div key={msg.id} className="text-center py-1 msg-enter">
                <span className="text-[11px] text-t3 glass px-3 py-1 rounded-full">{systemText}</span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex gap-2 max-w-[82%] msg-enter ${isMine ? 'self-end' : 'self-start'}`}>
              {!isMine && (
                <Avatar name={msg.sender_name} avatar={msg.sender_avatar} size="w-6 h-6" textSize="text-[10px]" />
              )}
              <div>
                <div className={`px-3.5 py-2.5 text-sm leading-relaxed ${isMine ? 'bubble-send' : 'bubble-recv'}`}>
                  {isImage ? (
                    <img src={msg.content} alt="image" className="max-w-full rounded-lg cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                  ) : isFile ? (
                    <a href={msg.content.split(': ')[1]} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      {msg.content.split(': ')[0]}
                    </a>
                  ) : isCall ? (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {msg.type === 'video' ? (
                          <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>
                        ) : (
                          <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/></>
                        )}
                      </svg>
                      <span>{msg.type === 'video' ? t('chat_videoCall') : t('chat_voiceCall')} · {callMin}:{callSec}</span>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <div className={`text-[10px] text-t3 mt-1 flex items-center gap-1 ${isMine ? 'justify-end' : ''}`}>
                  {isMine && (
                    <span className={isRead ? 'text-accent' : 'text-t3'}>
                      {isRead ? '✓✓' : '✓'}
                    </span>
                  )}
                  <span>{format(new Date(msg.created_at + 'Z'), 'HH:mm')}</span>
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex items-center gap-2 self-start msg-enter">
            <Avatar name={conversation.name} avatar={displayAvatar} size="w-6 h-6" textSize="text-[10px]" />
            <div className="flex gap-1 px-3.5 py-2.5 bubble-recv">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={msgEndRef} />
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="px-4 pb-2 shrink-0">
          <div className="glass rounded-2xl p-3 max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_LIST.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 pb-7 pt-2 shrink-0">
        <div className="flex items-end gap-2">
          {/* 表情按钮 */}
          <button 
            onClick={() => setShowEmoji(!showEmoji)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${showEmoji ? 'text-accent bg-accent/10' : 'text-t3'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          {/* 图片上传 */}
          <button 
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="w-9 h-9 flex items-center justify-center text-t3 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          {/* 文件上传 */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-9 h-9 flex items-center justify-center text-t3 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
          {/* 输入框 */}
          <div className="flex-1 composer-wrap glass rounded-pill px-4 flex items-center min-h-[38px] transition-colors">
            <input
              type="text"
              placeholder={t('chat_inputPlaceholder')}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleTypingStart(); }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-sm text-t1 placeholder:text-t3 py-2"
            />
          </div>
          {/* 发送按钮 */}
          <button onClick={handleSend} className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-white shrink-0 active:scale-92 transition-transform">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        {uploading && <div className="text-center text-xs text-t3 mt-2">{t('chat_uploading')}</div>}
      </div>
    </div>
  );
}
