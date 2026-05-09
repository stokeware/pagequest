import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
    createCampaignLifecycleJobDefinitions,
} = require('../lib/jobs/reminders.ts')
const { createJobRunner } = require('../lib/jobs/runner.ts')

type ParsedArgs = {
    initiatedBy?: string
    jobName: string
    now?: Date
    payload: unknown
}

function parseArgs(argv: string[]): ParsedArgs {
    const [jobName, ...rest] = argv

    if (!jobName) {
        throw new Error(
            'Usage: ./scripts/run-job <job-name> [--now <iso-date>] [--payload <json>] [--initiated-by <label>]'
        )
    }

    let now: Date | undefined
    let payload: unknown = {}
    let initiatedBy: string | undefined

    for (let index = 0; index < rest.length; index += 1) {
        const argument = rest[index]
        const next = rest[index + 1]

        if (argument === '--now') {
            if (!next) {
                throw new Error('Missing value for --now')
            }

            now = new Date(next)

            if (Number.isNaN(now.getTime())) {
                throw new Error(`Invalid ISO date for --now: ${next}`)
            }

            index += 1
            continue
        }

        if (argument === '--payload') {
            if (!next) {
                throw new Error('Missing value for --payload')
            }

            payload = JSON.parse(next)
            index += 1
            continue
        }

        if (argument === '--initiated-by') {
            if (!next) {
                throw new Error('Missing value for --initiated-by')
            }

            initiatedBy = next
            index += 1
            continue
        }

        throw new Error(`Unknown argument: ${argument}`)
    }

    return {
        initiatedBy,
        jobName,
        now,
        payload,
    }
}

async function main() {
    const runner = createJobRunner(createCampaignLifecycleJobDefinitions())
    const { initiatedBy, jobName, now, payload } = parseArgs(
        process.argv.slice(2)
    )
    const execution = await runner.runLocal({
        initiatedBy: initiatedBy ?? 'scripts/run-job',
        jobName,
        now,
        payload,
    })

    process.stdout.write(`${JSON.stringify(execution, null, 2)}\n`)
}

await main()
