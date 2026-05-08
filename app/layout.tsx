import type { Metadata } from 'next'
import { Merriweather, Source_Sans_3, Geist } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const headingFont = Merriweather({
    variable: '--font-heading',
    subsets: ['latin'],
    weight: ['400', '700'],
})

const bodyFont = Source_Sans_3({
    variable: '--font-body',
    subsets: ['latin'],
    weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
    title: 'Page Quest',
    description: 'A local-first reading competition app for seasonal quests.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className={cn("h-full", "antialiased", headingFont.variable, bodyFont.variable, "font-sans", geist.variable)}
        >
            <body className='min-h-full'>{children}</body>
        </html>
    )
}
