import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { generateReferralCode } from '../utils/referralCode.js'

export const DOCUMENT_TYPES = ['national_id', 'passport', 'drivers_license']
export const USER_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' }
export const FACE_STATUS = { NONE: 'none', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' }
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
    // True only once an admin approved the face scan (it is optional at sign-up and can be added later)
    faceVerified: { type: Boolean, default: false },
    face: {
      status: { type: String, enum: Object.values(FACE_STATUS), default: FACE_STATUS.NONE },
      image: String, // file in storage/kyc, never served statically
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      rejectionReason: String,
    },
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

    // Soft delete: the row stays for history, but its email / phone are freed for new accounts
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedSnapshot: { email: String, phone: String, applicationId: String, referralCode: String, reason: String },

    // Where commission withdrawals are paid (USDT, BNB Smart Chain). Changing it needs an authenticator code.
    withdrawalWallet: { address: String, updatedAt: Date },

    passwordReset: { type: emailVerificationSchema, select: false },
    passwordChangedAt: Date,
    // "Sign out of other devices": sessions issued before this are no longer valid
    sessionsRevokedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password
        delete ret.emailVerification
        if (ret.face) delete ret.face.image
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
