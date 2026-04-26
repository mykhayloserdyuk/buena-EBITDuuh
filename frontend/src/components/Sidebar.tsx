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
  image: string
  address?: string
  mapsUrl?: string
  unitCount?: number
  totalArea?: number
  units: Unit[]
}

type Unit = {
  id: string
  name: string
  meta: string
  location?: string
  kind?: string
  area?: number
  rooms?: number
  income?: number
}

export default function Sidebar() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [selectedHouseId, setSelectedHouseId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loadingProperties, setLoadingProperties] = useState(true)
  const [propertyError, setPropertyError] = useState('')
  const [openMenu, setOpenMenu] = useState<'house' | 'unit' | ''>('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedProperty = properties.find(p => p.id === selectedPropertyId) ?? properties[0]
  const houses = selectedProperty?.houses ?? []
  const selectedHouse = houses.find(house => house.id === selectedHouseId) ?? houses[0]
  const units = selectedHouse?.units ?? []
  const selectedUnit = units.find(unit => unit.id === selectedUnitId) ?? units[0]
  const formattedIncome = typeof selectedUnit?.income === 'number'
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(selectedUnit.income)
    : '-'

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

        const data = await res.json() as { properties?: Property[] }
        if (!res.ok) {
          console.warn('[Sidebar] /api/properties error body', data)
          throw new Error('Failed to load properties')
        }

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
      <div
        className={styles.imageWrap}
        style={{ backgroundImage: `url(${selectedHouse?.image ?? selectedProperty?.image ?? '/condominium.webp'})` }}
        role="img"
        aria-label={selectedHouse?.name ?? selectedProperty?.name ?? 'Keine Objekte'}
      >
        <div className={styles.imageOverlay}>
          <div className={styles.heroText}>
            <span className={styles.orgName}>{selectedHouse?.name ?? 'Haus'}</span>
            <span className={styles.propertyMeta}>
              {propertyError || selectedHouse?.address || 'Keine Adresse hinterlegt'}
            </span>
          </div>
          {selectedHouse?.mapsUrl && (
            <a
              className={styles.mapLink}
              href={selectedHouse.mapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${selectedHouse.name} in Google Maps öffnen`}
            >
              <svg
                className={styles.mapIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 3v15M15 6v15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}
        </div>
      </div>

      <div className={styles.dropdownWrap} ref={ref}>
        <div className={styles.selectorStack}>
          <button
            className={styles.dropdownTrigger}
            onClick={() => setOpenMenu(openMenu === 'house' ? '' : 'house')}
            aria-expanded={openMenu === 'house'}
            disabled={loadingProperties || houses.length === 0}
          >
            <span className={styles.dropdownLabel}>
              {loadingProperties ? 'Häuser laden...' : selectedHouse?.name ?? 'Kein Haus'}
            </span>
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

      <div className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <span className={styles.detailEyebrow}>Aktuelle Auswahl</span>
          <span className={styles.detailTitle}>{selectedUnit?.name ?? 'Keine Einheit'}</span>
        </div>
        <div className={styles.detailPath}>
          <span>{selectedHouse?.name ?? 'Haus'}</span>
          <span>/</span>
          <strong>{selectedUnit?.location ?? selectedUnit?.name ?? '-'}</strong>
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Einheiten (Haus)</span>
          <span className={styles.metricValue}>{(selectedHouse?.unitCount ?? units.length) || '-'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Hausfläche</span>
          <span className={styles.metricValue}>{selectedHouse?.totalArea ? `${selectedHouse.totalArea} qm` : '-'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Wohnfläche</span>
          <span className={styles.metricValue}>{selectedUnit?.area ? `${selectedUnit.area} qm` : '-'}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Zimmer</span>
          <span className={styles.metricValue}>{selectedUnit?.rooms ?? '-'}</span>
        </div>
        <div className={styles.metricWide}>
          <span className={styles.metricLabel}>Typ</span>
          <span className={styles.metricValue}>{selectedUnit?.kind ?? '-'}</span>
        </div>
        <div className={styles.metricWide}>
          <span className={styles.metricLabel}>Miete</span>
          <span className={styles.metricValue}>{formattedIncome}</span>
        </div>
      </div>

      <div className={styles.sidebarFill} />
    </aside>
  )
}
