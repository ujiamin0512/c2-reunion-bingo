// Saves a canvas as an image, preferring the native share sheet on mobile.
// iOS Safari and most in-app browsers (e.g. WeChat) ignore the `download`
// attribute for canvas-generated images — tapping it just opens/shows the
// image instead of saving it to the photo album. The Web Share API's file
// support opens the OS share sheet, where "存储图像"/"Save Image" reliably
// saves to the album. Falls back to a plain download link where Web Share
// with files isn't supported (desktop browsers), or where share() itself
// fails — notably Chrome on Android, which requires share() to fire within
// a short "user activation" window after the tap; the html2canvas render +
// toBlob() above already eat most of that window, so share() there commonly
// throws NotAllowedError even though the button really was just tapped.
// Falling back instead of surfacing that as an error keeps the download
// working everywhere, even where the nicer share-sheet flow can't fire.
export async function saveCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Canvas toBlob failed')

  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return // user closed the share sheet, not an error
      // Any other failure (e.g. Chrome's activation-window rejection): fall
      // through to the plain download link below instead of erroring out.
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
