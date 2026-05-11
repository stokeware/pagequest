'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui'

type ConfirmSubmitButtonProps = Omit<
    ComponentProps<typeof Button>,
    'name' | 'nativeButton' | 'value'
> & {
    cancelLabel?: string
    confirmLabel?: string
    description: string
    note?: ReactNode
    submitName?: string
    submitValue?: string
    title: string
}

export function ConfirmSubmitButton({
    cancelLabel = 'Cancel',
    confirmLabel = 'Confirm',
    description,
    note,
    onClick,
    submitName,
    submitValue,
    title,
    ...props
}: ConfirmSubmitButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const titleId = useId()
    const descriptionId = useId()
    const submitterRef = useRef<HTMLButtonElement | null>(null)

    return (
        <>
            <Button
                nativeButton
                {...props}
                onClick={(event) => {
                    onClick?.(event)

                    if (event.defaultPrevented) {
                        return
                    }

                    if (submitName) {
                        const form = event.currentTarget.form

                        if (form) {
                            const existingField =
                                form.elements.namedItem(submitName)
                            let hiddenField: HTMLInputElement

                            if (existingField instanceof HTMLInputElement) {
                                hiddenField = existingField
                            } else {
                                hiddenField = document.createElement('input')
                                hiddenField.setAttribute('type', 'hidden')
                                hiddenField.setAttribute('name', submitName)
                                form.appendChild(hiddenField)
                            }

                            hiddenField.value = submitValue ?? ''
                        }
                    }

                    submitterRef.current = event.currentTarget
                    event.preventDefault()
                    setIsOpen(true)
                }}
            />

            {isOpen ? (
                <div
                    className='ui-dialog-backdrop'
                    role='presentation'
                    onClick={() => setIsOpen(false)}
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
                                    type='button'
                                    variant='outline'
                                    onClick={() => setIsOpen(false)}
                                >
                                    {cancelLabel}
                                </Button>

                                <Button
                                    type='button'
                                    variant='destructive'
                                    onClick={() => {
                                        const submitter = submitterRef.current

                                        setIsOpen(false)
                                        submitter?.form?.requestSubmit(
                                            submitter
                                        )
                                    }}
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
