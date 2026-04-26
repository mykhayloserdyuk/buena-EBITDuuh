'use client'

import Image from 'next/image'
import styles from './Nav.module.css'

interface NavProps {
  onNewChat?: () => void
}

export default function Nav({ onNewChat }: NavProps) {
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
        <button
          className={styles.newChatBtn}
          onClick={onNewChat}
          title="Neuer Chat"
          aria-label="Neuer Chat"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M11.5 1.5a1.414 1.414 0 0 1 2 2L5 12H3v-2L11.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 13H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={styles.greetingCard}>
          <div className={styles.greetingText}>
            <span className={styles.greeting}>Hello,</span>
            <span className={styles.greetingName}>Din</span>
          </div>
          <div className={styles.avatar} />
        </div>
      </div>
    </nav>
  )
}
