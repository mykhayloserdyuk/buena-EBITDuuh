'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './Nav.module.css'

interface NavProps {
  onNewChat?: () => void
}

export default function Nav({ onNewChat }: NavProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }

    if (profileOpen) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [profileOpen])

  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <Image
          src="/logo.png"
          alt="buena logo"
          width={22}
          height={22}
          className={styles.icon}
        />
        <span className={styles.wordmark}>buena</span>
        <span className={styles.separator}>·</span>
        <span className={styles.subtitle}>Hausverwaltung</span>
      </div>

      <div className={styles.right}>
        <div className={styles.profileMenu} ref={profileRef}>
          <button
            className={styles.greetingCard}
            type="button"
            aria-expanded={profileOpen}
            aria-label="Profilmenü öffnen"
            onClick={() => setProfileOpen(open => !open)}
          >
            <div className={styles.greetingText}>
              <span className={styles.greeting}>Hello,</span>
              <span className={styles.greetingName}>Din</span>
            </div>
            <div className={styles.avatar} />
          </button>

          {profileOpen && (
            <div className={styles.profilePopover}>
              <div className={styles.profileHeader}>
                <span className={styles.profileEyebrow}>Profil</span>
                <strong>Din Bisevac</strong>
              </div>
              <div className={styles.profileRows}>
                <div className={styles.profileRow}>
                  <span>Name</span>
                  <strong>Din Bisevac</strong>
                </div>
                <div className={styles.profileRow}>
                  <span>Rolle</span>
                  <strong>Property Manager</strong>
                </div>
                <div className={styles.profileRow}>
                  <span>Email</span>
                  <strong>din@buena.dev</strong>
                </div>
                <div className={styles.profileRow}>
                  <span>Status</span>
                  <strong>Online</strong>
                </div>
              </div>
              <button
                className={styles.profileAction}
                onClick={() => {
                  onNewChat?.()
                  setProfileOpen(false)
                }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M11.5 1.5a1.414 1.414 0 0 1 2 2L5 12H3v-2L11.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 13H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Profil bearbeiten
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
