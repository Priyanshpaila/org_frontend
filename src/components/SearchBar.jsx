import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Props:
 * - value, onChange, onSubmit(normalizedQuery?)
 * - onClear?: () => void
 * - isLoading?: boolean
 * - minChars?: number (default 2)
 * - allowEmptySubmit?: boolean (default true)
 * - debounceMs?: number (default 0) // e.g. 400 to search as-you-type
 * - caseInsensitive?: boolean (default true)
 * - className?: string
 */
export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  isLoading = false,
  minChars = 2,
  allowEmptySubmit = true,
  debounceMs = 0,
  caseInsensitive = true,
  className = ''
}) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)

  // Keyboard shortcuts: "/" or ⌘/Ctrl+K focus; Esc clears
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea'
      const isK = e.key?.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)
      if (!typing && (e.key === '/' || isK)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) inputRef.current?.blur()
        if (value) handleClear()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value])

  // Optional: debounced submit-as-you-type
  useEffect(() => {
    if (!debounceMs) return
    const t = setTimeout(() => {
      const raw = value ?? ''
      const q = (caseInsensitive ? raw.toLowerCase() : raw).trim()
      if (q.length === 0 && !allowEmptySubmit) return
      if (q.length === 0 || q.length >= minChars) onSubmit?.(q)
    }, debounceMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs, allowEmptySubmit, minChars, caseInsensitive])

  const hint = useMemo(() => {
    const raw = value ?? ''
    const q = (caseInsensitive ? raw.toLowerCase() : raw).trim()
    if (q.length === 0) return 'Type a name, employee ID, or email'
    if (q.length < minChars) return `Keep typing… ${minChars - q.length} more`
    return 'Press Enter to search • Esc to clear'
  }, [value, minChars, caseInsensitive])

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    const raw = value ?? ''
    const q = (caseInsensitive ? raw.toLowerCase() : raw).trim()
    if (!q && !allowEmptySubmit) return
    if (q && q.length < minChars) return
    onSubmit?.(q)
  }

  const handleClear = () => {
    onChange?.('')
    onClear?.()
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      {/* wrapper: stacks on mobile, inline on ≥sm */}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        {/* Command bar */}
        <div
          className={[
            'flex w-full items-center gap-2 rounded-2xl border bg-white/80 px-3 py-2',
            'backdrop-blur shadow-sm transition',
            focused ? 'ring-2 ring-brand-600 border-transparent' : 'border-gray-200'
          ].join(' ')}
        >
          {/* left icon */}
          <Magnifier className="h-5 w-5 shrink-0 text-gray-400" />

          {/* input */}
          <input
            ref={inputRef}
            className="input !ring-0 !border-0 w-full bg-transparent"
            placeholder="Search by name, employee ID, or email…"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            spellCheck="false"
          />

          {/* clear (inline, no absolute overlap) */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="btn btn-ghost !px-2"
              aria-label="Clear search"
              title="Clear (Esc)"
            >
              ✕
            </button>
          )}

          {/* submit (desktop inline) */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary hidden sm:flex"
            aria-label="Search"
          >
            {isLoading ? <Spinner /> : 'Search'}
          </button>
        </div>

        {/* submit (mobile stacked) */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary sm:hidden"
          aria-label="Search"
        >
          {isLoading ? <Spinner /> : 'Search'}
        </button>
      </div>

      {/* helper row */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <div className="text-xs text-gray-500" aria-live="polite" aria-atomic="true">
          {hint}
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <Chip>name</Chip>
          <Chip>empId</Chip>
          <Chip>email</Chip>
        </div>
      </div>
    </form>
  )
}

/* ---------- tiny UI atoms ---------- */
function Magnifier({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
      aria-hidden="true"
    />
  )
}
function Chip({ children }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
      {children}
    </span>
  )
}
