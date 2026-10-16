import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { bsc } from '@reown/appkit/networks'

import { WALLETCONNECT_PROJECT_ID, walletConfigured } from './wallet-config'

let wagmiAdapter = null
if (walletConfigured) {
  // BNB Smart Chain is the only network offered, so every wallet opens straight on BSC
  wagmiAdapter = new WagmiAdapter({ projectId: WALLETCONNECT_PROJECT_ID, networks: [bsc], ssr: false })
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [bsc],
    defaultNetwork: bsc,
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: 'Ameritec IPS',
      description: 'Ameritec IPS Pre-IPO share purchase',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    },
    features: { analytics: false, email: false, socials: false, onramp: false, swaps: false },
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#e61e32',
      '--w3m-font-family': "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
      '--w3m-border-radius-master': '2.5px',
      '--w3m-z-index': 100,
    },
    // Popular wallets first (MetaMask, Trust, Binance Web3, OKX, Coinbase, SafePal)
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
      '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4',
      '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709',
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
      '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150',
    ],
  })
}

export const wagmiConfig = wagmiAdapter?.wagmiConfig

export const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]
