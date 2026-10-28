import sqlite3
from config import Config

def get_db():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price_usd REAL NOT NULL,
            image TEXT,
            category TEXT,
            in_stock INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_ref TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            shipping_address TEXT NOT NULL,
            crypto_type TEXT NOT NULL,
            amount_usd REAL NOT NULL,
            tx_proof TEXT,
            status TEXT DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_purchase REAL NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    ''')
    conn.commit()
    conn.close()

def get_products(in_stock_only=False, category=None):
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    if in_stock_only:
        query += " AND in_stock = 1"
    if category:
        query += " AND category = ?"
        params.append(category)
    cursor.execute(query, params)
    products = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return products

def get_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_order(order_data):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO orders (order_ref, customer_name, shipping_address, crypto_type, amount_usd, tx_proof)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        order_data['order_ref'], order_data['customer_name'], order_data['shipping_address'],
        order_data['crypto_type'], order_data['amount_usd'], order_data['tx_proof']
    ))
    order_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return order_id

def create_order_item(item_data):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        item_data['order_id'], item_data['product_id'], item_data['product_name'],
        item_data['quantity'], item_data['price_at_purchase']
    ))
    conn.commit()
    conn.close()

def get_orders():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
    orders = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return orders

def get_order_by_ref(order_ref):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_ref = ?", (order_ref,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_order(order_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    order = dict(row)
    
    cursor.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    items = [dict(i) for i in cursor.fetchall()]
    order['items'] = items
    
    conn.close()
    return order

def update_order_status(order_id, status, notes=None):
    conn = get_db()
    cursor = conn.cursor()
    if notes is not None:
        cursor.execute("UPDATE orders SET status = ?, notes = ? WHERE id = ?", (status, notes, order_id))
    else:
        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    conn.commit()
    conn.close()
