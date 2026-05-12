import { describe, expect, it, vi } from 'vitest'

import {
    buildCampaignStartReminderEmailMessage,
    buildInactivityNudgeEmailMessage,
} from '@/lib/email/templates'

describe('buildCampaignStartReminderEmailMessage', () => {
    it('builds a campaign launch reminder with dashboard and logging links', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildCampaignStartReminderEmailMessage({
            campaignName: 'Summer Reading Quest 2026',
            dashboardUrl: 'http://127.0.0.1:3000/dashboard',
            logProgressUrl: 'http://127.0.0.1:3000/campaign-board',
            recipientEmail: 'reader@example.com',
            startAt: new Date('2026-06-01T14:00:00.000Z'),
        })

        expect(message.senderAddress).toBe(
            'Page Quest <noreply@pagequest.local>'
        )
        expect(message.content.subject).toBe(
            'Summer Reading Quest 2026 starts now on Page Quest'
        )
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/dashboard'
        )
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/campaign-board'
        )
        expect(message.content.html).toContain('Open your dashboard')
        expect(message.content.html).toContain('Log your first reading update')
        expect(message.recipients.to).toEqual([
            {
                address: 'reader@example.com',
            },
        ])

        vi.unstubAllEnvs()
    })
})

describe('buildInactivityNudgeEmailMessage', () => {
    it('builds an inactivity nudge with leaderboard and logging links', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildInactivityNudgeEmailMessage({
            campaignEndsAt: new Date('2026-06-30T02:00:00.000Z'),
            campaignName: 'Summer Reading Quest 2026',
            daysSinceLastEntry: 7,
            leaderboardUrl: 'http://127.0.0.1:3000/leaderboard',
            logProgressUrl: 'http://127.0.0.1:3000/campaign-board',
            recipientEmail: 'reader@example.com',
        })

        expect(message.senderAddress).toBe(
            'Page Quest <noreply@pagequest.local>'
        )
        expect(message.content.subject).toBe(
            'Keep your streak moving in Summer Reading Quest 2026'
        )
        expect(message.content.plainText).toContain('7 days')
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/leaderboard'
        )
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/campaign-board'
        )
        expect(message.content.html).toContain("Log today's reading progress")
        expect(message.content.html).toContain('Check the leaderboard')
        expect(message.content.plainText).toContain('The campaign wraps up on')
        expect(message.recipients.to).toEqual([
            {
                address: 'reader@example.com',
            },
        ])

        vi.unstubAllEnvs()
    })
})
