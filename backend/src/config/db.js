import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../pulse.db');

let db = null;

export async function initDB() {
  const SQL = await initSqlJs();
  
  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      pulse_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      signature TEXT DEFAULT '',
      theme TEXT DEFAULT 'dark' CHECK(theme IN ('dark', 'light')),
      pulse_id_changed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('private', 'group')),
      name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'voice', 'video', 'file', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS message_status (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read')),
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'blocked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      call_type TEXT NOT NULL CHECK(call_type IN ('voice', 'video')),
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      online_visibility TEXT DEFAULT 'friends' CHECK(online_visibility IN ('all', 'friends', 'none')),
      show_read_receipts INTEGER DEFAULT 1,
      show_typing INTEGER DEFAULT 1,
      show_last_seen INTEGER DEFAULT 1,
      noti_sound INTEGER DEFAULT 1,
      noti_preview INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'read', 'replied')),
      admin_reply TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS _table_meta (
      table_name TEXT PRIMARY KEY,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conv_members ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_friendships ON friendships(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_recordings ON recordings(created_at);
  `);

  // 数据库迁移：添加缺失的列
  try {
    // 检查并添加 pulse_id 列
    const columns = db.exec("PRAGMA table_info(users)");
    const colNames = columns.length > 0 ? columns[0].values.map(row => row[1]) : [];
    
    if (!colNames.includes('pulse_id')) {
      db.exec("ALTER TABLE users ADD COLUMN pulse_id TEXT DEFAULT ''");
      // 为已有用户生成 pulse_id
      const users = db.exec("SELECT id FROM users");
      if (users.length > 0) {
        for (const row of users[0].values) {
          const pid = generatePulseId();
          db.run("UPDATE users SET pulse_id = ? WHERE id = ?", [pid, row[0]]);
        }
      }
      // 创建唯一索引
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pulse_id ON users(pulse_id)");
    }
    
    if (!colNames.includes('theme')) {
      db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'");
    }
    
    if (!colNames.includes('pulse_id_changed_at')) {
      db.exec("ALTER TABLE users ADD COLUMN pulse_id_changed_at DATETIME DEFAULT NULL");
    }
    
    if (!colNames.includes('email')) {
      db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
    }

    if (!colNames.includes('is_admin')) {
      db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
      // 把第一个注册的用户设为管理员
      const firstUser = db.exec("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
      if (firstUser.length > 0 && firstUser[0].values.length > 0) {
        db.run("UPDATE users SET is_admin = 1 WHERE id = ?", [firstUser[0].values[0][0]]);
      }
    }
  } catch (err) {
    console.log('Migration error (may be ok for new DB):', err.message);
  }

  // 创建默认管理员账号（如果不存在）
  try {
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminUser) {
      const id = uuid();
      const pulseId = '10000001';
      const hashed = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO users (id, pulse_id, username, password, nickname, is_admin) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, pulseId, 'admin', hashed, '管理员', 1);
      console.log('Default admin account created: admin / admin123');
    } else {
      // 确保 admin 账号有管理员权限
      db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('admin');
    }
  } catch (err) {
    console.log('Admin account setup:', err.message);
  }

  // 初始化表描述（仅插入不存在的）
  try {
    const defaultDescs = {
      users: '用户账号表：存储注册用户信息（用户名、密码、昵称、头像、主题等）',
      conversations: '会话表：存储私聊和群聊会话',
      conversation_members: '会话成员表：记录会话中的用户及角色（群主/管理员/成员）',
      messages: '消息表：存储所有聊天消息（文字、图片、语音、视频、文件、系统消息）',
      message_status: '消息状态表：追踪每条消息的投递/已读状态',
      friendships: '好友关系表：存储好友请求和状态（待确认/已接受/已拒绝/已屏蔽）',
      recordings: '通话录制表：存储音视频通话的录制文件信息',
      announcements: '公告表：存储系统公告',
      user_settings: '用户设置表：存储用户隐私和通知偏好',
      feedback: '反馈表：用户反馈及管理员回复',
    };
    for (const [name, desc] of Object.entries(defaultDescs)) {
      const existing = db.prepare('SELECT 1 FROM _table_meta WHERE table_name = ?').get(name);
      if (!existing) {
        db.prepare('INSERT INTO _table_meta (table_name, description) VALUES (?, ?)').run(name, desc);
      }
    }
  } catch (err) {
    console.log('Table meta setup:', err.message);
  }

  saveDB();
  console.log('Database initialized');
}

// 数据库迁移用的 pulse_id 生成函数（带唯一性检查）
function generatePulseId() {
  const chars = '0123456789';
  let pulseId;
  let existing;

  do {
    pulseId = '';
    for (let i = 0; i < 8; i++) {
      pulseId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const result = db.exec("SELECT id FROM users WHERE pulse_id = '" + pulseId + "'");
    existing = result.length > 0 && result[0].values.length > 0;
  } while (existing);

  return pulseId;
}

export function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 模拟 better-sqlite3 的 prepare API
class Statement {
  constructor(sql, dbInstance) {
    this.sql = sql;
    this.db = dbInstance;
  }

  get(...params) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initDB() first.');
    }
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  all(...params) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initDB() first.');
    }
    const stmt = this.db.prepare(this.sql);
    const results = [];
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  run(...params) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initDB() first.');
    }
    this.db.run(this.sql, params);
    saveDB();
    return { changes: 1 };
  }
}

// 创建数据库包装器
const dbWrapper = {
  prepare: (sql) => new Statement(sql, db),
  pragma: (pragma) => {
    if (!db) {
      throw new Error('Database not initialized. Call initDB() first.');
    }
    db.run(`PRAGMA ${pragma}`);
    saveDB();
  },
  exec: (sql) => {
    if (!db) {
      throw new Error('Database not initialized. Call initDB() first.');
    }
    const result = db.exec(sql);
    saveDB();
    return result;
  }
};

export default dbWrapper;
