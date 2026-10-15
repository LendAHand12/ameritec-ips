import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { generateReferralCode } from '../utils/referralCode.js'

export const DOCUMENT_TYPES = ['national_id', 'passport', 'drivers_license']
export const USER_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' }
export const ACCOUNT_STATUS = { ACTIVE: 'active', LOCKED: 'locked' }

const emailVerificationSchema = new mongoose.Schema(
  {
    codeHash: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    lastSentAt: Date,
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    phoneCountry: { type: String, uppercase: true },
    password: { type: String, required: true, select: false },

    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    identity: {
      documentType: { type: String, enum: DOCUMENT_TYPES },
      frontImage: String,
      backImage: String,
      supportingImage: String,
    },
    faceVerified: { type: Boolean, default: false },
    termsAcceptedAt: Date,

    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      // Last accepted TOTP time-step, prevents replaying the same code
      lastUsedStep: { type: Number, select: false },
    },

    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    emailVerification: { type: emailVerificationSchema, select: false },

    applicationId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.PENDING, index: true },
    rejectionReason: String,

    // Independent of KYC: an admin can lock any account
    accountStatus: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE, index: true },
    lockedAt: Date,
    lockedReason: String,
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password
        delete ret.emailVerification
        delete ret.__v
        if (ret.twoFactor) {
          delete ret.twoFactor.secret
          delete ret.twoFactor.lastUsedStep
        }
        return ret
      },
    },
  },
)

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12)
  }
  if (!this.referralCode) {
    do this.referralCode = generateReferralCode()
    while (await this.constructor.exists({ referralCode: this.referralCode }))
  }
})

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('User', userSchema)
