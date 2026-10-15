import { useMemo, useState } from 'react'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import FilterSelect from '@/components/admin/FilterSelect'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { useAsync } from '@/hooks/useAsync'
import { useDebounced } from '@/hooks/useDebounced'
import { formatDate, formatInt } from '@/lib/format'
import { CATEGORY_LABEL, SUPPORT_CATEGORIES } from '@/lib/support'
import { cn } from '@/lib/utils'
import { listSupportArticles } from '@/services/admin.service'
import ArticleDialog from './ArticleDialog'

const th = 'border-y border-divider bg-muted px-[15px] py-[12.5px] text-left text-caption font-semibold whitespace-nowrap text-muted-foreground'
const td = 'border-b border-divider px-[15px] py-[16.25px] text-caption'
const VISIBILITY = [
  { value: 'true', label: 'Published' },
  { value: 'false', label: 'Hidden' },
]
const selectClass = 'h-[42.5px] w-full rounded-lg bg-card text-caption text-foreground'

/** Help articles investors see in "Find a Solution". */
export default function ErrorCatalog() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [published, setPublished] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // undefined = closed, null = new article, object = editing
  const [editing, setEditing] = useState(undefined)
  const q = useDebounced(search.trim())

  const params = useMemo(() => ({ ...(q && { q }), ...(category && { category }), ...(published && { published }) }), [q, category, published])
  const { data, loading } = useAsync(() => listSupportArticles(params), [params, reloadKey])
  const articles = data?.data ?? []
  const filtering = !!(q || category || published)

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="flex h-[42.5px] items-center gap-2.5 rounded-[7.5px] border bg-card px-[12.5px] focus-within:ring-3 focus-within:ring-ring/30 sm:col-span-2 lg:col-span-1">
          <SearchIcon className="size-5 shrink-0 text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, title or keyword"
            className="min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-subtle"
            aria-label="Search articles"
          />
        </label>
        <FilterSelect
          label="Category"
          allLabel="All Categories"
          options={SUPPORT_CATEGORIES}
          value={category}
          onChange={setCategory}
          className={selectClass}
        />
        <FilterSelect
          label="Visibility"
          allLabel="All Articles"
          options={VISIBILITY}
          value={published}
          onChange={setPublished}
          className={selectClass}
        />
        <Button className="h-[42.5px] px-[17.5px] font-bold shadow-brand sm:col-span-2 lg:col-span-1" onClick={() => setEditing(null)}>
          <PlusIcon />
          New Article
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-[0_1.25px_2.5px_rgb(0_0_0/0.04)]">
        <div className={cn('overflow-x-auto pt-5 transition-opacity', loading && data && 'opacity-50')}>
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} pl-[25px]`}>Code</th>
                <th className={th}>Article</th>
                <th className={th}>Category</th>
                <th className={th}>Steps</th>
                <th className={th}>Visibility</th>
                <th className={th}>Updated</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/40">
                  <td className={`${td} pl-[25px] align-middle`}>
                    <span className="rounded-[6.25px] bg-primary-soft px-[8.75px] py-[6.25px] font-bold whitespace-nowrap text-primary">
                      {a.code}
                    </span>
                  </td>
                  <td className={`${td} max-w-[520px]`}>
                    <p className="font-bold">{a.title}</p>
                    <p className="pt-[5px] text-muted-foreground">{a.summary}</p>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted-foreground`}>{CATEGORY_LABEL[a.category]}</td>
                  <td className={`${td} text-muted-foreground tabular-nums`}>{a.steps.length}</td>
                  <td className={td}>
                    <StatusBadge tone={a.published ? 'success' : 'neutral'} icon={false}>
                      {a.published ? 'Published' : 'Hidden'}
                    </StatusBadge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(a.updatedAt)}</td>
                  <td className={td}>
                    <Button variant="outline" className="h-[35px] rounded-lg bg-card px-2.5 text-title font-bold" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <Spinner className="mx-auto my-16 size-6 text-muted-foreground" />}
          {data && !articles.length && (
            <p className="py-12 text-center text-title text-muted-foreground">{filtering ? 'No articles match your filters.' : 'No articles yet.'}</p>
          )}
        </div>
        <p className="flex min-h-[60px] items-center px-5 text-caption text-muted-foreground">
          {articles.length ? `${formatInt(articles.length)} ${articles.length === 1 ? 'article' : 'articles'}` : ''}
        </p>
      </section>

      <ArticleDialog
        open={editing !== undefined}
        article={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          setReloadKey((k) => k + 1)
        }}
      />
    </div>
  )
}
