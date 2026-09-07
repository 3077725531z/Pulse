import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { v4 as uuid } from 'uuid';
import db from '../config/db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

// ========== 邮件配置 ==========
// QQ邮箱 SMTP 配置 — 需要你在QQ邮箱设置中开启SMTP并获取授权码
const EMAIL_CONFIG = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL || 'yuliuyuefuxiafeng@foxmail.com',   // 你的QQ邮箱
    pass: process.env.SMTP_PASS || 'qvkplnipfsvjdhai',     // QQ邮箱授权码（不是QQ密码）
  }
};

let transporter = null;
function getTransporter() {
  if (!transporter && EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass) {
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
}

// 生成唯一的8位pulse_id
function generatePulseId() {
  const chars = '0123456789';
  let pulseId;
  let existing;
  do {
    pulseId = '';
    for (let i = 0; i < 8; i++) {
      pulseId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    existing = db.prepare('SELECT id FROM users WHERE pulse_id = ?').get(pulseId);
  } while (existing);
  return pulseId;
}

// 清理过期验证码
function cleanExpiredCodes() {
  db.prepare("DELETE FROM verification_codes WHERE expires_at < datetime('now')").run();
}

// ========== 用户名实时查重 ==========
router.get('/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ available: false, error: '请输入用户名' });
  if (username.length < 3) return res.json({ available: false, error: '用户名至少3个字符' });
  if (username.length > 20) return res.json({ available: false, error: '用户名最多20个字符' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.json({ available: false, error: '用户名只能包含字母、数字和下划线' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.json({ available: false, error: '用户名已被占用' });
  res.json({ available: true });
});

// ========== 发送邮箱验证码 ==========
router.post('/send-code', async (req, res) => {
  try {
    const { email, captchaToken } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱地址' });

    // 验证滑块验证码token
    if (!captchaToken) return res.status(400).json({ error: '请先完成滑块验证' });
    const captchaRow = db.prepare("SELECT id FROM verification_codes WHERE id = ? AND expires_at > datetime('now')")
      .get(`captcha_verified_${captchaToken}`);
    if (!captchaRow) {
      return res.status(400).json({ error: '滑块验证已过期，请重新验证' });
    }
    // 验证通过后删除token，防止重复使用
    db.prepare("DELETE FROM verification_codes WHERE id = ?").run(captchaRow.id);

    // 验证QQ邮箱格式
    if (!/^[a-zA-Z0-9._%+-]+@qq\.com$/.test(email)) {
      return res.status(400).json({ error: '请输入QQ邮箱地址' });
    }

    // 检查邮箱是否已注册
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: '该邮箱已注册' });

    const transport = getTransporter();
    if (!transport) {
      return res.status(500).json({ error: '邮件服务未配置，请联系管理员在后端配置SMTP_EMAIL和SMTP_PASS环境变量' });
    }

    // 限制发送频率：60秒内只能发一次
    const recent = db.prepare("SELECT id FROM verification_codes WHERE email = ? AND created_at > datetime('now', '-1 minute')").get(email);
    if (recent) return res.status(429).json({ error: '发送太频繁，请60秒后再试' });

    // 清理旧验证码
    cleanExpiredCodes();

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 存入数据库，5分钟有效
    db.prepare("INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, datetime('now', '+5 minutes'))")
      .run(uuid(), email, code);

    // 发送邮件
    await transport.sendMail({
      from: `"Pulse Chat" <${EMAIL_CONFIG.auth.user}>`,
      to: email,
      subject: 'Pulse 注册验证码',
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <h2 style="color:#2d3748;margin-bottom:16px;">Pulse 注册验证码</h2>
          <p style="color:#4a5568;font-size:14px;">你好，你正在注册 Pulse 账号，验证码为：</p>
          <div style="background:#fff;padding:16px;text-align:center;border-radius:8px;margin:16px 0;border:1px solid #e2e8f0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#6c9ce9;">${code}</span>
          </div>
          <p style="color:#718096;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#a0aec0;font-size:11px;margin-top:16px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `
    });

    res.json({ success: true, message: '验证码已发送到你的QQ邮箱' });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: '发送验证码失败: ' + err.message });
  }
});

// ========== 生成数学题验证码 ==========
router.get('/captcha', (req, res) => {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
      break;
    case '×':
      a = Math.floor(Math.random() * 12) + 1;
      b = Math.floor(Math.random() * 12) + 1;
      answer = a * b;
      break;
  }

  const question = `${a} ${op} ${b}`;
  const token = crypto.randomBytes(16).toString('hex');

  db.prepare("INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, datetime('now', '+5 minutes'))")
    .run(`captcha_${token}`, '_captcha_', String(answer));

  res.json({ token, question });
});

// ========== 验证数学题答案 ==========
router.post('/verify-captcha', (req, res) => {
  const { token, answer } = req.body;
  if (!token || answer === undefined) return res.status(400).json({ error: '参数缺失' });

  const row = db.prepare("SELECT id, code FROM verification_codes WHERE id = ? AND expires_at > datetime('now')")
    .get(`captcha_${token}`);
  if (!row) return res.status(400).json({ success: false, error: '验证码已过期，请刷新' });

  if (String(answer) === String(row.code)) {
    db.prepare("DELETE FROM verification_codes WHERE id = ?").run(row.id);
    const verifiedToken = crypto.randomBytes(16).toString('hex');
    db.prepare("INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))")
      .run(`captcha_verified_${verifiedToken}`, '_verified_', '1');
    return res.json({ success: true, verifiedToken });
  }
  res.json({ success: false, error: '答案错误，请重试' });
});

// ========== 注册 ==========
router.post('/register', (req, res) => {
  const { username, password, nickname, email, emailCode } = req.body;

  if (!username || !password || !nickname) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  // 密码强度验证
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6个字符' });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: '密码必须包含字母和数字' });
  }

  // 用户名格式验证
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: '用户名只能包含字母、数字和下划线' });
  }

  // 用户名查重
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: '用户名已存在' });

  // 邮箱验证码验证
  if (email && emailCode) {
    cleanExpiredCodes();
    const codeRow = db.prepare("SELECT id FROM verification_codes WHERE email = ? AND code = ? AND expires_at > datetime('now')")
      .get(email, emailCode);
    if (!codeRow) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
    // 删除已使用的验证码
    db.prepare("DELETE FROM verification_codes WHERE id = ?").run(codeRow.id);
  }

  const id = uuid();
  const pulseId = generatePulseId();
  const hashed = bcrypt.hashSync(password, 10);

  // 第一个注册的用户自动成为管理员
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const isAdmin = userCount === 0 ? 1 : 0;

  db.prepare('INSERT INTO users (id, pulse_id, username, password, nickname, email, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, pulseId, username, hashed, nickname, email || '', isAdmin);

  const token = generateToken(id);
  res.json({
    token,
    user: { id, pulseId, username, nickname, avatar: '', signature: '', theme: 'dark', isAdmin: !!isAdmin }
  });
});

// ========== 登录 ==========
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: { id: user.id, pulseId: user.pulse_id, username: user.username, nickname: user.nickname, avatar: user.avatar, signature: user.signature, theme: user.theme, isAdmin: !!user.is_admin }
  });
});

export default router;