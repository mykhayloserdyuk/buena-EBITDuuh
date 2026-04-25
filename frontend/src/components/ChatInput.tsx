'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import styles from './ChatInput.module.css'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  value?: string
  onChange?: (v: string) => void
}

export default function ChatInput({ onSend, disabled, value: externalValue, onChange }: ChatInputProps) {
  const [internal, setInternal] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const value = externalValue !== undefined ? externalValue : internal
  const setValue = onChange ?? setInternal

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend, setValue])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Stellen Sie eine Frage zu Ihrer Immobilie …"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            handleInput()
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />
        <button
          className={`${styles.send} ${value.trim() && !disabled ? styles.sendActive : ''}`}
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          aria-label="Senden"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M13.5 2.5L7 9M13.5 2.5L9 13.5L7 9M13.5 2.5L2.5 6.5L7 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className={styles.hint}>Enter zum Senden · Shift+Enter für Zeilenumbruch</p>
    </div>
  )
}
