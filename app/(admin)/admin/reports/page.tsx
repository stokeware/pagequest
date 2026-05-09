import { updateAdminReadingEntryAction } from './actions'
import { AdminReportsScreen } from './reports-screen'
import { getAdminReportsViewModel } from '@/lib/admin-reports'

type AdminReportsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

export default async function AdminReportsPage({
    searchParams,
}: AdminReportsPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const selectedReadingEntryId = getFirstSearchParamValue(
        resolvedSearchParams?.selectedReadingEntryId
    )
    const selectedQuestId = getFirstSearchParamValue(
        resolvedSearchParams?.questId
    )
    const notice = resolveReportsNotice({
        detail: getFirstSearchParamValue(resolvedSearchParams?.detail),
        outcome: getFirstSearchParamValue(resolvedSearchParams?.outcome),
    })
    const viewModel = await getAdminReportsViewModel(
        selectedQuestId,
        selectedReadingEntryId
    )

    return (
        <AdminReportsScreen
            notice={notice}
            updateReadingEntryAction={updateAdminReadingEntryAction}
            viewModel={viewModel}
        />
    )
}

function resolveReportsNotice({
    detail,
    outcome,
}: {
    detail: string | null
    outcome: string | null
}) {
    if (outcome === 'entry-updated') {
        return {
            description:
                'The corrected entry was saved and participant totals were refreshed from the updated quest history.',
            title: 'Entry corrected.',
            tone: 'success' as const,
        }
    }

    if (outcome !== 'error') {
        return null
    }

    return {
        description: getReportsErrorDetailMessage(detail),
        title: 'Entry correction blocked.',
        tone: 'error' as const,
    }
}

function getReportsErrorDetailMessage(detail: string | null) {
    switch (detail) {
        case 'challenge-entry-admin-edit-unsupported':
            return 'Challenge completion entries stay read-only in this panel so review state and awarded points remain consistent.'
        case 'invalid-entry':
            return 'Review the correction fields and try again.'
        case 'missing-quest':
            return 'Choose a quest report before correcting an entry.'
        case 'participant-removed':
            return 'That quest participant is no longer active.'
        case 'reading-entry-not-found':
            return 'That reading entry is no longer available for moderation.'
        default:
            return 'An unexpected error interrupted the correction. Try again.'
    }
}
