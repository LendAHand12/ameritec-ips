import env from '../config/env.js'
import User, { ACCOUNT_STATUS, USER_STATUS } from '../models/User.js'
import Withdrawal from '../models/Withdrawal.js'
import { getBalanceCents } from '../models/WalletTransaction.js'
import ApiError from '../utils/ApiError.js'
import { fromCents } from '../utils/money.js'
import { verifyTwoFactorCode } from './twoFactor.service.js'
import { notifyWithdrawalRequested } from './telegram.service.js'

export const BEP20_ADDRESS = /^0x[0-9a-fA-F]{40}$/
export const minWithdrawalCents = () => Math.round(env.withdrawal.minUsdt * 100)

/** Sensitive actions (saving a wallet, withdrawing) need a fresh authenticator code. */
export async function assertTwoFactor(userId, code) {
  const user = await User.findById(userId).select('+twoFactor.secret +twoFactor.lastUsedStep')
  const step = user?.twoFactor?.secret ? verifyTwoFactorCode(user.twoFactor.secret, code, user.twoFactor.lastUsedStep) : null
  if (step === null) {
    throw new ApiError(400, 'Incorrect or already used code — wait for the next one', { code: 'Incorrect or already used code' }, 'CODE_INVALID')
  }
  user.twoFactor.lastUsedStep = step
  await user.save()
}

/**
 * Re-authenticates before a sensitive change (saving a wallet, withdrawing, changing the phone). Users with
 * two-factor enabled give a fresh authenticator code; everyone else confirms their password.
 */
export async function assertSensitiveAuth(userId, { code, password } = {}) {
  const user = await User.findById(userId).select('+password +twoFactor.secret +twoFactor.lastUsedStep')
  if (user?.twoFactor?.enabled) {
    if (!code) throw new ApiError(400, 'Enter the 6-digit code', { code: 'Enter the 6-digit code' }, 'CODE_INVALID')
    return assertTwoFactor(userId, code)
  }
  if (!password) throw new ApiError(400, 'Enter your password', { password: 'Enter your password' }, 'PASSWORD_INVALID')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(400, 'Incorrect password', { password: 'Incorrect password' }, 'PASSWORD_INVALID')
  }
}

/** Creates a withdrawal for `user` (a loaded User). The code must already be verified. */
export async function requestWithdrawal(user, amountCents) {
  if (user.status === USER_STATUS.REJECTED || user.accountStatus !== ACCOUNT_STATUS.ACTIVE || user.deletedAt) {
    throw new ApiError(403, 'Your account can’t withdraw right now', undefined, 'WITHDRAW_NOT_ALLOWED')
  }
  if (!user.faceVerified) {
    throw new ApiError(403, 'Complete your face scan and wait for it to be approved before withdrawing commission', undefined, 'FACE_SCAN_REQUIRED')
  }
  const address = user.withdrawalWallet?.address
  if (!address) throw new ApiError(400, 'Add a withdrawal wallet first', { address: 'No withdrawal wallet saved' }, 'NO_WALLET')
  if (amountCents < minWithdrawalCents()) {
    const msg = `Minimum withdrawal is ${fromCents(minWithdrawalCents()).toFixed(2)} USDT`
    throw new ApiError(400, msg, { amount: msg })
  }
  if (amountCents > (await getBalanceCents(user._id))) {
    throw new ApiError(400, 'Amount is more than your available balance', { amount: 'More than available balance' }, 'INSUFFICIENT_BALANCE')
  }

  const withdrawal = await Withdrawal.create({ user: user._id, amountCents, address })
  // Two requests racing could both have passed the check above: if we're now overdrawn, back this one out
  if ((await getBalanceCents(user._id)) < 0) {
    await Withdrawal.deleteOne({ _id: withdrawal._id })
    throw new ApiError(409, 'Another withdrawal was requested at the same time. Please check your balance and try again.', undefined, 'INSUFFICIENT_BALANCE')
  }

  notifyWithdrawalRequested(withdrawal, user)
  return withdrawal
}
