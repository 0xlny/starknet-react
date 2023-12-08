import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { monoFont, sansFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { StarknetProvider } from '@/components/starknet-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          sansFont.variable,
          monoFont.variable
        )}
      >
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
