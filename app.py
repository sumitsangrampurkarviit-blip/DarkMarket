from flask import Flask, render_template, render_template_string, request, jsonify, session, redirect, url_for, send_file, abort, flash
import json
import uuid
import segno
import io
from functools import wraps

from config import Config
from models import init_db, get_products, get_product, create_order, create_order_item, get_orders, get_order, get_order_by_ref, update_order_status
from notifications import send_order_notification

app = Flask(__name__)
app.config.from_object(Config)

# Initialize database on startup
init_db()

# --- Middleware ---

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Public Routes ---

@app.route('/')
def index():
    category = request.args.get('category', None)
    products = get_products(in_stock_only=True, category=category)
    return render_template('index.html', products=products, site_name=app.config['SITE_NAME'])

@app.route('/product/<int:product_id>')
def product_detail(product_id):
    product = get_product(product_id)
    if not product:
        abort(404)
    return render_template('product.html', product=product, site_name=app.config['SITE_NAME'])

@app.route('/cart')
def cart():
    return render_template('cart.html', site_name=app.config['SITE_NAME'])

@app.route('/api/products')
def api_products():
    return jsonify(get_products(in_stock_only=True))

@app.route('/api/products/<int:product_id>')
def api_product(product_id):
    product = get_product(product_id)
    if product:
        return jsonify(product)
    return jsonify({'error': 'Not found'}), 404

@app.route('/checkout', methods=['GET', 'POST'])
def checkout():
    if request.method == 'GET':
        return render_template('checkout.html', 
                               site_name=app.config['SITE_NAME'],
                               btc_address=app.config['BTC_WALLET_ADDRESS'],
                               xmr_address=app.config['XMR_WALLET_ADDRESS'])
    
    # POST Request
    try:
        cart_items_json = request.form.get('cart_items', '[]')
        cart_items = json.loads(cart_items_json)
        
        if not cart_items:
            flash("Cart is empty.", "error")
            return redirect(url_for('cart'))

        total_amount = float(request.form.get('total_amount', 0))
        crypto_type = request.form.get('crypto_type', 'BTC').upper()
        
        order_ref = uuid.uuid4().hex[:8].upper()
        
        order_data = {
            'order_ref': order_ref,
            'customer_name': request.form.get('customer_name', 'Anonymous'),
            'shipping_address': request.form.get('shipping_address', 'N/A'),
            'crypto_type': crypto_type,
            'amount_usd': total_amount,
            'tx_proof': request.form.get('tx_proof', '')
        }
        
        # Save to DB
        order_id = create_order(order_data)
        
        for item in cart_items:
            product_id = item.get('product_id', item.get('id'))
            db_product = get_product(product_id)
            if db_product:
                create_order_item({
                    'order_id': order_id,
                    'product_id': product_id,
                    'product_name': db_product['name'],
                    'quantity': item.get('quantity', 1),
                    'price_at_purchase': db_product['price_usd']
                })
        
        # Send Notification (don't fail if it errors)
        try:
            send_order_notification(order_data, cart_items)
        except Exception:
            app.logger.warning("Telegram notification failed, but order was saved.")
        
        return render_template('order_confirm.html', order_ref=order_ref, site_name=app.config['SITE_NAME'])
        
    except Exception as e:
        app.logger.error(f"Checkout error: {e}")
        flash("An error occurred during checkout. Please try again.", "error")
        return redirect(url_for('checkout'))

# Order status lookup page (no ref)
@app.route('/order/status', methods=['GET', 'POST'])
def order_lookup():
    if request.method == 'POST':
        ref = request.form.get('order_ref', '').strip().upper()
        if ref:
            return redirect(url_for('order_status', order_ref=ref))
        flash("Please enter an order reference.", "error")
    ref = request.args.get('ref', '').strip().upper()
    if ref:
        return redirect(url_for('order_status', order_ref=ref))
    return render_template('order_status.html', order=None, site_name=app.config['SITE_NAME'])

@app.route('/order/<order_ref>')
def order_status(order_ref):
    order = get_order_by_ref(order_ref)
    return render_template('order_status.html', order=order, order_ref=order_ref, site_name=app.config['SITE_NAME'])

# --- Utilities ---

@app.route('/qr/<crypto_type>')
def qr_code(crypto_type):
    if crypto_type.upper() == 'BTC':
        uri = f"bitcoin:{app.config['BTC_WALLET_ADDRESS']}"
    elif crypto_type.upper() == 'XMR':
        uri = f"monero:{app.config['XMR_WALLET_ADDRESS']}"
    else:
        abort(404)
        
    qr = segno.make(uri)
    buf = io.BytesIO()
    qr.save(buf, kind='svg', scale=4)
    buf.seek(0)
    return send_file(buf, mimetype='image/svg+xml')

# --- Admin Routes ---

@app.route('/admin', methods=['GET', 'POST'])
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == app.config['ADMIN_PASSWORD']:
            session['admin'] = True
            return redirect(url_for('admin_dashboard'))
        return render_template('admin/login.html', error="Invalid password", site_name=app.config['SITE_NAME'])
    
    if session.get('admin'):
        return redirect(url_for('admin_dashboard'))
    return render_template('admin/login.html', site_name=app.config['SITE_NAME'])

@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    orders = get_orders()
    return render_template('admin/dashboard.html', orders=orders, site_name=app.config['SITE_NAME'])

@app.route('/admin/order/<int:order_id>')
@admin_required
def admin_order_detail(order_id):
    order = get_order(order_id)
    if not order:
        abort(404)
    return render_template('admin/order_detail.html', order=order, site_name=app.config['SITE_NAME'])

@app.route('/admin/order/<int:order_id>/status', methods=['POST'])
@app.route('/admin/order/<int:order_id>/update', methods=['POST'])
@admin_required
def admin_order_status(order_id):
    status = request.form.get('status')
    notes = request.form.get('notes')
    if status in ['pending', 'confirmed', 'shipped', 'completed']:
        update_order_status(order_id, status, notes=notes)
    return redirect(url_for('admin_order_detail', order_id=order_id))

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin', None)
    return redirect(url_for('admin_login'))

# --- Error Handlers ---

ERROR_TEMPLATE = '''
{% extends "base.html" %}
{% block title %}{{ error_code }} - SHADOW MARKET{% endblock %}
{% block content %}
<div class="terminal-header">
    <p style="color: var(--error);">ERROR {{ error_code }}</p>
    <p>{{ error_message }}</p>
    <p><a href="/">[RETURN TO SHOP]</a></p>
</div>
{% endblock %}
'''

@app.errorhandler(404)
def page_not_found(e):
    return render_template_string(ERROR_TEMPLATE, 
        error_code=404, 
        error_message="The page you are looking for does not exist.",
        site_name=app.config.get('SITE_NAME', 'SHADOW MARKET')), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template_string(ERROR_TEMPLATE,
        error_code=500,
        error_message="An internal error occurred. Try again later.",
        site_name=app.config.get('SITE_NAME', 'SHADOW MARKET')), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
