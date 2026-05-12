import { createInterface } from 'node:readline/promises'
import { stdin as input, stderr, stdout as output } from 'node:process'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

import * as adminCliModule from '../lib/admin-account-cli'
import * as passwordModule from '../lib/auth/password'

type AdminCliModule = typeof import('../lib/admin-account-cli')
type PasswordModule = typeof import('../lib/auth/password')

const adminCli = (
    'default' in adminCliModule
        ? (
              adminCliModule as typeof adminCliModule & {
                  default: AdminCliModule
              }
          ).default
        : adminCliModule
) as AdminCliModule

const passwordHelpers = (
    'default' in passwordModule
        ? (
              passwordModule as typeof passwordModule & {
                  default: PasswordModule
              }
          ).default
        : passwordModule
) as PasswordModule

type ProvisionedAdmin = {
    createdRole: boolean
    createdUser: boolean
    email: string
    name: string
    passwordWasStored: boolean
}

const legacySslModeAliases = new Set(['prefer', 'require', 'verify-ca'])

function normalizeConnectionString(connectionString: string) {
    try {
        const url = new URL(connectionString)

        if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
            return connectionString
        }

        if (url.searchParams.get('uselibpqcompat') === 'true') {
            return connectionString
        }

        const sslMode = url.searchParams.get('sslmode')

        if (!sslMode || !legacySslModeAliases.has(sslMode)) {
            return connectionString
        }

        url.searchParams.set('sslmode', 'verify-full')

        return url.toString()
    } catch {
        return connectionString
    }
}

async function promptText(question: string) {
    const terminal = createInterface({
        input,
        output,
    })

    try {
        return await terminal.question(question)
    } finally {
        terminal.close()
    }
}

async function promptHidden(question: string) {
    if (!input.isTTY) {
        return promptText(question)
    }

    output.write(question)
    input.resume()
    input.setEncoding('utf8')

    const wasRawMode = input.isRaw

    return await new Promise<string>((resolve, reject) => {
        let secret = ''

        function cleanup() {
            input.off('data', handleChunk)
            input.setRawMode(wasRawMode)
            input.pause()
            output.write('\n')
        }

        function handleCharacter(character: string) {
            if (character === '\u0003') {
                cleanup()
                reject(new Error('Prompt cancelled.'))
                return
            }

            if (character === '\r' || character === '\n') {
                cleanup()
                resolve(secret)
                return
            }

            if (character === '\u007f' || character === '\b') {
                secret = secret.slice(0, -1)
                return
            }

            if (character === '\u001b') {
                return
            }

            secret += character
        }

        function handleChunk(chunk: string | Buffer) {
            for (const character of String(chunk)) {
                handleCharacter(character)
            }
        }

        input.setRawMode(true)
        input.on('data', handleChunk)
    })
}

async function collectPromptInput(argv: string[]) {
    const parsedArgs = adminCli.parseCreateAdminArgs(argv)

    if (parsedArgs.help) {
        output.write(adminCli.getCreateAdminUsage())
        process.exit(0)
    }

    output.write(`${adminCli.getCreateAdminPasswordNotice()}\n\n`)

    return adminCli.validateCreateAdminInput({
        email: parsedArgs.email ?? (await promptText('Email: ')),
        name: parsedArgs.name ?? (await promptText('Name: ')),
        password: parsedArgs.password ?? (await promptHidden('Password: ')),
        passwordRepeat:
            parsedArgs.passwordRepeat ??
            (await promptHidden('Repeat password: ')),
    })
}

async function authorizeProvisioning(connectionString: string) {
    const expectedBootstrapSecret = adminCli.resolveCreateAdminBootstrapSecret(
        process.env,
        connectionString
    )

    if (!expectedBootstrapSecret) {
        return
    }

    output.write(`${adminCli.getCreateAdminSecurityNotice()}\n\n`)

    const providedBootstrapSecret = await promptHidden('Bootstrap secret: ')

    adminCli.verifyCreateAdminBootstrapSecret({
        expectedSecret: expectedBootstrapSecret,
        providedSecret: providedBootstrapSecret,
    })
}

function createPrismaClient(connectionString: string) {
    const pool = new Pool({
        connectionString: normalizeConnectionString(connectionString),
    })

    const prisma = new PrismaClient({
        adapter: new PrismaPg(pool),
    })

    return {
        pool,
        prisma,
    }
}

async function provisionAdministrator(
    prisma: PrismaClient,
    inputData: {
        email: string
        name: string
        password: string
    }
): Promise<ProvisionedAdmin> {
    const passwordHash = await passwordHelpers.hashPassword(inputData.password)
    const passwordChangedAt = new Date()

    return prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findUnique({
            where: {
                email: inputData.email,
            },
        })

        const user = existingUser
            ? await transaction.user.update({
                  data: {
                      authMethod: 'PASSWORD',
                      lastPasswordChangeAt: passwordChangedAt,
                      name: inputData.name,
                      passwordHash,
                      passwordSetAt: passwordChangedAt,
                  },
                  where: {
                      id: existingUser.id,
                  },
              })
            : await transaction.user.create({
                  data: {
                      authMethod: 'PASSWORD',
                      email: inputData.email,
                      lastPasswordChangeAt: passwordChangedAt,
                      name: inputData.name,
                      passwordHash,
                      passwordSetAt: passwordChangedAt,
                  },
              })

        const existingRoleAssignment =
            await transaction.roleAssignment.findUnique({
                where: {
                    userId_role: {
                        role: 'ADMIN',
                        userId: user.id,
                    },
                },
            })

        if (!existingRoleAssignment) {
            await transaction.roleAssignment.create({
                data: {
                    role: 'ADMIN',
                    userId: user.id,
                },
            })
        }

        return {
            createdRole: !existingRoleAssignment,
            createdUser: !existingUser,
            email: user.email,
            name: user.name ?? inputData.name,
            passwordWasStored: true,
        }
    })
}

function formatProvisioningResult(result: ProvisionedAdmin) {
    const accountAction = result.createdUser ? 'Created' : 'Updated'
    const roleLine = result.createdRole
        ? 'Granted ADMIN role in the Page Quest database.'
        : 'ADMIN role was already present.'
    const passwordLine = result.createdUser
        ? 'Stored the initial password hash for this administrator account.'
        : 'Updated the password hash for this administrator account.'

    return [
        `${accountAction} administrator record for ${result.name} <${result.email}>.`,
        roleLine,
        passwordLine,
        'Sign in with this email address and the password entered during provisioning.',
    ].join('\n')
}

async function main() {
    const promptInput = await collectPromptInput(process.argv.slice(2))
    const connectionString = adminCli.resolveCreateAdminDatabaseUrl(process.env)
    await authorizeProvisioning(connectionString)
    const { pool, prisma } = createPrismaClient(connectionString)

    try {
        const result = await provisionAdministrator(prisma, promptInput)

        output.write(`${formatProvisioningResult(result)}\n`)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

try {
    await main()
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    stderr.write(`${message}\n`)
    process.exitCode = 1
}
