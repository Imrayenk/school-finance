import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  if (totalPages <= 1) {
    return null
  }

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '12px 0' }}>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          backgroundColor: currentPage === 1 ? 'var(--color-surface-muted)' : 'white',
          color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
        aria-label="Page précédente"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((page) => {
        // Show max 5 pages around current page for massive lists
        if (totalPages > 7) {
          if (
            page !== 1 &&
            page !== totalPages &&
            Math.abs(currentPage - page) > 2
          ) {
            if (page === 2 || page === totalPages - 1) {
              return <span key={page} style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>...</span>
            }
            return null
          }
        }

        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: page === currentPage ? '1px solid var(--color-primary-accent)' : '1px solid var(--color-border)',
              backgroundColor: page === currentPage ? 'var(--color-primary-accent)' : 'white',
              color: page === currentPage ? 'white' : 'var(--color-text-primary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {page}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          backgroundColor: currentPage === totalPages ? 'var(--color-surface-muted)' : 'white',
          color: currentPage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
        aria-label="Page suivante"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
