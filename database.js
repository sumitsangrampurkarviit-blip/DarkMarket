const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('./config');

const DB_PATH = path.join(__dirname, 'shadow_cards.db');
let db;

async function initialize() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      role TEXT DEFAULT 'user',
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT DEFAULT '🎮', sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, category_id INTEGER,
      price REAL NOT NULL, stock INTEGER DEFAULT 0, featured INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, total REAL NOT NULL,
      status TEXT DEFAULT 'pending', payment_method TEXT, payment_address TEXT, tx_hash TEXT,
      card_details TEXT, admin_notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL,
      payment_address TEXT NOT NULL, status TEXT DEFAULT 'pending', tx_hash TEXT, admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, confirmed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, order_id TEXT,
      subject TEXT NOT NULL, status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
      message TEXT NOT NULL, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1, UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // ── Migrations (safe to run every startup) ──
  const migrations = [
    `ALTER TABLE products ADD COLUMN image_url TEXT`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  ];
  for (const m of migrations) {
    try { db.run(m); } catch (e) { /* already applied */ }
  }

  // Seed admin
  const admin = get('SELECT id FROM users WHERE role=?', ['admin']);
  if (!admin) {
    const hash = bcrypt.hashSync(config.defaultAdmin.password, 12);
    run('INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,?)', [config.defaultAdmin.username, config.defaultAdmin.email, hash, 'admin']);
    console.log('[+] Admin user created:', config.defaultAdmin.username);
  }

  // Seed categories
  const catCount = get('SELECT COUNT(*) as c FROM categories');
  if (catCount.c === 0) {
    const cats = [
      ['Steam Cards','steam','🎮',1],['PlayStation Cards','playstation','🎯',2],
      ['Xbox Cards','xbox','🕹️',3],['Nintendo Cards','nintendo','🍄',4],
      ['Google Play Cards','google-play','📱',5],['iTunes Cards','itunes','🍎',6],
      ['Amazon Cards','amazon','📦',7],['Other Cards','other','💳',8]
    ];
    cats.forEach(c => run('INSERT INTO categories (name,slug,icon,sort_order) VALUES (?,?,?,?)', c));
    console.log('[+] Categories seeded');
  }

  // Seed products
  const prodCount = get('SELECT COUNT(*) as c FROM products');
  if (prodCount.c === 0) {
    const prods = [
      ['Steam Gift Card $10','Steam Wallet Code - $10 USD.',1,8.50,25,1],
      ['Steam Gift Card $25','Steam Wallet Code - $25 USD.',1,21.00,15,1],
      ['Steam Gift Card $50','Steam Wallet Code - $50 USD.',1,42.00,10,1],
      ['Steam Gift Card $100','Steam Wallet Code - $100 USD.',1,82.00,5,0],
      ['PSN Card $10','PlayStation Network - $10 USD.',2,8.50,20,1],
      ['PSN Card $25','PlayStation Network - $25 USD.',2,21.50,12,0],
      ['PSN Card $50','PlayStation Network - $50 USD.',2,42.50,8,0],
      ['Xbox Gift Card $10','Xbox Live Gift Card - $10.',3,8.50,18,0],
      ['Xbox Gift Card $25','Xbox Live Gift Card - $25.',3,21.00,10,1],
      ['Nintendo eShop $10','Nintendo eShop - $10.',4,8.75,15,0],
      ['Nintendo eShop $25','Nintendo eShop - $25.',4,22.00,8,1],
      ['Google Play $25','Google Play Gift Card - $25.',5,21.50,12,0],
      ['iTunes $25','Apple iTunes Gift Card - $25.',6,22.00,10,0],
      ['Amazon $25','Amazon Gift Card - $25.',7,22.50,10,1],
      ['Amazon $50','Amazon Gift Card - $50.',7,44.00,5,0],
    ];
    prods.forEach(p => run('INSERT INTO products (name,description,category_id,price,stock,featured) VALUES (?,?,?,?,?,?)', p));
    console.log('[+] Products seeded');
  }

  save();
}

// Helper wrappers
function all(sql, params = []) { return db.exec(sql, params).length ? stmtToObjects(db.exec(sql, params)[0]) : []; }
function get(sql, params = []) { const r = all(sql, params); return r.length ? r[0] : null; }
function run(sql, params = []) { db.run(sql, params); save(); return { lastID: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] }; }
function save() { const data = db.export(); fs.writeFileSync(DB_PATH, Buffer.from(data)); }

// Settings helpers
function getSetting(key) { const r = get('SELECT value FROM settings WHERE key=?', [key]); return r ? r.value : null; }
function setSetting(key, value) { run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]); }
function getAllSettings() {
  const rows = all('SELECT key,value FROM settings');
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
}

function stmtToObjects(result) {
  const { columns, values } = result;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

module.exports = { initialize, all, get, run, save, getSetting, setSetting, getAllSettings };
