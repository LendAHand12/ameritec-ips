import mongoose from 'mongoose'
import { PERMISSIONS } from '../config/permissions.js'

/** A named set of permissions that can be given to sub admins ("KYC Reviewer", "Operations", …). */
const adminRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: { type: [{ type: String, enum: PERMISSIONS }], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
)

const DEFAULT_ROLES = [
  {
    name: 'Operations',
    description: 'Manages transactions, referrals, and approved operations.',
    permissions: ['overview:view', 'users:view', 'orders:manage', 'referrals:manage', 'parameters:view'],
  },
  { name: 'KYC Reviewer', description: 'Reviews investor identity verification applications.', permissions: ['overview:view', 'users:manage'] },
  { name: 'Support Agent', description: 'Manages investor requests and approved support guidance.', permissions: ['overview:view', 'users:view', 'support:manage'] },
]

const AdminRole = mongoose.model('AdminRole', adminRoleSchema)
export default AdminRole

/** First use: start the list with the three common roles (they can be edited or deleted like any other). */
export async function ensureDefaultRoles() {
  if ((await AdminRole.estimatedDocumentCount()) === 0) {
    await AdminRole.insertMany(DEFAULT_ROLES, { ordered: false }).catch(() => {})
  }
}
