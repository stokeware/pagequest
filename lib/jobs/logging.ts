import type { JobExecutionResult, JobTrigger } from '@/lib/jobs/runner'

type ConsoleLike = Pick<typeof console, 'error' | 'info'>

export type JobLogEvent = 'job.completed' | 'job.failed' | 'job.started'

export type JobLogEntry = {
    event: JobLogEvent
    jobName: string
    payload?: unknown
    result?: unknown
    runId: string
    runtime: JobTrigger['source']
    timestamp: string
    trigger: JobTrigger
} & (
    | {
          durationMs?: never
          error?: never
      }
    | {
          durationMs: number
          error?: never
      }
    | {
          durationMs: number
          error: {
              message: string
              name: string
              stack?: string
          }
      }
)

export type JobLogger = {
    error: (entry: JobLogEntry) => void
    info: (entry: JobLogEntry) => void
}

export function serializeJobError(error: unknown) {
    if (error instanceof Error) {
        return {
            message: error.message,
            name: error.name,
            stack: error.stack,
        }
    }

    return {
        message: String(error),
        name: 'UnknownError',
    }
}

export function buildJobStartedLogEntry({
    jobName,
    payload,
    runId,
    runtime,
    timestamp,
    trigger,
}: {
    jobName: string
    payload: unknown
    runId: string
    runtime: JobTrigger['source']
    timestamp: Date
    trigger: JobTrigger
}): JobLogEntry {
    return {
        event: 'job.started',
        jobName,
        payload,
        runId,
        runtime,
        timestamp: timestamp.toISOString(),
        trigger,
    }
}

export function buildJobCompletedLogEntry<TResult>({
    durationMs,
    execution,
    timestamp,
}: {
    durationMs: number
    execution: JobExecutionResult<TResult>
    timestamp: Date
}): JobLogEntry {
    return {
        durationMs,
        event: 'job.completed',
        jobName: execution.jobName,
        result: execution.result,
        runId: execution.runId,
        runtime: execution.runtime,
        timestamp: timestamp.toISOString(),
        trigger: execution.trigger,
    }
}

export function buildJobFailedLogEntry({
    durationMs,
    error,
    jobName,
    runId,
    runtime,
    timestamp,
    trigger,
}: {
    durationMs: number
    error: unknown
    jobName: string
    runId: string
    runtime: JobTrigger['source']
    timestamp: Date
    trigger: JobTrigger
}): JobLogEntry {
    return {
        durationMs,
        error: serializeJobError(error),
        event: 'job.failed',
        jobName,
        runId,
        runtime,
        timestamp: timestamp.toISOString(),
        trigger,
    }
}

export function createConsoleJobLogger(
    output: ConsoleLike = console
): JobLogger {
    return {
        error(entry) {
            output.error(JSON.stringify(entry))
        },
        info(entry) {
            output.info(JSON.stringify(entry))
        },
    }
}
