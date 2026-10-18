import Order, { ORDER_STATUS } from '../models/Order.js'
import { getSettings } from '../models/Setting.js'
import User from '../models/User.js'
import { fromCents } from '../utils/money.js'
import { roundShares } from '../utils/shares.js'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0))

// Same population the Users page works with: finished registrations only
const BASE_FILTER = { emailVerified: true, deletedAt: null }

/** Resolves the requested period (and the equally long one before it) into dates. */
function resolvePeriod({ range, from, to }) {
  const todayStart = startOfDay(new Date())
  let start
  let end = new Date(todayStart.getTime() + DAY) // exclusive
  if (range === 'today') start = todayStart
  else if (range === '7') start = new Date(end.getTime() - 7 * DAY)
  else if (range === 'custom' && from && to) {
    start = startOfDay(from)
    end = new Date(startOfDay(to).getTime() + DAY)
  } else start = new Date(end.getTime() - 30 * DAY)
  const length = end.getTime() - start.getTime()
  return { start, end, prevStart: new Date(start.getTime() - length), unit: length <= DAY ? 'hour' : 'day' }
}

const bucketFormat = (unit) => (unit === 'hour' ? '%Y-%m-%dT%H' : '%Y-%m-%d')

/** Every bucket key between start and end, so quiet days still appear as zeros. */
function bucketKeys(start, end, unit) {
  const step = unit === 'hour' ? HOUR : DAY
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(unit === 'hour' && { hour: '2-digit', hourCycle: 'h23' }),
  })
  const keys = []
  for (let t = start.getTime() + step / 2; t < end.getTime(); t += step) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    keys.push(unit === 'hour' ? `${p.year}-${p.month}-${p.day}T${p.hour}` : `${p.year}-${p.month}-${p.day}`)
  }
  return keys
}

const countByBucket = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]))

export async function getOverview(req, res) {
  const { start, end, prevStart, unit } = resolvePeriod(req.validatedQuery)
  const format = bucketFormat(unit)
  const inPeriod = { $gte: start, $lt: end }
  const completed = { status: ORDER_STATUS.COMPLETED }
  const completedAt = { $ifNull: ['$completedAt', '$createdAt'] }

  const [settings, usersBefore, newUserRows, volumeRows, prevVolume, sold, byStatus] = await Promise.all([
    getSettings(),
    User.countDocuments({ ...BASE_FILTER, createdAt: { $lt: start } }),
    User.aggregate([
      { $match: { ...BASE_FILTER, createdAt: inPeriod } },
      { $group: { _id: { $dateToString: { format, date: '$createdAt', timezone: TIME_ZONE } }, n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: completed },
      { $addFields: { at: completedAt } },
      { $match: { at: inPeriod } },
      { $group: { _id: { $dateToString: { format, date: '$at', timezone: TIME_ZONE } }, cents: { $sum: '$amountCents' } } },
    ]),
    Order.aggregate([
      { $match: completed },
      { $addFields: { at: completedAt } },
      { $match: { at: { $gte: prevStart, $lt: start } } },
      { $group: { _id: null, cents: { $sum: '$amountCents' } } },
    ]),
    Order.aggregate([{ $match: completed }, { $group: { _id: '$shareType', shares: { $sum: '$shares' } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])

  const keys = bucketKeys(start, end, unit)
  const newUsers = countByBucket(newUserRows)
  const cents = Object.fromEntries(volumeRows.map((r) => [r._id, r.cents]))
  let running = usersBefore
  const growth = keys.map((key) => {
    running += newUsers[key] ?? 0
    return { key, newUsers: newUsers[key] ?? 0, totalUsers: running }
  })
  const volume = keys.map((key) => ({ key, volume: fromCents(cents[key] ?? 0) }))

  const volumeTotal = volume.reduce((sum, v) => sum + v.volume, 0)
  const volumePrevious = fromCents(prevVolume[0]?.cents ?? 0)

  const soldBy = Object.fromEntries(['A', 'B'].map((t) => [t, roundShares(sold.find((r) => r._id === t)?.shares ?? 0)]))
  const total = settings.allocation.A + settings.allocation.B
  const soldTotal = roundShares(soldBy.A + soldBy.B)
  const counts = Object.fromEntries(byStatus.map((r) => [r._id, r.n]))

  res.json({
    data: {
      period: { from: start, to: end, unit },
      users: {
        total: running,
        newInPeriod: growth.reduce((sum, g) => sum + g.newUsers, 0),
      },
      growth,
      volume: {
        total: volumeTotal,
        previous: volumePrevious,
        // null when there is no earlier volume to compare with
        changePct: volumePrevious > 0 ? ((volumeTotal - volumePrevious) / volumePrevious) * 100 : null,
        series: volume,
      },
      shares: { total, sold: soldTotal, remaining: Math.max(0, roundShares(total - soldTotal)), A: soldBy.A, B: soldBy.B },
      orders: {
        completed: counts[ORDER_STATUS.COMPLETED] ?? 0,
        pending: counts[ORDER_STATUS.PENDING_REVIEW] ?? 0,
        processing: (counts[ORDER_STATUS.VERIFYING] ?? 0) + (counts[ORDER_STATUS.AWAITING_PAYMENT] ?? 0) + (counts[ORDER_STATUS.PAYING] ?? 0),
        failed: (counts[ORDER_STATUS.REJECTED] ?? 0) + (counts[ORDER_STATUS.CANCELLED] ?? 0),
      },
    },
  })
}
