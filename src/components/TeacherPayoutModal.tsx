import React, { useState, useEffect } from 'react'
import type { Teacher, TeacherPayout, TeacherPaymentStatus } from '../types'
import { getTeacherPayouts, recordTeacherPayout, deleteTeacherPayout } from '../db/sqlite'
import {
  DollarSign,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Calendar,
  Trash2,
  FileText,
  Clock
} from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'

interface TeacherPayoutModalProps {
  teacher: Teacher
  totalEarned: number
  onClose: () => void
  onPayoutRecorded?: () => void
}

export const TeacherPayoutModal: React.FC<TeacherPayoutModalProps> = ({
  teacher,
  totalEarned,
  onClose,
  onPayoutRecorded
}) => {
  const [payouts, setPayouts] = useState<TeacherPayout[]>([])
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<string>('Espèces')
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const loadPayouts = async () => {
    setLoading(true)
    const list = await getTeacherPayouts(teacher.id)
    setPayouts(list)
    setLoading(false)
  }

  useEffect(() => {
    loadPayouts()
  }, [teacher.id])

  const totalPaid = Number(payouts.reduce((sum, p) => sum + p.amount, 0).toFixed(2))
  const balance = Number((totalEarned - totalPaid).toFixed(2)) // > 0: underpaid/owed; < 0: overpaid/advance

  let paymentStatus: TeacherPaymentStatus = 'unpaid'
  if (totalPaid === 0 && totalEarned > 0) {
    paymentStatus = 'unpaid'
  } else if (Math.abs(balance) < 0.01) {
    paymentStatus = 'paid'
  } else if (balance > 0.01 && totalPaid > 0) {
    paymentStatus = 'partial'
  } else if (balance < -0.01) {
    paymentStatus = 'overpaid'
  } else {
    paymentStatus = 'paid'
  }

  const handlePreFillExact = () => {
    if (balance > 0) {
      setAmount(balance.toFixed(2))
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmt = parseFloat(amount)
    if (isNaN(numAmt) || numAmt <= 0) {
      setFeedback('Veuillez entrer un montant valide supérieur à 0 DTN.')
      return
    }

    setSaving(true)
    try {
      await recordTeacherPayout(
        teacher.id,
        numAmt,
        date,
        paymentMethod,
        notes.trim() || undefined
      )
      setAmount('')
      setNotes('')
      setFeedback('Versement enregistré avec succès ! Le solde a été mis à jour.')
      await loadPayouts()
      if (onPayoutRecorded) {
        onPayoutRecorded()
      }
      setTimeout(() => setFeedback(null), 3500)
    } catch (err) {
      console.error('Error recording payout:', err)
      setFeedback('Erreur lors de l\'enregistrement du versement.')
    } finally {
      setSaving(false)
    }
  }

  const [payoutToDelete, setPayoutToDelete] = useState<string | null>(null)

  const handleDeletePayout = (payoutId: string) => {
    setPayoutToDelete(payoutId)
  }

  const handleConfirmDeletePayout = async () => {
    if (!payoutToDelete) return
    const id = payoutToDelete
    setPayoutToDelete(null)
    await deleteTeacherPayout(id)
    await loadPayouts()
    if (onPayoutRecorded) {
      onPayoutRecorded()
    }
  }

  // Simulated future balance if current input is valid
  const parsedAmt = parseFloat(amount)
  const simulatedNewPaid = !isNaN(parsedAmt) && parsedAmt > 0 ? totalPaid + parsedAmt : totalPaid
  const simulatedNewBalance = Number((totalEarned - simulatedNewPaid).toFixed(2))

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-payout-modal-title"
      onClick={onClose}
      style={{ overflowY: 'auto', padding: 'var(--space-4)' }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '740px',
          width: '100%',
          backgroundColor: 'var(--color-surface-raised)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--color-border)',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header Strip */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            backgroundColor: 'var(--color-surface-raised)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <h2 id="teacher-payout-modal-title" style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Règlement des Honoraires Enseignant
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                {teacher.name} • {teacher.subject} (
                {teacher.payment_mode === 'per_student'
                  ? `Par Élève : ${teacher.rate_per_student.toFixed(2)} DTN`
                  : `Quote-part : ${(teacher.monthly_rate_cut * 100).toFixed(0)}%`}
                )
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Fermer"
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-muted)'
          }}
        >
          {/* Feedback banner */}
          {feedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                color: '#15803d',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </div>
          )}

          {/* 1. Account Financial Ledger Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)'
            }}
          >
            {/* Total Due/Earned */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Honoraires Générés
              </span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {totalEarned.toFixed(2)} <span style={{ fontSize: '12px' }}>DTN</span>
              </div>
            </div>

            {/* Total Paid */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Total Déjà Versé
              </span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {totalPaid.toFixed(2)} <span style={{ fontSize: '12px' }}>DTN</span>
              </div>
            </div>

            {/* Balance / Carryover Status */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor:
                  balance > 0.01
                    ? '#fffbeb'
                    : balance < -0.01
                    ? '#f5f3ff'
                    : '#ecfdf5',
                border: `1px solid ${
                  balance > 0.01
                    ? '#f59e0b'
                    : balance < -0.01
                    ? '#8b5cf6'
                    : '#10b981'
                }`,
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase' }}>
                {balance > 0.01
                  ? 'Solde Dû (Moins-Perçu)'
                  : balance < -0.01
                  ? 'Avance (Trop-Perçu)'
                  : 'Compte Soldé'}
              </span>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  marginTop: '4px',
                  color: balance > 0.01 ? '#b45309' : balance < -0.01 ? '#7c3aed' : '#059669'
                }}
              >
                {balance > 0.01
                  ? `+${balance.toFixed(2)} DTN`
                  : balance < -0.01
                  ? `-${Math.abs(balance).toFixed(2)} DTN`
                  : '0.00 DTN'}
              </div>
            </div>
          </div>

          {/* 2. Explanatory Carryover Box (Word-for-word addressing the prompt) */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: 1.4,
              backgroundColor:
                balance > 0.01
                  ? '#fef3c7'
                  : balance < -0.01
                  ? '#ede9fe'
                  : '#f0fdf4',
              color:
                balance > 0.01
                  ? '#92400e'
                  : balance < -0.01
                  ? '#5b21b6'
                  : '#166534',
              border: `1px solid ${
                balance > 0.01
                  ? '#fde68a'
                  : balance < -0.01
                  ? '#ddd6fe'
                  : '#bbf7d0'
              }`
            }}
          >
            {balance > 0.01 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Reliquat restant dû (Moins-perçu) : +{balance.toFixed(2)} DTN</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                    Le professeur a été réglé de moins que ses honoraires générés. Ce solde de{' '}
                    <strong>+{balance.toFixed(2)} DTN</strong> s'ajoute automatiquement au prochain versement.
                  </p>
                </div>
              </div>
            ) : balance < -0.01 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <TrendingUp size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Avance constatée (Trop-perçu) : -{Math.abs(balance).toFixed(2)} DTN</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                    Le professeur a été réglé de plus que ses honoraires actuels (acompte ou avance). Cet excédent de{' '}
                    <strong>-{Math.abs(balance).toFixed(2)} DTN</strong> sera automatiquement déduit lors du prochain décompte.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} />
                <span>
                  <strong>Compte entièrement soldé.</strong> L'enseignant a perçu la totalité exacte de ses honoraires dus à ce jour.
                </span>
              </div>
            )}
          </div>

          {/* 3. Record New Payment Form */}
          <form
            onSubmit={handleAddPayment}
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={16} color="#059669" />
              <span>Enregistrer un Nouveau Versement à l'Enseignant</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Montant Versé (DTN) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    placeholder="ex: 150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    style={{ fontWeight: 700, fontSize: '15px' }}
                  />
                  {balance > 0 && (
                    <button
                      type="button"
                      onClick={handlePreFillExact}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      title="Remplir le solde restant exact"
                    >
                      Solde ({balance.toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Date du Règlement *
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Mode de Versement
                </label>
                <select
                  className="input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Espèces">Espèces (Cash)</option>
                  <option value="Virement Bancaire">Virement Bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Note / Référence
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="ex: Acompte début de mois"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Live Carryover Preview */}
            {!isNaN(parsedAmt) && parsedAmt > 0 && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-surface-raised)',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-border)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>
                  Simulation après versement de <strong>{parsedAmt.toFixed(2)} DTN</strong> :
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      simulatedNewBalance > 0.01
                        ? '#b45309'
                        : simulatedNewBalance < -0.01
                        ? '#7c3aed'
                        : '#059669'
                  }}
                >
                  {simulatedNewBalance > 0.01
                    ? `Nouveau reliquat restant : +${simulatedNewBalance.toFixed(2)} DTN (reporté)`
                    : simulatedNewBalance < -0.01
                    ? `Nouvelle avance : -${Math.abs(simulatedNewBalance).toFixed(2)} DTN (à déduire)`
                    : 'Le compte sera entièrement soldé (0.00 DTN)'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 700 }}
              >
                {saving ? 'Enregistrement...' : 'Valider le Versement'}
              </button>
            </div>
          </form>

          {/* 4. History Table of Past Payouts */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="var(--color-text-muted)" />
              <span>Historique des Règlements Versés ({payouts.length})</span>
            </h3>

            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Chargement de l'historique...
              </div>
            ) : payouts.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface-muted)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)'
                }}
              >
                Aucun versement n'a encore été enregistré pour cet enseignant.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-surface-raised)' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '12px', backgroundColor: 'var(--color-surface-raised)' }}>
                  <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Mode</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Notes / Référence</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Montant Versé</th>
                      <th style={{ textAlign: 'center', width: '50px', padding: '8px 10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-raised)' }}>
                        <td style={{ fontWeight: 600, padding: '8px 10px' }}>{p.date}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              backgroundColor: 'var(--color-surface-muted)',
                              border: '1px solid var(--color-border)',
                              fontWeight: 600
                            }}
                          >
                            {p.payment_method}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '8px 10px' }}>{p.notes || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', padding: '8px 10px' }}>
                          +{p.amount.toFixed(2)} DTN
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeletePayout(p.id)}
                            title="Annuler ce versement"
                            style={{ padding: '4px 6px', color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sleek In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(payoutToDelete)}
        title="Annuler le Versement"
        message="Voulez-vous vraiment annuler et supprimer ce versement de rémunération ?"
        confirmLabel="Annuler le versement"
        variant="danger"
        onConfirm={handleConfirmDeletePayout}
        onCancel={() => setPayoutToDelete(null)}
      />
    </div>
  )
}
