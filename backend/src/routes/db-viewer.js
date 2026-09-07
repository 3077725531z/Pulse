import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// 30秒动态密码
const VIEWER_SECRET = crypto.randomBytes(16).toString('hex');

function getCurrentPassword() {
  const window = Math.floor(Date.now() / 30000);
  return crypto.createHash('sha256').update(`${VIEWER_SECRET}:${window}`).digest('hex').slice(0, 6);
}

function getTimeRemaining() {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

export { getCurrentPassword, getTimeRemaining };

// 密码验证（当前窗口和前一个窗口都有效，防止边界问题）
function viewerAuth(req, res, next) {
  const pwd = req.query.pwd || req.headers['x-viewer-pwd'];
  const current = getCurrentPassword();
  const prevWindow = Math.floor(Date.now() / 30000) - 1;
  const prev = crypto.createHash('sha256').update(`${VIEWER_SECRET}:${prevWindow}`).digest('hex').slice(0, 6);
  if (pwd !== current && pwd !== prev) {
    return res.status(401).json({ error: '密码错误' });
  }
  next();
}

router.use(viewerAuth);

// 获取所有表（带描述）
router.get('/tables', (req, res) => {
  try {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = result.length > 0 ? result[0].values.map(row => row[0]) : [];

    // 读取描述
    let metas = {};
    try {
      const metaResult = db.exec("SELECT table_name, description FROM _table_meta");
      if (metaResult.length > 0) {
        metaResult[0].values.forEach(row => { metas[row[0]] = row[1]; });
      }
    } catch {}

    res.json(tables.map(t => ({ name: t, description: metas[t] || '' })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存表描述
router.put('/table-desc/:name', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const { description } = req.body;
    db.prepare("INSERT OR REPLACE INTO _table_meta (table_name, description) VALUES (?, ?)").run(tableName, description || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取表结构
router.get('/table/:name/structure', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const result = db.exec(`PRAGMA table_info(${tableName})`);
    if (result.length === 0) return res.status(404).json({ error: '表不存在' });

    const columns = result[0].values.map(row => ({
      cid: row[0],
      name: row[1],
      type: row[2],
      notnull: row[3],
      dflt_value: row[4],
      pk: row[5]
    }));
    res.json(columns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取表数据（分页）
router.get('/table/:name', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const countResult = db.exec(`SELECT COUNT(*) FROM ${tableName}`);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    const dataResult = db.exec(`SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`);
    const columns = dataResult.length > 0 ? dataResult[0].columns : [];
    const rows = dataResult.length > 0 ? dataResult[0].values : [];

    res.json({
      columns,
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增行
router.post('/table/:name', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const { row } = req.body; // { col1: val1, col2: val2, ... }
    if (!row || Object.keys(row).length === 0) return res.status(400).json({ error: '数据不能为空' });

    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map(() => '?').join(', ');
    const colStr = columns.map(c => `"${c}"`).join(', ');

    db.prepare(`INSERT INTO ${tableName} (${colStr}) VALUES (${placeholders})`).run(...values);
    res.json({ success: true, message: '新增成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新行
router.put('/table/:name', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const { set, where } = req.body; // { set: { col: newVal }, where: { pk_col: pk_val } }
    if (!set || !where || Object.keys(set).length === 0 || Object.keys(where).length === 0) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const setClauses = Object.keys(set).map(k => `"${k}" = ?`).join(', ');
    const whereClauses = Object.keys(where).map(k => `"${k}" = ?`).join(' AND ');
    const values = [...Object.values(set), ...Object.values(where)];

    db.prepare(`UPDATE ${tableName} SET ${setClauses} WHERE ${whereClauses}`).run(...values);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除行
router.delete('/table/:name', (req, res) => {
  try {
    const tableName = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const { where } = req.body; // { pk_col: pk_val, ... }
    if (!where || Object.keys(where).length === 0) return res.status(400).json({ error: '缺少条件' });

    const whereClauses = Object.keys(where).map(k => `"${k}" = ?`).join(' AND ');
    const values = Object.values(where);

    db.prepare(`DELETE FROM ${tableName} WHERE ${whereClauses}`).run(...values);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 执行自定义 SQL（允许所有语句）
router.post('/query', (req, res) => {
  try {
    let { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL 不能为空' });

    sql = sql.trim();

    // SELECT/PRAGMA/EXPLAIN 返回结果
    const upperSql = sql.toUpperCase().replace(/^\s+/, '');
    if (upperSql.startsWith('SELECT') || upperSql.startsWith('PRAGMA') || upperSql.startsWith('EXPLAIN')) {
      const result = db.exec(sql);
      return res.json(result.map(r => ({ columns: r.columns, values: r.values })));
    }

    // 所有其他 SQL 语句直接执行（CREATE/ALTER/DROP/INSERT/UPDATE/DELETE 等）
    db.exec(sql);
    return res.json({ success: true, message: '执行成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
