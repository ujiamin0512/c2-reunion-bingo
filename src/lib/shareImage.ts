// Saves a canvas as an image, preferring the native share sheet on mobile.
// iOS Safari and most in-app browsers (e.g. WeChat) ignore the `download`
// attribute for canvas-generated images — tapping it just opens/shows the
// image instead of saving it to the photo album. The Web Share API's file
// support opens the OS share sheet, where "存储图像"/"Save Image" reliably
// saves to the album. Falls back to a plain download link where Web Share
// with files isn't supported (desktop browsers).
export async function saveCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Canvas toBlob failed')

  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return // user closed the share sheet, not an error
      throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}
