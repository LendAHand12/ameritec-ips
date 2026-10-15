import env from '../config/env.js'

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

async function rpc(method, params) {
  const res = await fetch(env.bsc.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`BSC RPC HTTP ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(`BSC RPC: ${body.error.message}`)
  return body.result
}

const topicToAddress = (topic) => `0x${topic.slice(-40)}`.toLowerCase()

/**
 * Checks that `txHash` is a successful USDT (BEP20) transfer of at least `minAmountCents` to `toAddress`,
 * mined no earlier than `notBefore`.
 *
 * @returns {{ state: 'verified' | 'pending' | 'invalid', reason?: string, amountCents?: number, confirmations?: number }}
 * 'pending' = not mined yet or not enough confirmations — check again later.
 */
export async function verifyUsdtPayment({ txHash, toAddress, minAmountCents, notBefore }) {
  const receipt = await rpc('eth_getTransactionReceipt', [txHash])
  if (!receipt) {
    // Unknown or still in the mempool
    const tx = await rpc('eth_getTransactionByHash', [txHash])
    return tx ? { state: 'pending', reason: 'Transaction is not mined yet' } : { state: 'pending', reason: 'Transaction not found yet' }
  }
  if (receipt.status !== '0x1') return { state: 'invalid', reason: 'The transaction failed on-chain' }

  const usdt = env.bsc.usdtContract.toLowerCase()
  const to = toAddress.toLowerCase()
  const received = receipt.logs
    .filter((log) => log.address.toLowerCase() === usdt && log.topics[0] === TRANSFER_TOPIC && topicToAddress(log.topics[2] ?? '') === to)
    .reduce((sum, log) => sum + BigInt(log.data), 0n)

  if (received === 0n) return { state: 'invalid', reason: 'No USDT (BEP20) transfer to the payment address found in this transaction' }

  // USDT on BSC has 18 decimals; 1 cent = 10^16 units
  const receivedCents = Number(received / 10n ** 16n)
  if (receivedCents < minAmountCents) {
    return { state: 'invalid', reason: `Amount received (${(receivedCents / 100).toFixed(2)} USDT) is less than the order total`, amountCents: receivedCents }
  }

  const block = await rpc('eth_getBlockByNumber', [receipt.blockNumber, false])
  if (notBefore && Number(BigInt(block.timestamp)) * 1000 < notBefore.getTime()) {
    return { state: 'invalid', reason: 'This transaction was made before the order was created' }
  }

  const latest = BigInt(await rpc('eth_blockNumber', []))
  const confirmations = Number(latest - BigInt(receipt.blockNumber)) + 1
  if (confirmations < env.bsc.minConfirmations) {
    return { state: 'pending', reason: `Waiting for confirmations (${confirmations}/${env.bsc.minConfirmations})`, amountCents: receivedCents, confirmations }
  }

  return { state: 'verified', amountCents: receivedCents, confirmations }
}
