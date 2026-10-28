import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BTC_WALLET_ADDRESS = os.getenv('BTC_WALLET_ADDRESS', 'YOUR_BTC_ADDRESS')
    XMR_WALLET_ADDRESS = os.getenv('XMR_WALLET_ADDRESS', 'YOUR_XMR_ADDRESS')
    TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
    TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
    SECRET_KEY = os.getenv('SECRET_KEY', os.urandom(24).hex())
    DATABASE_PATH = os.getenv('DATABASE_PATH', 'darkmarket.db')
    SITE_NAME = os.getenv('SITE_NAME', 'SHADOW MARKET')
