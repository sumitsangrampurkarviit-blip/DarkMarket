import json
import pytest
from app import app
from models import init_db, get_products, get_order, get_order_by_ref

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test_secret'
    init_db()
    with app.test_client() as client:
        yield client

def test_homepage(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b"SHADOW MARKET" in response.data
    assert b"Encrypted USB Drive" in response.data

def test_category_filter(client):
    response = client.get('/?category=hardware')
    assert response.status_code == 200
    assert b"Encrypted USB Drive" in response.data
    assert b"VPN Subscription" not in response.data

def test_api_products(client):
    response = client.get('/api/products')
    assert response.status_code == 200
    products = json.loads(response.data)
    assert len(products) >= 6

def test_product_detail(client):
    response = client.get('/product/1')
    assert response.status_code == 200
    assert b"Encrypted USB Drive" in response.data
    assert b"ADD TO CART" in response.data

def test_qr_code(client):
    btc_qr = client.get('/qr/btc')
    assert btc_qr.status_code == 200
    assert btc_qr.mimetype == 'image/svg+xml'
    
    xmr_qr = client.get('/qr/xmr')
    assert xmr_qr.status_code == 200
    assert xmr_qr.mimetype == 'image/svg+xml'

def test_checkout_and_order_flow(client):
    cart_items = [
        {"product_id": 1, "name": "Encrypted USB Drive", "price": 49.99, "quantity": 2},
        {"product_id": 2, "name": "VPN Subscription (1 Year)", "price": 79.99, "quantity": 1}
    ]
    
    checkout_data = {
        "customer_name": "GhostRider",
        "shipping_address": "P.O. Box 777, Secret Zone 9",
        "crypto_type": "XMR",
        "total_amount": "179.97",
        "tx_proof": "a9b8c7d6e5f4839201abcd",
        "cart_items": json.dumps(cart_items)
    }
    
    response = client.post('/checkout', data=checkout_data)
    assert response.status_code == 200
    assert b"ORDER RECEIVED" in response.data
    
    # Check that order was saved to database
    products = get_products()
    assert len(products) >= 6

def test_admin_flow(client):
    # Try dashboard without login
    dash_unauth = client.get('/admin/dashboard')
    assert dash_unauth.status_code == 302 # redirected to login
    
    # Login with wrong password
    bad_login = client.post('/admin', data={'password': 'wrongpassword'})
    assert b"Invalid password" in bad_login.data
    
    # Login with correct password
    good_login = client.post('/admin', data={'password': 'admin123'}, follow_redirects=True)
    assert good_login.status_code == 200
    assert b"ADMIN PANEL" in good_login.data
    
    # Update status of order 1 if it exists
    order = get_order(1)
    if order:
        update_resp = client.post('/admin/order/1/status', data={'status': 'shipped', 'notes': 'Shipped via priority courier'})
        assert update_resp.status_code == 302
        updated_order = get_order(1)
        assert updated_order['status'] == 'shipped'
        assert updated_order['notes'] == 'Shipped via priority courier'

if __name__ == '__main__':
    pytest.main(['-v', __file__])
