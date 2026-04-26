import type { Metadata } from 'next'
import './globals.css'
import '@openuidev/react-ui/styles/index.css'

export const metadata: Metadata = {
  title: 'buena · Hausverwaltung',
  description: 'Intelligente Hausverwaltung – fragen Sie einfach.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" style={{ height: '100%' }}>
      <body style={{ height: '100%' }}>{children}</body>
    </html>
  )
}
