import { PERMISSIONS, PERMISSION_LEVELS, PERMISSION_MODULES, ADMIN_ROLES, normalizePermissions } from '../config/permissions.js'
import Admin from '../models/Admin.js'
import AdminRole from '../models/AdminRole.js'
import ApiError from '../utils/ApiError.js'
import { describeAudit, diff, summarizeChanges } from '../services/audit.service.js'
import { getSettings } from '../models/Setting.js'
import { isAllowed, normalizeIp, parseEntry } from '../services/ipWhitelist.service.js'

const adminRecord = (a) => ({ type: 'admin', id: a.id, ref: a.email })

const toDto = (a) => ({
  id: a.id,
  fullName: a.fullName,
  email: a.email,
  role: a.role,
  permissions: a.isSuperAdmin() ? PERMISSIONS : a.permissions,
  roleId: a.roleRef ? String(a.roleRef) : null,
  isActive: a.isActive,
  lastLoginAt: a.lastLoginAt ?? null,
  createdAt: a.createdAt,
})

/** Access for a request: the chosen role's permissions, otherwise the list that was sent. */
async function resolveAccess({ roleId, permissions }) {
  if (!roleId) return { roleRef: null, permissions: normalizePermissions(permissions) }
  const role = await AdminRole.findById(roleId)
  if (!role) throw new ApiError(400, 'That role no longer exists', { roleId: 'Not found' })
  return { roleRef: role._id, permissions: role.permissions }
}

const snapshot = (a) => ({
  Name: a.fullName,
  Active: a.isActive,
  Permissions: a.permissions.join(', ') || 'None',
})

/** Super admins are managed outside the portal; nobody edits their own account here. */
async function findManageableOrThrow(req) {
  const target = await Admin.findById(req.params.id)
  if (!target) throw new ApiError(404, 'Admin not found')
  if (target.isSuperAdmin()) throw new ApiError(403, 'Super admin accounts cannot be changed here')
  return target
}

export function getMeta(req, res) {
  res.json({ data: { modules: PERMISSION_MODULES, levels: PERMISSION_LEVELS } })
}

export async function listAdmins(req, res) {
  const admins = await Admin.find().sort({ createdAt: 1 })
  res.json({ data: admins.map(toDto) })
}

export async function createAdmin(req, res) {
  const { fullName, email, password } = req.body
  const access = await resolveAccess(req.body)
  if (await Admin.exists({ email })) throw new ApiError(409, 'An admin with this email already exists', { email: 'Already in use' })

  const admin = await Admin.create({
    fullName,
    email,
    password,
    role: ADMIN_ROLES.SUB,
    roleRef: access.roleRef,
    permissions: access.permissions,
    createdBy: req.admin._id,
  })
  describeAudit(req, { record: adminRecord(admin), description: `Created sub admin with ${admin.permissions.length} permissions` })
  res.status(201).json({ data: toDto(admin) })
}

export async function updateAdmin(req, res) {
  const admin = await findManageableOrThrow(req)
  const before = snapshot(admin)
  admin.fullName = req.body.fullName
  admin.isActive = req.body.isActive
  const access = await resolveAccess(req.body)
  admin.roleRef = access.roleRef
  admin.permissions = access.permissions
  await admin.save()

  const changes = diff(before, snapshot(admin))
  describeAudit(req, { record: adminRecord(admin), changes, description: summarizeChanges(changes) })
  res.json({ data: toDto(admin) })
}

export async function resetAdminPassword(req, res) {
  const admin = await findManageableOrThrow(req)
  admin.password = req.body.password
  await admin.save()
  describeAudit(req, { record: adminRecord(admin), description: 'Password reset by a super admin' })
  res.json({ data: toDto(admin) })
}

/** Removes a sub admin for good. Their past actions stay in the audit log (it keeps a name/email snapshot). */
export async function deleteAdmin(req, res) {
  const admin = await findManageableOrThrow(req)
  await admin.deleteOne()
  describeAudit(req, { record: adminRecord(admin), description: `Deleted sub admin ${admin.fullName} (${admin.email})` })
  res.json({ data: { id: admin.id } })
}

// ---------- IP whitelist ----------

const whitelistDto = (settings, currentIp) => ({
  enabled: settings.adminIpWhitelist.enabled,
  entries: settings.adminIpWhitelist.entries.map((e) => ({ ip: e.ip, note: e.note ?? '', addedAt: e.addedAt })),
  currentIp: normalizeIp(currentIp),
  currentIpAllowed: isAllowed(currentIp, settings.adminIpWhitelist.entries),
})

export async function getIpWhitelist(req, res) {
  res.json({ data: whitelistDto(await getSettings(), req.ip) })
}

/** Replaces the list and the on/off switch. Refuses a setup that would lock the person saving it out. */
export async function updateIpWhitelist(req, res) {
  const { enabled } = req.body
  const seen = new Set()
  const entries = []
  const errors = {}
  req.body.entries.forEach((e, i) => {
    const parsed = parseEntry(e.ip)
    if (!parsed) errors[`entries.${i}.ip`] = 'Not a valid IP address or range'
    else if (!seen.has(parsed.value)) {
      seen.add(parsed.value)
      entries.push({ ip: parsed.value, note: e.note || undefined, addedAt: undefined })
    }
  })
  if (Object.keys(errors).length) throw new ApiError(400, 'Some IP addresses are not valid', errors)
  if (enabled && !entries.length) throw new ApiError(400, 'Add at least one IP address before turning the whitelist on')
  if (enabled && !isAllowed(req.ip, entries)) {
    throw new ApiError(400, `Your current IP (${normalizeIp(req.ip)}) is not in the list. Add it first, or you would lock yourself out.`, undefined, 'WOULD_LOCK_OUT')
  }

  const settings = await getSettings()
  const before = { Enabled: settings.adminIpWhitelist.enabled, IPs: settings.adminIpWhitelist.entries.map((e) => e.ip).join(', ') || 'None' }
  const previous = new Map(settings.adminIpWhitelist.entries.map((e) => [e.ip, e.addedAt]))
  settings.adminIpWhitelist.enabled = enabled
  settings.adminIpWhitelist.entries = entries.map((e) => ({ ...e, addedAt: previous.get(e.ip) ?? new Date() }))
  await settings.save()

  const after = { Enabled: enabled, IPs: entries.map((e) => e.ip).join(', ') || 'None' }
  const changes = diff(before, after)
  describeAudit(req, { description: summarizeChanges(changes) || 'IP whitelist saved', changes })
  res.json({ data: whitelistDto(settings, req.ip) })
}
