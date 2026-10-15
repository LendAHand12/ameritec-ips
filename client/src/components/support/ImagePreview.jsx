import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Full-size view of an attached screenshot. */
export default function ImagePreview({ image, onClose }) {
  return (
    <DialogPrimitive.Root open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-[60] bg-black/80 duration-150 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0"
        />
        <DialogPrimitive.Popup className="fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none sm:p-10">
          <DialogPrimitive.Title className="sr-only">{image?.name}</DialogPrimitive.Title>
          {image && <img src={image.src} alt={image.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />}
          <DialogPrimitive.Close
            render={<Button variant="outline" className="absolute top-4 right-4 size-[50px] rounded-lg bg-card" aria-label="Close preview" />}
          >
            <XIcon className="size-[25px]" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
