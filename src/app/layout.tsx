import type { Metadata } from "next"
// Single product typeface: Calibri (used first when the viewer has it — Windows/Office),
// falling back to Carlito, its metric-identical open clone, self-hosted via @fontsource.
// The family stack lives in globals.css (`--font-body` / `--font-heading`) so Calibri
// always wins over the bundled Carlito @font-face. Carlito ships 400 + 700 only.
import "@fontsource/carlito/latin-400.css"
import "@fontsource/carlito/latin-700.css"
import "@fontsource/carlito/latin-400-italic.css"
import "@fontsource/carlito/latin-700-italic.css"
import "./globals.css"
import { Toaster } from "sonner"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { StoreHydrator } from "@/components/StoreHydrator"

export const metadata: Metadata = {
  title: "Umang HIMS",
  description: "AI-Powered Hospital Management System — Umang HIMS",
  icons: { icon: "/favicon.png" },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-body antialiased text-foreground bg-background">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <StoreHydrator />
          {children}
        </NextIntlClientProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: 'var(--font-body, sans-serif)', fontSize: '14px' },
          }}
        />
      </body>
    </html>
  )
}
