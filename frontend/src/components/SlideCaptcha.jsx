import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';

/**
 * MathCaptcha 数字计算验证码组件
 * @param {Function} onSuccess - 验证成功回调，参数为 verifiedToken
 * @param {Function} onFail - 验证失败回调
 * @param {Function} onClose - 弹窗关闭回调
 * @param {boolean} open - 外部控制弹窗开关（可选，不传则使用内部按钮触发）
 * @param {boolean} verified - 是否已验证通过（控制按钮显示状态）
 */
export default function SlideCaptcha({ onSuccess, onFail, onClose, open: openProp, verified }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | fail
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const isExternal = openProp !== undefined;
  const isOpen = isExternal ? openProp : internalOpen;

  const primary = '#6c9ce9';
  const primaryLight = '#a5c4f7';
  const textMain = '#2d3748';
  const textSub = '#8896ab';
  const green = '#48bb78';
  const red = '#e53e3e';

  const fetchCaptcha = useCallback(async () => {
    setLoading(true);
    setStatus('idle');
    setAnswer('');
    try {
      const { data } = await api.get('/auth/captcha');
      setCaptcha(data);
    } catch (e) {
      console.error('Fetch captcha failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isExternal) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [isExternal, onClose]);

  const handleOpen = () => {
    if (verified) return;
    setInternalOpen(true);
    fetchCaptcha();
  };

  useEffect(() => {
    if (isOpen) {
      fetchCaptcha();
    }
  }, [isOpen]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, handleClose]);

  // 打开后自动聚焦输入框
  useEffect(() => {
    if (isOpen && captcha && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, captcha, loading]);

  const handleSubmit = async () => {
    if (!captcha || !answer.trim()) return;
    try {
      const { data } = await api.post('/auth/verify-captcha', {
        token: captcha.token,
        answer: answer.trim(),
      });
      if (data.success) {
        setStatus('success');
        onSuccess?.(data.verifiedToken);
        setTimeout(() => handleClose(), 500);
      } else {
        setStatus('fail');
        setShake(true);
        onFail?.();
        setTimeout(() => {
          setShake(false);
          fetchCaptcha();
          setAnswer('');
        }, 800);
      }
    } catch {
      setStatus('fail');
      setShake(true);
      onFail?.();
      setTimeout(() => {
        setShake(false);
        fetchCaptcha();
        setAnswer('');
      }, 800);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const popupContent = (
    <div
      style={{
        width: 300,
        padding: '20px 20px 16px',
        textAlign: 'center',
      }}
    >
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: textMain }}>
        安全验证
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: textSub }}>
        请完成下方计算题
      </p>

      {loading ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 24, height: 24, border: '3px solid #e2e8f0',
              borderTopColor: primary, borderRadius: '50%',
              animation: 'captchaSpin 0.8s linear infinite',
            }}
          />
        </div>
      ) : captcha ? (
        <>
          {/* 计算题 */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0f4f8, #e8ecf4)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, color: textMain, letterSpacing: 2 }}>
              {captcha.question}
            </span>
            <span style={{ fontSize: 20, color: textSub }}>=</span>
            <span style={{ fontSize: 24, color: primary, fontWeight: 700 }}>?</span>
          </div>

          {/* 输入框 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              ref={inputRef}
              type="number"
              value={answer}
              onChange={(e) => { setAnswer(e.target.value); setStatus('idle'); }}
              onKeyDown={handleKeyDown}
              placeholder="输入答案"
              disabled={status === 'success'}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                border: `1.5px solid ${status === 'fail' ? red : status === 'success' ? green : '#e2e8f0'}`,
                background: '#f8fafc',
                padding: '0 14px',
                fontSize: 15,
                color: textMain,
                outline: 'none',
                transition: 'border-color 0.2s',
                textAlign: 'center',
                letterSpacing: 4,
                animation: shake ? 'captchaShake 0.4s ease' : 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'success' || !answer.trim()}
              style={{
                width: 72,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: status === 'success' ? green : `linear-gradient(135deg, ${primary}, ${primaryLight})`,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: status === 'success' || !answer.trim() ? 'default' : 'pointer',
                opacity: !answer.trim() && status !== 'success' ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {status === 'success' ? '✓' : '确定'}
            </button>
          </div>

          {/* 刷新按钮 */}
          {status !== 'success' && (
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { fetchCaptcha(); setAnswer(''); setStatus('idle'); }}
                style={{
                  background: 'none', border: 'none', color: primary,
                  fontSize: 12, cursor: 'pointer', padding: '2px 4px',
                }}
              >
                换一题
              </button>
            </div>
          )}

          {/* 状态提示 */}
          {status === 'fail' && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: red }}>
              答案错误，请重试
            </p>
          )}
          {status === 'success' && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: green }}>
              验证通过
            </p>
          )}
        </>
      ) : null}

      <style>{`
        @keyframes captchaShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes captchaSpin {
          to { transform: rotate(360deg); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* 触发按钮（内部模式） */}
      {!isExternal && (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full h-11 rounded-xl flex items-center gap-3 px-4 text-sm transition-all duration-200"
          style={{
            background: verified ? 'rgba(72,187,120,0.08)' : '#f2f5f9',
            border: `1px solid ${verified ? 'rgba(72,187,120,0.3)' : '#e2e8f0'}`,
            color: verified ? green : textSub,
            cursor: verified ? 'default' : 'pointer',
          }}
        >
          <div
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
            style={{
              border: `2px solid ${verified ? green : '#c4cdd8'}`,
              background: verified ? green : 'transparent',
              transition: 'all 0.3s',
            }}
          >
            {verified && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )}
          </div>
          <span>{verified ? '验证通过' : '点击完成安全验证'}</span>
        </button>
      )}

      {/* 弹窗 */}
      {isOpen && !verified && (
        <>
          {/* 外部模式：居中遮罩弹窗 */}
          {isExternal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                zIndex: 99,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                ref={containerRef}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  animation: 'captchaPop 0.2s ease-out',
                  position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 关闭按钮 */}
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    position: 'absolute', top: 10, right: 12,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#a0aec0', fontSize: 18, lineHeight: 1, padding: 4,
                  }}
                >
                  ×
                </button>
                {popupContent}
              </div>
            </div>
          )}

          {/* 内部模式：下拉弹窗 */}
          {!isExternal && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid #e2e8f0',
                zIndex: 100,
                animation: 'captchaPop 0.2s ease-out',
              }}
            >
              {popupContent}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes captchaPop {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
