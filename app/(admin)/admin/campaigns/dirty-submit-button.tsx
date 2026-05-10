'use client'

import type { ComponentProps } from 'react'
import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui'

type DirtySubmitButtonProps = Omit<
    ComponentProps<typeof Button>,
    'children' | 'nativeButton' | 'type'
> & {
    children: string
    formId: string
    pendingLabel?: string
}

type DirtyFormActionsProps = {
    discardLabel?: string
    formId: string
    pendingLabel?: string
    saveLabel?: string
}

const disabledClassName =
    'disabled:bg-[color-mix(in_srgb,var(--button-primary-bg)_42%,white)] disabled:text-[color-mix(in_srgb,var(--button-primary-fg)_72%,black)] disabled:shadow-none'

function serializeFormState(form: HTMLFormElement) {
    return JSON.stringify(Array.from(new FormData(form).entries()))
}

function useFormDirtyState(formId: string) {
    const [isDirty, setIsDirty] = useState(false)

    useEffect(() => {
        const form = document.getElementById(formId)

        if (!(form instanceof HTMLFormElement)) {
            return
        }

        const initialState = serializeFormState(form)

        const updateDirtyState = () => {
            setIsDirty(serializeFormState(form) !== initialState)
        }

        updateDirtyState()
        form.addEventListener('change', updateDirtyState)
        form.addEventListener('input', updateDirtyState)
        form.addEventListener('reset', updateDirtyState)

        return () => {
            form.removeEventListener('change', updateDirtyState)
            form.removeEventListener('input', updateDirtyState)
            form.removeEventListener('reset', updateDirtyState)
        }
    }, [formId])

    return isDirty
}

export function DirtySubmitButton({
    children,
    className,
    formId,
    pendingLabel,
    ...props
}: DirtySubmitButtonProps) {
    const { pending } = useFormStatus()
    const isDirty = useFormDirtyState(formId)

    return (
        <Button
            nativeButton
            type='submit'
            disabled={!isDirty || pending}
            className={
                className
                    ? `${disabledClassName} ${className}`
                    : disabledClassName
            }
            {...props}
        >
            {pending ? (pendingLabel ?? children) : children}
        </Button>
    )
}

export function DirtyFormActions({
    discardLabel = 'Discard changes',
    formId,
    pendingLabel = 'Saving changes...',
    saveLabel = 'Save changes',
}: DirtyFormActionsProps) {
    const { pending } = useFormStatus()
    const isDirty = useFormDirtyState(formId)

    return (
        <div className='flex justify-end gap-3'>
            <Button
                nativeButton
                type='reset'
                variant='outline'
                disabled={!isDirty || pending}
            >
                {discardLabel}
            </Button>

            <Button
                nativeButton
                type='submit'
                disabled={!isDirty || pending}
                className={disabledClassName}
            >
                {pending ? pendingLabel : saveLabel}
            </Button>
        </div>
    )
}
