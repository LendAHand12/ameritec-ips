import { useEffect, useState } from 'react'
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { SUPPORT_CATEGORIES } from '@/lib/support'
import { createSupportArticle, deleteSupportArticle, updateSupportArticle } from '@/services/admin.service'

const EMPTY = { code: '', category: '', title: '', summary: '', keywords: '', steps: [''], published: true }

function Field({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-caption font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="block text-sm text-destructive">{error}</span>
      ) : (
        hint && <span className="block text-caption text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}

/** Create or edit a help article. `article` = null for a new one; `open` controls visibility. */
export default function ArticleDialog({ open, article, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(article ? { ...article, steps: article.steps.length ? article.steps : [''] } : EMPTY)
    setErrors({})
    setConfirmDelete(false)
  }, [open, article])

  const set = (key, value) => {
    setErrors((e) => ({ ...e, [key]: undefined }))
    setForm((f) => ({ ...f, [key]: value }))
  }
  const setStep = (i, value) =>
    set(
      'steps',
      form.steps.map((s, j) => (j === i ? value : s)),
    )

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { code, category, title, summary, keywords, steps, published } = form
      const payload = { code, category, title, summary, keywords, steps, published }
      if (article) await updateSupportArticle(article.id, payload)
      else await createSupportArticle(payload)
      toast.success(article ? 'Article updated' : 'Article created')
      onSaved()
    } catch (err) {
      setErrors(err.details ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      await deleteSupportArticle(article.id)
      toast.success(`${article.code} deleted`)
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-subheading font-bold">{article ? `Edit ${article.code}` : 'New Article'}</DialogTitle>
            <DialogDescription>Published articles appear in the investor’s Support Center under “Find a Solution”.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Code" hint="e.g. KYC-001" error={errors.code}>
              <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={14} aria-invalid={!!errors.code} />
            </Field>
            <Field label="Category" error={errors.category}>
              <Select items={SUPPORT_CATEGORIES} value={form.category || null} onValueChange={(v) => set('category', v ?? '')}>
                <SelectTrigger aria-label="Category" aria-invalid={!!errors.category} className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Title" error={errors.title}>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} aria-invalid={!!errors.title} />
          </Field>
          <Field label="Summary" hint="One line shown under the title." error={errors.summary}>
            <Input value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={200} aria-invalid={!!errors.summary} />
          </Field>
          <Field label="Search keywords" hint="Extra words investors might search for. Not shown." error={errors.keywords}>
            <Input value={form.keywords} onChange={(e) => set('keywords', e.target.value)} maxLength={300} />
          </Field>

          <Field label="Solution steps" error={errors.steps}>
            <ol className="space-y-2">
              {form.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-caption font-semibold text-muted-foreground">{i + 1}.</span>
                  <Textarea
                    value={step}
                    onChange={(e) => setStep(i, e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="min-h-0 flex-1"
                    aria-label={`Step ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-1"
                    aria-label={`Remove step ${i + 1}`}
                    disabled={form.steps.length === 1}
                    onClick={() =>
                      set(
                        'steps',
                        form.steps.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ol>
            {form.steps.length < 15 && (
              <Button type="button" variant="outline" className="mt-2 h-9 bg-card" onClick={() => set('steps', [...form.steps, ''])}>
                <PlusIcon />
                Add step
              </Button>
            )}
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <Checkbox checked={form.published} onCheckedChange={(v) => set('published', v === true)} />
            Published (visible to investors)
          </label>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {article ? (
              confirmDelete ? (
                <span className="flex items-center gap-2 text-caption">
                  Delete {article.code} permanently?
                  <Button type="button" variant="destructive" className="h-9" disabled={saving} onClick={remove}>
                    Delete
                  </Button>
                  <Button type="button" variant="ghost" className="h-9" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" className="h-9 text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2Icon />
                  Delete
                </Button>
              )
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="outline" className="h-10 bg-card" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="h-10 px-5 font-bold" disabled={saving}>
                {saving && <Spinner className="size-4" />}
                {article ? 'Save changes' : 'Create article'}
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
