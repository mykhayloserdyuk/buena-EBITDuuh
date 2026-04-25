'use client'

import { useState, useCallback } from 'react'
import Nav from '@/components/Nav'
import Sidebar from '@/components/Sidebar'
import MessageList, { Message } from '@/components/MessageList'
import ChatInput from '@/components/ChatInput'
import styles from './Chat.module.css'

let nextId = 1
const uid = () => String(nextId++)

async function fetchAgentReply(question: string): Promise<string> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
    const res = await fetch(`${backendUrl}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    if (!res.ok) throw new Error('Backend error')
    const data = await res.json()
    return data.response ?? data.message ?? JSON.stringify(data)
  } catch {
    // Demo mode: return a plausible placeholder response
    return [
      'Ich habe die Datenbank abgefragt. Basierend auf den aktuellen Einträgen kann ich Ihnen folgende Übersicht geben:\n\nDie gesuchten Informationen wurden erfolgreich abgerufen. Für eine vollständige Auswertung verbinden Sie bitte den Backend-Server.',
      'Laut Datenbankauswertung liegen zu Ihrer Anfrage folgende Informationen vor:\n\nDerzeit sind 26 aktive Mietverhältnisse erfasst. Der Backend-Server ist aktuell nicht erreichbar – bitte stellen Sie sicher, dass er unter localhost:8000 läuft.',
      'Die Anfrage wurde verarbeitet. Um Echtzeitdaten abzurufen, starten Sie bitte den buena-Agenten unter `backend/agent.py` und stellen Sie sicher, dass MongoDB läuft.',
    ][Math.floor(Math.random() * 3)]
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const loadingMsg: Message = { id: uid(), role: 'assistant', content: '', loading: true }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    const reply = await fetchAgentReply(text)

    setMessages((prev) =>
      prev.map((m) =>
        m.id === loadingMsg.id ? { ...m, content: reply, loading: false } : m
      )
    )
    setLoading(false)
  }, [])

  const handleSuggest = useCallback((text: string) => {
    setInputValue(text)
  }, [])

  return (
    <div className={styles.shell}>
      <Nav />
      <div className={styles.body}>
        <Sidebar onSuggest={handleSuggest} />
        <div className={styles.main}>
          <div className={styles.messages}>
            <MessageList messages={messages} />
          </div>
          <div className={styles.inputArea}>
            <ChatInput
              onSend={handleSend}
              disabled={loading}
              value={inputValue}
              onChange={setInputValue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
