
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "@/components/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ComboboxOption = {
    label: string
    value: string
    /** Optional right-aligned secondary text (e.g. a price) shown in the list. */
    hint?: string
}

type ComboboxProps = {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  onSearchChange?: (search: string) => void
  onCreateOption?: (label: string) => void
  createOptionLabel?: (label: string) => string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string;
}

export function Combobox({ 
    options, 
    value, 
    onValueChange, 
    onSearchChange,
    onCreateOption,
    createOptionLabel,
    placeholder, 
    searchPlaceholder, 
    emptyText,
    className
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const trimmedSearch = search.trim()
  const canCreate = !!onCreateOption && trimmedSearch.length > 0 && !options.some(option => option.label.toLowerCase() === trimmedSearch.toLowerCase())

  return (
    // modal keeps the list wheel-scrollable when the combobox opens inside a
    // modal Dialog (Radix otherwise blocks scroll events on the portal).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">
          {value
            ? options.find((option) => option.value === value)?.label
            : placeholder || "Select option..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder || "Search..."}
            value={search}
            onValueChange={(next) => {
              setSearch(next)
              onSearchChange?.(next)
            }}
          />
          <CommandList>
            <CommandEmpty>
              {canCreate ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onCreateOption?.(trimmedSearch)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  {createOptionLabel ? createOptionLabel(trimmedSearch) : `Add "${trimmedSearch}"`}
                </button>
              ) : (
                emptyText || "No results found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {canCreate && (
                <CommandItem
                  value={`create ${trimmedSearch}`}
                  onSelect={() => {
                    onCreateOption?.(trimmedSearch)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  {createOptionLabel ? createOptionLabel(trimmedSearch) : `Add "${trimmedSearch}"`}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
