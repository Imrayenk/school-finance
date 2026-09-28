import React, { useState, useEffect, useCallback } from 'react'
import { getGroups, addGroup, updateGroup, deleteGroup, getTeachers, getEnrollments, getStudents, updateEnrollmentGroup, addStudent, addEnrollment } from '../db/sqlite'
import type { Teacher, Enrollment, Student } from '../types'
import { Users, UserPlus, Edit2, Trash2, CheckCircle2, AlertTriangle, BookOpen, X, Search, Library, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Pagination } from './Pagination'

// Palette of vibrant gradients for group cards
const GROUP_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
]

function getGradientForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return GROUP_GRADIENTS[Math.abs(hash) % GROUP_GRADIENTS.length]
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export const GroupsManager: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [filterTeacher, setFilterTeacher] = useState<string>('All')

  useEffect(() => {
    const handleGlobalSearch = (e: any) => {
      if (e.detail.type === 'group') {
        setSearch(e.detail.name)
        setFilterTeacher('All')
      }
    }
    window.addEventListener('global_search_focus', handleGlobalSearch)
    return () => window.removeEventListener('global_search_focus', handleGlobalSearch)
  }, [])

  const [addModalOpen, setAddModalOpen] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const [teacherId, setTeacherId] = useState<string>('')

  const [editModalOpen, setEditModalOpen] = useState<boolean>(false)
  const [editingGroup, setEditingGroup] = useState<any | null>(null)
  const [editName, setEditName] = useState<string>('')

  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<any | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [addStudentModalGroupId, setAddStudentModalGroupId] = useState<string | null>(null)
  const [addStudentModalSearch, setAddStudentModalSearch] = useState<string>('')
  const [pendingEnrollStudent, setPendingEnrollStudent] = useState<Student | null>(null)
  const [pendingEnrollRate, setPendingEnrollRate] = useState('50')
  const [pendingEnrollType, setPendingEnrollType] = useState<'hourly' | 'session' | 'monthly'>('hourly')

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [grps, tchs, stds, enrs] = await Promise.all([getGroups(), getTeachers(), getStudents(), getEnrollments()])
      setGroups(grps)
      setTeachers(tchs)
      setStudents(stds)
      setEnrollments(enrs)
    } catch (err) {
      console.error('Failed to load groups data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAddStudentToGroup = async (enrollmentId: string, groupId: string) => {
    if (!enrollmentId) return
    await updateEnrollmentGroup(enrollmentId, groupId)
    showNotification('Élève ajouté au groupe.')
    await loadData()
  }

  const handleRemoveStudentFromGroup = async (enrollmentId: string) => {
    await updateEnrollmentGroup(enrollmentId, null)
    showNotification('Élève retiré du groupe.')
    await loadData()
  }

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !teacherId) return
    try {
      await addGroup(teacherId, name.trim())
      showNotification('Groupe ajouté avec succès !')
      setAddModalOpen(false)
      setName('')
      setTeacherId('')
      loadData()
    } catch (error) {
      console.error('Failed to add group', error)
      alert("Erreur lors de l'ajout du groupe.")
    }
  }

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup || !editName.trim()) return
    try {
      await updateGroup(editingGroup.id, editName.trim())
      showNotification('Groupe mis à jour avec succès !')
      setEditModalOpen(false)
      setEditingGroup(null)
      setEditName('')
      loadData()
    } catch (error) {
      console.error('Failed to update group', error)
      alert('Erreur lors de la mise à jour du groupe.')
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return
    try {
      await deleteGroup(deleteConfirmGroup.id)
      showNotification('Groupe supprimé.')
      setDeleteConfirmGroup(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete group', error)
      alert('Erreur lors de la suppression du groupe.')
    }
  }

  const filtered = React.useMemo(() => {
    return groups.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
                          (g.teacher_name || '').toLowerCase().includes(search.toLowerCase())
      const matchTeacher = filterTeacher === 'All' || g.teacher_id === filterTeacher
      return matchSearch && matchTeacher
    })
  }, [groups, search, filterTeacher])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterTeacher])

  const paginatedGroups = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  return (
    <div className="fade-in" style={{ minHeight: '60vh' }}>
      {/* Toast notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', padding: '14px 20px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)', zIndex: 9999,
          animation: 'slideIn 0.3s ease-out', fontWeight: 500, fontSize: '14px'
        }}>
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, #c026d3 0%, #7c3aed 50%, #4f46e5 100%)',
        borderRadius: '20px', padding: '32px 36px', marginBottom: '32px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '120px',
          width: '240px', height: '240px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)', pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
              }}>
                <Library size={24} color="white" />
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                Gestion des Groupes
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '14px', fontWeight: 400 }}>
              {groups.length} groupe{groups.length !== 1 ? 's' : ''} · Organisez vos élèves par groupes de cours
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(10px)', color: 'white', borderRadius: '12px',
              padding: '12px 22px', fontWeight: 600, fontSize: '14px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            <UserPlus size={18} />
            Nouveau Groupe
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)', pointerEvents: 'none'
          }} />
          <input
            type="text"
            placeholder="Rechercher un groupe ou enseignant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: '40px', paddingRight: '14px', paddingTop: '10px', paddingBottom: '10px',
              border: '1px solid var(--color-border)', borderRadius: '12px',
              background: 'var(--color-surface-raised)', color: 'var(--color-text)',
              fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
            onFocus={e => { e.target.style.borderColor = '#c026d3'; e.target.style.boxShadow = '0 0 0 3px rgba(192,38,211,0.12)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none' }}
          />
        </div>
        <select
          value={filterTeacher}
          onChange={e => setFilterTeacher(e.target.value)}
          style={{
            minWidth: '200px', padding: '10px 14px',
            border: '1px solid var(--color-border)', borderRadius: '12px',
            background: 'var(--color-surface-raised)', color: 'var(--color-text)',
            fontSize: '14px', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="All">Tous les enseignants</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--color-text-muted)' }}>
          <div className="loading-spinner" style={{ marginBottom: '16px' }} />
          <span style={{ fontSize: '14px' }}>Chargement des groupes...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          background: 'var(--color-surface-raised)', borderRadius: '20px',
          border: '2px dashed var(--color-border)'
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(192,38,211,0.1), rgba(124,58,237,0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <Library size={36} style={{ color: '#c026d3', opacity: 0.6 }} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)', marginBottom: '8px' }}>
            {search ? 'Aucun groupe trouvé' : 'Aucun groupe créé pour le moment'}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {search ? `Aucun résultat pour "${search}"` : 'Créez votre premier groupe de cours dès maintenant.'}
          </p>
          {!search && (
            <button
              onClick={() => setAddModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #c026d3, #7c3aed)', color: 'white',
                border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 16px rgba(192,38,211,0.3)', transition: 'all 0.2s'
              }}
            >
              <UserPlus size={16} /> Créer un Groupe
            </button>
          )}
        </div>
      ) : (
      <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {paginatedGroups.map(group => {
            const gradient = getGradientForId(group.id)
            return (
              <div
                key={group.id}
                style={{
                  background: 'var(--color-surface-raised)',
                  borderRadius: '18px', overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
              >
                {/* Card top gradient strip + avatar */}
                <div style={{ background: gradient, padding: '24px 24px 36px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: '-20px', right: '-20px',
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)', pointerEvents: 'none'
                  }} />
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '16px',
                    background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '18px', color: 'white',
                    letterSpacing: '-0.02em', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {getInitials(group.name)}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '20px 24px 24px', marginTop: '-16px' }}>
                  <h3 style={{
                    fontSize: '17px', fontWeight: 700, color: 'var(--color-text)',
                    margin: '0 0 6px', letterSpacing: '-0.01em'
                  }}>
                    {group.name}
                  </h3>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '16px'
                  }}>
                    <BookOpen size={13} />
                    <span>{group.teacher_name || 'Enseignant inconnu'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'linear-gradient(135deg, rgba(192,38,211,0.1), rgba(124,58,237,0.1))',
                      border: '1px solid rgba(192,38,211,0.2)',
                      padding: '5px 12px', borderRadius: '999px',
                      fontSize: '12px', fontWeight: 700, color: '#7c3aed'
                    }}>
                      <Users size={13} />
                      {group.student_count} élève{group.student_count !== 1 ? 's' : ''}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                        title="Gérer les élèves"
                        style={{
                          padding: '0 12px', height: '34px', borderRadius: '10px',
                          border: '1px solid var(--color-border)',
                          background: expandedGroupId === group.id ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-hover)',
                          color: expandedGroupId === group.id ? '#10b981' : 'var(--color-text-secondary)',
                          borderColor: expandedGroupId === group.id ? '#10b981' : 'var(--color-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          cursor: 'pointer', transition: 'all 0.18s',
                          fontSize: '12px', fontWeight: 600
                        }}
                      >
                        <UserPlus size={14} /> Élèves {expandedGroupId === group.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                      <button
                        onClick={() => { setEditingGroup(group); setEditName(group.name); setEditModalOpen(true) }}
                        title="Modifier"
                        style={{
                          width: '34px', height: '34px', borderRadius: '10px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-hover)',
                          color: 'var(--color-text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.18s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.background = 'var(--color-surface-hover)' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmGroup(group)}
                        title="Supprimer"
                        style={{
                          width: '34px', height: '34px', borderRadius: '10px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-hover)',
                          color: 'var(--color-text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.18s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.background = 'var(--color-surface-hover)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Manage Students Section */}
                {expandedGroupId === group.id && (() => {
                  const groupEnrollments = enrollments.filter(e => e.group_id === group.id)
                  return (
                    <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                      {/* Students list */}
                      <div style={{ padding: '16px 20px 12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={12} /> {groupEnrollments.length} Élève{groupEnrollments.length !== 1 ? 's' : ''} dans ce groupe
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                          {groupEnrollments.length === 0 ? (
                            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px 8px', textAlign: 'center', background: 'var(--color-surface-hover)', borderRadius: '10px' }}>
                              Aucun élève dans ce groupe
                            </div>
                          ) : groupEnrollments.map(enr => {
                            const student = students.find(s => s.id === enr.student_id)
                            if (!student) return null
                            const initials = student.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                            return (
                              <div key={enr.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '10px', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-background)')}
                              >
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                  {initials}
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', flex: 1 }}>{student.name}</span>
                                <button
                                  onClick={() => handleRemoveStudentFromGroup(enr.id)}
                                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', padding: '4px 6px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                                  title="Retirer du groupe"
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Add student row */}
                      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setAddStudentModalGroupId(group.id)}
                          style={{
                            flex: 1, padding: '10px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '13px',
                            border: '1px dashed var(--color-border)', cursor: 'pointer',
                            background: 'transparent',
                            color: 'var(--color-text-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.borderColor = '#7c3aed' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
                        >
                          <UserPlus size={14} /> Ajouter un élève...
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </>
      )}

      {/* ──────────── ADD GROUP MODAL ──────────── */}
      {addModalOpen && (
        <div
          className="modal-overlay fade-in"
          onClick={() => setAddModalOpen(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-content scale-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px', borderRadius: '20px', padding: '32px', overflow: 'hidden', position: 'relative' }}
          >
            {/* Gradient accent bar at top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #c026d3, #7c3aed)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #c026d3, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(192,38,211,0.3)'
                }}>
                  <UserPlus size={20} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Nouveau Groupe</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>Remplissez les informations ci-dessous</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '8px', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddGroup}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Nom du Groupe
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Groupe 4ème Sc 1"
                  required
                  autoFocus
                  style={{ borderRadius: '12px' }}
                />
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Enseignant responsable
                </label>
                <select
                  className="form-input"
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  required
                  style={{ borderRadius: '12px' }}
                >
                  <option value="">— Sélectionner un enseignant —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} · {t.subject}</option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={13} /> Ajoutez d'abord un enseignant pour créer un groupe.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)',
                    color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || !teacherId}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                    background: name.trim() && teacherId ? 'linear-gradient(135deg, #c026d3, #7c3aed)' : 'var(--color-border)',
                    color: 'white', fontWeight: 700, cursor: name.trim() && teacherId ? 'pointer' : 'not-allowed',
                    fontSize: '14px', boxShadow: name.trim() && teacherId ? '0 4px 16px rgba(192,38,211,0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Créer le Groupe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────── EDIT GROUP MODAL ──────────── */}
      {editModalOpen && editingGroup && (
        <div
          className="modal-overlay fade-in"
          onClick={() => setEditModalOpen(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-content scale-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px', borderRadius: '20px', padding: '32px', overflow: 'hidden', position: 'relative' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #7c3aed, #4f46e5)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
                }}>
                  <Edit2 size={20} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Modifier le Groupe</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>{editingGroup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '8px', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditGroup}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Nom du Groupe
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  autoFocus
                  style={{ borderRadius: '12px' }}
                />
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Enseignant
                </label>
                <div style={{
                  padding: '11px 14px', borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-hover)',
                  fontSize: '14px', color: 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <BookOpen size={14} />
                  {editingGroup.teacher_name || 'Inconnu'}
                  <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px' }}>
                    Non modifiable
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)',
                    color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.3)'
                  }}
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────── DELETE CONFIRMATION MODAL ──────────── */}
      {deleteConfirmGroup && (
        <div
          className="modal-overlay fade-in"
          onClick={() => setDeleteConfirmGroup(null)}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-content scale-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '420px', borderRadius: '20px', padding: '32px', textAlign: 'center' }}
          >
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
              border: '2px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', color: '#ef4444'
            }}>
              <Trash2 size={28} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700 }}>Supprimer ce groupe ?</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
              Le groupe <strong style={{ color: 'var(--color-text)' }}>«&nbsp;{deleteConfirmGroup.name}&nbsp;»</strong> sera définitivement supprimé.
              Les inscriptions des élèves ne seront pas affectées.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirmGroup(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)',
                  color: 'var(--color-text)', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteGroup}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                  boxShadow: '0 4px 16px rgba(239,68,68,0.3)'
                }}
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ──────────── ADD STUDENT TO GROUP MODAL ──────────── */}
      {addStudentModalGroupId && (() => {
        const modalGroup = groups.find(g => g.id === addStudentModalGroupId)
        if (!modalGroup) return null

        const modalAvailableStudents = students.filter(student => {
          const isInGroup = enrollments.some(e => e.student_id === student.id && e.group_id === modalGroup.id)
          return !isInGroup
        })
        
        const filteredStudents = modalAvailableStudents.filter(student => {
          return student.name.toLowerCase().includes(addStudentModalSearch.toLowerCase())
        })

        return (
          <div className="modal-overlay fade-in" onClick={() => { setAddStudentModalGroupId(null); setAddStudentModalSearch('') }} style={{ backdropFilter: 'blur(4px)' }}>
            <div className="modal-content scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', borderRadius: '20px', padding: '0', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div style={{ padding: '24px 24px 16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Ajouter un élève</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>au groupe {modalGroup.name}</p>
                  </div>
                  <button onClick={() => { setAddStudentModalGroupId(null); setAddStudentModalSearch('') }} style={{ background: 'var(--color-surface-hover)', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Rechercher un élève..." 
                    className="input-field"
                    value={addStudentModalSearch}
                    onChange={e => setAddStudentModalSearch(e.target.value)}
                    style={{ paddingLeft: '36px', borderRadius: '12px', fontSize: '13px' }}
                    autoFocus
                  />
                </div>
              </div>
              
              <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
                {filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                    {modalAvailableStudents.length === 0 ? (
                      <>
                        <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Aucun élève disponible.</p>
                        <p style={{ margin: '0 0 16px', fontSize: '12px', lineHeight: 1.5 }}>
                          Tous les élèves de la base de données sont déjà dans ce groupe.
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: '0 0 16px', fontStyle: 'italic', fontSize: '13px' }}>Aucun élève ne correspond à votre recherche.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredStudents.map(student => {
                      const existingEnrollment = enrollments.find(e => e.student_id === student.id && e.teacher_id === modalGroup.teacher_id)
                      return (
                        <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600 }}>{student.name}</span>
                            {!existingEnrollment && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Non inscrit avec ce prof</span>}
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                if (!existingEnrollment) {
                                  // Show inline rate picker instead of window.prompt
                                  setPendingEnrollStudent(student)
                                  setPendingEnrollRate('50')
                                  return;
                                } else {
                                  await updateEnrollmentGroup(existingEnrollment.id, modalGroup.id);
                                }
                                setAddStudentModalGroupId(null);
                                setAddStudentModalSearch('');
                                await loadData();
                                showNotification('Élève ajouté au groupe.');
                              } catch(err: any) {
                                alert('Erreur: ' + err.message);
                              }
                            }}
                            style={{ padding: '6px 12px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(99,102,241,0.2)' }}
                          >
                            <Plus size={14} /> Ajouter
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Inline rate picker for unenrolled students */}
              {pendingEnrollStudent && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600 }}>
                    Inscrire <span style={{ color: '#6366f1' }}>{pendingEnrollStudent.name}</span> avec ce professeur&nbsp;:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <select
                      className="input-field"
                      value={pendingEnrollType}
                      onChange={e => setPendingEnrollType(e.target.value as any)}
                      style={{ flex: 1, fontSize: '13px' }}
                    >
                      <option value="hourly">Par Heure</option>
                      <option value="session">Par Séance</option>
                      <option value="monthly">Forfait Mensuel</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      autoFocus
                      className="input-field"
                      value={pendingEnrollRate}
                      onChange={e => setPendingEnrollRate(e.target.value)}
                      placeholder="Tarif DTN..."
                      style={{ flex: 1, fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPendingEnrollStudent(null)}
                      style={{ whiteSpace: 'nowrap' }}
                    >Annuler</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', whiteSpace: 'nowrap' }}
                      onClick={async () => {
                        try {
                          const rate = parseFloat(pendingEnrollRate) || 50;
                          await addEnrollment(pendingEnrollStudent.id, modalGroup.teacher_id, rate, pendingEnrollType, modalGroup.id);
                          setPendingEnrollStudent(null);
                          setAddStudentModalGroupId(null);
                          setAddStudentModalSearch('');
                          await loadData();
                          showNotification('Élève inscrit et ajouté au groupe.');
                        } catch(err: any) {
                          alert('Erreur: ' + err.message);
                        }
                      }}
                    >Confirmer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
