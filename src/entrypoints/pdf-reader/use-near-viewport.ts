import { useCallback, useEffect, useState } from "react"

export function useNearViewport(eager = false) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [isNear, setIsNear] = useState(() => eager || typeof IntersectionObserver === "undefined")
  const nearRef = useCallback((node: HTMLElement | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element || typeof IntersectionObserver === "undefined") {
      if (element)
        setIsNear(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => setIsNear(entries.some(entry => entry.isIntersecting)),
      { rootMargin: "1200px 0px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { isNear, nearRef }
}
