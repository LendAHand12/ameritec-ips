import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="text-5xl font-semibold">404</div>
      <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link to="/" className={buttonVariants({ variant: 'outline' })}>Go home</Link>
    </div>
  )
}
