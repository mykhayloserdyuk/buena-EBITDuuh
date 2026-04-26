'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Renderer } from '@openuidev/react-lang'
import { library } from '@/openui-library'
import styles from './MessageList.module.css'

export interface ToolCall {
  name: string
  status: 'running' | 'done'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  responseType?: 'text' | 'openui'
  loading?: boolean
  isStreaming?: boolean
  toolCalls?: ToolCall[]
}

const TOOL_LABELS: Record<string, string> = {
  query: 'Datenbank abfragen',
  mutate: 'Daten aktualisieren',
}

function BuenaIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 38 38" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M19 0c1.147 0 2.1.885 2.185 2.03l.068.917a10.44 10.44 0 0 1 4.2-.876c5.786 0 10.476 4.69 10.476 10.476a10.44 10.44 0 0 1-.877 4.2l.919.068a2.19 2.19 0 0 1 0 4.37l-.918.068a10.44 10.44 0 0 1 .876 4.2c0 5.786-4.69 10.476-10.476 10.476a10.44 10.44 0 0 1-4.2-.877l-.068.919a2.19 2.19 0 0 1-4.37 0l-.068-.918a10.44 10.44 0 0 1-4.2.876c-5.786 0-10.476-4.69-10.476-10.476 0-1.494.313-2.914.876-4.2l-.918-.068a2.191 2.191 0 0 1 0-4.37l.918-.068a10.44 10.44 0 0 1-.876-4.2c0-5.786 4.69-10.476 10.476-10.476 1.493 0 2.914.313 4.2.876l.068-.918A2.191 2.191 0 0 1 19 0ZM7.924 19l-1.38 1.762a7.573 7.573 0 0 0-1.615 4.691 7.618 7.618 0 0 0 7.618 7.618 7.573 7.573 0 0 0 4.691-1.615L19 30.076l1.762 1.38a7.573 7.573 0 0 0 4.691 1.615 7.618 7.618 0 0 0 7.618-7.618 7.573 7.573 0 0 0-1.615-4.691L30.076 19l1.38-1.762a7.573 7.573 0 0 0 1.615-4.691 7.618 7.618 0 0 0-7.618-7.618 7.573 7.573 0 0 0-4.691 1.615L19 7.924l-1.762-1.38a7.573 7.573 0 0 0-4.691-1.615 7.618 7.618 0 0 0-7.618 7.618 7.57 7.57 0 0 0 1.615 4.691L7.924 19Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function LoadingDots() {
  return (
    <span className={styles.loadingDots}>
      <span /><span /><span />
    </span>
  )
}

function ToolChips({ toolCalls }: { toolCalls: ToolCall[] }) {
  let seenQuery = false
  return (
    <div className={styles.toolCalls}>
      {toolCalls.map((tc, i) => {
        let label: string
        if (tc.name === 'query') {
          label = seenQuery ? 'aktualisieren' : 'Datenbank abfragen'
          seenQuery = true
        } else {
          label = TOOL_LABELS[tc.name] ?? tc.name
        }
        return (
          <span key={i} className={`${styles.toolChip} ${tc.status === 'running' ? styles.toolChipRunning : styles.toolChipDone}`}>
            {tc.status === 'running' ? (
              <span className={styles.toolSpinner} aria-hidden="true" />
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {label}
          </span>
        )
      })}
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  onSend?: (text: string) => void
}

export default function MessageList({ messages, onSend }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><BuenaIcon /></div>
        <p className={styles.emptyTitle}>Wie kann ich Ihnen helfen?</p>
        <p className={styles.emptySubtitle}>
          Stellen Sie Fragen zu Ihrer Immobilie, Mietern, Eigentümern oder Finanzen.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {messages.map((msg) => (
        <div key={msg.id} className={`${styles.row} ${msg.role === 'user' ? styles.rowUser : styles.rowAssistant}`}>
          {msg.role === 'assistant' && (
            <div className={styles.avatar}><BuenaIcon /></div>
          )}
          <div className={styles.assistantContent}>
            {msg.role === 'assistant' && !!msg.toolCalls?.length && (
              <ToolChips toolCalls={msg.toolCalls} />
            )}
            {msg.role === 'user' ? (
              <div className={`${styles.bubble} ${styles.bubbleUser}`}>{msg.content}</div>
            ) : msg.loading && !msg.content && !msg.toolCalls?.some(tc => tc.status === 'running') ? (
              <div className={`${styles.bubble} ${styles.bubbleAssistant}`}><LoadingDots /></div>
            ) : msg.responseType === 'openui' ? (
              <Renderer
                response={msg.content}
                library={library}
                isStreaming={!!msg.isStreaming}
                onAction={e => {
                if (e.type !== 'continue_conversation') return
                if (e.formState && Object.keys(e.formState).length > 0) {
                  const fields = Object.entries(e.formState)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join('\n')
                  onSend?.(`${e.humanFriendlyMessage}\n\nForm data:\n${fields}`)
                } else {
                  onSend?.(e.humanFriendlyMessage)
                }
              }}
              />
            ) : (
              <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.markdown}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
