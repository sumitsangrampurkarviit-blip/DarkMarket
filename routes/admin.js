const router = require('express').Router();
const { all, get, run, getSetting, setSetting, getAllSettings } = require('../database');
const { requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/img/products')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'prod-' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Images only'), ok);
  }
});

router.use(requireAdmin);

router.get('/', (req, res) => {
  const stats = {
    users: get('SELECT COUNT(*) as c FROM users WHERE role="user"').c,
    orders: get('SELECT COUNT(*) as c FROM orders').c,
    pending: get('SELECT COUNT(*) as c FROM orders WHERE status IN ("pending","awaiting_payment","processing")').c,
    revenue: get('SELECT COALESCE(SUM(total),0) as c FROM orders WHERE status="completed"').c,
    deposits: get('SELECT COUNT(*) as c FROM deposits WHERE status="pending"').c,
    tickets: get('SELECT COUNT(*) as c FROM tickets WHERE status="open"').c,
  };
  const recent = all('SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 10');
  res.render('admin/dashboard', { title: 'Admin', stats, recent });
});

router.get('/products', (req, res) => {
  const products = all('SELECT p.*, c.name as cat FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.id DESC');
  const categories = all('SELECT * FROM categories ORDER BY sort_order');
  res.render('admin/products', { title: 'Products', products, categories });
});

// ── Categories ──────────────────────────────────────────────
router.get('/categories', (req, res) => {
  const categories = all('SELECT * FROM categories ORDER BY sort_order');
  res.render('admin/categories', { title: 'Categories', categories });
});

router.post('/categories', (req, res) => {
  const { name, slug, icon, sort_order } = req.body;
  if (!name || !slug) { req.flash('error', 'Name and slug required'); return res.redirect('/admin/categories'); }
  const exists = get('SELECT id FROM categories WHERE slug=?', [slug]);
  if (exists) { req.flash('error', 'Slug already taken'); return res.redirect('/admin/categories'); }
  run('INSERT INTO categories (name, slug, icon, sort_order) VALUES (?,?,?,?)', [name, slug.toLowerCase().replace(/\s+/g,'-'), icon || '🃏', parseInt(sort_order) || 0]);
  req.flash('success', 'Category added');
  res.redirect('/admin/categories');
});

router.post('/categories/:id', (req, res) => {
  const { name, slug, icon, sort_order } = req.body;
  if (!name || !slug) { req.flash('error', 'Name and slug required'); return res.redirect('/admin/categories'); }
  run('UPDATE categories SET name=?, slug=?, icon=?, sort_order=? WHERE id=?', [name, slug.toLowerCase().replace(/\s+/g,'-'), icon || '🃏', parseInt(sort_order) || 0, req.params.id]);
  req.flash('success', 'Category updated');
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', (req, res) => {
  const used = get('SELECT COUNT(*) as c FROM products WHERE category_id=?', [req.params.id]);
  if (used && used.c > 0) { req.flash('error', 'Cannot delete — category has products. Move them first.'); return res.redirect('/admin/categories'); }
  run('DELETE FROM categories WHERE id=?', [req.params.id]);
  req.flash('success', 'Category deleted');
  res.redirect('/admin/categories');
});

router.get('/products/:id/edit', (req, res) => {
  const product = get('SELECT p.*, c.name as cat FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.id=?', [req.params.id]);
  if (!product) { req.flash('error', 'Product not found'); return res.redirect('/admin/products'); }
  const categories = all('SELECT * FROM categories ORDER BY sort_order');
  res.render('admin/product-edit', { title: 'Edit ' + product.name, product, categories });
});

router.post('/products', upload.single('image'), (req, res) => {
  const { name, description, category_id, price, stock, featured } = req.body;
  const image_url = req.file ? '/img/products/' + req.file.filename : null;
  run('INSERT INTO products (name,description,category_id,price,stock,featured,image_url) VALUES (?,?,?,?,?,?,?)', [name, description, category_id, parseFloat(price), parseInt(stock) || 0, featured ? 1 : 0, image_url]);
  req.flash('success', 'Product added');
  res.redirect('/admin/products');
});

router.post('/products/:id', upload.single('image'), (req, res) => {
  const { name, description, category_id, price, stock, featured, is_active } = req.body;
  const existing = get('SELECT image_url FROM products WHERE id=?', [req.params.id]);
  let image_url = existing ? existing.image_url : null;
  if (req.file) {
    // Delete old image if exists
    if (image_url) {
      const oldPath = path.join(__dirname, '../public', image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image_url = '/img/products/' + req.file.filename;
  }
  run('UPDATE products SET name=?,description=?,category_id=?,price=?,stock=?,featured=?,is_active=?,image_url=? WHERE id=?', [name, description, category_id, parseFloat(price), parseInt(stock), featured ? 1 : 0, is_active ? 1 : 0, image_url, req.params.id]);
  req.flash('success', 'Product updated');
  res.redirect('/admin/products');
});

router.post('/products/:id/delete', (req, res) => {
  run('UPDATE products SET is_active=0 WHERE id=?', [req.params.id]);
  req.flash('success', 'Product hidden');
  res.redirect('/admin/products');
});

router.get('/orders', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id=u.id';
  const params = [];
  if (status) { sql += ' WHERE o.status=?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC';
  const orders = all(sql, params);
  res.render('admin/orders', { title: 'Orders', orders, fStatus: status });
});

router.get('/orders/:id', (req, res) => {
  const order = get('SELECT o.*, u.username, u.email FROM orders o JOIN users u ON o.user_id=u.id WHERE o.id=?', [req.params.id]);
  if (!order) return res.redirect('/admin/orders');
  const items = all('SELECT * FROM order_items WHERE order_id=?', [order.id]);
  res.render('admin/order', { title: 'Order ' + order.id, order, items });
});

router.post('/orders/:id', (req, res) => {
  const { status, card_details, admin_notes, tx_hash } = req.body;
  const order = get('SELECT * FROM orders WHERE id=?', [req.params.id]);
  if (!order) return res.redirect('/admin/orders');
  let completedAt = null;
  if (status === 'completed' && order.status !== 'completed') completedAt = new Date().toISOString();
  run('UPDATE orders SET status=?,card_details=?,admin_notes=?,tx_hash=?,completed_at=COALESCE(?,completed_at) WHERE id=?', [status, card_details || order.card_details, admin_notes || order.admin_notes, tx_hash || order.tx_hash, completedAt, req.params.id]);
  if (status === 'cancelled' && order.payment_method === 'balance' && order.status !== 'cancelled') {
    run('UPDATE users SET balance=balance+? WHERE id=?', [order.total, order.user_id]);
  }
  req.flash('success', 'Order updated');
  res.redirect('/admin/orders/' + req.params.id);
});

router.get('/deposits', (req, res) => {
  const deposits = all('SELECT d.*, u.username FROM deposits d JOIN users u ON d.user_id=u.id ORDER BY d.created_at DESC');
  res.render('admin/deposits', { title: 'Deposits', deposits });
});

router.post('/deposits/:id/confirm', (req, res) => {
  const dep = get('SELECT * FROM deposits WHERE id=? AND status="pending"', [req.params.id]);
  if (!dep) return res.redirect('/admin/deposits');
  const credit = parseFloat(req.body.credit_amount) || dep.amount;
  const txHash = req.body.tx_hash || null;
  run("UPDATE deposits SET status='confirmed', confirmed_at=CURRENT_TIMESTAMP, tx_hash=COALESCE(?,tx_hash) WHERE id=?", [txHash, dep.id]);
  run('UPDATE users SET balance=balance+? WHERE id=?', [credit, dep.user_id]);
  req.flash('success', `Deposit confirmed — $${credit.toFixed(2)} credited to user`);
  res.redirect('/admin/deposits');
});

router.post('/deposits/:id/reject', (req, res) => {
  run("UPDATE deposits SET status='rejected' WHERE id=? AND status='pending'", [req.params.id]);
  req.flash('success', 'Deposit rejected');
  res.redirect('/admin/deposits');
});

router.get('/tickets', (req, res) => {
  const tickets = all('SELECT t.*, u.username FROM tickets t JOIN users u ON t.user_id=u.id ORDER BY t.updated_at DESC');
  res.render('admin/tickets', { title: 'Tickets', tickets });
});

router.get('/tickets/:id', (req, res) => {
  const ticket = get('SELECT t.*, u.username FROM tickets t JOIN users u ON t.user_id=u.id WHERE t.id=?', [req.params.id]);
  if (!ticket) return res.redirect('/admin/tickets');
  const msgs = all('SELECT tm.*, u.username, u.role FROM ticket_messages tm JOIN users u ON tm.user_id=u.id WHERE tm.ticket_id=? ORDER BY tm.created_at', [ticket.id]);
  res.render('admin/ticket', { title: 'Ticket #' + ticket.id, ticket, msgs });
});

router.post('/tickets/:id', (req, res) => {
  const { message, status } = req.body;
  const ticket = get('SELECT * FROM tickets WHERE id=?', [req.params.id]);
  if (!ticket) return res.redirect('/admin/tickets');
  if (message) run('INSERT INTO ticket_messages (ticket_id,user_id,message,is_admin) VALUES (?,?,?,1)', [ticket.id, req.session.userId, message]);
  const newStatus = status || (message ? 'replied' : ticket.status);
  run('UPDATE tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [newStatus, ticket.id]);
  req.flash('success', 'Ticket updated');
  res.redirect('/admin/tickets/' + ticket.id);
});

router.get('/users', (req, res) => {
  const users = all('SELECT * FROM users ORDER BY created_at DESC');
  res.render('admin/users', { title: 'Users', users });
});

router.post('/users/:id/ban', (req, res) => {
  run('UPDATE users SET is_banned = CASE WHEN is_banned=0 THEN 1 ELSE 0 END WHERE id=? AND role!="admin"', [req.params.id]);
  res.redirect('/admin/users');
});

router.post('/users/:id/balance', (req, res) => {
  const amt = parseFloat(req.body.amount);
  if (amt) run('UPDATE users SET balance=balance+? WHERE id=?', [amt, req.params.id]);
  req.flash('success', 'Balance updated');
  res.redirect('/admin/users');
});

// ── Crypto Settings ──────────────────────────────────────────
const COINS = [
  { key: 'btc',        label: 'Bitcoin',       symbol: 'BTC'  },
  { key: 'eth',        label: 'Ethereum',      symbol: 'ETH'  },
  { key: 'usdt_bep20', label: 'USDT (BEP20)',  symbol: 'USDT' },
  { key: 'xmr',        label: 'Monero',        symbol: 'XMR'  },
];

router.get('/settings', (req, res) => {
  const settings = getAllSettings();
  res.render('admin/settings', { title: 'Crypto Settings', coins: COINS, settings });
});

// Save address text
router.post('/settings/address/:coin', (req, res) => {
  const { coin } = req.params;
  const { address } = req.body;
  setSetting('wallet_' + coin, address || '');
  req.flash('success', coin.toUpperCase() + ' address saved');
  res.redirect('/admin/settings');
});

module.exports = router;
