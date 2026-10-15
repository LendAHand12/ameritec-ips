import { useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { COUNTRIES, COUNTRY_BY_ISO } from '@/lib/countries'
import { cn } from '@/lib/utils'

export function CountryCodeSelect({ value, onChange, invalid, size }) {
  const [open, setOpen] = useState(false)
  const selected = COUNTRY_BY_ISO[value]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn('shrink-0 gap-1.5 px-2.5', size === 'lg' && 'h-[54px] bg-card px-3 text-title font-normal')}
            aria-invalid={invalid}
          />
        }
        aria-label="Country code"
      >
        <span>{selected?.flag}</span>
        <span className="tabular-nums">+{selected?.dialCode}</span>
        <ChevronsUpDownIcon className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.iso}
                  value={`${c.name} +${c.dialCode} ${c.iso}`}
                  data-checked={c.iso === value}
                  onSelect={() => {
                    onChange(c.iso)
                    setOpen(false)
                  }}
                >
                  <span>{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">+{c.dialCode}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Country code picker + phone number. `inputProps` go to the number input (e.g. register('phoneNumber')). */
export default function PhoneInput({ country, onCountryChange, invalid, size, ...inputProps }) {
  return (
    <div className="flex gap-2">
      <CountryCodeSelect value={country} onChange={onCountryChange} invalid={invalid} size={size} />
      <Input type="tel" inputMode="tel" autoComplete="tel-national" size={size} aria-invalid={invalid} {...inputProps} />
    </div>
  )
}
