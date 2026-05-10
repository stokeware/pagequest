'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui'

type DismissibleNoticeProps = {
    description?: string
    title: string
    tone: 'error' | 'success'
}

function getNoticeClassName(tone: 'error' | 'success') {
    return tone === 'error'
        ? 'border-destructive/30 bg-destructive/8 text-foreground'
        : 'border-[rgba(135,131,85,0.28)] bg-[rgba(135,131,85,0.12)] text-foreground'
}

export function DismissibleNotice({
    description,
    title,
    tone,
}: DismissibleNoticeProps) {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) {
        return null
    }

    return (
        <div
            className={`flex items-start justify-between gap-3 rounded-[calc(var(--radius-xl)-4px)] border px-4 py-3 ${getNoticeClassName(
                tone
            )}`}
        >
            <div className='space-y-1'>
                <p className='text-sm font-semibold'>{title}</p>
                {description ? <p className='text-sm'>{description}</p> : null}
            </div>

            <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='-mr-1 text-muted-foreground hover:text-foreground'
                aria-label='Dismiss status message'
                onClick={() => setIsVisible(false)}
            >
                <X />
            </Button>
        </div>
    )
}
