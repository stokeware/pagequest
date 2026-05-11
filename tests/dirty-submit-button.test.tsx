import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import {
    DirtyFormActions,
    DirtySubmitButton,
} from '@/app/(admin)/admin/campaigns/dirty-submit-button'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('dirty submit button', () => {
    let root: Root | null = null

    afterEach(() => {
        act(() => {
            root?.unmount()
            root = null
            document.body.innerHTML = ''
        })
    })

    it('stays disabled until the form changes and disables again when reverted', async () => {
        const form = document.createElement('form')
        form.id = 'campaign-settings-form'

        const input = document.createElement('input')
        input.name = 'name'
        input.value = 'Spring Story Sprint'
        form.appendChild(input)

        const mountNode = document.createElement('div')
        form.appendChild(mountNode)
        document.body.appendChild(form)

        await act(async () => {
            root = createRoot(mountNode)
            root.render(
                <DirtySubmitButton formId='campaign-settings-form'>
                    Save changes
                </DirtySubmitButton>
            )
        })

        const button = form.querySelector('button')

        expect(button).not.toBeNull()
        expect(button).toHaveProperty('disabled', true)
        expect(button?.className).toContain('disabled:bg-[color-mix(')

        await act(async () => {
            input.value = 'Summer Story Sprint'
            input.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect(button).toHaveProperty('disabled', false)

        await act(async () => {
            input.value = 'Spring Story Sprint'
            input.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect(button).toHaveProperty('disabled', true)
    })

    it('resets the form through discard changes and disables both buttons again', async () => {
        const form = document.createElement('form')
        form.id = 'campaign-challenges-form'

        const input = document.createElement('input')
        input.name = 'title'
        input.defaultValue = 'Night Reading'
        input.value = 'Night Reading'
        form.appendChild(input)

        const mountNode = document.createElement('div')
        form.appendChild(mountNode)
        document.body.appendChild(form)

        await act(async () => {
            root = createRoot(mountNode)
            root.render(<DirtyFormActions formId='campaign-challenges-form' />)
        })

        const buttons = Array.from(form.querySelectorAll('button'))
        const discardButton = buttons[0]
        const saveButton = buttons[1]

        expect(discardButton).toHaveProperty('disabled', true)
        expect(saveButton).toHaveProperty('disabled', true)

        await act(async () => {
            input.value = 'Weekend Sprint'
            input.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect(discardButton).toHaveProperty('disabled', false)
        expect(saveButton).toHaveProperty('disabled', false)

        await act(async () => {
            discardButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            )
            form.dispatchEvent(new Event('reset', { bubbles: true }))
        })

        expect(input.value).toBe('Night Reading')
        expect(discardButton).toHaveProperty('disabled', true)
        expect(saveButton).toHaveProperty('disabled', true)
    })
})
