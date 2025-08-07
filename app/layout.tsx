import './globals.css'

export const metadata = {
  title: 'JARVIS',
  description: 'AI Assistant with camera and voice',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
