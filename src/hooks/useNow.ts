import { useEffect, useState } from 'react'

/** Current time, refreshed every `intervalMs` so "Updated X ago" and live wild windows stay current. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
