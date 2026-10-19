/** What a permission list means for one area: 'manage', 'view' or null. */
export const levelFor = (permissions, key) => (permissions.includes(`${key}:manage`) ? 'manage' : permissions.includes(`${key}:view`) ? 'view' : null)

/** Super admins have everything; shown as a fixed card, not stored as a role. */
export const ADMINISTRATOR = { key: 'administrator', name: 'Administrator', description: 'Full administrative access across Ameritec IPS.', superAdmin: true, permissions: [] }
