const router = require('express').Router();
const { all, get, run } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const config = require('../config');

router.get('/', (req, res) => {
  const featured = all(`SELECT p.*, c.name as cat FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.featured=1 AND p.is_active=1 LIMIT 8`);
  const categories = all('SELECT * FROM categories ORDER BY sort_order');
  res.render('index', { title: 'Home', featured, categories });
});

router.get('/shop', (req, res) => {
  const { category, q, sort } = req.query;
  let sql = `SELECT p.*, c.name as cat FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_active=1`;
  const params = [];
  if (category) { sql += ' AND c.slug=?'; params.push(category); }
  if (q) { sql += ' AND p.name LIKE ?'; params.push('%' + q + '%'); }

  if (sort === 'low' || sort === 'price_asc' || sort === 'low_to_high') {
    sql += ' ORDER BY CAST(p.price AS REAL) ASC';
  } else if (sort === 'high' || sort === 'price_desc' || sort === 'high_to_low') {
    sql += ' ORDER BY CAST(p.price AS REAL) DESC';
  } else {
    sql += ' ORDER BY p.id DESC';
  }

  const products = all(sql, params);
  const categories = all('SELECT * FROM categories ORDER BY sort_order');
  res.render('shop', { title: 'Shop', products, categories, f: { category, q, sort } });
});

router.get('/shop/:id', (req, res) => {
  const product = get(`SELECT p.*, c.name as cat FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.id=?`, [req.params.id]);
  if (!product) return res.redirect('/shop');
  res.render('product', { title: product.name, product });
});

router.get('/cart', requireAuth, (req, res) => {
  const items = all(`SELECT c.*, p.name, p.price, p.stock FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?`, [req.session.userId]);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('cart', { title: 'Cart', items, total });
});

router.post('/cart/add', requireAuth, (req, res) => {
  const { product_id, quantity } = req.body;
  const existing = get('SELECT id FROM cart WHERE user_id=? AND product_id=?', [req.session.userId, product_id]);
  if (existing) {
    run('UPDATE cart SET quantity=quantity+? WHERE user_id=? AND product_id=?', [parseInt(quantity) || 1, req.session.userId, product_id]);
  } else {
    run('INSERT INTO cart (user_id,product_id,quantity) VALUES (?,?,?)', [req.session.userId, product_id, parseInt(quantity) || 1]);
  }
  req.flash('success', 'Added to cart');
  res.redirect(req.get('referer') || '/cart');
});

router.post('/cart/update', requireAuth, (req, res) => {
  const qty = parseInt(req.body.quantity);
  if (qty < 1) run('DELETE FROM cart WHERE user_id=? AND product_id=?', [req.session.userId, req.body.product_id]);
  else run('UPDATE cart SET quantity=? WHERE user_id=? AND product_id=?', [qty, req.session.userId, req.body.product_id]);
  res.redirect('/cart');
});

router.post('/cart/remove', requireAuth, (req, res) => {
  run('DELETE FROM cart WHERE user_id=? AND product_id=?', [req.session.userId, req.body.product_id]);
  res.redirect('/cart');
});

router.get('/checkout', requireAuth, (req, res) => {
  const items = all(`SELECT c.*, p.name, p.price, p.stock FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?`, [req.session.userId]);
  if (!items.length) return res.redirect('/cart');
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  res.render('checkout', { title: 'Checkout', items, total, wallets: config.wallets });
});

router.post('/checkout', requireAuth, (req, res) => {
  const items = all(`SELECT c.*, p.name, p.price, p.stock FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?`, [req.session.userId]);
  if (!items.length) { req.flash('error', 'Cart is empty'); return res.redirect('/cart'); }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  for (const i of items) {
    if (i.stock < i.quantity) { req.flash('error', i.name + ' is out of stock'); return res.redirect('/cart'); }
  }

  const u = get('SELECT balance FROM users WHERE id=?', [req.session.userId]);
  if (u.balance < total) {
    req.flash('error', `Insufficient balance — need $${total.toFixed(2)}, you have $${u.balance.toFixed(2)}`);
    return res.redirect('/deposit');
  }

  const oid = 'SC-' + uuidv4().substring(0, 8).toUpperCase();

  run('UPDATE users SET balance=balance-? WHERE id=?', [total, req.session.userId]);
  run('INSERT INTO orders (id,user_id,total,status,payment_method) VALUES (?,?,?,?,?)', [oid, req.session.userId, total, 'processing', 'balance']);

  for (const i of items) {
    run('INSERT INTO order_items (order_id,product_id,product_name,quantity,price) VALUES (?,?,?,?,?)', [oid, i.product_id, i.name, i.quantity, i.price]);
    run('UPDATE products SET stock=stock-? WHERE id=?', [i.quantity, i.product_id]);
  }
  run('DELETE FROM cart WHERE user_id=?', [req.session.userId]);

  req.flash('success', 'Order placed — ' + oid);
  res.redirect('/orders/' + oid);
});

router.get('/orders', requireAuth, (req, res) => {
  const orders = all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', [req.session.userId]);
  res.render('orders', { title: 'My Orders', orders });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = get('SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.session.userId]);
  if (!order) return res.redirect('/orders');
  const items = all('SELECT * FROM order_items WHERE order_id=?', [order.id]);
  res.render('order', { title: 'Order ' + order.id, order, items });
});

router.get('/orders/:id/receipt', requireAuth, (req, res) => {
  const order = get('SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id=u.id WHERE o.id=? AND o.user_id=?', [req.params.id, req.session.userId]);
  if (!order || order.status !== 'completed') { req.flash('error', 'Receipt unavailable'); return res.redirect('/orders'); }
  const items = all('SELECT * FROM order_items WHERE order_id=?', [order.id]);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=receipt-' + order.id + '.pdf');
  doc.pipe(res);
  doc.font('Courier-Bold').fontSize(22).text('SHADOW CARDS', { align: 'center' });
  doc.font('Courier').fontSize(10).text('PURCHASE RECEIPT', { align: 'center' });
  doc.moveDown(); doc.text('='.repeat(60)); doc.moveDown();
  doc.text('Order ID:  ' + order.id);
  doc.text('Date:      ' + order.created_at);
  doc.text('Buyer:     ' + order.username);
  doc.text('Payment:   ' + (order.payment_method || '').toUpperCase());
  doc.moveDown(); doc.text('-'.repeat(60)); doc.moveDown();
  doc.font('Courier-Bold').text('ITEMS:'); doc.font('Courier');
  for (const i of items) doc.text('  ' + i.product_name + ' x' + i.quantity + '  $' + (i.price * i.quantity).toFixed(2));
  doc.moveDown(); doc.text('-'.repeat(60));
  doc.font('Courier-Bold').text('TOTAL: $' + order.total.toFixed(2), { align: 'right' });
  if (order.card_details) { doc.moveDown(2); doc.font('Courier-Bold').text('CARD DETAILS:'); doc.font('Courier').text(order.card_details); }
  doc.moveDown(3); doc.fontSize(8).text('Generated by Shadow Cards. All sales final.', { align: 'center' });
  doc.end();
});

module.exports = router;
