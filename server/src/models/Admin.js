import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { ADMIN_MANAGEMENT, ADMIN_ROLES, PERMISSIONS, grants } from '../config/permissions.js'

/** Back-office accounts. Kept in their own collection, completely separate from customer `users`. */
const adminSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    // Accounts created before roles existed have no stored role and keep full access
    role: { type: String, enum: Object.values(ADMIN_ROLES), default: ADMIN_ROLES.SUPER },
    permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] }, // sub admins only
    // The role these permissions came from (kept in step when the role changes); empty = set individually
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminRole', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    isActive: { type: Boolean, default: true },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      // Last accepted TOTP time-step, prevents replaying the same code
      lastUsedStep: { type: Number, select: false },
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password
        if (ret.twoFactor) {
          delete ret.twoFactor.secret
          delete ret.twoFactor.lastUsedStep
        }
        ret.permissions = doc.effectivePermissions()
        delete ret.__v
        return ret
      },
    },
  },
)

adminSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12)
})

adminSchema.methods.isSuperAdmin = function () {
  return this.role === ADMIN_ROLES.SUPER
}

adminSchema.methods.effectivePermissions = function () {
  return this.isSuperAdmin() ? [...PERMISSIONS, ADMIN_MANAGEMENT] : this.permissions
}

adminSchema.methods.can = function (permission) {
  return this.isSuperAdmin() || grants(this.permissions, permission)
}

adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('Admin', adminSchema)
