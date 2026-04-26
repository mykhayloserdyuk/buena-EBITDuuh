'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './Sidebar.module.css'

const properties = [
  { id: '1', name: 'WEG Immanuelkirchstraße 26', meta: '3 Gebäude · 52 Einheiten', image: '/condominium.webp' },
  { id: '2', name: 'WEG Kastanienallee 12',       meta: '1 Gebäude · 18 Einheiten', image: '/condominium.webp' },
  { id: '3', name: 'WEG Prenzlauer Berg 7',        meta: '2 Gebäude · 34 Einheiten', image: '/condominium.webp' },
  { id: '4', name: 'MFH Kreuzberg 3',              meta: '1 Gebäude · 8 Einheiten',  image: '/condominium.webp' },
]

const suggested = [
  'Welche Mieter haben offene Zahlungen?',
  'Zeig mir alle Eigentümer im Beirat.',
  'Was hat Hausmeister Mueller GmbH dieses Jahr gekostet?',
  'Wie hoch sind die monatlichen Mieteinnahmen?',
]

interface SidebarProps {
  onSuggest: (text: string) => void
}

export default function Sidebar({ onSuggest }: SidebarProps) {
  const [selectedId, setSelectedId] = useState('1')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = properties.find(p => p.id === selectedId)!

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.dropdownWrap} ref={ref}>
        <button
          className={styles.dropdownTrigger}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span className={styles.dropdownLabel}>{selected.name}</span>
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className={styles.dropdownMenu}>
            {properties.map(p => (
              <button
                key={p.id}
                className={`${styles.dropdownItem} ${p.id === selectedId ? styles.dropdownItemActive : ''}`}
                onClick={() => { setSelectedId(p.id); setOpen(false) }}
              >
                <span className={styles.dropdownItemName}>{p.name}</span>
                <span className={styles.dropdownItemMeta}>{p.meta}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={styles.imageWrap}
        style={{ backgroundImage: `url(${selected.image})` }}
        role="img"
        aria-label={selected.name}
      >
        <div className={styles.imageOverlay}>
          <span className={styles.orgName}>Din Property Management GmbH</span>
          <span className={styles.propertyMeta}>{selected.name} · {selected.meta}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Vorgeschlagene Fragen</div>
        <ul className={styles.suggestionList}>
          {suggested.map((s) => (
            <li key={s}>
              <button className={styles.suggestion} onClick={() => onSuggest(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
