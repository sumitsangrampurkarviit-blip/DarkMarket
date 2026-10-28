module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'sh4d0w_c4rds_s3cr3t_k3y_change_this',
  
  // Crypto wallet addresses - REPLACE WITH YOUR OWN
  wallets: {
    btc: process.env.BTC_WALLET || 'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    eth: process.env.ETH_WALLET || '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    usdt_bep20: process.env.USDT_BEP20_WALLET || '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    xmr: process.env.XMR_WALLET || '4XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  },

  // Admin credentials (first run)
  defaultAdmin: {
    username: 'admin',
    email: 'admin@shadow.onion',
    password: process.env.ADMIN_PASSWORD || 'K8#vqhBfHDvA3NDfAzb9'
  },

  siteName: 'SHADOW CARDS',
  siteTagline: 'Premium Game Cards • Untraceable • Instant Delivery',
  currency: 'USD'
};
