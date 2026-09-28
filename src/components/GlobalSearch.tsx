import React, { useState, useEffect, useRef } from 'react'
import { Search, GraduationCap, Users, Library, X } from 'lucide-react'
import { globalSearch } from '../db/sqlite'
import type { GlobalSearchResult } from '../types'

interface GlobalSearchProps {
  onResultClick: (type: 'student' | 'teacher' | 'group', id: string, name: string) => void
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onResultClick }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const res = await globalSearch(query)
      setResults(res)
      setIsOpen(true)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [wrapperRef])

  const getIconForType = (type: string) => {
    switch (type) {
      case 'student': return <GraduationCap size={16} style={{ color: '#0284c7' }} />
      case 'teacher': return <Users size={16} style={{ color: '#e11d48' }} />
      case 'group': return <Library size={16} style={{ color: '#c026d3' }} />
      default: return <Search size={16} />
    }
  }

  const getLabelForType = (type: string) => {
    switch (type) {
      case 'student': return 'Élève'
      case 'teacher': return 'Enseignant'
      case 'group': return 'Groupe'
      default: return 'Autre'
    }
  }

  const handleResultClick = (result: GlobalSearchResult) => {
    setIsOpen(false)
    setQuery('')
    onResultClick(result.type, result.id, result.name)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '300px' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Rechercher élève, enseignant..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            fontSize: '13px',
            outline: 'none',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          onFocusCapture={(e) => {
            e.target.style.borderColor = 'var(--color-primary)'
            e.target.style.boxShadow = '0 0 0 2px rgba(79, 70, 229, 0.2)'
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = 'var(--color-border)'
            e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)'
          }}
        />
        <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
          <Search size={16} />
        </div>
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '350px',
            overflowY: 'auto'
          }}
        >
          {isSearching ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Recherche en cours...
            </div>
          ) : results.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
              {results.map((res) => (
                <li key={`${res.type}-${res.id}`}>
                  <button
                    onClick={() => handleResultClick(res)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getIconForType(res.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {res.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 500 }}>{getLabelForType(res.type)}</span>
                        {res.extra && (
                          <>
                            <span>•</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{res.extra}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Aucun résultat trouvé pour "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
