import { Fragment, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from 'lucide-react'
import Logo from '@/components/brand/Logo'
import { LEGAL_DOCS } from '@/lib/legal'
import { cn } from '@/lib/utils'

/** "**bold**" markers in the document text */
function Inline({ text }) {
  return text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))
}

function Block({ b }) {
  switch (b.t) {
    case 'center':
      return <p className={cn('text-center', b.b ? 'font-bold' : 'text-muted-foreground')}>{b.x}</p>
    case 'h2':
      return <h2 className="pt-6 text-subheading font-bold">{b.x}</h2>
    case 'h3':
      return <h3 className="pt-2 text-title font-semibold">{b.x}</h3>
    case 'li':
      return (
        <li className="ml-5 list-disc pl-1">
          <Inline text={b.x} />
        </li>
      )
    case 'ack':
      return (
        <p className="pl-4 -indent-4">
          <Inline text={b.x} />
        </p>
      )
    case 'field':
      return <p className="font-mono text-caption break-all text-muted-foreground">{b.x}</p>
    default:
      return (
        <p>
          <Inline text={b.x} />
        </p>
      )
  }
}

/** Public page showing one of the offering documents (Regulation D / Regulation S). */
export default function LegalPage() {
  const { doc } = useParams()
  const entry = LEGAL_DOCS[doc]
  useEffect(() => {
    if (entry) document.title = `${entry.title} — Ameritec IPS`
    window.scrollTo(0, 0)
  }, [entry])
  if (!entry) return <Navigate to="/404" replace />

  const firstSection = entry.blocks.findIndex((b) => b.t === 'h2')
  const intro = entry.blocks.slice(0, firstSection === -1 ? 0 : firstSection)
  const body = entry.blocks.slice(firstSection === -1 ? 0 : firstSection)

  return (
    <div className="min-h-svh bg-muted">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-[72px] w-full max-w-[900px] items-center justify-between gap-4 px-4">
          <Logo />
          <div className="flex items-center gap-4 text-caption font-semibold">
            {Object.entries(LEGAL_DOCS)
              .filter(([k]) => k !== doc)
              .map(([k, v]) => (
                <Link key={k} to={`/legal/${k}`} className="text-primary hover:underline">
                  {v.short}
                </Link>
              ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] px-4 py-8">
        <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/register'))} className="mb-4 inline-flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline">
          <ArrowLeftIcon className="size-4" />
          Back
        </button>
        <article className="space-y-3 rounded-xl border bg-card p-6 text-sm leading-relaxed shadow-sm sm:p-10">
          <div className="space-y-1 pb-4">
            {intro.map((b, i) => (
              <Block key={i} b={b} />
            ))}
          </div>
          {body.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </article>
        <p className="pt-4 text-center text-caption text-muted-foreground">This document is provided for information only and is not an offer where such an offer would be unlawful.</p>
      </main>
    </div>
  )
}
