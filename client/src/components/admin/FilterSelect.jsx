import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ALL = '__all__'

/** Dropdown filter where the first option ("All …") means "no filter" (empty string). */
export default function FilterSelect({ label, allLabel, options, value, onChange, className }) {
  const items = [{ value: ALL, label: allLabel }, ...options]
  return (
    <Select items={items} value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger aria-label={label} className={className ?? 'h-[42.5px] w-full rounded-[7.5px] bg-card text-sm text-muted-foreground'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
