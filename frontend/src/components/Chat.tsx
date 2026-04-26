'use client'

import { useState, useCallback } from 'react'
import Nav from '@/components/Nav'
import Sidebar from '@/components/Sidebar'
import MessageList, { Message } from '@/components/MessageList'
import ChatInput from '@/components/ChatInput'
import styles from './Chat.module.css'

let nextId = 1
const uid = () => String(nextId++)

const DEMO_REPLIES = [
  'Ich habe die Datenbank abgefragt. Basierend auf den aktuellen Einträgen kann ich Ihnen folgende Übersicht geben:\n\nDie gesuchten Informationen wurden erfolgreich abgerufen. Für eine vollständige Auswertung verbinden Sie bitte den Backend-Server.',
  'Laut Datenbankauswertung liegen zu Ihrer Anfrage folgende Informationen vor:\n\nDerzeit sind 26 aktive Mietverhältnisse erfasst.',
  'Die Anfrage wurde verarbeitet. Um Echtzeitdaten abzurufen, starten Sie bitte den buena-Agenten unter `backend/agent.py` und stellen Sie sicher, dass MongoDB läuft.',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const replyId = uid()
    const loadingMsg: Message = { id: replyId, role: 'assistant', content: '', loading: true, toolCalls: [] }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await fetch(`/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, conversation_id: conversationId }),
      })

      if (!res.ok) throw new Error('Backend error')
      const data = await res.json()

      setMessages(prev => prev.map(m =>
        m.id === replyId
          ? {
              ...m,
              content: data.response,
              responseType: data.type as 'text' | 'openui',
              loading: false,
              toolCalls: (data.tool_calls ?? []).map((tc: { tool: string }) => ({
                name: tc.tool,
                status: 'done' as const,
              })),
            }
          : m
      ))
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
    setConversationId(crypto.randomUUID())
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
            <MessageList messages={messages} onSend={handleSend} />
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
