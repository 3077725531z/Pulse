import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import SlideCaptcha from '../components/SlideCaptcha';

// 每次应用启动只播放一次加载动画
let splashShown = false;

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(splashShown);
  const [fadeOut, setFadeOut] = useState(splashShown);

  // 用户名查重
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [usernameMsg, setUsernameMsg] = useState('');
  const usernameTimer = useRef(null);

  // 密码强度
  const [pwdStrength, setPwdStrength] = useState(0); // 0-3
  const [pwdStrengthText, setPwdStrengthText] = useState('');

  // 确认密码
  const [confirmPwdMsg, setConfirmPwdMsg] = useState('');

  // 邮箱验证码
  const [codeSending, setCodeSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  // 滑块验证（用于发送验证码流程）
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const { login, register } = useAuthStore();

  // 加载动画
  if (!splashShown) {
    splashShown = true;
    setTimeout(() => setFadeOut(true), 1200);
    setTimeout(() => setPageReady(true), 1800);
  }

  // 邮箱验证码倒计时
  useEffect(() => {
    if (codeCountdown <= 0) return;
    const t = setInterval(() => setCodeCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [codeCountdown]);

  // 切换到注册时重置
  useEffect(() => {
    if (isRegister) {
      setCaptchaOpen(false);
    }
  }, [isRegister]);

  // 用户名实时查重
  const checkUsername = useCallback(async (val) => {
    if (!isRegister || val.length < 3) { setUsernameStatus(null); setUsernameMsg(''); return; }
    setUsernameStatus('checking');
    try {
      const { data } = await api.get(`/auth/check-username?username=${val}`);
      if (data.available) {
        setUsernameStatus('available');
        setUsernameMsg('用户名可用');
      } else {
        setUsernameStatus('taken');
        setUsernameMsg(data.error || '用户名不可用');
      }
    } catch {
      setUsernameStatus(null);
    }
  }, [isRegister]);

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    clearTimeout(usernameTimer.current);
    if (val.length >= 3) {
      usernameTimer.current = setTimeout(() => checkUsername(val), 500);
    } else {
      setUsernameStatus(null);
      setUsernameMsg('');
    }
  };

  // 密码强度计算
  const calcPwdStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 10) score++;
    setPwdStrength(score);
    if (!pwd) { setPwdStrengthText(''); return; }
    if (score === 0) setPwdStrengthText('弱');
    else if (score === 1) setPwdStrengthText('弱');
    else if (score === 2) setPwdStrengthText('中');
    else setPwdStrengthText('强');
  };

  const handlePwdChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (isRegister) calcPwdStrength(val);
    if (confirmPassword) {
      setConfirmPwdMsg(val === confirmPassword ? '' : '两次密码不一致');
    }
  };

  const handleConfirmPwdChange = (e) => {
    const val = e.target.value;
    setConfirmPassword(val);
    setConfirmPwdMsg(val === password ? '' : '两次密码不一致');
  };

  // 点击获取验证码 → 弹出滑块验证
  const handleSendCode = () => {
    if (!email) { setError('请输入QQ邮箱'); return; }
    setCaptchaOpen(true);
  };

  // 滑块验证通过 → 发送邮箱验证码
  const handleCaptchaSuccessForCode = async (token) => {
    setCaptchaOpen(false);
    setCodeSending(true);
    setError('');
    try {
      await api.post('/auth/send-code', { email, captchaToken: token });
      setCodeSent(true);
      setCodeCountdown(60);
    } catch (err) {
      setError(err.response?.data?.error || '发送失败');
    } finally {
      setCodeSending(false);
    }
  };

  // 表单提交
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (password !== confirmPassword) { setError('两次密码不一致'); return; }
      if (password.length < 6) { setError('密码至少6个字符'); return; }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setError('密码必须包含字母和数字'); return; }
      if (usernameStatus === 'taken') { setError('用户名已被占用'); return; }
      if (!codeSent) { setError('请先获取邮箱验证码'); return; }
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register({
          username, password, nickname: nickname || username,
          email, emailCode,
        });
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setConfirmPassword('');
    setEmailCode('');
    setCodeSent(false);
    setCodeCountdown(0);
    setUsernameStatus(null);
    setUsernameMsg('');
    setPwdStrength(0);
    setPwdStrengthText('');
    setConfirmPwdMsg('');
    setCaptchaOpen(false);
  };

  // 配色
  const primary = '#6c9ce9';
  const primaryLight = '#a5c4f7';
  const bgStart = '#f0f4f8';
  const bgEnd = '#e8ecf4';
  const cardBg = 'rgba(255,255,255,0.85)';
  const inputBg = '#f2f5f9';
  const textMain = '#2d3748';
  const textSub = '#8896ab';
  const textLight = '#b0bac9';
  const green = '#48bb78';
  const red = '#e53e3e';
  const orange = '#ed8936';

  const inputStyle = (focusColor = primary) => ({
    background: inputBg,
    color: textMain,
    border: '1px solid transparent',
  });

  const inputOnFocus = (e, color = primary) => { e.target.style.borderColor = color; };
  const inputOnBlur = (e) => { e.target.style.borderColor = 'transparent'; };

  // 密码强度条颜色
  const strengthColors = ['', red, orange, green];

  // 加载动画
  if (!pageReady) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: `linear-gradient(145deg, ${bgStart}, ${bgEnd})`, animation: fadeOut ? 'loaderFadeOut 0.5s ease forwards' : undefined }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[30%] left-[35%] w-[40%] h-[40%] rounded-full" style={{ background: `radial-gradient(circle, rgba(108,156,233,0.15) 0%, transparent 70%)`, animation: 'loaderPulse 2s ease-in-out infinite' }} />
        </div>
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primaryLight})`, animation: 'logoPulse 1.5s ease-in-out infinite', boxShadow: `0 8px 32px rgba(108,156,233,0.3)` }}>
            <div className="w-6 h-6 rounded-full" style={{ background: '#fff' }} />
            <div className="w-3 h-3 rounded-full absolute z-10" style={{ background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)' }} />
          </div>
          <svg className="absolute -inset-3" viewBox="0 0 100 100" style={{ animation: 'spinnerRotate 1.2s linear infinite' }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke={bgEnd} strokeWidth="2" />
            <circle cx="50" cy="50" r="46" fill="none" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="80 210" style={{ filter: `drop-shadow(0 0 4px rgba(108,156,233,0.5))` }} />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Pulse</h1>
        <p className="text-sm" style={{ color: textSub }}>正在加载...</p>
      </div>
    );
  }

  // 密码强度条
  const StrengthBar = () => (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: pwdStrength >= i ? strengthColors[pwdStrength] : '#e2e8f0', transition: 'background 0.3s' }} />
        ))}
      </div>
      {pwdStrengthText && (
        <span className="text-xs" style={{ color: strengthColors[pwdStrength] }}>{pwdStrengthText}</span>
      )}
    </div>
  );

  return (
    <div className="h-full relative overflow-hidden" style={{ background: `linear-gradient(145deg, ${bgStart}, ${bgEnd})` }}>
      {/* 背景装饰光晕 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full opacity-40" style={{ background: `radial-gradient(circle, rgba(108,156,233,0.2) 0%, transparent 70%)`, animation: 'pulseFloat1 8s ease-in-out infinite' }} />
        <div className="absolute -bottom-[20%] -right-[15%] w-[60%] h-[60%] rounded-full opacity-30" style={{ background: `radial-gradient(circle, rgba(247,160,114,0.18) 0%, transparent 70%)`, animation: 'pulseFloat2 10s ease-in-out infinite' }} />
        <div className="absolute top-[50%] left-[55%] w-[25%] h-[25%] rounded-full opacity-20" style={{ background: `radial-gradient(circle, rgba(165,196,247,0.2) 0%, transparent 70%)`, animation: 'pulseFloat3 12s ease-in-out infinite' }} />
      </div>

      {/* 主内容 */}
      <div className="relative h-full flex flex-col items-center justify-center px-6" style={{ overflowY: 'auto' }}>
        {/* Logo */}
        <div className="mb-6 text-center" style={{ animation: 'enterDown 0.6s ease-out' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${primary}, ${primaryLight})`, boxShadow: `0 8px 32px rgba(108,156,233,0.25)` }}>
            <div className="w-5 h-5 rounded-full" style={{ background: '#fff' }} />
            <div className="w-2.5 h-2.5 rounded-full absolute z-10" style={{ background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: textMain }}>Pulse</h1>
          <p className="text-sm mt-1" style={{ color: textSub }}>让对话有温度</p>
        </div>

        {/* 表单卡片 */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: cardBg,
            border: '1px solid rgba(255,255,255,0.6)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            animation: 'enterUp 0.5s ease-out 0.15s both',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, rgba(108,156,233,0.25), transparent)` }} />

          <div className="mb-4">
            <h2 className="text-lg font-bold" style={{ color: textMain }}>
              {isRegister ? '创建账号' : '欢迎回来'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: textSub }}>
              {isRegister ? '填写以下信息注册' : '登录以继续使用 Pulse'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* 登录模式：用户名+密码 */}
            {!isRegister && (
              <>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <input type="text" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)}
                    className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                    style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} required />
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                    style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} required />
                </div>
              </>
            )}

            {/* 注册模式 */}
            {isRegister && (
              <>
                {/* 昵称 */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </div>
                  <input type="text" placeholder="昵称" value={nickname} onChange={e => setNickname(e.target.value)}
                    className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                    style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} />
                </div>

                {/* 用户名 + 查重 */}
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input type="text" placeholder="用户名（3-20位字母数字下划线）" value={username} onChange={handleUsernameChange}
                      className="w-full h-12 rounded-xl pl-12 pr-10 text-sm outline-none transition-all duration-200"
                      style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} required />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#e2e8f0', borderTopColor: primary }} />}
                      {usernameStatus === 'available' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      {usernameStatus === 'taken' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                    </div>
                  </div>
                  {usernameMsg && <p className="text-xs mt-1 ml-1" style={{ color: usernameStatus === 'available' ? green : red }}>{usernameMsg}</p>}
                </div>

                {/* 邮箱 */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>
                  </div>
                  <input type="email" placeholder="QQ邮箱（用于找回账号）" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                    style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} />
                </div>

                {/* 邮箱验证码 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <input type="text" placeholder="邮箱验证码" value={emailCode} onChange={e => setEmailCode(e.target.value)}
                      className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                      style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} />
                  </div>
                  <div className="relative">
                    <button type="button" onClick={handleSendCode} disabled={codeCountdown > 0 || codeSending}
                      className="h-12 px-4 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200"
                      style={{
                        background: codeCountdown > 0 ? '#e2e8f0' : inputBg,
                        color: codeCountdown > 0 ? textSub : primary,
                        border: `1px solid ${codeCountdown > 0 ? '#e2e8f0' : 'transparent'}`,
                        cursor: codeCountdown > 0 || codeSending ? 'not-allowed' : 'pointer',
                        minWidth: '100px',
                      }}>
                      {codeCountdown > 0 ? `${codeCountdown}s` : codeSending ? '发送中...' : '获取验证码'}
                    </button>
                    {/* 滑块验证码弹窗（点击获取验证码时触发） */}
                    <SlideCaptcha
                      open={captchaOpen}
                      onClose={() => setCaptchaOpen(false)}
                      onSuccess={handleCaptchaSuccessForCode}
                      onFail={() => {}}
                    />
                  </div>
                </div>

                {/* 密码 + 强度条 */}
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <input type="password" placeholder="密码（至少6位，包含字母和数字）" value={password} onChange={handlePwdChange}
                      className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                      style={inputStyle()} onFocus={e => inputOnFocus(e)} onBlur={inputOnBlur} required />
                  </div>
                  <StrengthBar />
                </div>

                {/* 确认密码 */}
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textLight }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <input type="password" placeholder="确认密码" value={confirmPassword} onChange={handleConfirmPwdChange}
                      className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none transition-all duration-200"
                      style={inputStyle(confirmPwdMsg && confirmPassword ? red : primary)}
                      onFocus={e => inputOnFocus(e, confirmPwdMsg && confirmPassword ? red : primary)}
                      onBlur={inputOnBlur} required />
                  </div>
                  {confirmPwdMsg && confirmPassword && <p className="text-xs mt-1 ml-1" style={{ color: red }}>{confirmPwdMsg}</p>}
                </div>

                {/* 滑块验证 - 已移至获取验证码流程中 */}
              </>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.06)', color: red, border: '1px solid rgba(239,68,68,0.12)', animation: 'shake 0.4s ease' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${primaryLight})`,
                color: '#fff',
                boxShadow: `0 4px 16px rgba(108,156,233,0.25)`,
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff', animation: 'dotBounce 0.6s ease-in-out infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff', animation: 'dotBounce 0.6s ease-in-out 0.15s infinite' }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fff', animation: 'dotBounce 0.6s ease-in-out 0.3s infinite' }} />
                </div>
              )}
              <span style={{ opacity: loading ? 0 : 1 }}>
                {isRegister ? '注册' : '登录'}
              </span>
            </button>
          </form>

          <div className="mt-4 text-center text-sm" style={{ color: textSub }}>
            {isRegister ? '已有账号？' : '没有账号？'}
            <button type="button" onClick={toggleMode} className="ml-1 font-medium transition-colors duration-200" style={{ color: primary }}>
              {isRegister ? '去登录' : '注册一个'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-xs" style={{ color: textLight, animation: 'enterUp 0.5s ease-out 0.3s both' }}>
          Pulse Chat &copy; 2026 · v0.3.0-beta.3
        </p>
      </div>

      <style>{`
        @keyframes pulseFloat1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -20px); } }
        @keyframes pulseFloat2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20px, 30px); } }
        @keyframes pulseFloat3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-15px, -25px); } }
        @keyframes enterDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes enterUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes dotBounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes loaderPulse { 0%, 100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.1); opacity: 0.35; } }
        @keyframes logoPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes spinnerRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes loaderFadeOut { to { opacity: 0; pointer-events: none; } }
      `}</style>
    </div>
  );
}