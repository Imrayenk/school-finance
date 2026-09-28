import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getTimetableRecords,
  getTeachers,
  getStudents,
  getClassrooms,
  addClassroom,
  deleteClassroom,
  detectConflicts,
  addTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getGroups
} from '../db/sqlite'
import type {
  TimetableRecord,
  Teacher,
  Student,
  Classroom,
  ScheduleConflict,
  DayOfWeek,
  Group
} from '../types'
import {
  Clock,
  Plus,
  AlertTriangle,
  MapPin,
  User,
  GraduationCap,
  X,
  CheckCircle2,
  Trash2,
  DoorOpen,
  DoorClosed,
  Layers,
  Search,
  Filter
} from 'lucide-react'
import { ConfirmModal } from './ConfirmModal'

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche'
]

export const TimetableGrid: React.FC = () => {
  const [records, setRecords] = useState<TimetableRecord[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Filters
  const [filterTeacher, setFilterTeacher] = useState<string>('All')
  const [filterRoom, setFilterRoom] = useState<string>('All')

  // Edit / Add Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editingEntry, setEditingEntry] = useState<TimetableRecord | null>(null)
  const [formTeacherId, setFormTeacherId] = useState<string>('')
  const [formStudentId, setFormStudentId] = useState<string>('')
  const [formGroupId, setFormGroupId] = useState<string>('')
  const [isGroupSession, setIsGroupSession] = useState<boolean>(false)
  const [formDay, setFormDay] = useState<DayOfWeek>('Lundi')
  const [formStartTime, setFormStartTime] = useState<string>('14:00')
  const [formEndTime, setFormEndTime] = useState<string>('15:30')
  const [formRoom, setFormRoom] = useState<string>('')

  // Classroom Management Modal State
  const [roomModalOpen, setRoomModalOpen] = useState<boolean>(false)
  const [newRoomName, setNewRoomName] = useState<string>('')

  // Auto-select valid group when teacher changes
  useEffect(() => {
    if (formTeacherId && groups.length > 0) {
      const validGroups = groups.filter(g => g.teacher_id === formTeacherId)
      if (validGroups.length > 0) {
        // If the current group isn't valid for this teacher, switch it
        if (!validGroups.some(g => g.id === formGroupId)) {
          setFormGroupId(validGroups[0].id)
        }
      } else {
        setFormGroupId('') // No groups for this teacher
      }
    }
  }, [formTeacherId, groups])

  // Sleek In-App Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    variant?: 'danger' | 'warning' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmer',
    variant: 'danger',
    onConfirm: () => {}
  })

  const [notification, setNotification] = useState<string | null>(null)
  const [roomViewDay, setRoomViewDay] = useState<DayOfWeek>(() => {
    const todayIdx = new Date().getDay()
    // JS: 0=Sun,1=Mon..6=Sat -> map to our DAYS_OF_WEEK
    const mapping: Record<number, DayOfWeek> = {
      0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi',
      4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi'
    }
    return mapping[todayIdx] || 'Lundi'
  })

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [recs, tList, sList, cList, gList] = await Promise.all([
      getTimetableRecords(),
      getTeachers(),
      getStudents(),
      getClassrooms(),
      getGroups()
    ])
    setRecords(recs)
    setTeachers(tList)
    setStudents(sList)
    setClassrooms(cList)
    setGroups(gList)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const teachersMap = useMemo(() => {
    const map = new Map<string, Teacher>()
    teachers.forEach((t) => map.set(t.id, t))
    return map
  }, [teachers])

  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>()
    students.forEach((s) => map.set(s.id, s))
    return map
  }, [students])

  const groupsMap = useMemo(() => {
    const map = new Map<string, Group>()
    groups.forEach((g) => map.set(g.id, g))
    return map
  }, [groups])

  // Conflict Detection
  const conflicts = useMemo(() => {
    return detectConflicts(records, teachersMap, studentsMap)
  }, [records, teachersMap, studentsMap])

  // Set of entry IDs currently in conflict
  const conflictedEntryIds = useMemo(() => {
    const set = new Set<string>()
    conflicts.forEach((c) => {
      set.add(c.entryId1)
      set.add(c.entryId2)
    })
    return set
  }, [conflicts])

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchTeacher = filterTeacher === 'All' || r.teacher_id === filterTeacher
      const matchRoom = filterRoom === 'All' || (r.room || '').trim() === filterRoom
      return matchTeacher && matchRoom
    })
  }, [records, filterTeacher, filterRoom])

  // Room occupancy data for the selected day
  const roomOccupancy = useMemo(() => {
    // 1) Collect all classrooms (both from classrooms table and any legacy string from records)
    const roomItems: { id?: string; name: string }[] = classrooms.map((c) => ({ id: c.id, name: c.name }))
    
    // Add any room in records that might not be in classrooms list
    records.forEach((r) => {
      if (r.room && r.room.trim() && !roomItems.some((item) => item.name.toLowerCase() === r.room!.trim().toLowerCase())) {
        roomItems.push({ name: r.room.trim() })
      }
    })

    // 2) Get records for the selected day
    const dayRecords = records.filter((r) => r.day_of_week === roomViewDay)

    // 3) Build per-room info: list of sessions happening in that room on this day
    type RoomSession = {
      startTime: string
      endTime: string
      teacherName: string
      studentName: string
      subject: string
    }

    const roomMap = new Map<string, { id?: string; sessions: RoomSession[] }>()
    roomItems.forEach((item) => {
      roomMap.set(item.name, { id: item.id, sessions: [] })
    })

    dayRecords.forEach((rec) => {
      const room = (rec.room || '').trim()
      if (!room) return
      if (!roomMap.has(room)) {
        roomMap.set(room, { sessions: [] })
      }
      const teacher = teachersMap.get(rec.teacher_id)
      const student = rec.student_id ? studentsMap.get(rec.student_id) : undefined
      const group = rec.group_id ? groupsMap.get(rec.group_id) : undefined
      roomMap.get(room)!.sessions.push({
        startTime: rec.start_time,
        endTime: rec.end_time,
        teacherName: teacher?.name || 'N/A',
        studentName: student ? student.name : (group ? `Groupe: ${group.name}` : 'N/A'),
        subject: teacher?.subject || 'Cours'
      })
    })

    // Sort sessions within each room by start time
    roomMap.forEach((entry) => {
      entry.sessions.sort((a, b) => a.startTime.localeCompare(b.startTime))
    })

    // 4) Convert to sorted array: In-use first, then alphabetical
    const result = Array.from(roomMap.entries())
      .map(([room, { id, sessions }]) => ({
        id,
        room,
        sessions,
        inUse: sessions.length > 0
      }))
      .sort((a, b) => {
        if (a.inUse !== b.inUse) return a.inUse ? -1 : 1
        return a.room.localeCompare(b.room)
      })

    return result
  }, [records, classrooms, roomViewDay, teachersMap, studentsMap])

  // Add Classroom Handler
  const handleAddClassroomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newRoomName.trim()
    if (!trimmed) return
    if (classrooms.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showNotification('Cette salle de cours existe déjà.')
      return
    }
    await addClassroom(trimmed)
    setNewRoomName('')
    setRoomModalOpen(false)
    await loadData()
    showNotification(`Salle de cours "${trimmed}" ajoutée avec succès !`)
  }

  // Delete Classroom Handler
  const handleDeleteClassroom = (roomId?: string, roomName?: string) => {
    if (!roomId) {
      showNotification('Impossible de supprimer une salle non enregistrée.')
      return
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la Salle de Cours',
      message: `Êtes-vous sûr de vouloir supprimer la salle de cours "${roomName}" ?`,
      confirmLabel: 'Supprimer la salle',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        await deleteClassroom(roomId)
        await loadData()
        showNotification(`Salle de cours "${roomName}" supprimée.`)
      }
    })
  }

  // Open modal to add a new slot
  const handleOpenAddModal = (defaultDay: DayOfWeek = 'Lundi') => {
    setEditingEntry(null)
    setFormTeacherId(teachers[0]?.id || '')
    setFormStudentId(students[0]?.id || '')
    setFormGroupId(groups[0]?.id || '')
    setIsGroupSession(false)
    setFormDay(defaultDay)
    setFormStartTime('14:00')
    setFormEndTime('15:30')
    setFormRoom(classrooms[0]?.name || 'Salle Einstein')
    setModalOpen(true)
  }

  // Open modal to edit existing slot
  const handleOpenEditModal = (rec: TimetableRecord) => {
    setEditingEntry(rec)
    setFormTeacherId(rec.teacher_id)
    setFormStudentId(rec.student_id || '')
    setFormGroupId(rec.group_id || '')
    setIsGroupSession(!!rec.group_id)
    setFormDay(rec.day_of_week)
    setFormStartTime(rec.start_time)
    setFormEndTime(rec.end_time)
    setFormRoom(rec.room || classrooms[0]?.name || 'Salle Einstein')
    setModalOpen(true)
  }

  // Handle Save
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTeacherId) {
      showNotification('Veuillez sélectionner un enseignant.')
      return
    }
    if (!isGroupSession && !formStudentId) {
      showNotification('Veuillez sélectionner un élève.')
      return
    }
    if (isGroupSession && !formGroupId) {
      showNotification('Veuillez sélectionner un groupe.')
      return
    }

    if (formStartTime >= formEndTime) {
      showNotification("L'heure de début doit être strictement antérieure à l'heure de fin.")
      return
    }

    if (editingEntry) {
      await updateTimetableEntry(editingEntry.id, {
        teacher_id: formTeacherId,
        student_id: isGroupSession ? undefined : formStudentId,
        group_id: isGroupSession ? formGroupId : undefined,
        day_of_week: formDay,
        start_time: formStartTime,
        end_time: formEndTime,
        room: formRoom
      })
      showNotification('Créneau mis à jour avec succès.')
    } else {
      await addTimetableEntry({
        teacher_id: formTeacherId,
        student_id: isGroupSession ? undefined : formStudentId,
        group_id: isGroupSession ? formGroupId : undefined,
        day_of_week: formDay,
        start_time: formStartTime,
        end_time: formEndTime,
        room: formRoom
      })
      showNotification("Nouveau créneau ajouté à l'emploi du temps.")
    }

    setModalOpen(false)
    await loadData()
  }

  // Handle Delete
  const handleDeleteEntry = () => {
    if (!editingEntry) return
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer le Créneau',
      message: "Voulez-vous vraiment supprimer ce créneau de l'emploi du temps ?",
      confirmLabel: 'Supprimer définitivement',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        await deleteTimetableEntry(editingEntry.id)
        setModalOpen(false)
        await loadData()
        showNotification("Créneau supprimé de l'emploi du temps.")
      }
    })
  }

  // Helper to assign subject theme classes
  const getCourseCardClass = (subject: string, hasConflict: boolean) => {
    if (hasConflict) return 'course-card course-card-conflict'
    const s = (subject || '').toLowerCase()
    if (s.includes('math')) return 'course-card course-card-math'
    if (s.includes('phys')) return 'course-card course-card-physics'
    if (s.includes('svt') || s.includes('bio')) return 'course-card course-card-svt'
    if (s.includes('fran')) return 'course-card course-card-french'
    if (s.includes('arab') || s.includes('phil')) return 'course-card course-card-arabic'
    if (s.includes('angl')) return 'course-card course-card-english'
    return 'course-card course-card-math'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Hero Banner */}
      <div className="page-hero hero-amber fade-in">
        <div className="page-hero-content">
          <div className="page-hero-icon">
            <Clock size={26} color="white" />
          </div>
          <div>
            <h1 className="page-hero-title">Emploi du Temps Hebdomadaire</h1>
            <p className="page-hero-subtitle">
              Détection automatique des conflits d'horaires, de salles et d'élèves
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <button
            id="btn-add-timetable-entry"
            type="button"
            className="btn-hero"
            onClick={() => handleOpenAddModal()}
          >
            <Plus size={16} />
            Ajouter une Entrée
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="toast-success">
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {/* Active Conflict Banner */}
      {conflicts.length > 0 && (
        <div
          id="conflicts-alert-banner"
          style={{
            backgroundColor: 'var(--color-semantic-debt-bg)',
            border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={18} color="var(--color-semantic-debt)" aria-hidden="true" />
            <span style={{ fontWeight: 700, color: 'var(--color-semantic-debt)', fontSize: '14px' }}>
              {conflicts.length} Conflit{conflicts.length > 1 ? 's' : ''} de Planification Détecté{conflicts.length > 1 ? 's' : ''} !
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: '13px', color: 'var(--color-semantic-debt)' }}>
            {conflicts.map((c, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>
                {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Subject Color Legend */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Légende thématique des cours :
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span className="badge-subject badge-subject-math">Mathématiques</span>
          <span className="badge-subject badge-subject-physics">Physique-Chimie</span>
          <span className="badge-subject badge-subject-svt">SVT</span>
          <span className="badge-subject badge-subject-french">Français</span>
          <span className="badge-subject badge-subject-arabic">Arabe & Philo</span>
          <span className="badge-subject badge-subject-english">Anglais</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <AlertTriangle size={11} />
            Conflit Détecté
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={16} color="var(--color-text-muted)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Filtres :</span>
        </div>
        <select
          className="select-field"
          style={{ width: '250px' }}
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
        >
          <option value="All">Tous les enseignants</option>
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className="select-field"
          style={{ width: '250px' }}
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
        >
          <option value="All">Toutes les salles</option>
          {classrooms.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Weekly Timetable Calendar Grid */}
      {loading ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chargement de la grille d'emploi du temps...
        </div>
      ) : (
        <div
          id="timetable-weekly-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-3)'
          }}
        >
          {DAYS_OF_WEEK.map((day) => {
            const dayRecords = filteredRecords.filter((r) => r.day_of_week === day)

            return (
              <div
                key={day}
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: '280px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{day}</span>
                    <span
                      style={{
                        backgroundColor: dayRecords.length > 0 ? '#dbeafe' : 'var(--color-surface-muted)',
                        color: dayRecords.length > 0 ? '#1e40af' : 'var(--color-text-muted)',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      {dayRecords.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenAddModal(day)}
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    title={`Ajouter un cours le ${day}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Day Slots */}
                <div
                  style={{
                    padding: 'var(--space-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                    flex: 1
                  }}
                >
                  {dayRecords.length === 0 ? (
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        margin: 'auto'
                      }}
                    >
                      Aucun cours programmé
                    </div>
                  ) : (
                    dayRecords.map((rec) => {
                      const teacher = teachersMap.get(rec.teacher_id)
                      const student = rec.student_id ? studentsMap.get(rec.student_id) : undefined
                      const group = rec.group_id ? groupsMap.get(rec.group_id) : undefined
                      const hasConflict = conflictedEntryIds.has(rec.id)

                      return (
                        <div
                          key={rec.id}
                          id={`timetable-block-${rec.id}`}
                          tabIndex={0}
                          role="button"
                          onClick={() => handleOpenEditModal(rec)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleOpenEditModal(rec)
                            }
                          }}
                          className={getCourseCardClass(teacher?.subject || '', hasConflict)}
                        >
                          {/* Time & Conflict Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: hasConflict ? '#b91c1c' : '#1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              <Clock size={11} aria-hidden="true" />
                              {rec.start_time} - {rec.end_time}
                            </span>

                            {hasConflict && (
                              <span
                                className="badge-debt"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  fontWeight: 800,
                                  color: '#ffffff',
                                  backgroundColor: '#ef4444'
                                }}
                              >
                                <AlertTriangle size={10} aria-hidden="true" />
                                Conflit
                              </span>
                            )}
                          </div>

                          {/* Subject & Teacher */}
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                            {teacher?.subject || 'Cours'}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 500
                            }}
                          >
                            <User size={12} aria-hidden="true" />
                            {teacher?.name || 'Enseignant non spécifié'}
                          </div>

                          {/* Student / Group */}
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <GraduationCap size={12} aria-hidden="true" />
                            {student?.name || (group ? `Groupe: ${group.name}` : 'Élève non spécifié')}
                          </div>

                          {/* Room */}
                          {rec.room && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '2px',
                                fontWeight: 500
                              }}
                            >
                              <MapPin size={11} aria-hidden="true" />
                              {rec.room}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Room Occupancy Status Panel ── */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)'
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <DoorOpen size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>État des Salles de Cours</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Disponibilité et gestion des salles de classe par jour
              </p>
            </div>
          </div>

          {/* Right Action & Day selector pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              id="btn-add-classroom"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRoomModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                borderColor: '#4f46e5',
                color: '#4f46e5'
              }}
            >
              <Plus size={14} />
              Ajouter une Salle
            </button>

            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setRoomViewDay(day)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: roomViewDay === day ? '1.5px solid #4f46e5' : '1px solid var(--color-border)',
                    backgroundColor: roomViewDay === day ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                    color: roomViewDay === day ? '#4f46e5' : 'var(--color-text-muted)',
                    fontWeight: roomViewDay === day ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit'
                  }}
                >
                  {day.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI summary row */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#dc2626'
            }}
          >
            <DoorClosed size={14} />
            {roomOccupancy.filter((r) => r.inUse).length} Occupée{roomOccupancy.filter((r) => r.inUse).length > 1 ? 's' : ''}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.15)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#16a34a'
            }}
          >
            <DoorOpen size={14} />
            {roomOccupancy.filter((r) => !r.inUse).length} Disponible{roomOccupancy.filter((r) => !r.inUse).length > 1 ? 's' : ''}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(79, 70, 229, 0.06)',
              border: '1px solid rgba(79, 70, 229, 0.15)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#4f46e5'
            }}
          >
            <Layers size={14} />
            {classrooms.length} Salle{classrooms.length > 1 ? 's' : ''} enregistrée{classrooms.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Room cards grid */}
        {roomOccupancy.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-5)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '13px'
            }}
          >
            Aucune salle de cours enregistrée. Cliquez sur "+ Ajouter une Salle" pour en créer une.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--space-3)'
            }}
          >
            {roomOccupancy.map(({ id, room, sessions, inUse }) => (
              <div
                key={room}
                style={{
                  border: `1.5px solid ${inUse ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.3)'}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  backgroundColor: 'var(--color-surface)'
                }}
              >
                {/* Room header bar */}
                <div
                  style={{
                    background: inUse
                      ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                      : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {inUse ? (
                      <DoorClosed size={16} style={{ color: '#dc2626' }} />
                    ) : (
                      <DoorOpen size={16} style={{ color: '#16a34a' }} />
                    )}
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      {room}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        color: inUse ? '#dc2626' : '#16a34a',
                        backgroundColor: inUse ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        border: `1px solid ${inUse ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {inUse ? '● Occupée' : '● Libre'}
                    </span>
                    {id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClassroom(id, room)}
                        title={`Supprimer la salle ${room}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '3px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sessions list or empty state */}
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-surface-raised)' }}>
                  {sessions.length === 0 ? (
                    <div
                      style={{
                        color: '#16a34a',
                        fontSize: '12px',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Aucun cours programmé — salle disponible toute la journée
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {sessions.map((s, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-surface-muted)',
                            border: '1px solid var(--color-border-subtle)'
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#4f46e5',
                              whiteSpace: 'nowrap',
                              fontSize: '11px',
                              backgroundColor: 'rgba(79, 70, 229, 0.08)',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            <Clock size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
                            {s.startTime}–{s.endTime}
                          </span>
                          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                            {s.subject}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            {s.teacherName} · {s.studentName}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Classroom Modal */}
      {roomModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-classroom-title"
          onClick={() => setRoomModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DoorOpen size={18} style={{ color: '#4f46e5' }} />
                <h2 id="modal-classroom-title" style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  Nouvelle Salle de Cours
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRoomModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddClassroomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="new-room-name"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Nom de la salle de cours * :
                </label>
                <input
                  id="new-room-name"
                  type="text"
                  required
                  className="input-field"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="ex. Salle Avicenne, Salle 101, Labo Info..."
                  autoFocus
                />
              </div>

              {/* Existing classrooms summary */}
              {classrooms.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  <span style={{ fontWeight: 600 }}>Salles existantes ({classrooms.length}) : </span>
                  {classrooms.map((c) => c.name).join(', ')}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRoomModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  id="btn-save-new-classroom"
                  type="submit"
                  className="btn btn-primary"
                >
                  Ajouter la Salle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-timetable-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="modal-timetable-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {editingEntry ? "Modifier le Créneau d'Emploi du Temps" : "Nouveau Créneau d'Emploi du Temps"}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Teacher Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="form-teacher"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Enseignant * :
                </label>
                <select
                  id="form-teacher"
                  className="select-field"
                  required
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Type Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Type de session * :
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="sessionType"
                      checked={!isGroupSession}
                      onChange={() => setIsGroupSession(false)}
                      style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                    />
                    Élève Individuel
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="sessionType"
                      checked={isGroupSession}
                      onChange={() => setIsGroupSession(true)}
                      style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                    />
                    Groupe
                  </label>
                </div>
              </div>

              {/* Student or Group Selector */}
              {!isGroupSession ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="form-student"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Élève Inscrit * :
                  </label>
                  <select
                    id="form-student"
                    className="select-field"
                    required
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.grade_level})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="form-group"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Groupe * :
                  </label>
                  <select
                    id="form-group"
                    className="select-field"
                    required
                    value={formGroupId}
                    onChange={(e) => setFormGroupId(e.target.value)}
                  >
                    <option value="" disabled>Sélectionner un groupe...</option>
                    {groups
                      .filter(g => !formTeacherId || g.teacher_id === formTeacherId)
                      .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of Week */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="form-day"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Jour de la Semaine * :
                </label>
                <select
                  id="form-day"
                  className="select-field"
                  value={formDay}
                  onChange={(e) => setFormDay(e.target.value as DayOfWeek)}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Slots */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="form-start-time"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Heure Début * :
                  </label>
                  <input
                    id="form-start-time"
                    type="time"
                    required
                    className="input-field"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="form-end-time"
                    style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                  >
                    Heure Fin * :
                  </label>
                  <input
                    id="form-end-time"
                    type="time"
                    required
                    className="input-field"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Classroom Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="form-room"
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Salle de Cours :
                </label>
                {classrooms.length > 0 ? (
                  <select
                    id="form-room"
                    className="select-field"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {formRoom && !classrooms.some((c) => c.name === formRoom) && (
                      <option value={formRoom}>{formRoom}</option>
                    )}
                  </select>
                ) : (
                  <input
                    id="form-room"
                    type="text"
                    className="input-field"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="ex. Salle Einstein"
                  />
                )}
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 'var(--space-3)'
                }}
              >
                {editingEntry ? (
                  <button
                    id="btn-delete-timetable-entry"
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleDeleteEntry}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Supprimer le Créneau
                  </button>
                ) : (
                  <div />
                )}

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setModalOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    id="btn-save-schedule-changes"
                    type="submit"
                    className="btn btn-primary"
                  >
                    Enregistrer le Créneau
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek In-App Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1200,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <CheckCircle2 size={16} />
          {notification}
        </div>
      )}

      {/* Sleek In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

