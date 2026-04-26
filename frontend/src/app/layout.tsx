import type { Metadata } from 'next'
import './globals.css'
import '@openuidev/react-ui/styles/index.css'

export const metadata: Metadata = {
  title: 'Platform Buena',
  description: 'Intelligente Hausverwaltung – fragen Sie einfach.',
  icons: {
    icon: '/logo.png',
  },
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
