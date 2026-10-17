import 'dotenv/config'

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  appName: process.env.APP_NAME ?? 'Ameritec IPS',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? '8h',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mail: {
    from: process.env.MAIL_FROM,
  },
  withdrawal: {
    // Smallest commission payout a user can request
    minUsdt: Number(process.env.MIN_WITHDRAWAL_USDT ?? 10),
  },
  // Face scan runs on a separate FaceTec host: the browser is sent there and comes back to /user/kyc-callback
  facetec: {
    baseUrl: process.env.FACETEC_BASE_URL?.replace(/\/+$/, ''),
    // false (default): a successful scan still waits for an admin to approve it, then commission is released
    autoApprove: process.env.FACETEC_AUTO_APPROVE === 'true',
  },
  // Admin alerts (new payments to verify). Leave empty to disable.
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? 'uploads',
    maxSizeMB: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10),
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    // Binance-Peg USDT (BEP20) on BNB Smart Chain mainnet
    usdtContract: process.env.BSC_USDT_CONTRACT ?? '0x55d398326f99059fF775485246999027B3197955',
    minConfirmations: Number(process.env.BSC_MIN_CONFIRMATIONS ?? 5),
  },
  certificates: {
    dir: process.env.CERTIFICATE_DIR ?? 'storage/certificates',
  },
  settingsDir: process.env.SETTINGS_FILE_DIR ?? 'storage/settings',
  supportDir: process.env.SUPPORT_FILE_DIR ?? 'storage/support',
  kyc: {
    dir: process.env.KYC_DIR ?? 'storage/kyc',
    maxSizeMB: Number(process.env.KYC_MAX_SIZE_MB ?? 10),
  },
}

if (!env.jwt.secret) throw new Error('JWT_SECRET is not set')

export default env
