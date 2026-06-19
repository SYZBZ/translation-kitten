export function getFittedPdfViewportScale(
  pageWidth: number,
  availableWidth: number,
  preferredScale = 1.35,
) {
  if (pageWidth <= 0 || preferredScale <= 0) {
    return 1
  }

  if (availableWidth <= 0) {
    return Math.min(1, preferredScale)
  }

  return Math.min(preferredScale, availableWidth / pageWidth)
}
