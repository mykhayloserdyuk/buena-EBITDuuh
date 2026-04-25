import { useState } from 'react'
import './App.css'

// ── Inline data (derived from raw-data/) ────────────────────────

const property = {
  name: 'WEG Immanuelkirchstraße 26',
  address: 'Immanuelkirchstraße 26, 10405 Berlin',
  baujahr: 1928,
  sanierung: 2008,
  verwalter: 'Huber & Partner Immobilienverwaltung GmbH',
}

const buildings = [
  { id: 'HAUS-12', nr: '12', einheiten: 18, etagen: 5, fahrstuhl: true, baujahr: 1928 },
  { id: 'HAUS-14', nr: '14', einheiten: 20, etagen: 5, fahrstuhl: true, baujahr: 1928 },
  { id: 'HAUS-16', nr: '16', einheiten: 14, etagen: 4, fahrstuhl: false, baujahr: 1926 },
]

const categories = [
  { key: 'einheiten',      name: 'Einheiten',      icon: '🏠', count: 52,   desc: 'Wohnungen & Gewerbe' },
  { key: 'eigentuemer',    name: 'Eigentümer',     icon: '👤', count: 35,   desc: 'Eigentümerverzeichnis' },
  { key: 'mieter',         name: 'Mieter',          icon: '🔑', count: 26,   desc: 'Aktive Mietverhältnisse' },
  { key: 'dienstleister',  name: 'Dienstleister',   icon: '🔧', count: 16,   desc: 'Externe Partner' },
  { key: 'bank',           name: 'Bank',            icon: '🏦', count: 1619, desc: 'Kontobewegungen' },
  { key: 'rechnungen',     name: 'Rechnungen',      icon: '🧾', count: 24,   desc: 'Monate mit Belegen' },
  { key: 'briefe',         name: 'Briefe',          icon: '✉️', count: 13,   desc: 'Korrespondenz' },
  { key: 'emails',         name: 'Emails',          icon: '📧', count: 25,   desc: 'Monate mit E-Mails' },
]

const sampleEigentuemer = [
  { id: 'EIG-001', name: 'Marcus Dowerg',      ort: 'Saarbrücken',    einheiten: 'EH-037, EH-032', beirat: false },
  { id: 'EIG-002', name: 'Gertraud Holsten',   ort: 'Kaiserslautern', einheiten: 'EH-047, EH-033', beirat: false },
  { id: 'EIG-003', name: 'Paul Schacht',       ort: 'Düsseldorf',     einheiten: 'EH-025',         beirat: true },
  { id: 'EIG-004', name: 'Sabine Schmidtke',   ort: 'Hannover',       einheiten: 'EH-049',         beirat: false },
  { id: 'EIG-005', name: 'Jörn Hering',        ort: 'Essen',          einheiten: 'EH-006, EH-015', beirat: true },
]

const sampleMieter = [
  { id: 'MIE-001', name: 'Julius Nette',    einheit: 'EH-025', beginn: '2022-07-11', miete: '1.403 €', nk: '273 €' },
  { id: 'MIE-002', name: 'Edelgard Wulf',   einheit: 'EH-021', beginn: '2021-06-28', miete: '1.248 €', nk: '263 €' },
  { id: 'MIE-003', name: 'David Jenkins',   einheit: 'EH-023', beginn: '2020-03-15', miete: '1.767 €', nk: '310 €' },
  { id: 'MIE-004', name: 'Chantal Täsche',  einheit: 'EH-045', beginn: '2023-01-01', miete: '1.256 €', nk: '245 €' },
  { id: 'MIE-005', name: 'Sarah Bergmann',  einheit: 'EH-012', beginn: '2019-11-01', miete: '985 €',   nk: '198 €' },
]

const sampleDienstleister = [
  { id: 'DL-001', firma: 'Hausmeister Mueller GmbH',       branche: 'Hausmeisterdienst', monatlich: '650 €' },
  { id: 'DL-002', firma: 'Aufzug Schindler & Co. GmbH',    branche: 'Aufzugswartung',    monatlich: '185 €' },
  { id: 'DL-003', firma: 'Gartenbau Krause',                branche: 'Gartenpflege',      monatlich: '420 €' },
  { id: 'DL-004', firma: 'Reinigung Schmidt OHG',           branche: 'Gebäudereinigung',  monatlich: '380 €' },
]

const sampleTransactions = [
  { id: 'TX-00001', datum: '2024-01-01', typ: 'CREDIT', betrag: '1.256,00 €', kategorie: 'miete',     name: 'Chantal Täsche' },
  { id: 'TX-00002', datum: '2024-01-01', typ: 'CREDIT', betrag: '1.767,00 €', kategorie: 'miete',     name: 'David Jenkins' },
  { id: 'TX-00003', datum: '2024-01-02', typ: 'DEBIT',  betrag: '650,00 €',   kategorie: 'dienstleister', name: 'Hausmeister Mueller GmbH' },
  { id: 'TX-00004', datum: '2024-01-02', typ: 'CREDIT', betrag: '1.403,00 €', kategorie: 'miete',     name: 'Julius Nette' },
  { id: 'TX-00005', datum: '2024-01-03', typ: 'DEBIT',  betrag: '185,00 €',   kategorie: 'dienstleister', name: 'Aufzug Schindler & Co.' },
  { id: 'TX-00006', datum: '2024-01-05', typ: 'CREDIT', betrag: '985,00 €',   kategorie: 'miete',     name: 'Sarah Bergmann' },
]

const sampleEinheiten = [
  { id: 'EH-001', nr: 'WE 01', lage: '1. OG links',  typ: 'Wohnung', qm: 103, zimmer: 4,   haus: 'HAUS-12' },
  { id: 'EH-002', nr: 'WE 02', lage: '1. OG mitte',  typ: 'Wohnung', qm: 49,  zimmer: 1.5, haus: 'HAUS-12' },
  { id: 'EH-003', nr: 'WE 03', lage: '1. OG rechts', typ: 'Wohnung', qm: 62,  zimmer: 2,   haus: 'HAUS-12' },
  { id: 'EH-004', nr: 'WE 04', lage: '2. OG links',  typ: 'Wohnung', qm: 103, zimmer: 4,   haus: 'HAUS-12' },
  { id: 'EH-005', nr: 'WE 05', lage: '2. OG mitte',  typ: 'Wohnung', qm: 49,  zimmer: 1.5, haus: 'HAUS-12' },
  { id: 'EH-006', nr: 'WE 06', lage: '2. OG rechts', typ: 'Wohnung', qm: 62,  zimmer: 2,   haus: 'HAUS-12' },
]

// ── Icons ───────────────────────────────────────────

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 38 38">
      <path fill="currentColor" fillRule="evenodd" d="M19 0c1.147 0 2.1.885 2.185 2.03l.068.917a10.44 10.44 0 0 1 4.2-.876c5.786 0 10.476 4.69 10.476 10.476a10.44 10.44 0 0 1-.877 4.2l.919.068a2.19 2.19 0 0 1 0 4.37l-.918.068a10.44 10.44 0 0 1 .876 4.2c0 5.786-4.69 10.476-10.476 10.476a10.44 10.44 0 0 1-4.2-.877l-.068.919a2.19 2.19 0 0 1-4.37 0l-.068-.918a10.44 10.44 0 0 1-4.2.876c-5.786 0-10.476-4.69-10.476-10.476 0-1.494.313-2.914.876-4.2l-.918-.068a2.191 2.191 0 0 1 0-4.37l.918-.068a10.44 10.44 0 0 1-.876-4.2c0-5.786 4.69-10.476 10.476-10.476 1.493 0 2.914.313 4.2.876l.068-.918A2.191 2.191 0 0 1 19 0ZM7.924 19l-1.38 1.762a7.573 7.573 0 0 0-1.615 4.691 7.618 7.618 0 0 0 7.618 7.618 7.573 7.573 0 0 0 4.691-1.615L19 30.076l1.762 1.38a7.573 7.573 0 0 0 4.691 1.615 7.618 7.618 0 0 0 7.618-7.618 7.573 7.573 0 0 0-1.615-4.691L30.076 19l1.38-1.762a7.573 7.573 0 0 0 1.615-4.691 7.618 7.618 0 0 0-7.618-7.618 7.573 7.573 0 0 0-4.691 1.615L19 7.924l-1.762-1.38a7.573 7.573 0 0 0-4.691-1.615 7.618 7.618 0 0 0-7.618 7.618 7.57 7.57 0 0 0 1.615 4.691L7.924 19Z" clipRule="evenodd" />
    </svg>
  )
}

// ── Detail views per category ───────────────────────

function DetailEinheiten() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Lage</th>
            <th>Typ</th>
            <th>Fläche</th>
            <th>Zimmer</th>
            <th>Haus</th>
          </tr>
        </thead>
        <tbody>
          {sampleEinheiten.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500, color: 'var(--stone-50)' }}>{e.nr}</td>
              <td>{e.lage}</td>
              <td><span className="badge badge-stone">{e.typ}</span></td>
              <td>{e.qm} m²</td>
              <td>{e.zimmer}</td>
              <td>{e.haus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailEigentuemer() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Ort</th>
            <th>Einheiten</th>
            <th>Beirat</th>
          </tr>
        </thead>
        <tbody>
          {sampleEigentuemer.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500, color: 'var(--stone-50)' }}>{e.name}</td>
              <td>{e.ort}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.einheiten}</td>
              <td>{e.beirat ? <span className="badge badge-blue">Beirat</span> : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailMieter() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Einheit</th>
            <th>Seit</th>
            <th>Kaltmiete</th>
            <th>NK</th>
          </tr>
        </thead>
        <tbody>
          {sampleMieter.map(m => (
            <tr key={m.id}>
              <td style={{ fontWeight: 500, color: 'var(--stone-50)' }}>{m.name}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.einheit}</td>
              <td>{m.beginn}</td>
              <td>{m.miete}</td>
              <td>{m.nk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailDienstleister() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Firma</th>
            <th>Branche</th>
            <th>Monatlich</th>
          </tr>
        </thead>
        <tbody>
          {sampleDienstleister.map(d => (
            <tr key={d.id}>
              <td style={{ fontWeight: 500, color: 'var(--stone-50)' }}>{d.firma}</td>
              <td><span className="badge badge-stone">{d.branche}</span></td>
              <td>{d.monatlich}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailBank() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Name</th>
            <th>Kategorie</th>
            <th style={{ textAlign: 'right' }}>Betrag</th>
          </tr>
        </thead>
        <tbody>
          {sampleTransactions.map(t => (
            <tr key={t.id}>
              <td>{t.datum}</td>
              <td style={{ fontWeight: 500, color: 'var(--stone-50)' }}>{t.name}</td>
              <td><span className="badge badge-stone">{t.kategorie}</span></td>
              <td style={{ textAlign: 'right' }}>
                <span className={t.typ === 'CREDIT' ? 'badge badge-green' : 'badge badge-red'}>
                  {t.typ === 'CREDIT' ? '+' : '–'}{t.betrag}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailGeneric({ category }) {
  return (
    <div className="empty">
      {category.count} Einträge in <strong>{category.name}</strong> vorhanden.
    </div>
  )
}

const detailComponents = {
  einheiten: DetailEinheiten,
  eigentuemer: DetailEigentuemer,
  mieter: DetailMieter,
  dienstleister: DetailDienstleister,
  bank: DetailBank,
}

// ── Pages ───────────────────────────────────────────

function OverviewPage() {
  const [selected, setSelected] = useState(null)
  const totalEinheiten = buildings.reduce((s, b) => s + b.einheiten, 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>{property.name}</h1>
        <p>{property.address}</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Einheiten</div>
          <div className="stat-value">{totalEinheiten}</div>
          <div className="stat-sub">in {buildings.length} Gebäuden</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Eigentümer</div>
          <div className="stat-value">35</div>
          <div className="stat-sub">2 im Beirat</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mieter</div>
          <div className="stat-value">26</div>
          <div className="stat-sub">aktive Mietverhältnisse</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Transaktionen</div>
          <div className="stat-value">1.619</div>
          <div className="stat-sub">seit Jan 2024</div>
        </div>
      </div>

      <div className="section-label">Gebäude</div>
      <div className="buildings-grid">
        {buildings.map(b => (
          <div className="building-card" key={b.id}>
            <div className="building-nr">Nr. {b.nr}</div>
            <div className="building-detail">
              <span className="building-detail-label">Einheiten</span>
              <span className="building-detail-value">{b.einheiten}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Etagen</span>
              <span className="building-detail-value">{b.etagen}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Fahrstuhl</span>
              <span className="building-detail-value">{b.fahrstuhl ? 'Ja' : 'Nein'}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Baujahr</span>
              <span className="building-detail-value">{b.baujahr}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">Datenkategorien</div>
      <div className="category-grid">
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`category-card${selected === cat.key ? ' active' : ''}`}
            onClick={() => setSelected(selected === cat.key ? null : cat.key)}
          >
            <div className="category-icon">{cat.icon}</div>
            <div className="category-info">
              <div className="category-name">{cat.name}</div>
              <div className="category-meta">{cat.count} · {cat.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {selected && (() => {
        const cat = categories.find(c => c.key === selected)
        const Detail = detailComponents[selected] || (() => <DetailGeneric category={cat} />)
        return (
          <div className="detail-panel">
            <div className="detail-header">
              <h2>{cat.icon} {cat.name}</h2>
              <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="detail-body">
              <Detail />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function PropertyPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Liegenschaft</h1>
        <p>Stammdaten der Immobilie</p>
      </div>

      <div className="property-card">
        <div className="property-name">{property.name}</div>
        <div className="property-address">{property.address}</div>
        <div className="property-meta">
          <div className="property-meta-item">
            <span className="property-meta-label">Baujahr</span>
            <span className="property-meta-value">{property.baujahr}</span>
          </div>
          <div className="property-meta-item">
            <span className="property-meta-label">Sanierung</span>
            <span className="property-meta-value">{property.sanierung}</span>
          </div>
          <div className="property-meta-item">
            <span className="property-meta-label">Gebäude</span>
            <span className="property-meta-value">{buildings.length}</span>
          </div>
          <div className="property-meta-item">
            <span className="property-meta-label">Einheiten</span>
            <span className="property-meta-value">{buildings.reduce((s, b) => s + b.einheiten, 0)}</span>
          </div>
          <div className="property-meta-item">
            <span className="property-meta-label">Verwalter</span>
            <span className="property-meta-value">{property.verwalter}</span>
          </div>
        </div>
      </div>

      <div className="section-label">Gebäude</div>
      <div className="buildings-grid">
        {buildings.map(b => (
          <div className="building-card" key={b.id}>
            <div className="building-nr">Nr. {b.nr}</div>
            <div className="building-detail">
              <span className="building-detail-label">Einheiten</span>
              <span className="building-detail-value">{b.einheiten}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Etagen</span>
              <span className="building-detail-value">{b.etagen}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Fahrstuhl</span>
              <span className="building-detail-value">{b.fahrstuhl ? 'Ja' : 'Nein'}</span>
            </div>
            <div className="building-detail">
              <span className="building-detail-label">Baujahr</span>
              <span className="building-detail-value">{b.baujahr}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">Einheiten – Haus 12</div>
      <div className="detail-panel">
        <div className="detail-body">
          <DetailEinheiten />
        </div>
      </div>
    </div>
  )
}

// ── App ─────────────────────────────────────────────

const pages = [
  { key: 'overview', label: 'Übersicht', icon: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )},
  { key: 'property', label: 'Liegenschaft', icon: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V6l6-4 6 4v8H2z" /><rect x="6" y="9" width="4" height="5" />
    </svg>
  )},
]

export default function App() {
  const [page, setPage] = useState('overview')

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-logo"><Logo /></div>
          <div className="nav-title"><strong>buena</strong> · Hausverwaltung</div>
        </div>
        <div className="nav-links">
          {pages.map(p => (
            <button
              key={p.key}
              className={`nav-link${page === p.key ? ' active' : ''}`}
              onClick={() => setPage(p.key)}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {page === 'overview' && <OverviewPage />}
      {page === 'property' && <PropertyPage />}
    </>
  )
}
