import type { Metadata } from 'next'
import {
    Cinzel,
    Geist,
    IM_Fell_English,
    Merriweather,
    Source_Sans_3,
} from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

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

const fellFont = IM_Fell_English({
    variable: '--font-fell',
    subsets: ['latin'],
    weight: '400',
    style: ['normal', 'italic'],
})

const cinzelFont = Cinzel({
    variable: '--font-cinzel',
    subsets: ['latin'],
    weight: ['400', '700'],
})

export const metadata: Metadata = {
    title: 'Page Quest',
    description:
        'A local-first reading competition app for seasonal campaigns.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className={cn(
                'h-full',
                'antialiased',
                headingFont.variable,
                bodyFont.variable,
                fellFont.variable,
                cinzelFont.variable,
                'font-sans',
                geist.variable
            )}
        >
            <body className='min-h-full'>{children}</body>
        </html>
    )
}
