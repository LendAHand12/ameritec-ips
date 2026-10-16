import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useAccount, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { erc20Abi, formatUnits, parseUnits } from 'viem'
import { useAppKit, useDisconnect, useWalletInfo } from '@reown/appkit/react'
import WalletPanel from '@/components/trade/WalletPanel'
import { ERC20_TRANSFER_ABI, wagmiConfig } from '@/lib/wallet'
import * as trade from '@/services/trade.service'

const queryClient = new QueryClient()

function friendlyError(err) {
  const text = `${err?.name ?? ''} ${err?.shortMessage ?? ''} ${err?.message ?? ''}`
  if (/reject|denied|cancel/i.test(text) || err?.code === 4001) return 'You cancelled the transaction in your wallet. Press Pay to try again.'
  if (/insufficient/i.test(text)) return 'Your wallet doesn’t have enough USDT (or BNB for the network fee).'
  return err?.shortMessage ?? err?.message ?? 'Something went wrong. Please try again.'
}

function Inner({ order, method, onSubmitted, autoOpen }) {
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const { walletInfo } = useWalletInfo()
  const { address, isConnected, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState(null) // 'sending' | 'submitting'
  const [error, setError] = useState('')
  // Once the transfer is on-chain we only ever need to (re)submit it, never send again
  const [sentHash, setSentHash] = useState(null)

  // Show the wallet list straight away so the customer only has to pick theirs
  const opened = useRef(false)
  useEffect(() => {
    if (!autoOpen || isConnected || opened.current) return
    opened.current = true
    open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: rawBalance } = useReadContract({
    abi: erc20Abi,
    address: method.contract,
    functionName: 'balanceOf',
    args: [address],
    chainId: method.chainId,
    query: { enabled: isConnected && !!address, refetchInterval: 15_000 },
  })
  const balance = rawBalance == null ? null : Number(formatUnits(rawBalance, method.decimals))

  const submit = async (txHash) => {
    setBusy('submitting')
    try {
      const { order: updated } = await trade.submitPayment(order.id, { method: 'bep20', txHash })
      onSubmitted(updated)
    } catch (err) {
      setError(err.details?.txHash ?? err.message)
    } finally {
      setBusy(null)
    }
  }

  const pay = async () => {
    setError('')
    if (sentHash) return submit(sentHash)
    setBusy('sending')
    try {
      if (chainId !== method.chainId) await switchChainAsync({ chainId: method.chainId })
      const hash = await writeContractAsync({
        abi: ERC20_TRANSFER_ABI,
        address: method.contract,
        functionName: 'transfer',
        args: [method.address, parseUnits(order.amount.toFixed(2), method.decimals)],
        chainId: method.chainId,
      })
      setSentHash(hash)
      await submit(hash)
    } catch (err) {
      setError(friendlyError(err))
      setBusy(null)
    }
  }

  return (
    <WalletPanel
      amount={order.amount}
      address={isConnected ? address : null}
      walletName={walletInfo?.name}
      walletIcon={walletInfo?.icon}
      networkOk={chainId === method.chainId}
      balance={balance}
      busy={busy}
      error={error}
      sentHash={sentHash}
      onConnect={() => open()}
      onChange={() => open()}
      onDisconnect={() => disconnect()}
      onPay={pay}
    />
  )
}

/** "Pay with wallet": connect through WalletConnect, send the USDT transfer, hand the tx hash to the server. */
export default function WalletPayment(props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Inner {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
