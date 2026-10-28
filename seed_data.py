from models import init_db, get_db

PRODUCTS = [
    {
        "name": "Encrypted USB Drive",
        "price_usd": 49.99,
        "description": "Military-grade encrypted 128GB USB drive. AES-256 hardware encryption.",
        "category": "hardware",
        "image": "product_1.png"
    },
    {
        "name": "VPN Subscription (1 Year)",
        "price_usd": 79.99,
        "description": "No-log VPN service. 500+ servers in 40 countries. WireGuard protocol.",
        "category": "services",
        "image": "product_2.png"
    },
    {
        "name": "Privacy Phone Case",
        "price_usd": 29.99,
        "description": "Faraday cage phone case. Blocks all signals when closed.",
        "category": "hardware",
        "image": "product_3.png"
    },
    {
        "name": "Security Audit Report",
        "price_usd": 199.99,
        "description": "Professional penetration testing report for your website or application.",
        "category": "services",
        "image": "product_4.png"
    },
    {
        "name": "Hardware Security Key",
        "price_usd": 34.99,
        "description": "FIDO2/U2F compatible hardware key. Protect your accounts.",
        "category": "hardware",
        "image": "product_5.png"
    },
    {
        "name": "Anonymity Guide eBook",
        "price_usd": 14.99,
        "description": "Complete guide to online anonymity. 200+ pages. PDF format.",
        "category": "digital",
        "image": "product_6.png"
    }
]

def seed():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM products")
    count = cursor.fetchone()[0]
    
    if count == 0:
        print("Seeding initial products...")
        for p in PRODUCTS:
            cursor.execute('''
                INSERT INTO products (name, description, price_usd, image, category)
                VALUES (?, ?, ?, ?, ?)
            ''', (p['name'], p['description'], p['price_usd'], p['image'], p['category']))
        conn.commit()
        print("Products seeded successfully.")
    else:
        print("Products table already has data. Skipping seed.")
        
    conn.close()

if __name__ == '__main__':
    seed()
