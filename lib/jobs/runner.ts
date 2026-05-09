type JobTriggerSource = 'serverless-function' | 'local' | 'scheduled'

import {
    buildJobCompletedLogEntry,
    buildJobFailedLogEntry,
    buildJobStartedLogEntry,
    createConsoleJobLogger,
    type JobLogger,
} from '@/lib/jobs/logging'

export type LocalJobTrigger = {
    initiatedBy?: string
    source: 'local'
}

export type ScheduledJobTrigger = {
    scheduledFor?: Date
    scheduleKey: string
    source: 'scheduled'
}

export type ServerlessFunctionJobTrigger = {
    functionName: string
    invocationId?: string
    scheduledFor?: Date
    scheduleKey?: string
    source: 'serverless-function'
}

export type JobTrigger =
    | ServerlessFunctionJobTrigger
    | LocalJobTrigger
    | ScheduledJobTrigger

export type JobExecutionContext = {
    jobName: string
    now: Date
    runId: string
    runtime: JobTriggerSource
    trigger: JobTrigger
}

export type JobExecutionRequest<TPayload> = {
    context: JobExecutionContext
    payload: TPayload
}

export type JobExecutionResult<TResult> = {
    completedAt: Date
    jobName: string
    result: TResult
    runId: string
    runtime: JobTriggerSource
    startedAt: Date
    trigger: JobTrigger
}

export type JobDefinition<TPayload = void, TResult = void> = {
    description: string
    handler: (
        request: JobExecutionRequest<TPayload>
    ) => Promise<TResult> | TResult
    name: string
}

type RegisteredJobDefinition = JobDefinition<never, unknown>

export type JobRunner = {
    listJobs: () => Array<Pick<RegisteredJobDefinition, 'description' | 'name'>>
    run: <TPayload, TResult>(options: {
        jobName: string
        now?: Date
        payload: TPayload
        runId?: string
        trigger: JobTrigger
    }) => Promise<JobExecutionResult<TResult>>
    runServerlessFunction: <TPayload, TResult>(options: {
        functionName: string
        invocationId?: string
        jobName: string
        now?: Date
        payload: TPayload
        runId?: string
        scheduledFor?: Date
        scheduleKey?: string
    }) => Promise<JobExecutionResult<TResult>>
    runLocal: <TPayload, TResult>(options: {
        initiatedBy?: string
        jobName: string
        now?: Date
        payload: TPayload
        runId?: string
    }) => Promise<JobExecutionResult<TResult>>
    runScheduled: <TPayload, TResult>(options: {
        jobName: string
        now?: Date
        payload: TPayload
        runId?: string
        scheduledFor?: Date
        scheduleKey: string
    }) => Promise<JobExecutionResult<TResult>>
}

type CreateJobRunnerOptions = {
    logger?: JobLogger
}

function createRunId(jobName: string, now: Date) {
    const timestamp = now.toISOString().replaceAll(/[:.]/g, '-')

    return `${jobName}-${timestamp}`
}

export function createJobRunner(
    definitions: RegisteredJobDefinition[],
    { logger = createConsoleJobLogger() }: CreateJobRunnerOptions = {}
): JobRunner {
    const registry = new Map<string, RegisteredJobDefinition>()

    for (const definition of definitions) {
        if (registry.has(definition.name)) {
            throw new Error(
                `Duplicate job definition registered: ${definition.name}`
            )
        }

        registry.set(definition.name, definition)
    }

    async function run<TPayload, TResult>({
        jobName,
        now = new Date(),
        payload,
        runId = createRunId(jobName, now),
        trigger,
    }: {
        jobName: string
        now?: Date
        payload: TPayload
        runId?: string
        trigger: JobTrigger
    }): Promise<JobExecutionResult<TResult>> {
        const definition = registry.get(jobName) as
            | JobDefinition<TPayload, TResult>
            | undefined

        if (!definition) {
            throw new Error(`Job is not registered: ${jobName}`)
        }

        const executionStartedAt = new Date()
        const startedAt = now
        const context: JobExecutionContext = {
            jobName,
            now,
            runId,
            runtime: trigger.source,
            trigger,
        }
        logger.info(
            buildJobStartedLogEntry({
                jobName,
                payload,
                runId,
                runtime: trigger.source,
                timestamp: executionStartedAt,
                trigger,
            })
        )

        try {
            const result = await definition.handler({
                context,
                payload,
            })
            const completedAt = new Date()
            const execution = {
                completedAt,
                jobName,
                result: result as TResult,
                runId,
                runtime: trigger.source,
                startedAt,
                trigger,
            }

            logger.info(
                buildJobCompletedLogEntry({
                    durationMs:
                        completedAt.getTime() - executionStartedAt.getTime(),
                    execution,
                    timestamp: completedAt,
                })
            )

            return execution
        } catch (error) {
            const failedAt = new Date()

            logger.error(
                buildJobFailedLogEntry({
                    durationMs:
                        failedAt.getTime() - executionStartedAt.getTime(),
                    error,
                    jobName,
                    runId,
                    runtime: trigger.source,
                    timestamp: failedAt,
                    trigger,
                })
            )

            throw error
        }
    }

    return {
        listJobs() {
            return [...registry.values()]
                .map(({ description, name }) => ({ description, name }))
                .sort((left, right) => left.name.localeCompare(right.name))
        },
        run,
        runServerlessFunction<TPayload, TResult>(options: {
            functionName: string
            invocationId?: string
            jobName: string
            now?: Date
            payload: TPayload
            runId?: string
            scheduledFor?: Date
            scheduleKey?: string
        }) {
            const {
                functionName,
                invocationId,
                jobName,
                now,
                payload,
                runId,
                scheduledFor,
                scheduleKey,
            } = options

            return run<TPayload, TResult>({
                jobName,
                now,
                payload,
                runId,
                trigger: {
                    functionName,
                    invocationId,
                    scheduledFor,
                    scheduleKey,
                    source: 'serverless-function',
                },
            })
        },
        runLocal<TPayload, TResult>(options: {
            initiatedBy?: string
            jobName: string
            now?: Date
            payload: TPayload
            runId?: string
        }) {
            const { initiatedBy, jobName, now, payload, runId } = options

            return run<TPayload, TResult>({
                jobName,
                now,
                payload,
                runId,
                trigger: {
                    initiatedBy,
                    source: 'local',
                },
            })
        },
        runScheduled<TPayload, TResult>(options: {
            jobName: string
            now?: Date
            payload: TPayload
            runId?: string
            scheduledFor?: Date
            scheduleKey: string
        }) {
            const { jobName, now, payload, runId, scheduledFor, scheduleKey } =
                options

            return run<TPayload, TResult>({
                jobName,
                now,
                payload,
                runId,
                trigger: {
                    scheduledFor,
                    scheduleKey,
                    source: 'scheduled',
                },
            })
        },
    }
}

export function defineJob<TPayload, TResult>(
    definition: JobDefinition<TPayload, TResult>
) {
    return definition
}
