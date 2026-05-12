type EnvironmentTarget = 'local' | 'production'

// This validates either the local developer contract or the hosted production
// contract. `./scripts/build` uses the production path so Vercel fails before
// shipping a broken deployment.

async function loadValidateEnvironment() {
    const environmentModule = await import('../lib/env')
    const { validateEnvironment } = environmentModule

    if (typeof validateEnvironment !== 'function') {
        throw new Error(
            'The environment validation module could not be loaded correctly.'
        )
    }

    return validateEnvironment
}

function parseTargetArgument(argv: string[]): EnvironmentTarget {
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]

        if (argument === '--target') {
            const nextArgument = argv[index + 1]

            if (nextArgument === 'local' || nextArgument === 'production') {
                return nextArgument
            }

            break
        }

        if (argument.startsWith('--target=')) {
            const value = argument.slice('--target='.length)

            if (value === 'local' || value === 'production') {
                return value
            }

            break
        }
    }

    throw new Error('Expected --target local or --target production.')
}

async function main() {
    const target = parseTargetArgument(process.argv.slice(2))
    const validateEnvironment = await loadValidateEnvironment()
    const result = validateEnvironment({
        env: process.env,
        target,
    })

    console.log(
        `Environment validation passed for ${result.target} mode (${result.emailMode} email).`
    )
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
