const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { get, run } = require('../database');

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { title: 'Login' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = get('SELECT * FROM users WHERE username=? OR email=?', [username, username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.flash('error', 'Invalid credentials');
    return res.redirect('/auth/login');
  }
  if (user.is_banned) { req.flash('error', 'Account suspended'); return res.redirect('/auth/login'); }
  req.session.userId = user.id;
  req.flash('success', 'Welcome back, ' + user.username);
  res.redirect('/');
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { title: 'Register' });
});

router.post('/register', (req, res) => {
  const { username, email, password, confirm } = req.body;
  if (!username || !email || !password) { req.flash('error', 'All fields required'); return res.redirect('/auth/register'); }
  if (password !== confirm) { req.flash('error', 'Passwords do not match'); return res.redirect('/auth/register'); }
  if (password.length < 6) { req.flash('error', 'Password min 6 characters'); return res.redirect('/auth/register'); }
  const exists = get('SELECT id FROM users WHERE username=? OR email=?', [username, email]);
  if (exists) { req.flash('error', 'Username or email already taken'); return res.redirect('/auth/register'); }
  const hash = bcrypt.hashSync(password, 12);
  run('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)', [username, email, hash]);
  req.flash('success', 'Account created — log in now');
  res.redirect('/auth/login');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;
