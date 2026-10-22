import net from 'net'

/** `::ffff:1.2.3.4` is just 1.2.3.4 and `::1` is this machine, so a whitelist entry matches either way. */
export function normalizeIp(ip = '') {
  const v = String(ip).trim()
  if (v === '::1') return '127.0.0.1'
  return v.replace(/^::ffff:/i, '')
}

/** An exact address ("203.0.113.7", "2001:db8::1") or an address range ("203.0.113.0/24"). Returns null if invalid. */
export function parseEntry(raw) {
  const value = normalizeIp(raw)
  const [address, prefix, ...rest] = value.split('/')
  const family = net.isIP(address)
  if (!family || rest.length) return null
  if (prefix === undefined) return { value: address, address, family: family === 4 ? 'ipv4' : 'ipv6', prefix: null }
  const bits = Number(prefix)
  const max = family === 4 ? 32 : 128
  if (!/^\d+$/.test(prefix) || bits < 0 || bits > max) return null
  return { value: `${address}/${bits}`, address, family: family === 4 ? 'ipv4' : 'ipv6', prefix: bits }
}

export function isAllowed(ip, entries) {
  const address = normalizeIp(ip)
  const family = net.isIP(address)
  if (!family) return false
  const list = new net.BlockList()
  for (const entry of entries) {
    const parsed = parseEntry(entry.ip ?? entry)
    if (!parsed) continue
    if (parsed.prefix === null) list.addAddress(parsed.address, parsed.family)
    else list.addSubnet(parsed.address, parsed.prefix, parsed.family)
  }
  return list.check(address, family === 4 ? 'ipv4' : 'ipv6')
}
