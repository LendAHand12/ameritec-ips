import { useMemo, useState } from 'react'
import { ArrowRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/dashboard/Panel'
import { Spinner } from '@/components/ui/spinner'
import { useAsync } from '@/hooks/useAsync'
import { CATEGORY_LABEL, POPULAR_SEARCHES, SUPPORT_CATEGORIES, searchArticles } from '@/lib/support'
import { listArticles } from '@/services/support.service'
import { cn } from '@/lib/utils'

function ArticleRow({ article, open, onToggle, onRequest }) {
  const panelId = `article-${article.code}`
  return (
    <li className="border-t border-divider">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="grid w-full grid-cols-[auto_1fr_30px] items-center gap-[12.5px] px-[25px] py-[12.5px] text-left transition-colors hover:bg-muted/40 md:min-h-[82.5px] md:grid-cols-[87.5px_1fr_212.5px_30px]"
      >
        <span className="justify-self-start rounded-[6.25px] bg-primary-soft px-[8.75px] py-[6.25px] text-caption font-bold whitespace-nowrap text-primary">
          {article.code}
        </span>
        <span className="min-w-0 space-y-[5px]">
          <span className="block text-caption font-bold">{article.title}</span>
          <span className="block text-caption text-muted-foreground">{article.summary}</span>
        </span>
        <span className="hidden text-caption text-muted-foreground md:block">{CATEGORY_LABEL[article.category]}</span>
        <ArrowRightIcon className={cn('size-[25px] text-brand-muted transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="px-[25px] pb-5 md:pl-[125px]">
          <ol className="list-decimal space-y-1.5 rounded-lg bg-muted py-4 pr-4 pl-9 text-caption text-muted-foreground marker:font-semibold marker:text-foreground">
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <span className="text-caption text-muted-foreground">Still need help?</span>
            <Button type="button" variant="outline" className="h-9 bg-card font-bold" onClick={() => onRequest(article)}>
              Submit a request
              <ArrowRightIcon />
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Tab 1: search the help articles, browse by category, open an article's solution. */
export default function FindSolution({ onRequest }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [openCode, setOpenCode] = useState(null)
  const { data, error } = useAsync(listArticles, [])
  const articles = useMemo(() => searchArticles(data?.data ?? [], query, category), [data, query, category])

  return (
    <div className="space-y-[22.5px]">
      <section className="rounded-xl bg-brand-muted px-5 pt-[31.25px] pb-[26.25px] text-center shadow-[0_7.5px_11.25px_rgb(0_0_0/0.1)] sm:px-[35px]">
        <h2 className="text-2xl text-white">How can we help?</h2>
        <p className="pt-[6.25px] text-caption text-steel">Search the Support Center for guided solutions.</p>
        <label className="mx-auto mt-[21.25px] flex h-[60px] max-w-[825px] items-center gap-[12.5px] rounded-lg bg-card px-[16.25px] shadow-[0_5px_7.5px_rgb(0_0_0/0.12)] focus-within:ring-3 focus-within:ring-ring/40">
          <SearchIcon className="size-[25px] shrink-0 text-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by error code or keyword"
            aria-label="Search help articles"
            className="min-w-0 flex-1 bg-transparent text-title outline-none placeholder:text-foreground/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="flex size-[37.5px] items-center justify-center rounded-md text-subtle hover:bg-muted"
            >
              <XIcon className="size-5" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center justify-center gap-[6.25px] pt-[13.75px]">
          <span className="text-caption text-subtle">Popular:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className="rounded-full border border-white/12 bg-white/7 px-[8.75px] py-[5px] text-caption text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-title">Browse by category</h2>
        <p className="pt-[5px] text-caption text-muted-foreground">Choose a topic to narrow your search.</p>
        <div className="grid gap-[11.25px] pt-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORT_CATEGORIES.map((c) => {
            const selected = c.value === category
            const Icon = c.icon
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(selected ? '' : c.value)}
                className={cn(
                  'flex min-h-[72.5px] items-center gap-[11.25px] rounded-lg border bg-card px-[13.75px] py-[11.25px] text-left transition-colors hover:border-primary/50',
                  selected && 'border-primary bg-primary-soft/40',
                )}
              >
                <span className="flex size-[37.5px] shrink-0 items-center justify-center rounded-[8.75px] bg-primary-soft text-primary">
                  <Icon className="size-[25px]" />
                </span>
                <span className="flex-1 text-caption font-bold">{c.label}</span>
                {selected ? (
                  <XIcon className="size-5 text-primary" aria-hidden />
                ) : (
                  <ArrowRightIcon className="size-5 text-muted-foreground" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </section>

      <Panel className="px-0 pb-[5px]">
        <PanelHeader
          className="px-[25px]"
          title={category ? CATEGORY_LABEL[category] : 'Common Issues'}
          description="Open an article to see step-by-step solutions."
          action={
            <span className="rounded-full bg-muted px-2.5 py-[6.25px] text-caption text-muted-foreground">
              {articles.length} {articles.length === 1 ? 'article' : 'articles'}
            </span>
          }
        />
        {!data ? (
          <div className="mt-[17.5px] border-t border-divider py-12 text-center">
            {error ? (
              <p className="text-caption text-muted-foreground">Couldn’t load help articles. Please try again.</p>
            ) : (
              <Spinner className="mx-auto size-6 text-muted-foreground" />
            )}
          </div>
        ) : articles.length ? (
          <ul className="mt-[17.5px]">
            {articles.map((a) => (
              <ArticleRow
                key={a.code}
                article={a}
                open={openCode === a.code}
                onToggle={() => setOpenCode(openCode === a.code ? null : a.code)}
                onRequest={onRequest}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-[17.5px] border-t border-divider px-[25px] py-12 text-center">
            <p className="text-caption text-muted-foreground">No articles match your search.</p>
            <Button type="button" variant="outline" className="mt-3 h-9 bg-card font-bold" onClick={() => onRequest({ category })}>
              Submit a request instead
              <ArrowRightIcon />
            </Button>
          </div>
        )}
      </Panel>
    </div>
  )
}
