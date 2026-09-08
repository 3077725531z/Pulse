import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import resolveUrl from '../utils/resolveUrl';

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

export default function EditProfilePage({ onClose }) {
  const { user, fetchMe } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [signature, setSignature] = useState(user?.signature || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 检查文件大小（限制为 2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }

    setLoading(true);
    try {
      // 上传到服务器
      const formData = new FormData();
      formData.append('avatar', file);
      
      const { data } = await api.post('/user/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAvatar(data.avatar);
    } catch (err) {
      alert('上传失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      alert('昵称不能为空');
      return;
    }

    setLoading(true);
    try {
      await api.put('/user/me', {
        nickname: nickname.trim(),
        signature: signature.trim(),
        avatar: avatar
      });
      
      await fetchMe();
      onClose();
    } catch (err) {
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-80 glass rounded-glass p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">编辑个人信息</h2>
          <button onClick={onClose} className="text-t3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white cursor-pointer overflow-hidden"
              style={{ background: avatar ? 'transparent' : getGradient(nickname) }}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatar ? (
                <img src={resolveUrl(avatar)} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (nickname || 'U')[0]
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-accent rounded-full flex items-center justify-center text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Nickname */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-t3 mb-2 block">昵称</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            className="w-full h-10 glass rounded-full px-4 text-sm text-t1 placeholder:text-t3 outline-none"
            placeholder="输入昵称"
          />
        </div>

        {/* Signature */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-t3 mb-2 block">个性签名</label>
          <textarea
            value={signature}
            onChange={e => setSignature(e.target.value)}
            className="w-full h-20 glass rounded-glass px-4 py-3 text-sm text-t1 placeholder:text-t3 outline-none resize-none"
            placeholder="输入个性签名"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-12 bg-accent text-white font-semibold rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}