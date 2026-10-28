import requests
from config import Config
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def send_order_notification(order_data, cart_items):
    if not Config.TELEGRAM_BOT_TOKEN or not Config.TELEGRAM_CHAT_ID:
        logger.info("Telegram notification skipped: Bot token or chat ID not configured.")
        return False

    items_text = ""
    for item in cart_items:
        items_text += f"   - {item.get('name', 'Unknown')} x{item.get('quantity', 1)}\n"

    message = f"""🔔 NEW ORDER #{order_data['order_ref']}

💰 Payment: {order_data['crypto_type']}
💵 Amount: ${order_data['amount_usd']:.2f}
📋 TX Proof: {order_data['tx_proof']}

📦 Shipping To:
   Name: {order_data['customer_name']}
   Address: {order_data['shipping_address']}

🛒 Items:
{items_text}
⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    url = f"https://api.telegram.org/bot{Config.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": Config.TELEGRAM_CHAT_ID,
        "text": message
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f"Telegram notification sent for order #{order_data['order_ref']}")
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False
