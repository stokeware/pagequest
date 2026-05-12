import { hash, verify } from '@node-rs/argon2'
import type { Options as Argon2Options } from '@node-rs/argon2'

export const passwordPolicy = {
    maxLength: 128,
    minLength: 6,
} as const

const passwordHashOptions: Argon2Options = {
    algorithm: 2,
    memoryCost: 19456,
    outputLen: 32,
    parallelism: 1,
    timeCost: 2,
} as const

export type PasswordValidationResult = {
    errors: string[]
    isValid: boolean
}

export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = []

    if (!password.length) {
        errors.push('Password is required.')
    } else {
        if (password.length < passwordPolicy.minLength) {
            errors.push(
                `Password must be at least ${passwordPolicy.minLength} characters.`
            )
        }

        if (password.length > passwordPolicy.maxLength) {
            errors.push(
                `Password must be at most ${passwordPolicy.maxLength} characters.`
            )
        }
    }

    return {
        errors,
        isValid: errors.length === 0,
    }
}

export function assertValidPassword(password: string) {
    const validation = validatePassword(password)

    if (!validation.isValid) {
        throw new Error(validation.errors[0])
    }
}

export function assertPasswordConfirmation({
    password,
    passwordConfirmation,
}: {
    password: string
    passwordConfirmation: string
}) {
    if (password !== passwordConfirmation) {
        throw new Error('Passwords do not match.')
    }
}

export async function hashPassword(password: string): Promise<string> {
    assertValidPassword(password)

    return hash(password, passwordHashOptions)
}

export async function verifyPassword({
    password,
    passwordHash,
}: {
    password: string
    passwordHash: string | null | undefined
}) {
    if (!passwordHash?.trim()) {
        return false
    }

    try {
        return await verify(passwordHash, password)
    } catch {
        return false
    }
}
