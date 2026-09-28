import React from 'react'
import { LayoutDashboard, Calendar, DollarSign, Users, Clock, GraduationCap, UserCheck, Settings, Library } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch'

export type ActiveTab = 'dashboard' | 'daily-sheet' | 'financial-rollup' | 'teacher-students' | 'timetable' | 'students' | 'teachers' | 'groups' | 'settings'

interface HeaderProps {
  activeTab: ActiveTab
  onSelectTab: (tab: ActiveTab) => void
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  return (
    <header
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        position: 'relative'
      }}
    >
      {/* Sleek Modern Gradient Top Strip */}
      <div
        style={{
          height: '4px',
          background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 25%, #8b5cf6 50%, #f59e0b 75%, #ef4444 100%)'
        }}
      />

      <div
        style={{
          padding: 'var(--space-3) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px',
                boxShadow: '0 4px 10px rgba(139, 92, 246, 0.35)'
              }}
            >
              E
            </div>
            <div>
              <h1 style={{ fontSize: '19px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Espoir
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0, fontWeight: 500 }}>
                Administration Locale & Gestion Intégrée SQLite
              </p>
            </div>
          </div>
          
          <GlobalSearch 
            onResultClick={(type, id, name) => {
              if (type === 'student') onSelectTab('students')
              else if (type === 'teacher') onSelectTab('teachers')
              else if (type === 'group') onSelectTab('groups')
              
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('global_search_focus', { detail: { type, id, name } }))
              }, 50)
            }} 
          />
        </div>

        {/* Navigation with Distinct Color Identities */}
        <nav
          aria-label="Navigation Principale"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: 'var(--space-2)'
          }}
        >
          {/* Tab 0: Dashboard (Indigo / Violet) */}
          <button
            id="tab-dashboard"
            className="btn"
            onClick={() => onSelectTab('dashboard')}
            style={{
              backgroundColor: activeTab === 'dashboard' ? '#4f46e5' : '#eef2ff',
              color: activeTab === 'dashboard' ? '#ffffff' : '#3730a3',
              borderColor: activeTab === 'dashboard' ? '#4f46e5' : '#c7d2fe',
              fontWeight: 600,
              boxShadow: activeTab === 'dashboard' ? '0 3px 10px rgba(79, 70, 229, 0.35)' : 'none',
              transform: activeTab === 'dashboard' ? 'translateY(-1px)' : 'none'
            }}
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            Tableau de Bord
          </button>
          {/* Tab 1: Daily Sheet (Emerald) */}
          <button
            id="tab-daily-sheet"
            className="btn"
            onClick={() => onSelectTab('daily-sheet')}
            style={{
              backgroundColor: activeTab === 'daily-sheet' ? '#059669' : '#f0fdf4',
              color: activeTab === 'daily-sheet' ? '#ffffff' : '#065f46',
              borderColor: activeTab === 'daily-sheet' ? '#059669' : '#bbf7d0',
              fontWeight: 600,
              boxShadow: activeTab === 'daily-sheet' ? '0 3px 10px rgba(5, 150, 105, 0.35)' : 'none',
              transform: activeTab === 'daily-sheet' ? 'translateY(-1px)' : 'none'
            }}
          >
            <Calendar size={16} aria-hidden="true" />
            Fiche Journalière (Présence)
          </button>

          {/* Tab 2: Financial Rollup (Royal Blue) */}
          <button
            id="tab-financial-rollup"
            className="btn"
            onClick={() => onSelectTab('financial-rollup')}
            style={{
              backgroundColor: activeTab === 'financial-rollup' ? '#2563eb' : '#eff6ff',
              color: activeTab === 'financial-rollup' ? '#ffffff' : '#1e40af',
              borderColor: activeTab === 'financial-rollup' ? '#2563eb' : '#bfdbfe',
              fontWeight: 600,
              boxShadow: activeTab === 'financial-rollup' ? '0 3px 10px rgba(37, 99, 235, 0.35)' : 'none',
              transform: activeTab === 'financial-rollup' ? 'translateY(-1px)' : 'none'
            }}
          >
            <DollarSign size={16} aria-hidden="true" />
            Récapitulatif Financier Mensuel
          </button>

          {/* Tab 3: Teacher-Students Tracker (Vibrant Violet) */}
          <button
            id="tab-teacher-students"
            className="btn"
            onClick={() => onSelectTab('teacher-students')}
            style={{
              backgroundColor: activeTab === 'teacher-students' ? '#7c3aed' : '#f5f3ff',
              color: activeTab === 'teacher-students' ? '#ffffff' : '#5b21b6',
              borderColor: activeTab === 'teacher-students' ? '#7c3aed' : '#ddd6fe',
              fontWeight: 600,
              boxShadow: activeTab === 'teacher-students' ? '0 3px 10px rgba(124, 58, 237, 0.35)' : 'none',
              transform: activeTab === 'teacher-students' ? 'translateY(-1px)' : 'none'
            }}
          >
            <UserCheck size={16} aria-hidden="true" />
            Suivi par Enseignant
          </button>

          {/* Tab 4: Timetable (Sunset Amber) */}
          <button
            id="tab-timetable"
            className="btn"
            onClick={() => onSelectTab('timetable')}
            style={{
              backgroundColor: activeTab === 'timetable' ? '#d97706' : '#fffbeb',
              color: activeTab === 'timetable' ? '#ffffff' : '#92400e',
              borderColor: activeTab === 'timetable' ? '#d97706' : '#fde68a',
              fontWeight: 600,
              boxShadow: activeTab === 'timetable' ? '0 3px 10px rgba(217, 119, 6, 0.35)' : 'none',
              transform: activeTab === 'timetable' ? 'translateY(-1px)' : 'none'
            }}
          >
            <Clock size={16} aria-hidden="true" />
            Emploi du Temps & Conflits
          </button>

          {/* Tab 5: Students (Ocean Teal/Cyan) */}
          <button
            id="tab-students"
            className="btn"
            onClick={() => onSelectTab('students')}
            style={{
              backgroundColor: activeTab === 'students' ? '#0284c7' : '#f0f9ff',
              color: activeTab === 'students' ? '#ffffff' : '#075985',
              borderColor: activeTab === 'students' ? '#0284c7' : '#bae6fd',
              fontWeight: 600,
              boxShadow: activeTab === 'students' ? '0 3px 10px rgba(2, 132, 199, 0.35)' : 'none',
              transform: activeTab === 'students' ? 'translateY(-1px)' : 'none'
            }}
          >
            <GraduationCap size={16} aria-hidden="true" />
            Élèves & InEriptions
          </button>

          {/* Tab 6: Teachers (Ruby Rose) */}
          <button
            id="tab-teachers"
            className="btn"
            onClick={() => onSelectTab('teachers')}
            style={{
              backgroundColor: activeTab === 'teachers' ? '#e11d48' : '#fff1f2',
              color: activeTab === 'teachers' ? '#ffffff' : '#9f1239',
              borderColor: activeTab === 'teachers' ? '#e11d48' : '#fecdd3',
              fontWeight: 600,
              boxShadow: activeTab === 'teachers' ? '0 3px 10px rgba(225, 29, 72, 0.35)' : 'none',
              transform: activeTab === 'teachers' ? 'translateY(-1px)' : 'none'
            }}
          >
            <Users size={16} aria-hidden="true" />
            Enseignants
          </button>

          {/* Tab 6.5: Groups (Fuchsia / Purple) */}
          <button
            id="tab-groups"
            className="btn"
            onClick={() => onSelectTab('groups')}
            style={{
              backgroundColor: activeTab === 'groups' ? '#c026d3' : '#fdf4ff',
              color: activeTab === 'groups' ? '#ffffff' : '#86198f',
              borderColor: activeTab === 'groups' ? '#c026d3' : '#f5d0fe',
              fontWeight: 600,
              boxShadow: activeTab === 'groups' ? '0 3px 10px rgba(192, 38, 211, 0.35)' : 'none',
              transform: activeTab === 'groups' ? 'translateY(-1px)' : 'none'
            }}
          >
            <Library size={16} aria-hidden="true" />
            Groupes
          </button>

          {/* Tab 7: Settings (Slate / Steel) */}
          <button
            id="tab-settings"
            className="btn"
            onClick={() => onSelectTab('settings')}
            style={{
              backgroundColor: activeTab === 'settings' ? '#475569' : '#f1f5f9',
              color: activeTab === 'settings' ? '#ffffff' : '#334155',
              borderColor: activeTab === 'settings' ? '#475569' : '#cbd5e1',
              fontWeight: 600,
              boxShadow: activeTab === 'settings' ? '0 3px 10px rgba(71, 85, 105, 0.35)' : 'none',
              transform: activeTab === 'settings' ? 'translateY(-1px)' : 'none',
              marginLeft: 'auto'
            }}
          >
            <Settings size={16} aria-hidden="true" />
            Paramètres
          </button>
        </nav>
      </div>
    </header>
  )
}

