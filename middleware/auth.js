module.exports = {
  requireAuth(req, res, next) {
    if (!req.session.userId) {
      req.flash('error', 'Please log in');
      return res.redirect('/auth/login');
    }
    next();
  },
  requireAdmin(req, res, next) {
    if (!res.locals.user || res.locals.user.role !== 'admin') {
      req.flash('error', 'Access denied');
      return res.redirect('/');
    }
    next();
  }
};
