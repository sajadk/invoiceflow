import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable function that only calls `callback` once the caller has
 * stopped calling it for `delay` ms. Used for search-as-you-type.
 *
 * The "latest ref" pattern: the timer always calls the newest `callback`,
 * without the returned function changing identity on every render.
 */
export function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delay: number) {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    callbackRef.current = callback
  })

  // Clear a pending call if the component unmounts.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return useCallback(
    (...args: Args) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay)
    },
    [delay],
  )
}
