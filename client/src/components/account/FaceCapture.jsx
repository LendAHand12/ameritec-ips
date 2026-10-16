import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraIcon, ImageUpIcon, RotateCcwIcon, ScanFaceIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useObjectUrl } from '@/hooks/useObjectUrl'

const MAX_MB = 10
const ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * Face scan photo: take a selfie with the camera, or choose a photo if there's no camera.
 * Controlled: `value` is a File (or null), `onChange(file | null)` reports the photo to keep.
 */
export default function FaceCapture({ value, onChange, disabled }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInput = useRef(null)
  const [camera, setCamera] = useState('off') // 'off' | 'starting' | 'live'
  const [error, setError] = useState('')
  const preview = useObjectUrl(value)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamera('off')
  }, [])
  useEffect(() => stopCamera, [stopCamera])

  const startCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) return setError('This browser can’t open the camera. Choose a photo instead.')
    setCamera('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      setCamera('live')
      // The <video> mounts on the next render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setCamera('off')
      setError('We couldn’t use your camera. Allow camera access in your browser, or choose a photo instead.')
    }
  }

  const snap = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, 960)
    // Centre-crop to a square
    canvas.getContext('2d').drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError('Couldn’t take the photo. Please try again.')
        onChange(new File([blob], 'face-scan.jpg', { type: 'image/jpeg' }))
        stopCamera()
      },
      'image/jpeg',
      0.92,
    )
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) return setError('Use a JPG, PNG or WebP photo.')
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The photo must be under ${MAX_MB} MB.`)
    setError('')
    onChange(file)
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border bg-muted">
        {preview ? (
          <img src={preview} alt="Your face scan" className="size-full object-cover" />
        ) : camera === 'live' ? (
          <>
            <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
            {/* Face guide */}
            <span aria-hidden className="pointer-events-none absolute inset-[14%] rounded-[50%] border-2 border-dashed border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/0.28)]" />
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            {camera === 'starting' ? <Spinner className="size-8" /> : <ScanFaceIcon className="size-12" />}
            <p className="text-caption">{camera === 'starting' ? 'Starting camera…' : 'Face the camera in good light, without hats or sunglasses.'}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {value ? (
          <Button type="button" variant="outline" onClick={() => onChange(null)} disabled={disabled}>
            <RotateCcwIcon />
            Retake
          </Button>
        ) : camera === 'live' ? (
          <>
            <Button type="button" onClick={snap} disabled={disabled} className="shadow-brand">
              <CameraIcon />
              Take photo
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={startCamera} disabled={disabled || camera === 'starting'}>
              <CameraIcon />
              Open camera
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={disabled}>
              <ImageUpIcon />
              Choose a photo
            </Button>
          </>
        )}
        <input ref={fileInput} type="file" accept={ACCEPT} capture="user" className="sr-only" onChange={onFile} tabIndex={-1} />
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
