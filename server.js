const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const config = require('./config');
const { initialize, get } = require('./database');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true }
}));
app.use(flash());

app.use((req, res, next) => {
  if (req.session.userId) {
    const u = get('SELECT id,username,email,balance,role,is_banned FROM users WHERE id=?', [req.session.userId]);
    if (u && !u.is_banned) { res.locals.user = u; }
    else { req.session.destroy(); res.locals.user = null; }
  } else { res.locals.user = null; }
  res.locals.messages = { success: req.flash('success')[0], error: req.flash('error')[0] };
  res.locals.siteName = config.siteName;
  next();
});

app.use('/auth', require('./routes/auth'));
app.use('/', require('./routes/shop'));
app.use('/', require('./routes/user'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('error', { title: '404', msg: 'Page not found' }));

async function start() {
  await initialize();
  app.listen(config.port, () => console.log(`\n[★] SHADOW CARDS → http://localhost:${config.port}\n`));
}
start();
