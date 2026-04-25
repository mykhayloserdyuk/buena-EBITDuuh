'use client'

import styles from './Sidebar.module.css'

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
  return (
    <aside className={styles.sidebar}>
      {/* Property hero — full-bleed image with firm name overlay */}
      <div
        className={styles.imageWrap}
        style={{ backgroundImage: 'url(/condominium1.webp)' }}
        role="img"
        aria-label="WEG Immanuelkirchstraße 26"
      >
        <div className={styles.imageOverlay}>
          <span className={styles.orgName}>Din Property Management GmbH</span>
          <span className={styles.propertyMeta}>WEG Immanuelkirchstraße 26 · 3 Gebäude · 52 Einheiten</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Vorgeschlagene Fragen</div>
        <ul className={styles.suggestionList}>
          {suggested.map((s) => (
            <li key={s}>
              <button
                className={styles.suggestion}
                onClick={() => onSuggest(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
