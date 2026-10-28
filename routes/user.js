const router = require('express').Router();
const { all, get, run, getSetting, getAllSettings } = require('../database');
const { requireAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

router.get('/profile', requireAuth, (req, res) => {
  const u = get('SELECT * FROM users WHERE id=?', [req.session.userId]);
  const orderCount = get('SELECT COUNT(*) as c FROM orders WHERE user_id=?', [req.session.userId]).c;
  const ticketCount = get('SELECT COUNT(*) as c FROM tickets WHERE user_id=?', [req.session.userId]).c;
  res.render('profile', { title: 'Profile', u, orderCount, ticketCount });
});

router.post('/profile', requireAuth, (req, res) => {
  const { email, current_password, new_password } = req.body;
  const u = get('SELECT * FROM users WHERE id=?', [req.session.userId]);
  if (new_password) {
    if (!bcrypt.compareSync(current_password, u.password_hash)) { req.flash('error', 'Current password wrong'); return res.redirect('/profile'); }
    run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(new_password, 12), req.session.userId]);
  }
  if (email && email !== u.email) {
    const taken = get('SELECT id FROM users WHERE email=? AND id!=?', [email, req.session.userId]);
    if (taken) { req.flash('error', 'Email taken'); return res.redirect('/profile'); }
    run('UPDATE users SET email=? WHERE id=?', [email, req.session.userId]);
  }
  req.flash('success', 'Profile updated');
  res.redirect('/profile');
});

router.get('/deposit', requireAuth, (req, res) => {
  const deposits = all('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC', [req.session.userId]);
  const wallets = {
    btc:        { address: getSetting('wallet_btc')        || '', label: 'Bitcoin',      symbol: 'BTC'  },
    eth:        { address: getSetting('wallet_eth')        || '', label: 'Ethereum',     symbol: 'ETH'  },
    usdt_bep20: { address: getSetting('wallet_usdt_bep20') || '', label: 'USDT (BEP20)', symbol: 'USDT' },
    xmr:        { address: getSetting('wallet_xmr')        || '', label: 'Monero',       symbol: 'XMR'  },
  };
  res.render('deposit', { title: 'Deposit', deposits, wallets, step: 'form', deposit: null, selectedWallet: null });
});

router.post('/deposit', requireAuth, async (req, res) => {
  const { amount, payment_method } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt < 50) { req.flash('error', 'Minimum deposit is $50'); return res.redirect('/deposit'); }
  if (amt > 5000) { req.flash('error', 'Maximum deposit is $5000'); return res.redirect('/deposit'); }

  const addr = getSetting('wallet_' + payment_method);
  if (!addr) { req.flash('error', 'Wallet not configured — contact admin'); return res.redirect('/deposit'); }

  const did = 'DEP-' + uuidv4().substring(0, 8).toUpperCase();
  run('INSERT INTO deposits (id,user_id,amount,payment_method,payment_address) VALUES (?,?,?,?,?)', [did, req.session.userId, amt, payment_method, addr]);

  const deposit = get('SELECT * FROM deposits WHERE id=?', [did]);
  const deposits = all('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC', [req.session.userId]);
  const wallets = {
    btc:        { address: getSetting('wallet_btc')        || '', label: 'Bitcoin',      symbol: 'BTC'  },
    eth:        { address: getSetting('wallet_eth')        || '', label: 'Ethereum',     symbol: 'ETH'  },
    usdt_bep20: { address: getSetting('wallet_usdt_bep20') || '', label: 'USDT (BEP20)', symbol: 'USDT' },
    xmr:        { address: getSetting('wallet_xmr')        || '', label: 'Monero',       symbol: 'XMR'  },
  };
  const selectedWallet = wallets[payment_method] || null;
  res.render('deposit', { title: 'Deposit', deposits, wallets, step: 'pay', deposit, selectedWallet });
});

router.get('/tickets', requireAuth, (req, res) => {
  const tickets = all('SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC', [req.session.userId]);
  res.render('tickets', { title: 'Tickets', tickets });
});

router.get('/tickets/new', requireAuth, (req, res) => {
  const orders = all('SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC', [req.session.userId]);
  res.render('ticket-new', { title: 'New Ticket', orders });
});

router.post('/tickets', requireAuth, (req, res) => {
  const { subject, message, order_id, priority } = req.body;
  if (!subject || !message) { req.flash('error', 'Subject and message required'); return res.redirect('/tickets/new'); }
  const r = run('INSERT INTO tickets (user_id,subject,order_id,priority) VALUES (?,?,?,?)', [req.session.userId, subject, order_id || null, priority || 'normal']);
  run('INSERT INTO ticket_messages (ticket_id,user_id,message) VALUES (?,?,?)', [r.lastID, req.session.userId, message]);
  req.flash('success', 'Ticket created');
  res.redirect('/tickets/' + r.lastID);
});

router.get('/tickets/:id', requireAuth, (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id=? AND user_id=?', [req.params.id, req.session.userId]);
  if (!ticket) return res.redirect('/tickets');
  const msgs = all('SELECT tm.*, u.username, u.role FROM ticket_messages tm JOIN users u ON tm.user_id=u.id WHERE tm.ticket_id=? ORDER BY tm.created_at', [ticket.id]);
  res.render('ticket', { title: 'Ticket #' + ticket.id, ticket, msgs });
});

router.post('/tickets/:id', requireAuth, (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id=? AND user_id=?', [req.params.id, req.session.userId]);
  if (!ticket || ticket.status === 'closed') return res.redirect('/tickets');
  run('INSERT INTO ticket_messages (ticket_id,user_id,message) VALUES (?,?,?)', [ticket.id, req.session.userId, req.body.message]);
  run("UPDATE tickets SET status='open',updated_at=CURRENT_TIMESTAMP WHERE id=?", [ticket.id]);
  res.redirect('/tickets/' + ticket.id);
});

module.exports = router;
