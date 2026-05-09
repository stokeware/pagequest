import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminReportsScreen } from '@/app/(admin)/admin/reports/reports-screen'
import {
    defaultAdminReportsViewModel,
    type AdminReportsViewModel,
} from '@/lib/admin-reports'

function buildViewModel(): AdminReportsViewModel {
    return {
        auditRows: [
            {
                actionLabel: 'Invitation created',
                actorLabel: 'Alex Admin',
                detailLabel: 'Invitation activity for reader@example.com.',
                key: 'audit-1',
                timestampLabel: 'May 8, 2026, 10:15 AM',
            },
            {
                actionLabel: 'Entry corrected',
                actorLabel: 'Alex Admin',
                detailLabel: 'Morgan correction saved for 24 pages.',
                key: 'audit-2',
                timestampLabel: 'May 8, 2026, 12:30 PM',
            },
        ],
        entryBreakdownRows: [
            {
                entriesLabel: '2 entries',
                key: 'pages',
                label: 'Pages logged',
                shareLabel: '50% of logged entries',
                totalLabel: '125 pages',
            },
        ],
        hasQuest: true,
        moderationRows: [
            {
                activityLabel: 'May 8, 2026',
                editHref:
                    '/admin/reports?campaignId=campaign-active&selectedReadingEntryId=entry-1',
                isEditable: true,
                isSelected: true,
                key: 'entry-1',
                noteLabel: 'Note: Original note',
                readerLabel: 'Morgan',
                summaryLabel: 'The Giver by Lois Lowry',
                typeLabel: '42 pages',
            },
            {
                activityLabel: 'May 7, 2026',
                editHref: null,
                isEditable: false,
                isSelected: false,
                key: 'entry-2',
                noteLabel: 'Note: Needs review',
                readerLabel: 'Avery',
                summaryLabel: 'Challenge completion for Friend recommendation',
                typeLabel: 'Challenge: Friend recommendation',
            },
        ],
        participantRows: [
            {
                activityLabel: 'Joined Apr 2, 2026. Last activity May 6, 2026.',
                key: 'participant-1',
                pointsLabel: '450 points',
                rankLabel: '#1',
                readerLabel: 'Morgan',
                totalsLabel: '350 pages • 120 minutes • 4 books • 2 challenges',
            },
        ],
        campaignDescription:
            '3 readers are on this campaign roster. 2 have logged progress so far. 4 entries feed this summary.',
        campaignName: 'Spring Story Sprint',
        campaignOptions: [
            {
                href: '/admin/reports?campaignId=campaign-active',
                id: 'campaign-active',
                isSelected: true,
                label: 'Spring Story Sprint',
                statusLabel: 'Active',
            },
            {
                href: '/admin/reports?campaignId=campaign-archived',
                id: 'campaign-archived',
                isSelected: false,
                label: 'Winter Reading Rally',
                statusLabel: 'Archived',
            },
        ],
        campaignStatusLabel: 'Active',
        campaignWindowLabel: 'Apr 20, 2026 to May 20, 2026 in UTC',
        selectedModerationEntry: {
            activityDate: '2026-05-08',
            bookAuthor: 'Lois Lowry',
            bookTitle: 'The Giver',
            entryId: 'entry-1',
            helperText:
                'Corrections update the reader totals immediately after the admin save completes.',
            isEditable: true,
            notes: 'Original note',
            participantLabel: 'Morgan',
            statusMessage:
                'Standard reading entries can be corrected from this moderation panel.',
            summaryLabel: 'The Giver by Lois Lowry',
            type: 'PAGES_READ',
            value: '42',
        },
        summaryCards: [
            {
                detail: 'Apr 20, 2026 to May 20, 2026 in UTC',
                label: 'Campaign status',
                value: 'Active',
            },
            {
                detail: '1 pending • 1 expired • 1 revoked',
                label: 'Accepted invites',
                value: '1',
            },
        ],
    }
}

describe('admin reports screen', () => {
    it('renders campaign-wide summary cards and tables', () => {
        const html = renderToStaticMarkup(
            <AdminReportsScreen
                notice={null}
                updateReadingEntryAction={async () => undefined}
                viewModel={buildViewModel()}
            />
        )

        expect(html).toContain('Spring Story Sprint')
        expect(html).toContain('Campaign status')
        expect(html).toContain('Accepted invites')
        expect(html).toContain('Participation by activity type')
        expect(html).toContain('Participant snapshot')
        expect(html).toContain('Recent audit trail')
        expect(html).toContain('Invitation created')
        expect(html).toContain('Morgan correction saved for 24 pages.')
        expect(html).toContain('Morgan')
        expect(html).toContain('Open campaigns')
        expect(html).toContain('Export CSV')
        expect(html).toContain('Winter Reading Rally')
        expect(html).toContain('Recent entries to moderate')
        expect(html).toContain('Correct selected entry')
        expect(html).toContain('Save correction')
        expect(html).toContain('Review queue only')
    })

    it('renders the empty state when no campaign is reportable', () => {
        const html = renderToStaticMarkup(
            <AdminReportsScreen
                notice={null}
                updateReadingEntryAction={async () => undefined}
                viewModel={defaultAdminReportsViewModel}
            />
        )

        expect(html).toContain(
            'Campaign reports will appear here once a campaign is ready.'
        )
        expect(html).toContain('Open campaigns')
        expect(html).toContain('Review invitations')
    })
})
