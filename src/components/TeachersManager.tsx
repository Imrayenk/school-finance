import React, { useState, useEffect, useCallback } from 'react'
import { getTeachers, addTeacher, updateTeacher, deleteTeacher } from '../db/sqlite'
import type { Teacher, TeacherPaymentMode } from '../types'
import { Users, UserPlus, BookOpen, Percent, X, CheckCircle2, Edit2, Trash2, AlertTriangle, Printer, Search } from 'lucide-react'
import { InvoiceModal } from './InvoiceModal'
import { Pagination } from './Pagination'

export const TeachersManager: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterSubject, setFilterSubject] = useState<string>('All')

  useEffect(() => {
    const handleGlobalSearch = (e: any) => {
      if (e.detail.type === 'teacher') {
        setSearchQuery(e.detail.name)
        setFilterSubject('All')
      }
    }
    window.addEventListener('global_search_focus', handleGlobalSearch)
    return () => window.removeEventListener('global_search_focus', handleGlobalSearch)
  }, [])

  const uniqueSubjects = React.useMemo(() => {
    return Array.from(new Set(teachers.map(t => t.subject))).sort()
  }, [teachers])

  const filteredTeachers = React.useMemo(() => {
    return teachers.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSubject = filterSubject === 'All' || t.subject === filterSubject
      return matchesSearch && matchesSubject
    })
  }, [teachers, searchQuery, filterSubject])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterSubject])

  const paginatedTeachers = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTeachers.slice(start, start + itemsPerPage)
  }, [filteredTeachers, currentPage])

  // Add Form states
  const [name, setName] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [rateCutPercent, setRateCutPercent] = useState<string>('80')
  const [paymentMode, setPaymentMode] = useState<TeacherPaymentMode>('percentage')
  const [ratePerStudent, setRatePerStudent] = useState<string>('50')

  // Edit Form states
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editPhone, setEditPhone] = useState<string>('')
  const [editSubject, setEditSubject] = useState<string>('')
  const [editRateCutPercent, setEditRateCutPercent] = useState<string>('80')
  const [editPaymentMode, setEditPaymentMode] = useState<TeacherPaymentMode>('percentage')
  const [editRatePerStudent, setEditRatePerStudent] = useState<string>('50')

  // Delete Confirmation state
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<Teacher | null>(null)

  // Invoice / Payout Statement state
  const [invoiceTeacher, setInvoiceTeacher] = useState<Teacher | null>(null)

  const [notification, setNotification] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    const list = await getTeachers()
    setTeachers(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !subject.trim()) return

    const normalizedName = name.trim().toLowerCase()
    if (teachers.some(t => t.name.toLowerCase() === normalizedName)) {
      alert(`Un enseignant avec le nom "${name.trim()}" existe déjà.`)
      return
    }

    const cutVal = parseFloat(rateCutPercent) / 100
    if (paymentMode === 'percentage' && (isNaN(cutVal) || cutVal <= 0 || cutVal > 1)) {
      alert('La commission doit être comprise entre 1% et 100%.')
      return
    }
    const studentRate = parseFloat(ratePerStudent)
    if (paymentMode === 'per_student' && (isNaN(studentRate) || studentRate <= 0)) {
      alert('Le tarif par élève doit être supérieur à 0 DTN.')
      return
    }

    try {
      await addTeacher({
        name: name.trim(),
        subject: subject.trim(),
        monthly_rate_cut: !isNaN(cutVal) && cutVal > 0 ? cutVal : 0.80,
        payment_mode: paymentMode,
        rate_per_student: !isNaN(studentRate) && studentRate > 0 ? studentRate : 50.0,
        phone: phone.trim()
      })

      showNotification(`Enseignant ${name} créé avec succès.`)
      setAddModalOpen(false)
      setName('')
      setPhone('')
      setSubject('')
      setRateCutPercent('80')
      setPaymentMode('percentage')
      setRatePerStudent('50')
      await loadTeachers()
    } catch (err: any) {
      alert('Erreur lors de la création : ' + err.message)
    }
  }

  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacher(t)
    setEditName(t.name)
    setEditPhone(t.phone || '')
    setEditSubject(t.subject)
    setEditRateCutPercent(String(parseFloat((t.monthly_rate_cut * 100).toFixed(2))))
    setEditPaymentMode(t.payment_mode || 'percentage')
    setEditRatePerStudent(String(t.rate_per_student !== undefined ? t.rate_per_student : 50))
    setEditModalOpen(true)
  }

  const handleUpdateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTeacher || !editName.trim() || !editSubject.trim()) return

    const normalizedName = editName.trim().toLowerCase()
    if (teachers.some(t => t.id !== editingTeacher.id && t.name.toLowerCase() === normalizedName)) {
      alert(`Un enseignant avec le nom "${editName.trim()}" existe déjà.`)
      return
    }

    const cutVal = parseFloat(editRateCutPercent) / 100
    if (editPaymentMode === 'percentage' && (isNaN(cutVal) || cutVal <= 0 || cutVal > 1)) {
      alert('La commission doit être comprise entre 1% et 100%.')
      return
    }
    const studentRate = parseFloat(editRatePerStudent)
    if (editPaymentMode === 'per_student' && (isNaN(studentRate) || studentRate <= 0)) {
      alert('Le tarif par élève doit être supérieur à 0 DTN.')
      return
    }

    try {
      await updateTeacher(editingTeacher.id, {
        name: editName.trim(),
        subject: editSubject.trim(),
        monthly_rate_cut: !isNaN(cutVal) && cutVal > 0 ? cutVal : 0.80,
        payment_mode: editPaymentMode,
        rate_per_student: !isNaN(studentRate) && studentRate > 0 ? studentRate : 50.0,
        phone: editPhone.trim()
      })

      showNotification(`Enseignant ${editName} mis à jour avec succès.`)
      setEditModalOpen(false)
      setEditingTeacher(null)
      await loadTeachers()
    } catch (err: any) {
      alert('Erreur lors de la mise à jour : ' + err.message)
    }
  }

  const handleConfirmDeleteTeacher = async () => {
    if (!deleteConfirmTeacher) return
    const teacherName = deleteConfirmTeacher.name
    await deleteTeacher(deleteConfirmTeacher.id)
    showNotification(`Enseignant ${teacherName} et ses affectations ont été supprimés.`)
    setDeleteConfirmTeacher(null)
    await loadTeachers()
  }

  const getSubjectBadgeClass = (subj: string) => {
    const s = (subj || '').toLowerCase()
    if (s.includes('math')) return 'badge-subject-math'
    if (s.includes('phys')) return 'badge-subject-physics'
    if (s.includes('svt') || s.includes('bio')) return 'badge-subject-svt'
    if (s.includes('fran')) return 'badge-subject-french'
    if (s.includes('arab') || s.includes('phil')) return 'badge-subject-arabic'
    if (s.includes('angl')) return 'badge-subject-english'
    return 'badge-subject-math'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Hero Banner */}
      <div className="page-hero hero-rose fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <Users size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Corps Enseignant</h1>
            <p className="page-hero-subtitle">
              {teachers.length} enseignant{teachers.length !== 1 ? 's' : ''} · Matières, commissions et conventions financières
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <button
            id="btn-open-create-teacher"
            type="button"
            className="btn-hero"
            onClick={() => setAddModalOpen(true)}
          >
            <UserPlus size={16} />
            Ajouter un Enseignant
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="toast-success">
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
            <Search size={16} />
          </div>
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '36px' }}
            placeholder="Rechercher un enseignant par nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          style={{ width: '250px' }}
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
        >
          <option value="All">Toutes les matières</option>
          {uniqueSubjects.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      </div>

      {/* Teachers Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Chargement des enseignants...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Aucun enseignant trouvé.
          </div>
        ) : (
          <>
            <table className="data-table" aria-label="Liste des enseignants">
              <thead>
                <tr>
                <th scope="col">ID</th>
                <th scope="col">Nom de l'Enseignant</th>
                <th scope="col">Téléphone</th>
                <th scope="col">Matière Enseignée</th>
                <th scope="col" style={{ textAlign: 'center' }}>Mode de Rémunération</th>
                <th scope="col" style={{ textAlign: 'center' }}>Part Centre Retenue</th>
                <th scope="col" style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTeachers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                    {t.id}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f43f5e, #8b5cf6)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <span>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {t.phone || '-'}
                  </td>
                  <td>
                    <span className={`badge-subject ${getSubjectBadgeClass(t.subject)}`}>
                      {t.subject}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {t.payment_mode === 'per_student' ? (
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Users size={12} />
                        Par Élève : {t.rate_per_student.toFixed(2)} DTN
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#ede9fe',
                          color: '#6d28d9',
                          border: '1px solid #ddd6fe',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Percent size={12} />
                        Au Pourcentage : {parseFloat((t.monthly_rate_cut * 100).toFixed(2))}%
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#15803d', fontSize: '12px' }}>
                    {t.payment_mode === 'per_student' ? (
                      <span>Solde Brut Restant</span>
                    ) : (
                      <span style={{ fontWeight: 700 }}>{parseFloat(((1 - t.monthly_rate_cut) * 100).toFixed(2))}%</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <button
                        id={`btn-invoice-teacher-${t.id}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                        onClick={() => setInvoiceTeacher(t)}
                        title="Imprimer le bordereau d'honoraires de cet enseignant"
                      >
                        <Printer size={12} aria-hidden="true" />
                        Bordereau
                      </button>
                      <button
                        id={`btn-edit-teacher-${t.id}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                        onClick={() => handleOpenEditTeacher(t)}
                        title="Modifier cet enseignant"
                      >
                        <Edit2 size={12} aria-hidden="true" />
                        Modifier
                      </button>
                      <button
                        id={`btn-delete-teacher-${t.id}`}
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                        onClick={() => setDeleteConfirmTeacher(t)}
                        title="Supprimer cet enseignant"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTeachers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
        )}
      </div>

      {/* Create Teacher Modal */}
      {addModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-teacher-modal-title"
          onClick={() => setAddModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="create-teacher-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Créer un Nouvel Enseignant
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="input-teacher-name" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nom Complet du Professeur * :
                </label>
                <input
                  id="input-teacher-name"
                  type="text"
                  required
                  autoFocus
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Prof. Mohamed Ben Salem"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="input-teacher-phone" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Numéro de Téléphone (Optionnel) :
                </label>
                <input
                  id="input-teacher-phone"
                  type="text"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="ex. 98 765 432"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="input-teacher-subject" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Matière Enseignée * :
                </label>
                <input
                  id="input-teacher-subject"
                  type="text"
                  required
                  className="input-field"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="ex. Mathématiques, Sciences Physiques, SVT"
                />
              </div>

              {/* Remuneration Mode Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  Mode de Rémunération * :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    id="btn-mode-percentage-add"
                    type="button"
                    onClick={() => setPaymentMode('percentage')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: paymentMode === 'percentage' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                      backgroundColor: paymentMode === 'percentage' ? '#ede9fe' : '#ffffff',
                      color: paymentMode === 'percentage' ? '#6d28d9' : '#64748b'
                    }}
                  >
                    <Percent size={13} />
                    <span>Au Pourcentage (%)</span>
                  </button>
                  <button
                    id="btn-mode-student-add"
                    type="button"
                    onClick={() => setPaymentMode('per_student')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: paymentMode === 'per_student' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      backgroundColor: paymentMode === 'per_student' ? '#dcfce7' : '#ffffff',
                      color: paymentMode === 'per_student' ? '#15803d' : '#64748b'
                    }}
                  >
                    <Users size={13} />
                    <span>Par Élève (DTN)</span>
                  </button>
                </div>
              </div>

              {paymentMode === 'percentage' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="input-teacher-cut" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Quote-part Enseignant (% sur le brut) * :
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      id="input-teacher-cut"
                      type="number"
                      min="1"
                      max="100"
                      step="any"
                      required
                      className="input-field"
                      value={rateCutPercent}
                      onChange={(e) => setRateCutPercent(e.target.value)}
                    />
                    <span style={{ fontWeight: 600 }}>%</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    L'enseignant perçoit une quote-part (ex. 70%) sur le total des cours suivis.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="input-teacher-rate-student" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tarif Fixe par Élève (DTN / élève) * :
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      id="input-teacher-rate-student"
                      type="number"
                      min="5"
                      max="1000"
                      step="5"
                      required
                      className="input-field"
                      value={ratePerStudent}
                      onChange={(e) => setRatePerStudent(e.target.value)}
                    />
                    <span style={{ fontWeight: 600 }}>DTN</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    L'enseignant perçoit un montant forfaitaire par élève rattaché/ayant étudié.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-create-teacher" type="submit" className="btn btn-primary">
                  Create Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editModalOpen && editingTeacher && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-teacher-modal-title"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="edit-teacher-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Modifier l'Enseignant
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacherSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="edit-teacher-name" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Nom Complet du Professeur * :
                </label>
                <input
                  id="edit-teacher-name"
                  type="text"
                  required
                  autoFocus
                  className="input-field"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="ex. Prof. Mohamed Ben Salem"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="edit-teacher-phone" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Numéro de Téléphone (Optionnel) :
                </label>
                <input
                  id="edit-teacher-phone"
                  type="text"
                  className="input-field"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="ex. 98 765 432"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="edit-teacher-subject" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Matière Enseignée * :
                </label>
                <input
                  id="edit-teacher-subject"
                  type="text"
                  required
                  className="input-field"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="ex. Mathématiques, Physique"
                />
              </div>

              {/* Edit Remuneration Mode Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  Mode de Rémunération * :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    id="btn-mode-percentage-edit"
                    type="button"
                    onClick={() => setEditPaymentMode('percentage')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: editPaymentMode === 'percentage' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                      backgroundColor: editPaymentMode === 'percentage' ? '#ede9fe' : '#ffffff',
                      color: editPaymentMode === 'percentage' ? '#6d28d9' : '#64748b'
                    }}
                  >
                    <Percent size={13} />
                    <span>Au Pourcentage (%)</span>
                  </button>
                  <button
                    id="btn-mode-student-edit"
                    type="button"
                    onClick={() => setEditPaymentMode('per_student')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: editPaymentMode === 'per_student' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      backgroundColor: editPaymentMode === 'per_student' ? '#dcfce7' : '#ffffff',
                      color: editPaymentMode === 'per_student' ? '#15803d' : '#64748b'
                    }}
                  >
                    <Users size={13} />
                    <span>Par Élève (DTN)</span>
                  </button>
                </div>
              </div>

              {editPaymentMode === 'percentage' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="edit-teacher-cut" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Quote-part Enseignant (% sur le brut) * :
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      id="edit-teacher-cut"
                      type="number"
                      min="1"
                      max="100"
                      step="any"
                      required
                      className="input-field"
                      value={editRateCutPercent}
                      onChange={(e) => setEditRateCutPercent(e.target.value)}
                    />
                    <span style={{ fontWeight: 600 }}>%</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    L'enseignant perçoit une quote-part (ex. 70%) sur le total des cours suivis.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="edit-teacher-rate-student" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Tarif Fixe par Élève (DTN / élève) * :
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      id="edit-teacher-rate-student"
                      type="number"
                      min="5"
                      max="1000"
                      step="5"
                      required
                      className="input-field"
                      value={editRatePerStudent}
                      onChange={(e) => setEditRatePerStudent(e.target.value)}
                    />
                    <span style={{ fontWeight: 600 }}>DTN</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    L'enseignant perçoit un montant forfaitaire par élève rattaché/ayant étudié.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Annuler
                </button>
                <button id="btn-submit-edit-teacher" type="submit" className="btn btn-primary">
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTeacher && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-teacher-modal-title"
          onClick={() => setDeleteConfirmTeacher(null)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: '#be123c' }}>
              <AlertTriangle size={22} aria-hidden="true" />
              <h2 id="delete-teacher-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Supprimer l'Enseignant
              </h2>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{deleteConfirmTeacher.name}</strong> ({deleteConfirmTeacher.subject}) ?
              <br />
              <span style={{ color: '#be123c', fontWeight: 600 }}>
                Attention : Toutes les inscriptions d'élèves et créneaux horaires rattachés à cet enseignant seront également supprimés en cascade.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmTeacher(null)}>
                Annuler
              </button>
              <button
                id="btn-confirm-delete-teacher"
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteTeacher}
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Official Statement / Payout Modal */}
      {invoiceTeacher && (
        <InvoiceModal
          type="teacher"
          data={invoiceTeacher}
          onClose={() => setInvoiceTeacher(null)}
        />
      )}
    </div>
  )
}
