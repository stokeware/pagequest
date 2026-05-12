import { describe, expect, it } from 'vitest'

import {
    assertPasswordConfirmation,
    assertValidPassword,
    hashPassword,
    passwordPolicy,
    validatePassword,
    verifyPassword,
} from '@/lib/auth/password'

describe('password helpers', () => {
    it('hashes passwords with Argon2id and verifies matching input', async () => {
        const passwordHash = await hashPassword('correct horse battery staple')

        expect(passwordHash).toContain('$argon2id$')
        await expect(
            verifyPassword({
                password: 'correct horse battery staple',
                passwordHash,
            })
        ).resolves.toBe(true)
    })

    it('rejects invalid password checks and malformed hashes', async () => {
        const passwordHash = await hashPassword('correct horse battery staple')

        await expect(
            verifyPassword({
                password: 'tr0ub4dor&3',
                passwordHash,
            })
        ).resolves.toBe(false)

        await expect(
            verifyPassword({
                password: 'correct horse battery staple',
                passwordHash: 'not-a-valid-argon2-hash',
            })
        ).resolves.toBe(false)
    })

    it('salts hashes so repeated passwords do not reuse the same digest', async () => {
        const firstHash = await hashPassword('correct horse battery staple')
        const secondHash = await hashPassword('correct horse battery staple')

        expect(firstHash).not.toBe(secondHash)
    })

    it('validates password length boundaries', () => {
        expect(validatePassword('')).toEqual({
            errors: ['Password is required.'],
            isValid: false,
        })

        expect(validatePassword('short')).toEqual({
            errors: [
                `Password must be at least ${passwordPolicy.minLength} characters.`,
            ],
            isValid: false,
        })

        expect(
            validatePassword('a'.repeat(passwordPolicy.maxLength + 1))
        ).toEqual({
            errors: [
                `Password must be at most ${passwordPolicy.maxLength} characters.`,
            ],
            isValid: false,
        })

        expect(validatePassword('secret-value')).toEqual({
            errors: [],
            isValid: true,
        })
    })

    it('throws when password validation or confirmation fails', () => {
        expect(() => assertValidPassword('short')).toThrow(
            /at least 12 characters/
        )

        expect(() =>
            assertPasswordConfirmation({
                password: 'correct horse battery staple',
                passwordConfirmation: 'different password value',
            })
        ).toThrow(/Passwords do not match/)
    })
})
