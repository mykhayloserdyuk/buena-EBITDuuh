import { useState } from 'react'
import './App.css'

const categories = [
  { name: 'Bank', folder: 'bank', icon: '🏦' },
  { name: 'Briefe', folder: 'briefe', icon: '✉️' },
  { name: 'Emails', folder: 'emails', icon: '📧' },
  { name: 'Incremental', folder: 'incremental', icon: '📈' },
  { name: 'Rechnungen', folder: 'rechnungen', icon: '🧾' },
  { name: 'Stammdaten', folder: 'stammdaten', icon: '📋' },
]

export default function App() {
  const [selected, setSelected] = useState(null)

  return (
    <div className="app">
      <header>
        <h1>Buffalo</h1>
        <p className="subtitle">Data Overview</p>
      </header>
      <main>
        <div className="grid">
          {categories.map((cat) => (
            <button
              key={cat.folder}
              className={`card ${selected === cat.folder ? 'active' : ''}`}
              onClick={() => setSelected(selected === cat.folder ? null : cat.folder)}
            >
              <span className="icon">{cat.icon}</span>
              <span className="name">{cat.name}</span>
              <span className="folder">{cat.folder}/</span>
            </button>
          ))}
        </div>
        {selected && (
          <div className="detail">
            <p>Selected: <strong>raw-data/{selected}</strong></p>
          </div>
        )}
      </main>
    </div>
  )
}
