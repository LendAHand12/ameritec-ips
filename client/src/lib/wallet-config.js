// Free project ID from https://dashboard.reown.com (WalletConnect). Without it the "Pay with wallet" button is
// hidden and customers pay by copying the address and pasting the transaction hash.
export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
export const walletConfigured = !!WALLETCONNECT_PROJECT_ID
