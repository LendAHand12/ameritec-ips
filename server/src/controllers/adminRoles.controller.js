import AdminRole, { ensureDefaultRoles } from '../models/AdminRole.js'
import Admin from '../models/Admin.js'
import ApiError from '../utils/ApiError.js'
import { normalizePermissions } from '../config/permissions.js'
import { describeAudit, diff, summarizeChanges } from '../services/audit.service.js'

const roleRecord = (r) => ({ type: 'admin', id: r.id, ref: `Role: ${r.name}` })
const toDto = (r, adminCount = 0) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, adminCount, createdAt: r.createdAt })
const snapshot = (r) => ({ Name: r.name, Description: r.description || '—', Permissions: r.permissions.join(', ') || 'None' })

async function findRoleOrThrow(id) {
  const role = await AdminRole.findById(id)
  if (!role) throw new ApiError(404, 'Role not found')
  return role
}

async function assertNameFree(name, exceptId) {
  // strength 2: "kyc reviewer" and "KYC Reviewer" are the same name
  const clash = await AdminRole.findOne({ name, _id: { $ne: exceptId } }).collation({ locale: 'en', strength: 2 })
  if (clash) throw new ApiError(409, 'A role with this name already exists', { name: 'Already in use' })
}

export async function listRoles(req, res) {
  await ensureDefaultRoles()
  const [roles, counts] = await Promise.all([AdminRole.find().sort({ createdAt: 1 }), Admin.aggregate([{ $match: { roleRef: { $ne: null } } }, { $group: { _id: '$roleRef', n: { $sum: 1 } } }])])
  const byRole = Object.fromEntries(counts.map((c) => [String(c._id), c.n]))
  res.json({ data: roles.map((r) => toDto(r, byRole[r.id] ?? 0)) })
}

export async function createRole(req, res) {
  const { name, description, permissions } = req.body
  await assertNameFree(name)
  const role = await AdminRole.create({ name, description, permissions: normalizePermissions(permissions), createdBy: req.admin._id })
  describeAudit(req, { record: roleRecord(role), description: `Created role "${role.name}" with ${role.permissions.length} permissions` })
  res.status(201).json({ data: toDto(role) })
}

/** Changing a role changes the access of everyone who has it. */
export async function updateRole(req, res) {
  const role = await findRoleOrThrow(req.params.id)
  const before = snapshot(role)
  await assertNameFree(req.body.name, role._id)
  role.name = req.body.name
  role.description = req.body.description
  role.permissions = normalizePermissions(req.body.permissions)
  await role.save()
  const { modifiedCount } = await Admin.updateMany({ roleRef: role._id }, { $set: { permissions: role.permissions } })

  const changes = diff(before, snapshot(role))
  describeAudit(req, { record: roleRecord(role), changes, description: `${summarizeChanges(changes)}${modifiedCount ? ` — applied to ${modifiedCount} admin(s)` : ''}` })
  res.json({ data: toDto(role, modifiedCount) })
}

export async function deleteRole(req, res) {
  const role = await findRoleOrThrow(req.params.id)
  const inUse = await Admin.countDocuments({ roleRef: role._id })
  if (inUse) throw new ApiError(409, `${inUse} admin(s) still have this role. Give them another role first.`)
  await role.deleteOne()
  describeAudit(req, { record: roleRecord(role), description: `Deleted role "${role.name}"` })
  res.json({ data: { id: role.id } })
}
