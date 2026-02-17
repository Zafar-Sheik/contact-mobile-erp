"use client"

import * as React from "react"
import { Search, X, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  showFilter?: boolean
  onFilter?: () => void
  filterCount?: number
  onSubmit?: (value: string) => void
  onClear?: () => void
  onCancel?: () => void
  showCancel?: boolean
  autoFocus?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Mobile-optimized search bar with full-width input, icon,
 * clear button, and optional cancel/filter buttons.
 */
export function SearchBar({
  value = "",
  onChange,
  placeholder = "Search...",
  showFilter = false,
  onFilter,
  filterCount = 0,
  onSubmit,
  onClear,
  onCancel,
  showCancel = false,
  autoFocus = false,
  disabled = false,
  className,
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = React.useState(value)

  React.useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange?.(newValue)
  }

  const handleClear = () => {
    setLocalValue("")
    onChange?.("")
    onClear?.()
    inputRef.current?.focus()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(localValue)
  }

  const handleCancel = () => {
    setLocalValue("")
    onChange?.("")
    onCancel?.()
  }

  const hasValue = localValue.length > 0

  return (
    <form onSubmit={handleSubmit} className={cn("flex items-center gap-2 w-full", className)}>
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>

        <input
          ref={inputRef}
          type="search"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "w-full h-11 pl-10 pr-10 rounded-xl",
            "bg-muted/50 border-0",
            "text-base text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background",
            "transition-all duration-200",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />

        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {showFilter && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-11 w-11 shrink-0 relative",
            filterCount > 0 && "border-primary bg-primary/5"
          )}
          onClick={onFilter}
          disabled={disabled}
          aria-label="Filter"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {filterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </Button>
      )}

      {showCancel && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={disabled}
          className="shrink-0 px-2 h-11"
        >
          Cancel
        </Button>
      )}
    </form>
  )
}

export interface SearchBarCompactProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
  className?: string
}

/** Compact search bar for use in headers */
export function SearchBarCompact({
  value,
  onChange,
  placeholder = "Search",
  onFocus,
  onBlur,
  className,
}: SearchBarCompactProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value || "")

  React.useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value)
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange?.(newValue)
  }

  const handleClear = () => {
    setLocalValue("")
    onChange?.("")
  }

  const handleFocus = () => {
    setIsFocused(true)
    onFocus?.()
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
  }

  const hasValue = localValue.length > 0

  return (
    <div
      className={cn(
        "flex items-center gap-2 w-full h-10 px-3 rounded-lg",
        "bg-muted/60 border border-transparent",
        isFocused && [
          "bg-background border-primary/20",
          "focus-within:ring-2 focus-within:ring-primary/20"
        ],
        className
      )}
    >
      <Search className={cn(
        "h-4 w-4 transition-colors",
        isFocused ? "text-primary" : "text-muted-foreground"
      )} />
      
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {hasValue && (
        <button
          onClick={handleClear}
          className="p-1 rounded-full hover:bg-muted-foreground/10 transition-colors"
          aria-label="Clear"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

export default SearchBar
