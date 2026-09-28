import React, { useEffect } from 'react'
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react'

export interface ConfirmModalProps {
  isOpen: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
      style={{
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '90%',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header with App Branding & Close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isDanger ? '#ef4444' : '#4f46e5',
                backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                padding: '3px 8px',
                borderRadius: '6px'
              }}
            >
              Centre de Soutien
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            aria-label="Fermer"
            style={{ padding: '4px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginTop: '4px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              flexShrink: 0,
              backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(79, 70, 229, 0.12)',
              border: isDanger ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(79, 70, 229, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDanger ? '#dc2626' : '#4f46e5'
            }}
          >
            {isDanger ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <h3
              id="confirm-modal-title"
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-text-primary)'
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--color-text-secondary)'
              }}
            >
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-border-subtle)'
          }}
        >
          <button
            id="btn-confirm-cancel"
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ fontWeight: 600 }}
          >
            {cancelLabel}
          </button>

          <button
            id="btn-confirm-accept"
            type="button"
            className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            style={{
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isDanger ? '0 2px 8px rgba(239, 68, 68, 0.3)' : '0 2px 8px rgba(79, 70, 229, 0.3)'
            }}
          >
            {isDanger && <Trash2 size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
