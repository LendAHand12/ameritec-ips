import { useEffect, useState } from 'react'

/** Resolves CSS custom properties to concrete colours (SVG attributes can't use var()). */
export function useCssVars(names) {
  const key = names.join('|')
  const read = () => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]))
  }
  const [values, setValues] = useState(read)

  useEffect(() => {
    setValues(read())
    // Re-read when the theme class flips (light/dark)
    const observer = new MutationObserver(() => setValues(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return values
}
