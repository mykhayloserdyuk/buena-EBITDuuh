'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './Sidebar.module.css'

type Property = {
  id: string
  name: string
  meta: string
  image: string
  houses?: House[]
}

type House = {
  id: string
  name: string
  meta: string
  units: Unit[]
}

type Unit = {
  id: string
  name: string
  meta: string
}

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
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [selectedHouseId, setSelectedHouseId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loadingProperties, setLoadingProperties] = useState(true)
  const [propertyError, setPropertyError] = useState('')
  const [openMenu, setOpenMenu] = useState<'property' | 'house' | 'unit' | ''>('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId) ?? properties[0]
  const houses = selectedProperty?.houses ?? []
  const selectedHouse = houses.find(house => house.id === selectedHouseId) ?? houses[0]
  const units = selectedHouse?.units ?? []
  const selectedUnit = units.find(unit => unit.id === selectedUnitId) ?? units[0]

  useEffect(() => {
    let cancelled = false

    async function loadProperties() {
      setLoadingProperties(true)
      setPropertyError('')
      console.log('[Sidebar] loading properties')

      try {
        const res = await fetch('/api/properties', { cache: 'no-store' })
        console.log('[Sidebar] /api/properties response', {
          status: res.status,
          ok: res.ok,
        })
        if (!res.ok) throw new Error('Failed to load properties')

        const data = await res.json() as { properties?: Property[] }
        const nextProperties = data.properties ?? []

        console.log('[Sidebar] /api/properties body', data)
        console.log('[Sidebar] next properties', nextProperties)

        if (cancelled) return

        setProperties(nextProperties)
        setSelectedPropertyId(current => {
          const nextProperty = current && nextProperties.some(property => property.id === current)
            ? nextProperties.find(property => property.id === current)
            : nextProperties[0]

          setSelectedHouseId(nextProperty?.houses?.[0]?.id ?? '')
          setSelectedUnitId(nextProperty?.houses?.[0]?.units?.[0]?.id ?? '')

          return nextProperty?.id ?? ''
        })
      } catch (error) {
        console.error('[Sidebar] failed to load properties', error)
        if (!cancelled) {
          setProperties([])
          setSelectedPropertyId('')
          setSelectedHouseId('')
          setSelectedUnitId('')
          setPropertyError('Objekte konnten nicht geladen werden')
        }
      } finally {
        if (!cancelled) setLoadingProperties(false)
      }
    }

    loadProperties()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu('')
    }
    if (openMenu) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [openMenu])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.dropdownWrap} ref={ref}>
        <div className={styles.selectorStack}>
          <button
            className={styles.dropdownTrigger}
            onClick={() => setOpenMenu(openMenu === 'property' ? '' : 'property')}
            aria-expanded={openMenu === 'property'}
            disabled={loadingProperties || properties.length === 0}
          >
            <span className={styles.dropdownLabel}>
              {loadingProperties ? 'Objekte laden...' : selectedProperty?.name ?? 'Keine Objekte'}
            </span>
            <svg
              className={`${styles.chevron} ${openMenu === 'property' ? styles.chevronOpen : ''}`}
              width="14" height="14" viewBox="0 0 14 14" fill="none"
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {openMenu === 'property' && (
            <div className={styles.dropdownMenu}>
              {properties.map(property => (
                <button
                  key={property.id}
                  className={`${styles.dropdownItem} ${property.id === selectedPropertyId ? styles.dropdownItemActive : ''}`}
                  onClick={() => {
                    setSelectedPropertyId(property.id)
                    setSelectedHouseId(property.houses?.[0]?.id ?? '')
                    setSelectedUnitId(property.houses?.[0]?.units?.[0]?.id ?? '')
                    setOpenMenu('')
                  }}
                >
                  <span className={styles.dropdownItemName}>{property.name}</span>
                  <span className={styles.dropdownItemMeta}>{property.meta}</span>
                </button>
              ))}
            </div>
          )}

          <button
            className={styles.dropdownTrigger}
            onClick={() => setOpenMenu(openMenu === 'house' ? '' : 'house')}
            aria-expanded={openMenu === 'house'}
            disabled={houses.length === 0}
          >
            <span className={styles.dropdownLabel}>{selectedHouse?.name ?? 'Kein Haus'}</span>
            <svg
              className={`${styles.chevron} ${openMenu === 'house' ? styles.chevronOpen : ''}`}
              width="14" height="14" viewBox="0 0 14 14" fill="none"
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {openMenu === 'house' && (
            <div className={styles.dropdownMenu}>
              {houses.map(house => (
                <button
                  key={house.id}
                  className={`${styles.dropdownItem} ${house.id === selectedHouseId ? styles.dropdownItemActive : ''}`}
                  onClick={() => {
                    setSelectedHouseId(house.id)
                    setSelectedUnitId(house.units[0]?.id ?? '')
                    setOpenMenu('')
                  }}
                >
                  <span className={styles.dropdownItemName}>{house.name}</span>
                  <span className={styles.dropdownItemMeta}>{house.meta}</span>
                </button>
              ))}
            </div>
          )}

          <button
            className={styles.dropdownTrigger}
            onClick={() => setOpenMenu(openMenu === 'unit' ? '' : 'unit')}
            aria-expanded={openMenu === 'unit'}
            disabled={units.length === 0}
          >
            <span className={styles.dropdownLabel}>{selectedUnit?.name ?? 'Keine Einheit'}</span>
            <svg
              className={`${styles.chevron} ${openMenu === 'unit' ? styles.chevronOpen : ''}`}
              width="14" height="14" viewBox="0 0 14 14" fill="none"
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {openMenu === 'unit' && (
            <div className={`${styles.dropdownMenu} ${styles.dropdownMenuTall}`}>
              {units.map(unit => (
                <button
                  key={unit.id}
                  className={`${styles.dropdownItem} ${unit.id === selectedUnitId ? styles.dropdownItemActive : ''}`}
                  onClick={() => { setSelectedUnitId(unit.id); setOpenMenu('') }}
                >
                  <span className={styles.dropdownItemName}>{unit.name}</span>
                  <span className={styles.dropdownItemMeta}>{unit.meta}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={styles.imageWrap}
        style={{ backgroundImage: `url(${selectedProperty?.image ?? '/condominium.webp'})` }}
        role="img"
        aria-label={selectedProperty?.name ?? 'Keine Objekte'}
      >
        <div className={styles.imageOverlay}>
          <span className={styles.orgName}>Din Property Management GmbH</span>
          <span className={styles.propertyMeta}>
            {propertyError || (
              selectedProperty
                ? [selectedProperty.name, selectedHouse?.name, selectedUnit?.name].filter(Boolean).join(' · ')
                : 'Keine Objekte gefunden'
            )}
          </span>
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
