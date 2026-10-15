import { useEffect, useState } from 'react'

/** Seconds remaining, ticking down to 0. Call start(seconds) to (re)start. */
export function useCountdown(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  return [seconds, setSeconds]
}
