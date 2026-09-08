import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

// ========== 纯 CSS 图表组件 ==========

function BarChart({ data, height = 160, color = '#38bdf8', labelKey = 'date', valueKey = 'count' }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3 text-center py-8">暂无数据</div>;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[10px] text-t3 mb-1">{d[valueKey]}</div>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d[valueKey] / max) * (height - 30)}px`, background: color, minHeight: d[valueKey] > 0 ? 4 : 0 }} />
          <div className="text-[10px] text-t3 mt-1 truncate w-full text-center">{d[labelKey]?.slice(5) || ''}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 140, colors }) {
  if (!data || data.length === 0) return <div className="text-xs text-t3 text-center py-4">暂无数据</div>;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <div className="text-xs text-t3 text-center py-4">暂无数据</div>;
  const defaultColors = ['#38bdf8', '#a78bfa', '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
  const c = colors || defaultColors;
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const pct = d.count / total;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, color: c[i % c.length] };
  });

  const r = 50;
  const cx = 60;
  const cy = 60;
  const strokeW = 18;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 120 120">
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={`${seg.pct * circumference} ${circumference}`}
            strokeDashoffset={-seg.start * circumference}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-t1 text-lg font-bold">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-t3 text-[10px]">总计</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="text-t2">{seg.type || seg.callType || seg.label}</span>
            <span className="text-t3">{seg.count} ({(seg.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ data, color = '#38bdf8', height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100;
  const points = data.map((d, i) => `${(i / (data.length - 1 || 1)) * w},${height - (d.count / max) * (height - 10)}`);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points.join(' ')} />
      <polyline fill={`${color}20`} stroke="none" points={`0,${height} ${points.join(' ')} ${w},${height}`} />
    </svg>
  );
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="glass rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-sm text-t3 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-t3 mt-1">{sub}</div>}
    </div>
  );
}

// ========== 主组件 ==========

export default function AdminPage({ onBack }) {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [calls, setCalls] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [editAnnouncement, setEditAnnouncement] = useState(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [changelogs, setChangelogs] = useState([]);
  const [editChangelog, setEditChangelog] = useState(null);
  const [clVersion, setClVersion] = useState('');
  const [clDate, setClDate] = useState('');
  const [clTitle, setClTitle] = useState('');
  const [clTags, setClTags] = useState('');
  const [clSections, setClSections] = useState([{ type: 'feat', title: '', items: '' }]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [replyingFeedback, setReplyingFeedback] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [search, setSearch] = useState('');

  // 筛选状态
  const [callFilter, setCallFilter] = useState({ type: '', search: '' });
  const [recordingFilter, setRecordingFilter] = useState({ type: '', search: '' });
  const [friendFilter, setFriendFilter] = useState({ status: '', search: '' });
  const [convFilter, setConvFilter] = useState({ type: '', search: '' });
  const [userFilter, setUserFilter] = useState({ search: '' });
  const [dbPassword, setDbPassword] = useState('');
  const [dbRemaining, setDbRemaining] = useState(30);

  // 部署相关
  const [apps, setApps] = useState([]);
  const [deployTarget, setDeployTarget] = useState('backend');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deployMessage, setDeployMessage] = useState('');
  const [restarting, setRestarting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState([]);
  const [buildProgress, setBuildProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState(null);
  const [autoBuild, setAutoBuild] = useState(true);
  const [autoRestart, setAutoRestart] = useState(false);
  const buildAbortRef = useRef(null);

  // 动态密码：前端每秒倒计时，到0时从后端刷新
  useEffect(() => {
    let mounted = true;
    const fetchPassword = async () => {
      try {
        const { data } = await api.get('/admin/db-viewer-password');
        if (mounted) { setDbPassword(data.password); setDbRemaining(data.remaining); }
      } catch {}
    };
    fetchPassword();
    const timer = setInterval(() => {
      setDbRemaining(prev => {
        if (prev <= 1) { fetchPassword(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try { const { data } = await api.get('/admin/stats'); setStats(data); } catch (err) { if (err.response?.status === 403) alert('无管理员权限'); }
  };
  const loadUsers = async () => { const { data } = await api.get('/admin/users'); setUsers(data); };
  const loadConversations = async () => { const { data } = await api.get('/admin/conversations'); setConversations(data); };
  const loadMessages = async (convId) => { const { data } = await api.get(`/admin/conversations/${convId}/messages`); setMessages(data); setSelectedConv(convId); };
  const loadFriendships = async () => { const { data } = await api.get('/admin/friendships'); setFriendships(data); };
  const loadCalls = async () => { const { data } = await api.get('/admin/calls'); setCalls(data); };
  const loadRecordings = async () => { const { data } = await api.get('/admin/recordings'); setRecordings(data); };
  const loadAnnouncements = async () => { const { data } = await api.get('/admin/announcements'); setAnnouncements(data); };
  const loadChangelogs = async () => { const { data } = await api.get('/admin/changelogs'); setChangelogs(data); };
  const loadFeedbacks = async () => { const { data } = await api.get('/admin/feedback'); setFeedbacks(data); };

  const handleDeleteUser = async (id) => { if (!confirm('确定删除此用户？')) return; await api.delete(`/admin/users/${id}`); loadUsers(); };
  const handleToggleAdmin = async (id, isAdmin) => { await api.put(`/admin/users/${id}/admin`, { isAdmin: !isAdmin }); loadUsers(); };
  const handleDeleteRecording = async (id) => { if (!confirm('确定删除此录制文件？')) return; await api.delete(`/admin/recordings/${id}`); setSelectedRecordings(prev => prev.filter(rid => rid !== id)); loadRecordings(); };

  const handleDownloadSingle = (id, format) => {
    const token = localStorage.getItem('pulse_token');
    const formatParam = format ? `?format=${format}` : '';
    fetch(`/api/admin/recordings/${id}/download${formatParam}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error('下载失败: ' + res.status); return res.blob(); })
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); })
      .catch(err => alert(err.message));
  };

  const handleDownloadZip = async () => {
    if (selectedRecordings.length === 0) return alert('请先选择录制文件');
    const token = localStorage.getItem('pulse_token');
    try {
      const res = await fetch('/api/admin/recordings/download-zip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: selectedRecordings }) });
      if (!res.ok) throw new Error('下载失败: ' + res.status);
      const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recordings_${Date.now()}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
    } catch (err) { alert('下载失败: ' + err.message); }
  };

  const toggleRecordingSelect = (id) => setSelectedRecordings(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
  const toggleSelectAllRecordings = () => { if (selectedRecordings.length === filteredRecordings.length) setSelectedRecordings([]); else setSelectedRecordings(filteredRecordings.map(r => r.id)); };

  const formatFileSize = (bytes) => { if (!bytes) return '0 B'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; };
  const formatDuration = (seconds) => { if (!seconds) return '00:00'; const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };

  const handleTabChange = (tab) => {
    setActiveTab(tab); setSelectedConv(null); setMessages([]); setSelectedRecordings([]);
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'users') loadUsers();
    if (tab === 'conversations') loadConversations();
    if (tab === 'friendships') loadFriendships();
    if (tab === 'calls') loadCalls();
    if (tab === 'recordings') loadRecordings();
    if (tab === 'announcements') loadAnnouncements();
    if (tab === 'changelogs') loadChangelogs();
    if (tab === 'feedback') loadFeedbacks();
    if (tab === 'deploy') { loadApps(); loadDeployStatus(); }
  };

  // ===== 部署相关：加载 App 列表 =====
  const loadApps = async () => {
    try {
      const { data } = await api.get('/admin/deploy/apps');
      setApps(data);
    } catch (err) {
      setDeployMessage('加载 App 列表失败：' + (err.response?.data?.error || err.message));
    }
  };

  // 加载部署状态
  const loadDeployStatus = async () => {
    try {
      const { data } = await api.get('/admin/deploy/status');
      setDeployStatus(data);
    } catch (err) {
      // 静默失败
    }
  };

  // 构建前端（使用 SSE 实时接收日志）
  const handleBuild = () => {
    if (building) return;
    if (!confirm('确定开始构建前端？构建过程会清空 backend/public 目录并重新打包，期间前端可能短暂无法访问。')) return;

    setBuilding(true);
    setBuildLogs([]);
    setBuildProgress(0);
    setDeployMessage('正在构建前端...');

    // AbortController：用于主动取消构建
    const controller = new AbortController();
    buildAbortRef.current = controller;

    // Vite 构建进度估算（根据日志关键阶段）
    const updateProgress = (text) => {
      if (/building for production/i.test(text)) setBuildProgress(5);
      else if (/transforming/i.test(text)) setBuildProgress(15);
      else if (/modules transformed/i.test(text)) setBuildProgress(60);
      else if (/rendering chunks/i.test(text)) setBuildProgress(75);
      else if (/computing gzip size/i.test(text)) setBuildProgress(90);
      else if (/built in/i.test(text)) setBuildProgress(100);
    };

    // 使用 fetch 接收 SSE 流
    const baseURL = api.defaults?.baseURL || '';
    const token = localStorage.getItem('token');
    const url = `${baseURL}/admin/deploy/build`;

    fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 格式：data: {...}\n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'log') {
              updateProgress(msg.data);
              setBuildLogs(prev => [...prev, msg.data]);
            } else if (msg.type === 'done') {
              const result = JSON.parse(msg.data);
              if (result.success) {
                setBuildProgress(100);
                setDeployMessage('✓ 前端构建成功，请重启系统使更改生效');
              } else {
                setDeployMessage('✗ 前端构建失败，请查看日志');
              }
            }
          } catch (e) {
            // 忽略解析失败的行
          }
        }
      }
    }).catch(err => {
      if (err.name === 'AbortError') {
        setDeployMessage('已取消构建');
        setBuildLogs(prev => [...prev, '\n>>> 用户已取消构建\n']);
      } else {
        setDeployMessage('✗ 构建请求失败：' + err.message);
      }
    }).finally(() => {
      setBuilding(false);
      buildAbortRef.current = null;
      loadDeployStatus();
    });
  };

  // 取消构建
  const handleCancelBuild = () => {
    if (buildAbortRef.current) {
      if (!confirm('确定取消构建？正在进行的构建进程将被终止。')) return;
      buildAbortRef.current.abort();
    }
  };

  // 上传代码包
  const handleCodeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadProgress(0);
    setDeployMessage('正在上传代码包...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', deployTarget);
    try {
      const { data } = await api.post('/admin/deploy/code', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      setDeployMessage(`✓ ${data.message}（解压 ${data.fileCount} 个文件）`);

      // 上传前端代码后，自动触发构建
      if (autoBuild && (deployTarget === 'frontend' || deployTarget === 'root')) {
        setTimeout(() => {
          setDeployMessage('上传完成，自动开始构建前端...');
          // 直接调用构建逻辑
          setBuilding(true);
          setBuildLogs([]);
          setBuildProgress(0);
          const controller = new AbortController();
          buildAbortRef.current = controller;

          const updateProgress = (text) => {
            if (/building for production/i.test(text)) setBuildProgress(5);
            else if (/transforming/i.test(text)) setBuildProgress(15);
            else if (/modules transformed/i.test(text)) setBuildProgress(60);
            else if (/rendering chunks/i.test(text)) setBuildProgress(75);
            else if (/computing gzip size/i.test(text)) setBuildProgress(90);
            else if (/built in/i.test(text)) setBuildProgress(100);
          };

          const baseURL = api.defaults?.baseURL || '';
          const token = localStorage.getItem('token');
          fetch(`${baseURL}/admin/deploy/build`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal,
          }).then(async (response) => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const msg = JSON.parse(line.slice(6));
                  if (msg.type === 'log') {
                    updateProgress(msg.data);
                    setBuildLogs(prev => [...prev, msg.data]);
                  } else if (msg.type === 'done') {
                    const result = JSON.parse(msg.data);
                    if (result.success) {
                      setBuildProgress(100);
                      setDeployMessage('✓ 前端构建成功');
                      // 自动重启
                      if (autoRestart) {
                        setTimeout(() => handleRestart(), 500);
                      }
                    } else {
                      setDeployMessage('✗ 前端构建失败，请查看日志');
                    }
                  }
                } catch (e) {}
              }
            }
          }).catch(err => {
            if (err.name !== 'AbortError') {
              setDeployMessage('✗ 构建请求失败：' + err.message);
            }
          }).finally(() => {
            setBuilding(false);
            buildAbortRef.current = null;
            loadDeployStatus();
          });
        }, 300);
      } else if (autoRestart) {
        // 只上传后端代码且开启自动重启
        setTimeout(() => handleRestart(), 500);
      }
    } catch (err) {
      setDeployMessage('✗ 上传失败：' + (err.response?.data?.error || err.message));
    } finally {
      e.target.value = '';
    }
  };

  // 上传 App 安装包
  const handleAppUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadProgress(0);
    setDeployMessage('正在上传 App 安装包...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/admin/deploy/app', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      setDeployMessage(`✓ App 安装包上传成功：${file.name}`);
      loadApps();
    } catch (err) {
      setDeployMessage('✗ 上传失败：' + (err.response?.data?.error || err.message));
    } finally {
      e.target.value = '';
    }
  };

  // 删除 App 安装包
  const handleDeleteApp = async (filename) => {
    if (!confirm(`确定删除 ${filename}？`)) return;
    try {
      await api.delete(`/admin/deploy/apps/${encodeURIComponent(filename)}`);
      loadApps();
    } catch (err) {
      setDeployMessage('删除失败：' + (err.response?.data?.error || err.message));
    }
  };

  // 重启系统
  const handleRestart = async () => {
    if (!confirm('⚠️ 确定重启系统？这会导致服务短暂中断（约 5-10 秒）。\n\n建议先上传代码包后再重启。')) return;
    setRestarting(true);
    setDeployMessage('正在重启...');
    try {
      const { data } = await api.post('/admin/deploy/restart');
      setDeployMessage(`✓ ${data.message}，PID: ${data.pid}。请等待几秒后刷新页面。`);
      // 5 秒后尝试重新加载
      setTimeout(() => {
        setRestarting(false);
        setDeployMessage('系统应已重启，请刷新页面验证。');
      }, 5000);
    } catch (err) {
      setRestarting(false);
      // 重启后连接断开是正常现象，不一定是错误
      if (err.code === 'ECONNABORTED' || !err.response) {
        setDeployMessage('✓ 重启指令已发送，服务正在重启中，请等待几秒后刷新页面。');
      } else {
        setDeployMessage('✗ 重启失败：' + (err.response?.data?.error || err.message));
      }
    }
  };

  // 筛选逻辑
  const filteredUsers = users.filter(u => {
    if (userFilter.search && !u.nickname?.toLowerCase().includes(userFilter.search.toLowerCase()) && !u.username?.toLowerCase().includes(userFilter.search.toLowerCase()) && !u.pulseId?.includes(userFilter.search)) return false;
    return true;
  });

  const filteredCalls = calls.filter(c => {
    if (callFilter.type && c.callType !== callFilter.type) return false;
    if (callFilter.search && !c.callerName?.toLowerCase().includes(callFilter.search.toLowerCase()) && !c.receiverName?.toLowerCase().includes(callFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredRecordings = recordings.filter(r => {
    if (recordingFilter.type && r.callType !== recordingFilter.type) return false;
    if (recordingFilter.search && !r.senderName?.toLowerCase().includes(recordingFilter.search.toLowerCase()) && !r.peerName?.toLowerCase().includes(recordingFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredFriendships = friendships.filter(f => {
    if (friendFilter.status && f.status !== friendFilter.status) return false;
    if (friendFilter.search && !f.user_name?.toLowerCase().includes(friendFilter.search.toLowerCase()) && !f.friend_name?.toLowerCase().includes(friendFilter.search.toLowerCase())) return false;
    return true;
  });

  const filteredConversations = conversations.filter(c => {
    if (convFilter.type && c.type !== convFilter.type) return false;
    if (convFilter.search && !c.name?.toLowerCase().includes(convFilter.search.toLowerCase()) && !c.members?.toLowerCase().includes(convFilter.search.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: 'dashboard', label: '总览', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'users', label: '用户', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'conversations', label: '会话', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id: 'friendships', label: '好友关系', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    { id: 'calls', label: '通话记录', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg> },
    { id: 'recordings', label: '录制文件', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
    { id: 'announcements', label: '系统公告', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { id: 'changelogs', label: '更新日志', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'feedback', label: '用户反馈', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> },
    { id: 'deploy', label: '部署', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 glass rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <h1 className="text-xl font-bold text-t1">管理员控制台</h1>
        </div>
        <span className="text-sm text-t3">{user?.nickname} (管理员)</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 shrink-0 border-r border-border p-3 flex flex-col gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-accent/15 text-accent' : 'text-t2 hover:bg-white/5'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ========== Dashboard ========== */}
          {activeTab === 'dashboard' && stats && (
            <div>
              <h2 className="text-lg font-semibold text-t1 mb-4">数据概览</h2>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="总用户" value={stats.userCount} color="#38bdf8" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
                <StatCard label="总消息" value={stats.msgCount} color="#a78bfa" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} sub={`图片 ${stats.imageCount} / 文件 ${stats.fileCount}`} />
                <StatCard label="总会话" value={stats.convCount} color="#22d3ee" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
                <StatCard label="总通话" value={stats.callCount} color="#22c55e" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg>} sub={`好友 ${stats.friendCount} / 录制 ${stats.recordingCount}`} />
              </div>

              {/* 数据库可视化密码 */}
              <div className="glass rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b15' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div>
                      <div className="text-sm text-t1 font-medium">数据库查看密码</div>
                      <div className="text-xs text-t3">每30秒自动刷新 | <a href="/db-viewer" target="_blank" className="text-accent hover:underline">打开数据库面板</a></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold px-4 py-2 rounded-lg select-all" style={{ background: 'var(--bg-secondary)', color: '#f59e0b', letterSpacing: '4px' }}>{dbPassword}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(dbPassword).catch(() => {}); }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'var(--bg-secondary)', color: '#f59e0b' }}
                      title="复制密码"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <span className="text-sm font-mono font-bold px-2 py-1 rounded-lg" style={{ background: dbRemaining <= 10 ? '#ef444415' : '#f59e0b15', color: dbRemaining <= 10 ? '#ef4444' : '#f59e0b' }}>{dbRemaining}s</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${(dbRemaining / 30) * 100}%`,
                      background: dbRemaining <= 10 ? '#ef4444' : '#f59e0b',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* 用户增长 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">近7天用户增长</div>
                  <MiniLineChart data={stats.userGrowth} color="#38bdf8" />
                  <div className="mt-2"><BarChart data={stats.userGrowth} height={100} color="#38bdf8" /></div>
                </div>
                {/* 消息趋势 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">近7天消息趋势</div>
                  <MiniLineChart data={stats.msgTrend} color="#a78bfa" />
                  <div className="mt-2"><BarChart data={stats.msgTrend} height={100} color="#a78bfa" /></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* 消息类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">消息类型分布</div>
                  <DonutChart data={stats.msgTypeDist} />
                </div>
                {/* 通话类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">通话类型分布</div>
                  <DonutChart data={stats.callTypeDist} colors={['#22c55e', '#38bdf8']} />
                </div>
                {/* 会话类型分布 */}
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">会话类型分布</div>
                  <DonutChart data={stats.convTypeDist} colors={['#a78bfa', '#22d3ee']} />
                </div>
              </div>

              {/* 通话趋势 */}
              {stats.callTrend && stats.callTrend.length > 0 && (
                <div className="glass rounded-xl p-4 mb-6">
                  <div className="text-sm font-medium text-t1 mb-3">近7天通话趋势</div>
                  <BarChart data={stats.callTrend} height={120} color="#22c55e" />
                </div>
              )}

              {/* 最近注册 */}
              {stats.recentUsers && stats.recentUsers.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <div className="text-sm font-medium text-t1 mb-3">最近注册用户</div>
                  <div className="space-y-2">
                    {stats.recentUsers.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                          {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (u.nickname || '?')[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-t1">{u.nickname}</div>
                          <div className="text-xs text-t3">@{u.username}</div>
                        </div>
                        <div className="text-xs text-t3">{u.created_at}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Users ========== */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">用户管理 ({filteredUsers.length}/{users.length})</h2>
                <input type="text" placeholder="搜索昵称/用户名/PulseID..." value={userFilter.search} onChange={e => setUserFilter({ ...userFilter, search: e.target.value })} className="w-64 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">用户</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-left py-3 px-4 font-medium">用户名</th>
                    <th className="text-left py-3 px-4 font-medium">主题</th>
                    <th className="text-left py-3 px-4 font-medium">管理员</th>
                    <th className="text-left py-3 px-4 font-medium">注册时间</th>
                    <th className="text-right py-3 px-4 font-medium">操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4"><div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-xs font-bold text-accent">{u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : (u.nickname || '?')[0]}</div>
                          <span className="text-t1">{u.nickname}</span>
                        </div></td>
                        <td className="py-3 px-4 text-t2 font-mono">{u.pulseId}</td>
                        <td className="py-3 px-4 text-t2">{u.username}</td>
                        <td className="py-3 px-4 text-t2">{u.theme}</td>
                        <td className="py-3 px-4">{u.isAdmin ? <span className="text-accent">是</span> : <span className="text-t3">否</span>}</td>
                        <td className="py-3 px-4 text-t3">{u.createdAt}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} className="text-xs text-accent mr-3">{u.isAdmin ? '取消管理员' : '设为管理员'}</button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-xs text-red">删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Conversations ========== */}
          {activeTab === 'conversations' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">会话列表 ({filteredConversations.length}/{conversations.length})</h2>
                <div className="flex gap-2">
                  <select value={convFilter.type} onChange={e => setConvFilter({ ...convFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="private">私聊</option>
                    <option value="group">群聊</option>
                  </select>
                  <input type="text" placeholder="搜索会话/成员..." value={convFilter.search} onChange={e => setConvFilter({ ...convFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              {!selectedConv ? (
                <div className="space-y-2">
                  {filteredConversations.map(c => (
                    <div key={c.id} className="glass rounded-xl p-4 cursor-pointer hover:bg-white/5" onClick={() => loadMessages(c.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-t1 font-medium">{c.name || c.type}</div>
                          <div className="text-xs text-t3 mt-1">成员: {c.members}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'group' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>{c.type === 'group' ? '群聊' : '私聊'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <button onClick={() => { setSelectedConv(null); setMessages([]); }} className="text-sm text-accent mb-4">← 返回列表</button>
                  <div className="glass rounded-xl p-4 max-h-[600px] overflow-y-auto">
                    {messages.map(m => (
                      <div key={m.id} className="py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-t1">{m.sender_name}</span>
                          <span className="text-xs text-t3">{m.created_at}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-t3">{m.type}</span>
                        </div>
                        {m.type === 'image' ? <img src={m.content} alt="" className="max-w-[200px] rounded-lg mt-1" /> :
                         m.type === 'file' ? <span className="text-sm text-accent">{m.content.split(': ')[0]}</span> :
                         <p className="text-sm text-t2">{m.content}</p>}
                      </div>
                    ))}
                    {messages.length === 0 && <p className="text-t3 text-sm text-center py-4">暂无消息</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Friendships ========== */}
          {activeTab === 'friendships' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">好友关系 ({filteredFriendships.length}/{friendships.length})</h2>
                <div className="flex gap-2">
                  <select value={friendFilter.status} onChange={e => setFriendFilter({ ...friendFilter, status: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部状态</option>
                    <option value="accepted">已接受</option>
                    <option value="pending">待处理</option>
                    <option value="rejected">已拒绝</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={friendFilter.search} onChange={e => setFriendFilter({ ...friendFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">用户</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-center py-3 px-4 font-medium">→</th>
                    <th className="text-left py-3 px-4 font-medium">好友</th>
                    <th className="text-left py-3 px-4 font-medium">PulseID</th>
                    <th className="text-left py-3 px-4 font-medium">状态</th>
                    <th className="text-left py-3 px-4 font-medium">时间</th>
                  </tr></thead>
                  <tbody>
                    {filteredFriendships.map((f, i) => (
                      <tr key={i} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4 text-t1">{f.user_name}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{f.user_pulse_id}</td>
                        <td className="py-3 px-4 text-center text-t3">→</td>
                        <td className="py-3 px-4 text-t1">{f.friend_name}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{f.friend_pulse_id}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'accepted' ? 'bg-green/20 text-green' : f.status === 'rejected' ? 'bg-red/20 text-red' : 'bg-yellow/20 text-yellow'}`}>
                            {f.status === 'accepted' ? '已接受' : f.status === 'rejected' ? '已拒绝' : '待处理'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t3">{f.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Calls ========== */}
          {activeTab === 'calls' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">通话记录 ({filteredCalls.length}/{calls.length})</h2>
                <div className="flex gap-2">
                  <select value={callFilter.type} onChange={e => setCallFilter({ ...callFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="voice">语音通话</option>
                    <option value="video">视频通话</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={callFilter.search} onChange={e => setCallFilter({ ...callFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="text-left py-3 px-4 font-medium">类型</th>
                    <th className="text-left py-3 px-4 font-medium">发起方</th>
                    <th className="text-left py-3 px-4 font-medium">接收方</th>
                    <th className="text-left py-3 px-4 font-medium">时长</th>
                    <th className="text-left py-3 px-4 font-medium">状态</th>
                    <th className="text-left py-3 px-4 font-medium">时间</th>
                  </tr></thead>
                  <tbody>
                    {filteredCalls.map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.callType === 'video' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>
                            {c.callType === 'video' ? '📹 视频' : '📞 语音'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t1">{c.callerName}</td>
                        <td className="py-3 px-4 text-t2">{c.receiverName}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{formatDuration(c.duration)}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'answered' ? 'bg-green/20 text-green' : c.status === 'rejected' ? 'bg-red/20 text-red' : 'bg-yellow/20 text-yellow'}`}>
                            {c.status === 'answered' ? '已接听' : c.status === 'rejected' ? '已拒绝' : c.status === 'missed' ? '未接' : c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-t3 text-xs">{c.createdAt}</td>
                      </tr>
                    ))}
                    {filteredCalls.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-t3">暂无通话记录</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== Recordings ========== */}
          {activeTab === 'recordings' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">录制文件 ({filteredRecordings.length}/{recordings.length})</h2>
                <div className="flex gap-2">
                  <select value={recordingFilter.type} onChange={e => setRecordingFilter({ ...recordingFilter, type: e.target.value })} className="h-9 glass rounded-lg px-3 text-sm text-t1 outline-none">
                    <option value="">全部类型</option>
                    <option value="voice">语音</option>
                    <option value="video">视频</option>
                  </select>
                  <input type="text" placeholder="搜索用户..." value={recordingFilter.search} onChange={e => setRecordingFilter({ ...recordingFilter, search: e.target.value })} className="w-48 h-9 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                  {selectedRecordings.length > 0 && (
                    <button onClick={handleDownloadZip} className="px-3 h-9 bg-accent rounded-lg text-xs font-medium" style={{ color: '#fff' }}>打包下载 ({selectedRecordings.length})</button>
                  )}
                </div>
              </div>
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-t3">
                    <th className="py-3 px-4 w-10"><input type="checkbox" checked={selectedRecordings.length === filteredRecordings.length && filteredRecordings.length > 0} onChange={toggleSelectAllRecordings} className="accent-accent" /></th>
                    <th className="text-left py-3 px-4 font-medium">类型</th>
                    <th className="text-left py-3 px-4 font-medium">发送者</th>
                    <th className="text-left py-3 px-4 font-medium">对方</th>
                    <th className="text-left py-3 px-4 font-medium">会话</th>
                    <th className="text-left py-3 px-4 font-medium">时长</th>
                    <th className="text-left py-3 px-4 font-medium">文件大小</th>
                    <th className="text-left py-3 px-4 font-medium">录制时间</th>
                    <th className="text-right py-3 px-4 font-medium">操作</th>
                  </tr></thead>
                  <tbody>
                    {filteredRecordings.map(r => (
                      <tr key={r.id} className="border-b border-border hover:bg-white/5">
                        <td className="py-3 px-4"><input type="checkbox" checked={selectedRecordings.includes(r.id)} onChange={() => toggleRecordingSelect(r.id)} className="accent-accent" /></td>
                        <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${r.callType === 'video' ? 'bg-accent/20 text-accent' : 'bg-green/20 text-green'}`}>{r.callType === 'video' ? '📹 视频' : '📞 语音'}</span></td>
                        <td className="py-3 px-4 text-t1">{r.senderName}</td>
                        <td className="py-3 px-4 text-t2">{r.peerName || '-'}</td>
                        <td className="py-3 px-4 text-t2">{r.convName || '-'}</td>
                        <td className="py-3 px-4 text-t2 font-mono">{formatDuration(r.duration)}</td>
                        <td className="py-3 px-4 text-t2">{formatFileSize(r.fileSize)}</td>
                        <td className="py-3 px-4 text-t3 text-xs">{r.createdAt}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => handleDownloadSingle(r.id)} className="text-xs text-accent hover:underline">原格式</button>
                            <span className="text-t3 text-xs">|</span>
                            <select onChange={(e) => { if (e.target.value) { handleDownloadSingle(r.id, e.target.value); e.target.value = ''; } }} defaultValue="" className="text-xs bg-transparent text-accent outline-none cursor-pointer">
                              <option value="" disabled>转码下载</option>
                              {r.callType === 'video' ? <><option value="mp4">MP4</option><option value="webm">WebM</option></> : <><option value="mp3">MP3</option><option value="webm">WebM</option></>}
                            </select>
                            <span className="text-t3 text-xs">|</span>
                            <button onClick={() => handleDeleteRecording(r.id)} className="text-xs text-red hover:underline">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRecordings.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-t3">暂无录制文件</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              {selectedRecordings.length === 1 && (() => {
                const r = recordings.find(rec => rec.id === selectedRecordings[0]);
                if (!r) return null;
                return (
                  <div className="mt-4 glass rounded-xl p-4">
                    <h3 className="text-sm font-medium text-t1 mb-3">预览: {r.callType === 'video' ? '视频通话' : '语音通话'} - {r.senderName}</h3>
                    {r.callType === 'video' ? <video controls src={r.filePath} className="w-full max-w-lg rounded-lg" preload="metadata" /> : <audio controls src={r.filePath} className="w-full" preload="metadata" />}
                    <div className="text-xs text-t3 mt-2">时长: {formatDuration(r.duration)} | 大小: {formatFileSize(r.fileSize)} | 格式: {r.mimeType || 'webm'}</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========== Announcements ========== */}
          {activeTab === 'announcements' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">系统公告 ({announcements.length})</h2>
                <button onClick={() => { setEditAnnouncement({}); setAnnouncementTitle(''); setAnnouncementContent(''); }} className="px-3 py-1.5 bg-accent rounded-lg text-sm font-medium" style={{ color: '#fff' }}>+ 发布公告</button>
              </div>
              {announcements.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-t3 mb-3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  <p className="text-t3">暂无公告</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[15px] font-semibold text-t1">{a.title}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditAnnouncement(a); setAnnouncementTitle(a.title); setAnnouncementContent(a.content); }} className="text-xs text-accent hover:underline">编辑</button>
                          <button onClick={async () => { if (confirm('确定删除此公告？')) { await api.delete(`/admin/announcements/${a.id}`); loadAnnouncements(); } }} className="text-xs text-red hover:underline">删除</button>
                        </div>
                      </div>
                      <p className="text-sm text-t2 whitespace-pre-wrap">{a.content}</p>
                      <p className="text-xs text-t3 mt-2">{a.created_at}</p>
                    </div>
                  ))}
                </div>
              )}
              {editAnnouncement !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="w-96 glass rounded-xl p-5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-t1">{editAnnouncement.id ? '编辑公告' : '发布公告'}</h3>
                      <button onClick={() => setEditAnnouncement(null)} className="text-t3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                    <input type="text" placeholder="公告标题" value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none mb-3" />
                    <textarea placeholder="公告内容" value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} className="w-full h-32 glass rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-4" />
                    <button onClick={async () => { if (!announcementTitle.trim() || !announcementContent.trim()) return alert('标题和内容不能为空'); if (editAnnouncement.id) { await api.put(`/admin/announcements/${editAnnouncement.id}`, { title: announcementTitle, content: announcementContent }); } else { await api.post('/admin/announcements', { title: announcementTitle, content: announcementContent }); } setEditAnnouncement(null); loadAnnouncements(); }} className="w-full h-10 bg-accent rounded-lg text-sm font-medium" style={{ color: '#fff' }}>{editAnnouncement.id ? '保存修改' : '发布'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Changelogs ========== */}
          {activeTab === 'changelogs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">更新日志 ({changelogs.length})</h2>
                <button onClick={() => {
                  setEditChangelog({});
                  setClVersion(''); setClDate(new Date().toISOString().slice(0, 10));
                  setClTitle(''); setClTags('');
                  setClSections([{ type: 'feat', title: '', items: '' }]);
                }} className="px-3 py-1.5 bg-accent rounded-lg text-sm font-medium" style={{ color: '#fff' }}>+ 新增版本</button>
              </div>
              {changelogs.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <p className="text-t3">暂无更新日志</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {changelogs.map(c => (
                    <div key={c.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[15px] font-semibold text-t1">v{c.version} <span className="text-xs text-t3 font-normal ml-2">{c.date}</span></h3>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setEditChangelog(c);
                            setClVersion(c.version); setClDate(c.date); setClTitle(c.title || '');
                            setClTags((c.tags || []).join(', '));
                            setClSections((c.sections || []).map(s => ({ type: s.type, title: s.title, items: (s.items || []).join('\n') })));
                          }} className="text-xs text-accent hover:underline">编辑</button>
                          <button onClick={async () => { if (confirm('确定删除此版本日志？')) { await api.delete(`/admin/changelogs/${c.id}`); loadChangelogs(); } }} className="text-xs text-red hover:underline">删除</button>
                        </div>
                      </div>
                      {c.title && <p className="text-sm text-t2 mb-2">{c.title}</p>}
                      {c.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {c.tags.map(tag => <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-glass-m text-t3">{tag}</span>)}
                        </div>
                      )}
                      {c.sections?.map((s, i) => (
                        <div key={i} className="mb-2 last:mb-0">
                          <span className="text-xs text-t2 font-medium">{s.title}</span>
                          <ul className="text-xs text-t3 ml-3 mt-1">
                            {s.items?.map((it, j) => <li key={j}>• {it}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {editChangelog !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="w-full max-w-2xl glass rounded-xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-t1">{editChangelog.id ? '编辑版本' : '新增版本'}</h3>
                      <button onClick={() => setEditChangelog(null)} className="text-t3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-t3 mb-1 block">版本号 *</label>
                        <input type="text" placeholder="如 0.3.0" value={clVersion} onChange={e => setClVersion(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-t3 mb-1 block">日期 *</label>
                        <input type="date" value={clDate} onChange={e => setClDate(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 outline-none" />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-t3 mb-1 block">标题</label>
                      <input type="text" placeholder="一句话描述" value={clTitle} onChange={e => setClTitle(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                    </div>
                    <div className="mb-4">
                      <label className="text-xs text-t3 mb-1 block">标签（逗号分隔）</label>
                      <input type="text" placeholder="如 新功能, Bug修复" value={clTags} onChange={e => setClTags(e.target.value)} className="w-full h-10 glass rounded-lg px-3 text-sm text-t1 placeholder:text-t3 outline-none" />
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-t3">版本内容（每个模块一组）</label>
                        <button onClick={() => setClSections([...clSections, { type: 'feat', title: '', items: '' }])} className="text-xs text-accent">+ 添加模块</button>
                      </div>
                      <div className="space-y-3">
                        {clSections.map((sec, i) => (
                          <div key={i} className="glass rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <select value={sec.type} onChange={e => { const next = [...clSections]; next[i] = { ...sec, type: e.target.value }; setClSections(next); }} className="h-8 glass rounded-lg px-2 text-xs text-t1 outline-none">
                                <option value="feat">新功能</option>
                                <option value="fix">修复</option>
                                <option value="style">样式</option>
                                <option value="perf">优化</option>
                              </select>
                              <input type="text" placeholder="模块标题" value={sec.title} onChange={e => { const next = [...clSections]; next[i] = { ...sec, title: e.target.value }; setClSections(next); }} className="flex-1 h-8 glass rounded-lg px-2 text-sm text-t1 placeholder:text-t3 outline-none" />
                              {clSections.length > 1 && <button onClick={() => setClSections(clSections.filter((_, j) => j !== i))} className="text-xs text-red">删除</button>}
                            </div>
                            <textarea placeholder="每条一行" value={sec.items} onChange={e => { const next = [...clSections]; next[i] = { ...sec, items: e.target.value }; setClSections(next); }} className="w-full h-20 glass rounded-lg px-2 py-1.5 text-sm text-t1 placeholder:text-t3 outline-none resize-none" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={async () => {
                      if (!clVersion.trim() || !clDate.trim()) return alert('版本号和日期不能为空');
                      const tags = clTags.split(',').map(t => t.trim()).filter(Boolean);
                      const sections = clSections.filter(s => s.title.trim() || s.items.trim()).map(s => ({
                        type: s.type,
                        title: s.title.trim(),
                        items: s.items.split('\n').map(it => it.trim()).filter(Boolean),
                      }));
                      const payload = { version: clVersion, date: clDate, title: clTitle, tags, sections };
                      if (editChangelog.id) await api.put(`/admin/changelogs/${editChangelog.id}`, payload);
                      else await api.post('/admin/changelogs', payload);
                      setEditChangelog(null);
                      loadChangelogs();
                    }} className="w-full h-10 bg-accent rounded-lg text-sm font-medium" style={{ color: '#fff' }}>{editChangelog.id ? '保存修改' : '发布'}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Feedback ========== */}
          {activeTab === 'feedback' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-t1">用户反馈 ({feedbacks.length})</h2>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-500">待处理: {feedbacks.filter(f => f.status === 'pending').length}</span>
                  <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">已读: {feedbacks.filter(f => f.status === 'read').length}</span>
                  <span className="px-2 py-1 rounded bg-green/20 text-green">已回复: {feedbacks.filter(f => f.status === 'replied').length}</span>
                </div>
              </div>
              {feedbacks.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-t3 mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  <p className="text-t3">暂无反馈</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map(f => (
                    <div key={f.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {f.avatar ? <img src={f.avatar} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">{(f.nickname || 'U')[0]}</div>}
                          <span className="text-sm font-medium text-t1">{f.nickname}</span>
                          <span className="text-xs text-t3">@{f.username}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'replied' ? 'bg-green/20 text-green' : f.status === 'read' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-500'}`}>{f.status === 'replied' ? '已回复' : f.status === 'read' ? '已读' : '待处理'}</span>
                      </div>
                      <p className="text-sm text-t2 mb-2">{f.content}</p>
                      <p className="text-xs text-t3 mb-2">{f.createdAt}</p>
                      {f.adminReply && <div className="mb-2 p-2 rounded bg-glass-m text-xs text-t2"><span className="text-accent font-medium">管理员回复：</span>{f.adminReply}</div>}
                      <div className="flex gap-2">
                        {f.status === 'pending' && <button onClick={async () => { await api.put(`/admin/feedback/${f.id}/status`, { status: 'read' }); loadFeedbacks(); }} className="text-xs text-blue-400 hover:underline">标为已读</button>}
                        <button onClick={() => { setReplyingFeedback(f.id); setReplyContent(f.adminReply || ''); }} className="text-xs text-accent hover:underline">回复</button>
                        <button onClick={async () => { if (confirm('确定删除此反馈？')) { await api.delete(`/admin/feedback/${f.id}`); loadFeedbacks(); } }} className="text-xs text-red hover:underline">删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {replyingFeedback && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="w-96 glass rounded-xl p-5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-t1">回复反馈</h3>
                      <button onClick={() => setReplyingFeedback(null)} className="text-t3"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                    <textarea placeholder="输入回复内容..." value={replyContent} onChange={e => setReplyContent(e.target.value)} className="w-full h-24 glass rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t3 outline-none resize-none mb-4" />
                    <button onClick={async () => { if (!replyContent.trim()) return; await api.put(`/admin/feedback/${replyingFeedback}/reply`, { adminReply: replyContent }); setReplyingFeedback(null); loadFeedbacks(); }} className="w-full h-10 bg-accent rounded-lg text-sm font-medium" style={{ color: '#fff' }}>发送回复</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Deploy 部署 ========== */}
          {activeTab === 'deploy' && (
            <div>
              <h2 className="text-lg font-semibold text-t1 mb-4">部署管理</h2>

              {/* 提示信息 */}
              {deployMessage && (
                <div className="glass rounded-xl p-3 mb-4 text-sm text-t1 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {deployMessage}
                </div>
              )}

              {/* 部署状态卡片 */}
              {deployStatus && (
                <div className="glass rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xs text-t3 mb-1">应用版本</div>
                      <div className="text-sm font-medium text-t1">v{deployStatus.version || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-t3 mb-1">前端构建</div>
                      <div className="text-sm font-medium" style={{ color: deployStatus.frontendBuilt ? '#22c55e' : '#ef4444' }}>
                        {deployStatus.frontendBuilt ? '已构建' : '未构建'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-t3 mb-1">最近构建时间</div>
                      <div className="text-sm font-medium text-t1">
                        {deployStatus.buildTime ? new Date(deployStatus.buildTime).toLocaleString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-t3 mb-1">App 安装包</div>
                      <div className="text-sm font-medium text-t1">
                        {deployStatus.appCount} 个 · {formatFileSize(deployStatus.totalAppSize || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 上传进度条 */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-4">
                  <div className="text-xs text-t3 mb-1">上传进度：{uploadProgress}%</div>
                  <div className="h-2 bg-glass rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                {/* 代码包上传 */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#38bdf815' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-t1">上传代码包</div>
                      <div className="text-xs text-t3">上传 .zip 自动解压</div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-t2 block mb-1">解压目录</label>
                    <select
                      value={deployTarget}
                      onChange={e => setDeployTarget(e.target.value)}
                      className="w-full h-9 glass rounded-lg px-3 text-sm text-t1 outline-none"
                    >
                      <option value="backend">backend（后端）</option>
                      <option value="frontend">frontend（前端）</option>
                      <option value="root">root（整个项目）</option>
                    </select>
                  </div>
                  <label className="block w-full h-10 bg-accent rounded-lg text-sm font-medium text-center leading-10 cursor-pointer hover:opacity-90 transition-opacity" style={{ color: '#fff' }}>
                    选择 .zip 文件上传
                    <input type="file" accept=".zip" onChange={handleCodeUpload} className="hidden" />
                  </label>

                  {/* 自动化选项 */}
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoBuild}
                        onChange={e => setAutoBuild(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-t2">
                        上传前端代码后<strong>自动构建</strong>
                        <span className="text-t3">（推荐）</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRestart}
                        onChange={e => setAutoRestart(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-t2">
                        构建/上传后<strong>自动重启系统</strong>
                        <span className="text-t3">（谨慎）</span>
                      </span>
                    </label>
                  </div>

                  <p className="text-xs text-t3 mt-2">
                    保留 <code className="px-1 bg-glass-m rounded">.git</code>、<code className="px-1 bg-glass-m rounded">node_modules</code>、<code className="px-1 bg-glass-m rounded">.env</code>、<code className="px-1 bg-glass-m rounded">uploads</code>
                  </p>
                </div>

                {/* 构建前端 */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#a78bfa15' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-t1">构建前端</div>
                      <div className="text-xs text-t3">npm run build → public</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBuild}
                      disabled={building}
                      className="flex-1 h-10 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                      style={{ background: '#a78bfa', color: '#fff' }}
                    >
                      {building ? '构建中...' : '开始构建'}
                    </button>
                    {building && (
                      <button
                        onClick={handleCancelBuild}
                        className="px-4 h-10 rounded-lg text-sm font-medium transition-opacity"
                        style={{ background: '#ef4444', color: '#fff' }}
                      >
                        取消
                      </button>
                    )}
                  </div>

                  {/* 构建进度条 */}
                  {building && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-t3">进度</span>
                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>{buildProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${buildProgress}%`,
                            background: 'linear-gradient(90deg, #a78bfa, #c4b5fd)',
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-t3 mt-2">
                    上传前端代码包后，点击此处执行 <code className="px-1 bg-glass-m rounded">npm run build</code>，
                    产物会自动输出到 <code className="px-1 bg-glass-m rounded">backend/public</code>
                  </p>
                </div>

                {/* App 安装包上传 */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#22c55e15' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-t1">上传 App 安装包</div>
                      <div className="text-xs text-t3">.apk / .ipa / .zip</div>
                    </div>
                  </div>
                  <label className="block w-full h-10 bg-accent rounded-lg text-sm font-medium text-center leading-10 cursor-pointer hover:opacity-90 transition-opacity" style={{ color: '#fff' }}>
                    选择 App 文件上传
                    <input type="file" accept=".apk,.ipa,.zip" onChange={handleAppUpload} className="hidden" />
                  </label>
                  <p className="text-xs text-t3 mt-2">
                    下载地址：<code className="px-1 bg-glass-m rounded">/uploads/apps/&lt;filename&gt;</code>，大小限制 1GB
                  </p>
                </div>
              </div>

              {/* 构建日志 */}
              {(building || buildLogs.length > 0) && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-t1">
                      构建日志
                      {building && (
                        <span className="ml-2 text-xs text-t3">
                          <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse mr-1"></span>
                          构建中...
                        </span>
                      )}
                    </h3>
                    <button onClick={() => setBuildLogs([])} className="text-xs text-t3 hover:text-t1">清空</button>
                  </div>
                  <div
                    className="glass rounded-xl p-3 h-64 overflow-y-auto font-mono text-xs"
                    ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                  >
                    {buildLogs.length === 0 ? (
                      <p className="text-t3 text-center mt-8">
                        {building ? '等待构建日志输出...' : '暂无日志'}
                      </p>
                    ) : (
                      buildLogs.map((log, i) => (
                        <pre key={i} className="text-t2 whitespace-pre-wrap break-all">{log}</pre>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 重启系统 */}
              <div className="glass rounded-xl p-5 mt-4 border border-red/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#ef444415' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-t1">重启系统</div>
                      <div className="text-xs text-t3">构建/上传后点击此处使更改生效</div>
                    </div>
                  </div>
                  <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="px-4 h-9 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                    style={{ background: '#ef4444', color: '#fff' }}
                  >
                    {restarting ? '重启中...' : '重启系统'}
                  </button>
                </div>
              </div>

              {/* App 安装包列表 */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-t1">App 安装包列表 ({apps.length})</h3>
                  <button onClick={loadApps} className="text-xs text-accent hover:underline">刷新</button>
                </div>
                {apps.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-t3 mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p className="text-t3 text-sm">暂无 App 安装包</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apps.map(app => (
                      <div key={app.filename} className="glass rounded-xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: app.platform === 'ios' ? '#a78bfa15' : app.platform === 'android' ? '#22c55e15' : '#8896ab15' }}>
                          <span className="text-xs font-bold" style={{ color: app.platform === 'ios' ? '#a78bfa' : app.platform === 'android' ? '#22c55e' : '#8896ab' }}>
                            {app.platform === 'ios' ? 'iOS' : app.platform === 'android' ? 'APK' : 'ZIP'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-t1 truncate">{app.filename}</div>
                          <div className="text-xs text-t3">{formatFileSize(app.size)} · {new Date(app.uploadedAt).toLocaleString()}</div>
                        </div>
                        <a
                          href={app.url}
                          className="text-xs text-accent hover:underline px-2 py-1 rounded bg-accent/10"
                          download
                        >
                          下载
                        </a>
                        <button
                          onClick={() => handleDeleteApp(app.filename)}
                          className="text-xs text-red hover:underline px-2 py-1 rounded bg-red/10"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 部署说明 */}
              <div className="mt-6 glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  <h3 className="text-sm font-semibold text-t1">部署说明</h3>
                </div>

                <div className="space-y-4 text-sm">
                  {/* 方式一 */}
                  <div className="rounded-lg p-3" style={{ background: 'rgba(56, 189, 248, 0.08)' }}>
                    <div className="font-medium text-t1 mb-2">📦 方式一：本地构建后上传 backend（推荐）</div>
                    <ol className="text-xs text-t2 space-y-1 list-decimal list-inside">
                      <li>本地执行 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">cd frontend &amp;&amp; npm run build</code>，产物输出到 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">backend/public/</code></li>
                      <li>打包 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">backend/</code> 文件夹为 zip</li>
                      <li>上传目标选 <b>backend</b>，<b>关闭</b>自动构建，<b>开启</b>自动重启</li>
                      <li>若 package.json 有新依赖，服务器终端执行 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">npm install</code></li>
                    </ol>
                    <div className="mt-2 text-xs text-t3">
                      <b>包含：</b>src/、public/（构建产物）、package.json、views/、seed-changelogs.mjs 等
                      <br />
                      <b>排除：</b>node_modules/、uploads/、pulse.db、.env
                    </div>
                  </div>

                  {/* 方式二 */}
                  <div className="rounded-lg p-3" style={{ background: 'rgba(167, 139, 250, 0.08)' }}>
                    <div className="font-medium text-t1 mb-2">🖥️ 方式二：上传 frontend 源码，服务器构建</div>
                    <ol className="text-xs text-t2 space-y-1 list-decimal list-inside">
                      <li>打包 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">frontend/</code> 源码为 zip（src/、package.json、vite.config.js）</li>
                      <li>上传目标选 <b>frontend</b>，<b>开启</b>自动构建（会自动 build 到 backend/public/）</li>
                      <li>构建日志实时显示，完成后自动重启（如开启）</li>
                    </ol>
                    <div className="mt-2 text-xs text-t3">
                      <b>排除：</b>node_modules/、dist/
                    </div>
                  </div>

                  {/* 注意事项 */}
                  <div>
                    <div className="font-medium text-t1 mb-2">⚠️ 注意事项</div>
                    <ul className="text-xs text-t2 space-y-1.5">
                      <li>• <b>上传 backend 时务必关闭自动构建</b>，否则服务器找不到 frontend 源码会构建失败</li>
                      <li>• <b>backend/public/ 必须有构建产物</b>，否则页面空白</li>
                      <li>• <b>上传 backend 后必须重启</b>，后端代码改动才会生效</li>
                      <li>• 新增依赖后需在服务器 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">npm install</code>，否则报 Cannot find module</li>
                      <li>• 上传时 <code className="px-1.5 py-0.5 rounded bg-glass-m text-t1">uploads/</code> 目录会被保留（头像、文件、录音不会丢失）</li>
                    </ul>
                  </div>

                  {/* 常见问题 */}
                  <div>
                    <div className="font-medium text-t1 mb-2">🔧 常见问题</div>
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-t1">Q：上传后页面空白？</span>
                        <span className="text-t3 ml-1">→ zip 里没包含 public/ 构建产物，本地先 build 再打包</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-t1">Q：上传后 502 Bad Gateway？</span>
                        <span className="text-t3 ml-1">→ 后端没起来，开启自动重启或手动 pm2 restart pulse</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-t1">Q：构建失败？</span>
                        <span className="text-t3 ml-1">→ 查看下方构建日志，或确认上传的是 frontend 源码而非 backend</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
