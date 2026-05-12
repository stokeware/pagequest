import { timingSafeEqual } from 'node:crypto'

import {
    assertPasswordConfirmation,
    assertValidPassword,
} from '@/lib/auth/password'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const localDatabaseHosts = new Set(['0.0.0.0', '127.0.0.1', 'localhost'])

export type CreateAdminCliArgs = {
    email?: string
    help: boolean
    name?: string
    password?: string
    passwordRepeat?: string
}

export type CreateAdminPromptInput = {
    email: string
    name: string
    password: string
    passwordRepeat: string
}

export type CreateAdminInput = {
    email: string
    name: string
}

const usageLines = [
    'Usage: ./scripts/create-admin [--name <name>] [--email <email>]',
    '                              [--password <password>] [--repeat-password <password>]',
    '',
    'Prompts are shown for any value you do not pass on the command line.',
    'Hosted targets also require PAGEQUEST_ADMIN_BOOTSTRAP_SECRET and a matching interactive secret prompt.',
]

const hostedPasswordNotice =
    'Production sign-in is managed by Auth0. This script creates the user and ADMIN role in Neon, but it does not store or sync a password.'

export function getCreateAdminUsage() {
    return `${usageLines.join('\n')}\n`
}

export function getCreateAdminPasswordNotice() {
    return hostedPasswordNotice
}

export function getCreateAdminSecurityNotice() {
    return 'Hosted admin provisioning requires both DIRECT_URL and PAGEQUEST_ADMIN_BOOTSTRAP_SECRET from a secure out-of-band source.'
}

export function parseCreateAdminArgs(argv: string[]): CreateAdminCliArgs {
    const parsedArgs: CreateAdminCliArgs = {
        help: false,
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]

        if (argument === '--help' || argument === '-h') {
            parsedArgs.help = true
            continue
        }

        const nextValue = argv[index + 1]

        if (!nextValue) {
            throw new Error(`Missing value for ${argument}`)
        }

        if (argument === '--name') {
            parsedArgs.name = nextValue
            index += 1
            continue
        }

        if (argument === '--email') {
            parsedArgs.email = nextValue
            index += 1
            continue
        }

        if (argument === '--password') {
            parsedArgs.password = nextValue
            index += 1
            continue
        }

        if (
            argument === '--repeat-password' ||
            argument === '--password-repeat'
        ) {
            parsedArgs.passwordRepeat = nextValue
            index += 1
            continue
        }

        throw new Error(`Unknown argument: ${argument}`)
    }

    return parsedArgs
}

export function validateCreateAdminInput({
    email,
    name,
    password,
    passwordRepeat,
}: CreateAdminPromptInput): CreateAdminInput {
    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedName) {
        throw new Error('Name is required.')
    }

    if (!normalizedEmail) {
        throw new Error('Email is required.')
    }

    if (!emailPattern.test(normalizedEmail)) {
        throw new Error('Email address must be valid.')
    }

    if (!password.length) {
        throw new Error('Password is required.')
    }

    assertValidPassword(password)
    assertPasswordConfirmation({
        password,
        passwordConfirmation: passwordRepeat,
    })

    return {
        email: normalizedEmail,
        name: normalizedName,
    }
}

export function resolveCreateAdminDatabaseUrl(env: NodeJS.ProcessEnv): string {
    const connectionString = env.DIRECT_URL?.trim()

    if (!connectionString) {
        throw new Error('Set DIRECT_URL before running ./scripts/create-admin.')
    }

    return connectionString
}

export function isHostedDatabaseTarget(connectionString: string): boolean {
    try {
        const url = new URL(connectionString)

        if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
            return true
        }

        return !localDatabaseHosts.has(url.hostname)
    } catch {
        return true
    }
}

export function resolveCreateAdminBootstrapSecret(
    env: NodeJS.ProcessEnv,
    connectionString: string
): string | null {
    if (!isHostedDatabaseTarget(connectionString)) {
        return null
    }

    const secret = env.PAGEQUEST_ADMIN_BOOTSTRAP_SECRET?.trim()

    if (!secret) {
        throw new Error(
            'Set PAGEQUEST_ADMIN_BOOTSTRAP_SECRET before provisioning an administrator on a hosted database target.'
        )
    }

    return secret
}

export function verifyCreateAdminBootstrapSecret({
    expectedSecret,
    providedSecret,
}: {
    expectedSecret: string
    providedSecret: string
}) {
    const normalizedProvidedSecret = providedSecret.trim()

    if (!normalizedProvidedSecret) {
        throw new Error('Bootstrap secret is required.')
    }

    const expectedBuffer = Buffer.from(expectedSecret)
    const providedBuffer = Buffer.from(normalizedProvidedSecret)

    if (expectedBuffer.length !== providedBuffer.length) {
        throw new Error('Bootstrap secret is not valid.')
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
        throw new Error('Bootstrap secret is not valid.')
    }
}
