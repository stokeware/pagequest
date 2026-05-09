import Link from 'next/link'

import { Prisma } from '@prisma/client'
import type { QuestStatus, QuestVisibility } from '@prisma/client'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    FormActions,
    FormCard,
    FormField,
    Input,
    StatCard,
    TableCard,
} from '@/components/ui'
import { prisma } from '@/lib/prisma'
import { synchronizeDerivedQuestStatuses } from '@/lib/quest-status'

import {
    buildQuestScoringPreviewItems,
    describeQuestLifecycle,
    getQuestStatusLabel,
    getQuestVisibilityLabel,
} from '@/lib/quest-admin'

import {
    archiveQuestAction,
    createQuestAction,
    duplicateQuestAction,
    publishQuestAction,
    updateQuestAction,
} from './actions'

type QuestsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type QuestFormDefaults = {
    description: string
    endAt: string
    entryDeleteWindowMinutes: string
    entryEditWindowMinutes: string
    name: string
    pointsPerAudiobookMinute: string
    pointsPerBook: string
    pointsPerChallengeCompletion: string
    pointsPerPage: string
    startAt: string
    timezone: string
    visibility: 'INVITE_ONLY'
}

type QuestLifecycleView = {
    archivedAt: Date | null
    endAt: Date
    publishedAt: Date | null
    startAt: Date
    status: QuestStatus
    visibility: QuestVisibility
}

const selectClassName = [
    'h-10 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

const textareaClassName = [
    'min-h-28 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

const noticeContent = {
    archived: {
        description:
            'The quest is now preserved as historical context and no longer appears as a live competition surface.',
        title: 'Quest archived.',
        tone: 'success',
    },
    created: {
        description:
            'The quest record is now available for editing, publication, and future participant setup.',
        title: 'Quest created.',
        tone: 'success',
    },
    duplicated: {
        description:
            'A new draft copy was created with the same core configuration but without participants, invitations, or history.',
        title: 'Quest duplicated.',
        tone: 'success',
    },
    error: {
        description:
            'The quest change could not be completed. Review the detail below and try again.',
        title: 'Quest update blocked.',
        tone: 'error',
    },
    published: {
        description:
            'The quest is now published and its lifecycle status reflects the configured date window.',
        title: 'Quest published.',
        tone: 'success',
    },
    updated: {
        description:
            'The quest configuration was saved and its stored lifecycle status was recalculated.',
        title: 'Quest updated.',
        tone: 'success',
    },
} as const

const errorDetailMessages: Record<string, string> = {
    'active-quest-conflict':
        'Only one quest can be active at a time. Archive or let the current live quest complete before activating another one.',
    'invalid-entry-delete-window':
        'Entry delete window must be a whole number of minutes or left blank.',
    'invalid-entry-edit-window':
        'Entry edit window must be a whole number of minutes or left blank.',
    'invalid-points-per-audiobook-minute':
        'Audiobook minute scoring must be a valid number that is zero or greater.',
    'invalid-points-per-book':
        'Book scoring must be a valid number that is zero or greater.',
    'invalid-points-per-challenge-completion':
        'Challenge completion scoring must be a valid number that is zero or greater.',
    'invalid-points-per-page':
        'Page scoring must be a valid number that is zero or greater.',
    'invalid-quest-window': 'Quest start must be on or before the end time.',
    'invalid-visibility':
        'Only invite-only quests are available in the current MVP.',
    'missing-end-at': 'Choose an end date and time for the quest.',
    'missing-name': 'Enter a quest name before saving.',
    'missing-quest': 'Choose a valid quest before running that action.',
    'missing-start-at': 'Choose a start date and time for the quest.',
    'missing-timezone': 'Enter a timezone for the quest schedule.',
    'quest-already-archived':
        'Archived quests cannot return to a published state from this surface.',
    'quest-not-editable':
        'Archived quests are read-only here. Duplicate the quest to create a new draft.',
    'quest-not-found': 'That quest record is no longer available.',
    'unexpected-error':
        'An unexpected error interrupted the quest action. Check the server logs if this keeps happening.',
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatDateTime(value: Date | null) {
    if (!value) {
        return 'Not yet'
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value)
}

function formatQuestWindow(startAt: Date, endAt: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
    })

    return `${formatter.format(startAt)} to ${formatter.format(endAt)}`
}

function formatDateTimeInput(value: Date) {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    const hours = `${value.getHours()}`.padStart(2, '0')
    const minutes = `${value.getMinutes()}`.padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatPoints(value: { toString(): string }) {
    const numericValue = Number(value.toString())

    return Number.isInteger(numericValue)
        ? numericValue.toString()
        : numericValue.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

function getQuestStatusPillClass(status: QuestStatus) {
    const baseClassName =
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]'

    if (status === 'ACTIVE') {
        return `${baseClassName} bg-[rgba(135,131,85,0.16)] text-[color:var(--dusty-olive)]`
    }

    if (status === 'ARCHIVED') {
        return `${baseClassName} bg-[rgba(156,63,43,0.12)] text-[color:var(--destructive)]`
    }

    if (status === 'COMPLETED') {
        return `${baseClassName} bg-[rgba(218,165,24,0.18)] text-[color:var(--dusty-olive)]`
    }

    if (status === 'SCHEDULED') {
        return `${baseClassName} bg-[rgba(64,105,124,0.12)] text-[color:var(--blue-slate)]`
    }

    return `${baseClassName} bg-muted text-foreground`
}

function getVisibilityPillClass(visibility: QuestVisibility) {
    const baseClassName =
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]'

    if (visibility === 'INVITE_ONLY') {
        return `${baseClassName} bg-[rgba(64,105,124,0.12)] text-[color:var(--blue-slate)]`
    }

    return `${baseClassName} bg-muted text-foreground`
}

function getNotice(
    outcome: string | null,
    detail: string | null
): {
    description: string
    title: string
    tone: 'error' | 'success'
} | null {
    if (!outcome || !(outcome in noticeContent)) {
        return null
    }

    const content = noticeContent[outcome as keyof typeof noticeContent]

    if (outcome !== 'error') {
        return content
    }

    return {
        ...content,
        description: detail
            ? (errorDetailMessages[detail] ?? content.description)
            : content.description,
    }
}

function getQuestFormDefaults(
    quest?: {
        description: string | null
        endAt: Date
        entryDeleteWindowMinutes: number | null
        entryEditWindowMinutes: number | null
        name: string
        pointsPerAudiobookMinute: { toString(): string }
        pointsPerBook: { toString(): string }
        pointsPerChallengeCompletion: { toString(): string }
        pointsPerPage: { toString(): string }
        startAt: Date
        timezone: string
        visibility: 'INVITE_ONLY'
    } | null
): QuestFormDefaults {
    if (!quest) {
        return {
            description: '',
            endAt: '',
            entryDeleteWindowMinutes: '',
            entryEditWindowMinutes: '',
            name: '',
            pointsPerAudiobookMinute: '0.75',
            pointsPerBook: '1',
            pointsPerChallengeCompletion: '1',
            pointsPerPage: '1',
            startAt: '',
            timezone: 'America/Chicago',
            visibility: 'INVITE_ONLY',
        }
    }

    return {
        description: quest.description ?? '',
        endAt: formatDateTimeInput(quest.endAt),
        entryDeleteWindowMinutes:
            quest.entryDeleteWindowMinutes?.toString() ?? '',
        entryEditWindowMinutes: quest.entryEditWindowMinutes?.toString() ?? '',
        name: quest.name,
        pointsPerAudiobookMinute: quest.pointsPerAudiobookMinute.toString(),
        pointsPerBook: quest.pointsPerBook.toString(),
        pointsPerChallengeCompletion:
            quest.pointsPerChallengeCompletion.toString(),
        pointsPerPage: quest.pointsPerPage.toString(),
        startAt: formatDateTimeInput(quest.startAt),
        timezone: quest.timezone,
        visibility: quest.visibility,
    }
}

function formatLifecycleDescription(lifecycle: QuestLifecycleView) {
    let description = describeQuestLifecycle(lifecycle)
        .replaceAll(
            lifecycle.startAt.toISOString(),
            formatDateTime(lifecycle.startAt)
        )
        .replaceAll(
            lifecycle.endAt.toISOString(),
            formatDateTime(lifecycle.endAt)
        )

    if (lifecycle.archivedAt) {
        description = description.replaceAll(
            lifecycle.archivedAt.toISOString(),
            formatDateTime(lifecycle.archivedAt)
        )
    }

    return description
}

function QuestLifecyclePanel({
    lifecycle,
    questId,
}: {
    lifecycle: QuestLifecycleView
    questId?: string
}) {
    const statusLabel = getQuestStatusLabel(lifecycle.status)
    const visibilityLabel = getQuestVisibilityLabel(lifecycle.visibility)
    const lifecycleDescription = formatLifecycleDescription(lifecycle)

    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Lifecycle and access</CardTitle>
                <CardDescription>
                    Status is derived from publication and archive events plus
                    the configured quest dates. Visibility defines who can join.
                </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4'>
                <div className='flex flex-wrap gap-3'>
                    <span className={getQuestStatusPillClass(lifecycle.status)}>
                        {statusLabel}
                    </span>
                    <span
                        className={getVisibilityPillClass(lifecycle.visibility)}
                    >
                        {visibilityLabel}
                    </span>
                </div>

                <div className='grid gap-3 md:grid-cols-2'>
                    <div className='stack-sm'>
                        <p className='type-muted text-xs'>Current status</p>
                        <strong>{statusLabel}</strong>
                        <p className='type-muted text-xs'>
                            {lifecycleDescription}
                        </p>
                    </div>
                    <div className='stack-sm'>
                        <p className='type-muted text-xs'>Visibility</p>
                        <strong>{visibilityLabel}</strong>
                        <p className='type-muted text-xs'>
                            Invite-only quests require the invitation flow
                            before a competitor can join.
                        </p>
                    </div>
                </div>

                <div className='grid gap-3 md:grid-cols-2'>
                    <div className='stack-sm'>
                        <p className='type-muted text-xs'>Published at</p>
                        <strong>{formatDateTime(lifecycle.publishedAt)}</strong>
                    </div>
                    <div className='stack-sm'>
                        <p className='type-muted text-xs'>Archived at</p>
                        <strong>{formatDateTime(lifecycle.archivedAt)}</strong>
                    </div>
                </div>

                {questId ? (
                    <div className='flex flex-wrap gap-2'>
                        {!lifecycle.archivedAt && !lifecycle.publishedAt ? (
                            <form action={publishQuestAction}>
                                <input
                                    type='hidden'
                                    name='questId'
                                    value={questId}
                                />
                                <Button nativeButton type='submit' size='sm'>
                                    Publish from configuration
                                </Button>
                            </form>
                        ) : null}

                        {!lifecycle.archivedAt ? (
                            <form action={archiveQuestAction}>
                                <input
                                    type='hidden'
                                    name='questId'
                                    value={questId}
                                />
                                <Button
                                    nativeButton
                                    type='submit'
                                    size='sm'
                                    variant='destructive'
                                >
                                    Archive from configuration
                                </Button>
                            </form>
                        ) : null}
                    </div>
                ) : (
                    <p className='type-muted text-xs'>
                        New quests begin as draft and stay invite-only until you
                        create the record and publish it.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

function QuestScoringPanel({
    scoringRules,
}: {
    scoringRules: Pick<
        QuestFormDefaults,
        | 'pointsPerAudiobookMinute'
        | 'pointsPerBook'
        | 'pointsPerChallengeCompletion'
        | 'pointsPerPage'
    >
}) {
    const previewItems = buildQuestScoringPreviewItems({
        pointsPerAudiobookMinute: new Prisma.Decimal(
            scoringRules.pointsPerAudiobookMinute
        ),
        pointsPerBook: new Prisma.Decimal(scoringRules.pointsPerBook),
        pointsPerChallengeCompletion: new Prisma.Decimal(
            scoringRules.pointsPerChallengeCompletion
        ),
        pointsPerPage: new Prisma.Decimal(scoringRules.pointsPerPage),
    })

    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Scoring rules</CardTitle>
                <CardDescription>
                    Configure how the quest awards points for books, pages,
                    audiobook minutes, and challenge completions.
                </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4'>
                <div className='grid gap-3 md:grid-cols-2'>
                    {previewItems.map((item) => (
                        <div
                            key={item.title}
                            className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'
                        >
                            <p className='type-muted text-xs'>{item.title}</p>
                            <strong>{formatPoints(item.points)} points</strong>
                            <p className='type-muted text-xs'>
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
                <p className='type-muted text-xs'>
                    Use zero to keep an entry type available without awarding
                    points yet. Negative scoring is blocked to keep quest totals
                    predictable.
                </p>
            </CardContent>
        </Card>
    )
}

function QuestForm({
    action,
    defaultValues,
    lifecycle,
    note,
    questId,
    submitLabel,
    title,
}: {
    action: (formData: FormData) => Promise<void>
    defaultValues: QuestFormDefaults
    lifecycle: QuestLifecycleView
    note: string
    questId?: string
    submitLabel: string
    title: string
}) {
    return (
        <FormCard
            title={title}
            description='Dates, scoring, and entry windows can be tuned here before or after publication.'
        >
            <form action={action} className='ui-form-shell'>
                {questId ? (
                    <input type='hidden' name='questId' value={questId} />
                ) : null}

                <FormField
                    label='Quest name'
                    htmlFor={`${questId ?? 'new'}-name`}
                    hint='Use a clear seasonal or thematic name that reads well in invitations and standings.'
                >
                    <Input
                        id={`${questId ?? 'new'}-name`}
                        name='name'
                        defaultValue={defaultValues.name}
                        placeholder='Summer Reading Rally'
                    />
                </FormField>

                <FormField
                    label='Description'
                    htmlFor={`${questId ?? 'new'}-description`}
                    hint='Optional context for admins and future competitor-facing surfaces.'
                >
                    <textarea
                        id={`${questId ?? 'new'}-description`}
                        name='description'
                        defaultValue={defaultValues.description}
                        className={textareaClassName}
                        placeholder='A short summary of the quest theme, audience, or pacing.'
                    />
                </FormField>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FormField
                        label='Start at'
                        htmlFor={`${questId ?? 'new'}-startAt`}
                        hint='Publication status and the date window together determine draft, scheduled, active, or completed states.'
                    >
                        <Input
                            id={`${questId ?? 'new'}-startAt`}
                            name='startAt'
                            type='datetime-local'
                            defaultValue={defaultValues.startAt}
                        />
                    </FormField>

                    <FormField
                        label='End at'
                        htmlFor={`${questId ?? 'new'}-endAt`}
                        hint='Use the same timezone reference you plan to communicate to participants.'
                    >
                        <Input
                            id={`${questId ?? 'new'}-endAt`}
                            name='endAt'
                            type='datetime-local'
                            defaultValue={defaultValues.endAt}
                        />
                    </FormField>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FormField
                        label='Timezone'
                        htmlFor={`${questId ?? 'new'}-timezone`}
                        hint='Store the IANA timezone that should anchor the quest schedule.'
                    >
                        <Input
                            id={`${questId ?? 'new'}-timezone`}
                            name='timezone'
                            defaultValue={defaultValues.timezone}
                            placeholder='America/Chicago'
                        />
                    </FormField>

                    <FormField
                        label='Visibility'
                        htmlFor={`${questId ?? 'new'}-visibility`}
                        hint='This is explicit configuration even though the MVP currently supports only one visibility mode.'
                    >
                        <select
                            id={`${questId ?? 'new'}-visibility`}
                            name='visibility'
                            className={selectClassName}
                            defaultValue={defaultValues.visibility}
                        >
                            <option value='INVITE_ONLY'>Invite only</option>
                        </select>
                    </FormField>

                    <FormField
                        label='Status'
                        htmlFor={`${questId ?? 'new'}-status`}
                        hint='Status is calculated from publish and archive events plus the quest dates, so it is informative rather than directly editable.'
                    >
                        <div
                            id={`${questId ?? 'new'}-status`}
                            className='flex min-h-10 items-center rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2'
                        >
                            <span
                                className={getQuestStatusPillClass(
                                    lifecycle.status
                                )}
                            >
                                {getQuestStatusLabel(lifecycle.status)}
                            </span>
                        </div>
                    </FormField>
                </div>

                <div className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/50 p-4'>
                    <div className='stack-sm'>
                        <h3 className='text-sm font-semibold'>
                            Scoring configuration
                        </h3>
                        <p className='type-muted text-xs'>
                            These stored rule values drive the leaderboard and
                            progress totals once reading entries and challenge
                            completions are logged.
                        </p>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        <FormField
                            label='Points per book'
                            htmlFor={`${questId ?? 'new'}-pointsPerBook`}
                            hint='Applied to each completed book entry.'
                        >
                            <Input
                                id={`${questId ?? 'new'}-pointsPerBook`}
                                name='pointsPerBook'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={defaultValues.pointsPerBook}
                            />
                        </FormField>

                        <FormField
                            label='Points per page'
                            htmlFor={`${questId ?? 'new'}-pointsPerPage`}
                            hint='Applied to each logged page.'
                        >
                            <Input
                                id={`${questId ?? 'new'}-pointsPerPage`}
                                name='pointsPerPage'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={defaultValues.pointsPerPage}
                            />
                        </FormField>

                        <FormField
                            label='Points per audiobook minute'
                            htmlFor={`${questId ?? 'new'}-pointsPerAudiobookMinute`}
                            hint='Applied to every minute logged.'
                        >
                            <Input
                                id={`${questId ?? 'new'}-pointsPerAudiobookMinute`}
                                name='pointsPerAudiobookMinute'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={
                                    defaultValues.pointsPerAudiobookMinute
                                }
                            />
                        </FormField>

                        <FormField
                            label='Points per challenge'
                            htmlFor={`${questId ?? 'new'}-pointsPerChallengeCompletion`}
                            hint='Default points for a completed challenge.'
                        >
                            <Input
                                id={`${questId ?? 'new'}-pointsPerChallengeCompletion`}
                                name='pointsPerChallengeCompletion'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={
                                    defaultValues.pointsPerChallengeCompletion
                                }
                            />
                        </FormField>
                    </div>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FormField
                        label='Entry edit window (minutes)'
                        htmlFor={`${questId ?? 'new'}-entryEditWindowMinutes`}
                        hint='Leave blank to keep edits open until the tighter phase-7 rules land.'
                    >
                        <Input
                            id={`${questId ?? 'new'}-entryEditWindowMinutes`}
                            name='entryEditWindowMinutes'
                            type='number'
                            min='0'
                            step='1'
                            defaultValue={defaultValues.entryEditWindowMinutes}
                        />
                    </FormField>

                    <FormField
                        label='Entry delete window (minutes)'
                        htmlFor={`${questId ?? 'new'}-entryDeleteWindowMinutes`}
                        hint='Leave blank to defer hard delete-window rules until entry logging is active.'
                    >
                        <Input
                            id={`${questId ?? 'new'}-entryDeleteWindowMinutes`}
                            name='entryDeleteWindowMinutes'
                            type='number'
                            min='0'
                            step='1'
                            defaultValue={
                                defaultValues.entryDeleteWindowMinutes
                            }
                        />
                    </FormField>
                </div>

                <FormActions note={note}>
                    <Button nativeButton type='submit'>
                        {submitLabel}
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export default async function AdminQuestsPage({
    searchParams,
}: QuestsPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const selectedQuestId = getFirstSearchParamValue(
        resolvedSearchParams.selectedQuestId
    )
    const notice = getNotice(outcome, detail)
    await synchronizeDerivedQuestStatuses()
    const quests = await prisma.quest.findMany({
        include: {
            _count: {
                select: {
                    invitations: true,
                    participants: true,
                },
            },
        },
        orderBy: [
            {
                createdAt: 'desc',
            },
        ],
    })

    const selectedQuest =
        quests.find((quest) => quest.id === selectedQuestId) ??
        quests.find((quest) => !quest.archivedAt) ??
        quests[0] ??
        null

    const totalCount = quests.length
    const draftCount = quests.filter((quest) => quest.status === 'DRAFT').length
    const publishedCount = quests.filter((quest) => quest.publishedAt).length
    const archivedCount = quests.filter(
        (quest) => quest.status === 'ARCHIVED'
    ).length

    const rows = quests.map((quest) => {
        const canArchive = !quest.archivedAt
        const canPublish = !quest.archivedAt && !quest.publishedAt

        return {
            cells: [
                <div key='quest' className='stack-sm'>
                    <strong>{quest.name}</strong>
                    <p className='type-muted text-xs'>
                        {quest.description || 'No quest description yet.'}
                    </p>
                </div>,
                <div key='window' className='stack-sm'>
                    <strong>
                        {formatQuestWindow(quest.startAt, quest.endAt)}
                    </strong>
                    <p className='type-muted text-xs'>
                        Timezone: {quest.timezone}
                    </p>
                </div>,
                <div key='status' className='stack-sm'>
                    <span className={getQuestStatusPillClass(quest.status)}>
                        {getQuestStatusLabel(quest.status)}
                    </span>
                    <p className='type-muted text-xs'>
                        Published {formatDateTime(quest.publishedAt)}
                    </p>
                    <p className='type-muted text-xs'>
                        Archived {formatDateTime(quest.archivedAt)}
                    </p>
                </div>,
                <div key='rules' className='stack-sm'>
                    <p className='type-muted text-xs'>
                        Book {quest.pointsPerBook.toString()} | Page{' '}
                        {quest.pointsPerPage.toString()}
                    </p>
                    <p className='type-muted text-xs'>
                        Audio {quest.pointsPerAudiobookMinute.toString()} |
                        Challenge{' '}
                        {quest.pointsPerChallengeCompletion.toString()}
                    </p>
                    <p className='type-muted text-xs'>
                        {quest._count.participants} participants |{' '}
                        {quest._count.invitations} invitations
                    </p>
                </div>,
                <div key='actions' className='flex flex-wrap gap-2'>
                    <Button
                        size='sm'
                        variant='outline'
                        render={
                            <Link
                                href={`/admin/quests?selectedQuestId=${quest.id}`}
                            />
                        }
                    >
                        Edit
                    </Button>

                    <form action={duplicateQuestAction}>
                        <input type='hidden' name='questId' value={quest.id} />
                        <Button
                            nativeButton
                            type='submit'
                            size='sm'
                            variant='secondary'
                        >
                            Duplicate
                        </Button>
                    </form>

                    {canPublish ? (
                        <form action={publishQuestAction}>
                            <input
                                type='hidden'
                                name='questId'
                                value={quest.id}
                            />
                            <Button nativeButton type='submit' size='sm'>
                                Publish
                            </Button>
                        </form>
                    ) : null}

                    {canArchive ? (
                        <form action={archiveQuestAction}>
                            <input
                                type='hidden'
                                name='questId'
                                value={quest.id}
                            />
                            <Button
                                nativeButton
                                type='submit'
                                size='sm'
                                variant='destructive'
                            >
                                Archive
                            </Button>
                        </form>
                    ) : null}

                    {!canPublish && !canArchive ? (
                        <p className='type-muted text-xs'>
                            Lifecycle settled for this quest.
                        </p>
                    ) : null}
                </div>,
            ],
            key: quest.id,
        }
    })

    return (
        <div className='grid gap-6'>
            {notice ? (
                <Card
                    className={
                        notice.tone === 'success'
                            ? 'surface-tint'
                            : 'surface-warm'
                    }
                >
                    <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.description}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <StatCard
                    eyebrow='Quest roster'
                    title='Tracked quests'
                    value={totalCount}
                    description='Every draft, published, and archived quest configuration lives here.'
                />
                <StatCard
                    eyebrow='Needs configuration'
                    title='Draft quests'
                    value={draftCount}
                    description='Drafts can still change freely before they enter a published lifecycle state.'
                />
                <StatCard
                    eyebrow='Publication surface'
                    title='Published quests'
                    value={publishedCount}
                    description='Published quests derive scheduled, active, or completed states from their dates.'
                />
                <StatCard
                    eyebrow='Historical archive'
                    title='Archived quests'
                    value={archivedCount}
                    description='Archived quests remain visible for reporting, duplication, and historical context.'
                />
            </div>

            <div className='grid gap-6 xl:grid-cols-2'>
                <div className='grid gap-6'>
                    <QuestScoringPanel scoringRules={getQuestFormDefaults()} />
                    <QuestForm
                        action={createQuestAction}
                        defaultValues={getQuestFormDefaults()}
                        lifecycle={{
                            archivedAt: null,
                            endAt: new Date(),
                            publishedAt: null,
                            startAt: new Date(),
                            status: 'DRAFT',
                            visibility: 'INVITE_ONLY',
                        }}
                        note='Create stores the quest immediately as a draft. Publish and archive controls appear in the table once the quest exists.'
                        submitLabel='Create quest'
                        title='Create a quest'
                    />
                </div>

                {selectedQuest ? (
                    selectedQuest.archivedAt ? (
                        <div className='grid gap-6'>
                            <QuestLifecyclePanel
                                lifecycle={selectedQuest}
                                questId={selectedQuest.id}
                            />
                            <QuestScoringPanel
                                scoringRules={getQuestFormDefaults(
                                    selectedQuest
                                )}
                            />
                            <Card className='surface-warm'>
                                <CardHeader>
                                    <CardTitle>
                                        {selectedQuest.name} is archived
                                    </CardTitle>
                                    <CardDescription>
                                        Archived quests stay read-only in this
                                        editor. Duplicate this record to spin up
                                        a fresh draft with the same
                                        configuration.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className='grid gap-3'>
                                    <p className='type-muted'>
                                        Published{' '}
                                        {formatDateTime(
                                            selectedQuest.publishedAt
                                        )}
                                    </p>
                                    <p className='type-muted'>
                                        Archived{' '}
                                        {formatDateTime(
                                            selectedQuest.archivedAt
                                        )}
                                    </p>
                                    <form action={duplicateQuestAction}>
                                        <input
                                            type='hidden'
                                            name='questId'
                                            value={selectedQuest.id}
                                        />
                                        <Button
                                            nativeButton
                                            type='submit'
                                            variant='secondary'
                                        >
                                            Duplicate archived quest
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className='grid gap-6'>
                            <QuestLifecyclePanel
                                lifecycle={selectedQuest}
                                questId={selectedQuest.id}
                            />
                            <QuestScoringPanel
                                scoringRules={getQuestFormDefaults(
                                    selectedQuest
                                )}
                            />
                            <QuestForm
                                action={updateQuestAction}
                                defaultValues={getQuestFormDefaults(
                                    selectedQuest
                                )}
                                lifecycle={selectedQuest}
                                note='Edits recalculate the stored lifecycle status while preserving publication history.'
                                questId={selectedQuest.id}
                                submitLabel='Save quest changes'
                                title={`Edit ${selectedQuest.name}`}
                            />
                        </div>
                    )
                ) : (
                    <EmptyState
                        eyebrow='Quest editor'
                        title='No quest has been selected yet.'
                        description='Create the first quest to unlock edit, publish, archive, and duplicate controls.'
                    />
                )}
            </div>

            {rows.length > 0 ? (
                <TableCard
                    title='Quest management'
                    description='This admin table supports listing, editing, publishing, archiving, and duplicating quest records without touching participant history.'
                    columns={['Quest', 'Window', 'Status', 'Rules', 'Actions']}
                    rows={rows}
                    ariaLabel='Quest management table'
                />
            ) : (
                <EmptyState
                    eyebrow='Quest history'
                    title='No quests have been created yet.'
                    description='Use the create form to add the first quest. Publish, archive, and duplicate controls will appear as soon as there is at least one record.'
                />
            )}
        </div>
    )
}
