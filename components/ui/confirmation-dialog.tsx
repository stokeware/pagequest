'use client'

import { useId, useState } from 'react'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui'

type ConfirmationDialogProps = {
    triggerLabel: string
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'default' | 'destructive'
    note?: React.ReactNode
}

function ConfirmationDialog({
    triggerLabel,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
    note,
}: ConfirmationDialogProps) {
    const [open, setOpen] = useState(false)
    const titleId = useId()
    const descriptionId = useId()

    return (
        <>
            <Button
                variant={tone === 'destructive' ? 'destructive' : 'outline'}
                onClick={() => setOpen(true)}
            >
                {triggerLabel}
            </Button>

            {open ? (
                <div
                    className='ui-dialog-backdrop'
                    role='presentation'
                    onClick={() => setOpen(false)}
                >
                    <Card
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                        className='surface-warm ui-dialog-card'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <CardHeader>
                            <CardTitle id={titleId}>{title}</CardTitle>
                            <CardDescription id={descriptionId}>
                                {description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='ui-dialog-content'>
                            {note ? (
                                <div className='ui-dialog-note'>{note}</div>
                            ) : null}
                            <div className='ui-dialog-actions'>
                                <Button
                                    variant='outline'
                                    onClick={() => setOpen(false)}
                                >
                                    {cancelLabel}
                                </Button>
                                <Button
                                    variant={
                                        tone === 'destructive'
                                            ? 'destructive'
                                            : 'default'
                                    }
                                    onClick={() => setOpen(false)}
                                >
                                    {confirmLabel}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </>
    )
}

export { ConfirmationDialog }
