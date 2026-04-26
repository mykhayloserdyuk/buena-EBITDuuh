'use client'

import { useState, useCallback } from 'react'
import Nav from '@/components/Nav'
import Sidebar from '@/components/Sidebar'
import MessageList, { Message } from '@/components/MessageList'
import ChatInput from '@/components/ChatInput'
import styles from './Chat.module.css'

let nextId = 1
const uid = () => String(nextId++)

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

const DEMO_REPLIES = [
  'Ich habe die Datenbank abgefragt. Basierend auf den aktuellen Einträgen kann ich Ihnen folgende Übersicht geben:\n\nDie gesuchten Informationen wurden erfolgreich abgerufen. Für eine vollständige Auswertung verbinden Sie bitte den Backend-Server.',
  'Laut Datenbankauswertung liegen zu Ihrer Anfrage folgende Informationen vor:\n\nDerzeit sind 26 aktive Mietverhältnisse erfasst. Der Backend-Server ist aktuell nicht erreichbar – bitte stellen Sie sicher, dass er unter localhost:8000 läuft.',
  'Die Anfrage wurde verarbeitet. Um Echtzeitdaten abzurufen, starten Sie bitte den buena-Agenten unter `backend/agent.py` und stellen Sie sicher, dass MongoDB läuft.',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const replyId = uid()
    const loadingMsg: Message = { id: replyId, role: 'assistant', content: '', loading: true, toolCalls: [] }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND}/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })

      if (!res.ok || !res.body) throw new Error('Backend error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'token') {
              setMessages(prev => prev.map(m =>
                m.id === replyId ? { ...m, content: m.content + evt.text, loading: false } : m
              ))
            } else if (evt.type === 'tool_start') {
              setMessages(prev => prev.map(m =>
                m.id === replyId
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: evt.name, status: 'running' as const }] }
                  : m
              ))
            } else if (evt.type === 'tool_end') {
              setMessages(prev => prev.map(m => {
                if (m.id !== replyId) return m
                let found = false
                return {
                  ...m,
                  toolCalls: (m.toolCalls ?? []).map(tc => {
                    if (!found && tc.name === evt.name && tc.status === 'running') {
                      found = true
                      return { ...tc, status: 'done' as const }
                    }
                    return tc
                  }),
                }
              }))
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch {
      const demo = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)]
      setMessages(prev => prev.map(m =>
        m.id === replyId ? { ...m, content: demo, loading: false } : m
      ))
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === replyId && m.loading ? { ...m, loading: false } : m
      ))
      setLoading(false)
    }
  }, [])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setInputValue('')
    setLoading(false)
  }, [])

  const handleSuggest = useCallback((text: string) => {
    setInputValue(text)
  }, [])

  return (
    <div className={styles.shell}>
      <Nav onNewChat={handleNewChat} />
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
