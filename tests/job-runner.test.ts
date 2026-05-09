import { describe, expect, it, vi } from 'vitest'

import { createJobRunner, defineJob } from '@/lib/jobs/runner'
import type { JobLogger } from '@/lib/jobs/logging'

function createLoggerSpy() {
    return {
        error: vi.fn(),
        info: vi.fn(),
    } satisfies JobLogger
}

describe('createJobRunner', () => {
    it('runs a registered job locally with a stable execution context', async () => {
        const handler = vi.fn(async ({ context, payload }) => ({
            echoedPayload: payload,
            runId: context.runId,
            runtime: context.runtime,
            source: context.trigger.source,
        }))
        const logger = createLoggerSpy()
        const runner = createJobRunner(
            [
                defineJob({
                    description:
                        'Send reminder emails from a local task runner.',
                    handler,
                    name: 'notifications.send-reminders',
                }),
            ],
            { logger }
        )
        const now = new Date('2026-05-09T12:00:00.000Z')

        const execution = await runner.runLocal({
            initiatedBy: 'scripts/local-startup',
            jobName: 'notifications.send-reminders',
            now,
            payload: {
                dryRun: true,
            },
        })

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith({
            context: {
                jobName: 'notifications.send-reminders',
                now,
                runId: 'notifications.send-reminders-2026-05-09T12-00-00-000Z',
                runtime: 'local',
                trigger: {
                    initiatedBy: 'scripts/local-startup',
                    source: 'local',
                },
            },
            payload: {
                dryRun: true,
            },
        })
        expect(execution.result).toEqual({
            echoedPayload: {
                dryRun: true,
            },
            runId: 'notifications.send-reminders-2026-05-09T12-00-00-000Z',
            runtime: 'local',
            source: 'local',
        })
        expect(execution.runtime).toBe('local')
        expect(logger.info).toHaveBeenCalledTimes(2)
        expect(logger.info).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                event: 'job.started',
                jobName: 'notifications.send-reminders',
                payload: {
                    dryRun: true,
                },
                runId: 'notifications.send-reminders-2026-05-09T12-00-00-000Z',
                runtime: 'local',
                trigger: {
                    initiatedBy: 'scripts/local-startup',
                    source: 'local',
                },
            })
        )
        expect(logger.info).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                event: 'job.completed',
                jobName: 'notifications.send-reminders',
                result: {
                    echoedPayload: {
                        dryRun: true,
                    },
                    runId: 'notifications.send-reminders-2026-05-09T12-00-00-000Z',
                    runtime: 'local',
                    source: 'local',
                },
                runId: 'notifications.send-reminders-2026-05-09T12-00-00-000Z',
                runtime: 'local',
                trigger: {
                    initiatedBy: 'scripts/local-startup',
                    source: 'local',
                },
            })
        )
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('runs the same job through a serverless function invocation shape', async () => {
        const logger = createLoggerSpy()
        const runner = createJobRunner(
            [
                defineJob({
                    description: 'Send scheduled reminders.',
                    handler: ({ context }) => ({
                        functionName:
                            context.trigger.source === 'serverless-function'
                                ? context.trigger.functionName
                                : null,
                        invocationId:
                            context.trigger.source === 'serverless-function'
                                ? context.trigger.invocationId
                                : null,
                        runtime: context.runtime,
                        scheduleKey:
                            context.trigger.source === 'serverless-function'
                                ? context.trigger.scheduleKey
                                : null,
                    }),
                    name: 'notifications.send-reminders',
                }),
            ],
            { logger }
        )

        const execution = await runner.runServerlessFunction({
            functionName: 'SendReminderEmails',
            invocationId: 'function-invocation-42',
            jobName: 'notifications.send-reminders',
            now: new Date('2026-05-09T13:00:00.000Z'),
            payload: {
                dryRun: false,
            },
            scheduleKey: '0 0 14 * * *',
        })

        expect(execution.result).toEqual({
            functionName: 'SendReminderEmails',
            invocationId: 'function-invocation-42',
            runtime: 'serverless-function',
            scheduleKey: '0 0 14 * * *',
        })
        expect(execution.trigger).toEqual({
            functionName: 'SendReminderEmails',
            invocationId: 'function-invocation-42',
            scheduledFor: undefined,
            scheduleKey: '0 0 14 * * *',
            source: 'serverless-function',
        })
        expect(logger.info).toHaveBeenCalledTimes(2)
    })

    it('logs a structured failure when a registered job throws', async () => {
        const logger = createLoggerSpy()
        const runner = createJobRunner(
            [
                defineJob({
                    description: 'Simulate a failing job.',
                    handler: async () => {
                        throw new Error('SMTP delivery failed')
                    },
                    name: 'notifications.send-reminders',
                }),
            ],
            { logger }
        )

        await expect(
            runner.runScheduled({
                jobName: 'notifications.send-reminders',
                payload: {
                    dryRun: false,
                },
                scheduleKey: '0 */15 * * * *',
            })
        ).rejects.toThrow('SMTP delivery failed')

        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({
                    message: 'SMTP delivery failed',
                    name: 'Error',
                }),
                event: 'job.failed',
                jobName: 'notifications.send-reminders',
                runtime: 'scheduled',
                trigger: {
                    scheduledFor: undefined,
                    scheduleKey: '0 */15 * * * *',
                    source: 'scheduled',
                },
            })
        )
    })

    it('rejects unknown or duplicate job registrations', async () => {
        const definition = defineJob({
            description: 'Update derived campaign states.',
            handler: () => undefined,
            name: 'campaigns.sync-statuses',
        })

        expect(() => createJobRunner([definition, definition])).toThrow(
            'Duplicate job definition registered: campaigns.sync-statuses'
        )

        const runner = createJobRunner([definition])

        await expect(
            runner.runScheduled({
                jobName: 'notifications.missing',
                payload: undefined,
                scheduleKey: '0 */15 * * * *',
            })
        ).rejects.toThrow('Job is not registered: notifications.missing')
    })
})
