import Link from 'next/link'

import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    FormField,
    Input,
} from '@/components/ui'
import {
    formatCampaignDateInput,
    getAdminCampaignBucket,
    selectDefaultAdminCampaignId,
    sortAdminCampaignTabs,
} from '@/lib/admin-campaign-workbench'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'
import { prisma } from '@/lib/prisma'

import {
    createCampaignAction,
    deleteCampaignAction,
    deleteCampaignChallengeAction,
    saveCampaignChallengesAction,
    updateCampaignAction,
    updateCompetitorChallengesAction,
} from './actions'
import { ConfirmSubmitButton } from './confirm-submit-button'
import { DismissibleNotice } from './dismissible-notice'
import { DirtyFormActions } from './dirty-submit-button'

type CampaignsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const noticeContent = {
    created: {
        title: 'Campaign created.',
        tone: 'success',
    },
    'challenge-created': {
        title: 'Challenge created.',
        tone: 'success',
    },
    'challenge-deleted': {
        title: 'Challenge deleted.',
        tone: 'success',
    },
    'challenge-updated': {
        title: 'Challenge updated.',
        tone: 'success',
    },
    deleted: {
        title: 'Campaign deleted.',
        tone: 'success',
    },
    error: {
        title: 'Campaign update blocked.',
        tone: 'error',
    },
    updated: {
        title: 'Campaign updated.',
        tone: 'success',
    },
} as const

const errorDetailMessages: Record<string, string> = {
    'active-campaign-conflict':
        'Only one campaign can be active at a time. Adjust the dates or archive the current live campaign first.',
    'campaign-not-editable':
        'Archived campaigns stay visible here but cannot be edited from this screen.',
    'campaign-not-found': 'That campaign record is no longer available.',
    'challenge-in-use':
        'Challenges with historical completions cannot be deleted because scores and reports still reference them.',
    'challenge-not-found': 'That challenge record is no longer available.',
    'invalid-campaign-window':
        'Campaign start must be on or before the end date.',
    'invalid-page-minute-multiplier':
        'Challenge multipliers must be valid numbers that are zero or greater.',
    'invalid-points-per-challenge-completion':
        'Challenge completion scoring must be a valid number that is zero or greater.',
    'invalid-point-value':
        'Challenge points must be a valid number that is zero or greater, or left blank.',
    'invalid-points-per-audiobook-minute':
        'Audiobook minute scoring must be a valid number that is zero or greater.',
    'invalid-points-per-book':
        'Book scoring must be a valid number that is zero or greater.',
    'invalid-points-per-page':
        'Page scoring must be a valid number that is zero or greater.',
    'missing-campaign': 'Choose a valid campaign before saving.',
    'missing-challenge': 'Choose a valid challenge before running that action.',
    'missing-end-at': 'Choose an end date for the campaign.',
    'missing-name': 'Enter a challenge name before saving.',
    'missing-start-at': 'Choose a start date for the campaign.',
    'missing-timezone': 'Choose a timezone for the campaign before saving.',
    'unexpected-error':
        'An unexpected error interrupted the campaign action. Check the server logs if this keeps happening.',
}

type CampaignSummary = Awaited<ReturnType<typeof loadCampaigns>>[number]

function addDays(date: Date, days: number) {
    const nextDate = new Date(date)
    nextDate.setUTCDate(nextDate.getUTCDate() + days)

    return nextDate
}

function buildNewCampaignDefaults(baseCampaign?: CampaignSummary) {
    const today = new Date()
    const startAt = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
            12,
            0,
            0,
            0
        )
    )

    return {
        endAt: addDays(startAt, 30),
        name: 'New',
        pointsPerAudiobookMinute:
            formatPoints(baseCampaign?.pointsPerAudiobookMinute ?? null) ||
            '0.75',
        pointsPerBook: formatPoints(baseCampaign?.pointsPerBook ?? null) || '1',
        pointsPerChallengeCompletion:
            formatPoints(baseCampaign?.pointsPerChallengeCompletion ?? null) ||
            '1',
        pointsPerPage: formatPoints(baseCampaign?.pointsPerPage ?? null) || '1',
        startAt,
        timezone: baseCampaign?.timezone ?? 'America/Chicago',
        visibility: baseCampaign?.visibility ?? 'INVITE_ONLY',
    }
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatPoints(value: { toString(): string } | null) {
    if (!value) {
        return ''
    }

    const numericValue = Number(value.toString())

    return Number.isInteger(numericValue)
        ? numericValue.toString()
        : numericValue.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

function getNotice(
    outcome: string | null,
    detail: string | null
): {
    description?: string
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
            ? (errorDetailMessages[detail] ??
              'Review the values and try again.')
            : 'Review the values and try again.',
    }
}

function getBucketLabel(bucket: ReturnType<typeof getAdminCampaignBucket>) {
    if (bucket === 'current') {
        return 'Current'
    }

    if (bucket === 'future') {
        return 'Future'
    }

    return 'Past'
}

function getTabClassName(isSelected: boolean) {
    return isSelected
        ? 'border-[color:var(--spicy-paprika)] bg-[rgba(202,89,47,0.12)] text-foreground shadow-[0_0.75rem_1.6rem_rgba(202,89,47,0.12)]'
        : 'border-border bg-card/72 text-muted-foreground hover:border-[rgba(64,105,124,0.28)] hover:text-foreground'
}

async function loadCampaigns() {
    await synchronizeDerivedCampaignStatuses()

    const campaigns = await prisma.campaign.findMany({
        select: {
            archivedAt: true,
            challenges: {
                orderBy: [
                    {
                        createdAt: 'asc',
                    },
                ],
                select: {
                    id: true,
                    kind: true,
                    pageMinuteMultiplier: true,
                    pointValue: true,
                    title: true,
                },
            },
            endAt: true,
            id: true,
            name: true,
            pointsPerAudiobookMinute: true,
            pointsPerBook: true,
            pointsPerChallengeCompletion: true,
            pointsPerPage: true,
            publishedAt: true,
            startAt: true,
            status: true,
            timezone: true,
            visibility: true,
        },
        orderBy: [
            {
                startAt: 'asc',
            },
        ],
    })

    return sortAdminCampaignTabs(campaigns)
}

function CampaignTabs({
    campaigns,
    selectedCampaignId,
}: {
    campaigns: CampaignSummary[]
    selectedCampaignId: string
}) {
    return (
        <div className='flex flex-wrap gap-2'>
            {campaigns.map((campaign) => {
                const bucket = getAdminCampaignBucket(campaign)

                return (
                    <Button
                        key={campaign.id}
                        variant='outline'
                        className={`h-auto min-h-14 justify-start px-4 py-3 text-left ${getTabClassName(
                            campaign.id === selectedCampaignId
                        )}`}
                        render={
                            <Link
                                href={`/admin/campaigns?selectedCampaignId=${campaign.id}`}
                            />
                        }
                    >
                        <span className='flex flex-col items-start gap-1'>
                            <span className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                                {getBucketLabel(bucket)}
                            </span>
                            <span>{campaign.name}</span>
                        </span>
                    </Button>
                )
            })}
        </div>
    )
}

function NewCampaignButton({
    baseCampaign,
}: {
    baseCampaign?: CampaignSummary
}) {
    const defaults = buildNewCampaignDefaults(baseCampaign)

    return (
        <form action={createCampaignAction} className='sm:ml-auto'>
            <input type='hidden' name='name' value={defaults.name} />
            <input
                type='hidden'
                name='startAt'
                value={formatCampaignDateInput(defaults.startAt)}
            />
            <input
                type='hidden'
                name='endAt'
                value={formatCampaignDateInput(defaults.endAt)}
            />
            <input
                type='hidden'
                name='pointsPerPage'
                value={defaults.pointsPerPage}
            />
            <input
                type='hidden'
                name='pointsPerAudiobookMinute'
                value={defaults.pointsPerAudiobookMinute}
            />
            <input
                type='hidden'
                name='pointsPerBook'
                value={defaults.pointsPerBook}
            />
            <input
                type='hidden'
                name='pointsPerChallengeCompletion'
                value={defaults.pointsPerChallengeCompletion}
            />
            <input type='hidden' name='timezone' value={defaults.timezone} />
            <input
                type='hidden'
                name='visibility'
                value={defaults.visibility}
            />

            <Button
                nativeButton
                type='submit'
                variant='outline'
                className={`h-auto min-h-14 min-w-48 justify-start px-4 py-3 text-left ${getTabClassName(
                    false
                )}`}
            >
                <span className='flex flex-col items-start gap-1'>
                    <span className='text-xs uppercase tracking-[0.16em] text-muted-foreground'>
                        New
                    </span>
                    <span>Create new campaign</span>
                </span>
            </Button>
        </form>
    )
}

function CampaignSettingsForm({ campaign }: { campaign: CampaignSummary }) {
    const formId = `${campaign.id}-settings-form`

    return (
        <Card key={campaign.id} className='surface-card'>
            <CardContent className='pt-6'>
                <form
                    id={formId}
                    action={updateCampaignAction}
                    className='ui-form-shell'
                >
                    <input
                        type='hidden'
                        name='campaignId'
                        value={campaign.id}
                    />
                    <input
                        type='hidden'
                        name='pointsPerChallengeCompletion'
                        value={formatPoints(
                            campaign.pointsPerChallengeCompletion
                        )}
                    />
                    <input
                        type='hidden'
                        name='timezone'
                        value={campaign.timezone}
                    />
                    <input
                        type='hidden'
                        name='visibility'
                        value={campaign.visibility}
                    />

                    <div className='grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]'>
                        <FormField
                            label='Campaign name'
                            htmlFor={`${campaign.id}-name`}
                        >
                            <Input
                                id={`${campaign.id}-name`}
                                name='name'
                                defaultValue={campaign.name}
                            />
                        </FormField>

                        <FormField
                            label='Start date'
                            htmlFor={`${campaign.id}-startAt`}
                        >
                            <Input
                                id={`${campaign.id}-startAt`}
                                name='startAt'
                                type='date'
                                defaultValue={formatCampaignDateInput(
                                    campaign.startAt
                                )}
                            />
                        </FormField>

                        <FormField
                            label='End date'
                            htmlFor={`${campaign.id}-endAt`}
                        >
                            <Input
                                id={`${campaign.id}-endAt`}
                                name='endAt'
                                type='date'
                                defaultValue={formatCampaignDateInput(
                                    campaign.endAt
                                )}
                            />
                        </FormField>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        <FormField
                            label='Points per page'
                            htmlFor={`${campaign.id}-pointsPerPage`}
                        >
                            <Input
                                id={`${campaign.id}-pointsPerPage`}
                                name='pointsPerPage'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={formatPoints(
                                    campaign.pointsPerPage
                                )}
                            />
                        </FormField>

                        <FormField
                            label='Points per minute listened'
                            htmlFor={`${campaign.id}-pointsPerAudiobookMinute`}
                        >
                            <Input
                                id={`${campaign.id}-pointsPerAudiobookMinute`}
                                name='pointsPerAudiobookMinute'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={formatPoints(
                                    campaign.pointsPerAudiobookMinute
                                )}
                            />
                        </FormField>

                        <FormField
                            label='Points per completed book'
                            htmlFor={`${campaign.id}-pointsPerBook`}
                        >
                            <Input
                                id={`${campaign.id}-pointsPerBook`}
                                name='pointsPerBook'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={formatPoints(
                                    campaign.pointsPerBook
                                )}
                            />
                        </FormField>
                    </div>

                    <DirtyFormActions
                        formId={formId}
                        pendingLabel='Saving changes...'
                    />
                </form>
            </CardContent>
        </Card>
    )
}

function CompetitorChallengesTable({
    campaign,
}: {
    campaign: CampaignSummary
}) {
    const recommendationChallenge = campaign.challenges.find(
        (challenge) => challenge.kind === 'RECOMMENDATION_TEMPLATE'
    )
    const personalGoalChallenge = campaign.challenges.find(
        (challenge) => challenge.kind === 'PERSONAL_GOAL_TEMPLATE'
    )

    const templateRows = [
        {
            challenge: recommendationChallenge,
            fieldPrefix: 'recommendation',
            kind: 'RECOMMENDATION_TEMPLATE' as const,
            label: 'Recommendation',
        },
        {
            challenge: personalGoalChallenge,
            fieldPrefix: 'personalGoal',
            kind: 'PERSONAL_GOAL_TEMPLATE' as const,
            label: 'Personal Goal',
        },
    ]

    const formId = `${campaign.id}-competitor-challenges-form`

    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Competitor Challenges</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <form
                    id={formId}
                    action={updateCompetitorChallengesAction}
                    className='space-y-4'
                >
                    <input
                        type='hidden'
                        name='campaignId'
                        value={campaign.id}
                    />

                    <div
                        className='hidden gap-3 border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)]'
                        role='row'
                    >
                        <div role='columnheader'>Challenge</div>
                        <div role='columnheader'>Points</div>
                        <div role='columnheader'>Multiplier</div>
                    </div>

                    <div
                        className='space-y-4'
                        role='table'
                        aria-label='Competitor challenges'
                    >
                        {templateRows.map(
                            ({ challenge, fieldPrefix, kind, label }) => (
                                <div
                                    key={kind}
                                    className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-card/60 p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)] lg:items-center'
                                    role='row'
                                >
                                    <div role='cell'>
                                        <p className='font-medium text-foreground'>
                                            {label}
                                        </p>
                                    </div>

                                    <div role='cell'>
                                        <label
                                            htmlFor={`${campaign.id}-${kind}-points`}
                                            className='sr-only'
                                        >
                                            {label} points
                                        </label>
                                        <Input
                                            id={`${campaign.id}-${kind}-points`}
                                            name={`${fieldPrefix}PointValue`}
                                            type='number'
                                            min='0'
                                            step='0.01'
                                            defaultValue={formatPoints(
                                                challenge?.pointValue ?? null
                                            )}
                                            placeholder='0'
                                        />
                                    </div>

                                    <div role='cell'>
                                        <label
                                            htmlFor={`${campaign.id}-${kind}-multiplier`}
                                            className='sr-only'
                                        >
                                            {label} multiplier
                                        </label>
                                        <Input
                                            id={`${campaign.id}-${kind}-multiplier`}
                                            name={`${fieldPrefix}PageMinuteMultiplier`}
                                            type='number'
                                            min='0'
                                            step='0.01'
                                            defaultValue={formatPoints(
                                                challenge?.pageMinuteMultiplier ??
                                                    null
                                            )}
                                            placeholder='0'
                                        />
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <DirtyFormActions
                        formId={formId}
                        pendingLabel='Saving changes...'
                    />
                </form>
            </CardContent>
        </Card>
    )
}

export function CampaignChallengesTable({
    campaign,
}: {
    campaign: CampaignSummary
}) {
    const adminChallenges = campaign.challenges.filter(
        (challenge) => challenge.kind === 'ADMIN'
    )
    const formId = `${campaign.id}-campaign-challenges-form`
    const tableGridColumns =
        'lg:grid-cols-[minmax(0,1.5fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)_minmax(8.5rem,auto)]'

    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Challenges</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                {adminChallenges.map((challenge) => {
                    const deleteFormId = `${challenge.id}-delete-form`

                    return (
                        <form
                            key={deleteFormId}
                            id={deleteFormId}
                            action={deleteCampaignChallengeAction}
                            className='hidden'
                        >
                            <input
                                type='hidden'
                                name='campaignId'
                                value={campaign.id}
                            />
                            <input
                                type='hidden'
                                name='challengeId'
                                value={challenge.id}
                            />
                        </form>
                    )
                })}

                <form
                    id={formId}
                    action={saveCampaignChallengesAction}
                    className='space-y-4'
                >
                    <input
                        type='hidden'
                        name='campaignId'
                        value={campaign.id}
                    />

                    <div
                        className={`hidden gap-3 border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid ${tableGridColumns}`}
                        role='row'
                    >
                        <div role='columnheader'>Challenge name</div>
                        <div role='columnheader'>Points</div>
                        <div role='columnheader'>Multiplier</div>
                        <div role='columnheader'>Actions</div>
                    </div>

                    <div
                        className='space-y-4'
                        role='table'
                        aria-label='Campaign challenges'
                    >
                        {adminChallenges.map((challenge) => {
                            const deleteFormId = `${challenge.id}-delete-form`

                            return (
                                <div key={challenge.id}>
                                    <input
                                        type='hidden'
                                        name='existingChallengeId'
                                        value={challenge.id}
                                    />

                                    <div
                                        className={`grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-card/60 p-3 lg:items-center ${tableGridColumns}`}
                                        role='row'
                                    >
                                        <div role='cell'>
                                            <label
                                                htmlFor={`${challenge.id}-title`}
                                                className='sr-only'
                                            >
                                                Challenge name
                                            </label>
                                            <Input
                                                id={`${challenge.id}-title`}
                                                name='existingTitle'
                                                defaultValue={challenge.title}
                                            />
                                        </div>

                                        <div role='cell'>
                                            <label
                                                htmlFor={`${challenge.id}-pointValue`}
                                                className='sr-only'
                                            >
                                                Challenge points
                                            </label>
                                            <Input
                                                id={`${challenge.id}-pointValue`}
                                                name='existingPointValue'
                                                type='number'
                                                min='0'
                                                step='0.01'
                                                defaultValue={formatPoints(
                                                    challenge.pointValue
                                                )}
                                                placeholder='0'
                                            />
                                        </div>

                                        <div role='cell'>
                                            <label
                                                htmlFor={`${challenge.id}-pageMinuteMultiplier`}
                                                className='sr-only'
                                            >
                                                Challenge multiplier
                                            </label>
                                            <Input
                                                id={`${challenge.id}-pageMinuteMultiplier`}
                                                name='existingPageMinuteMultiplier'
                                                type='number'
                                                min='0'
                                                step='0.01'
                                                defaultValue={formatPoints(
                                                    challenge.pageMinuteMultiplier
                                                )}
                                                placeholder='0'
                                            />
                                        </div>

                                        <div
                                            role='cell'
                                            className='flex items-start lg:justify-end'
                                        >
                                            <ConfirmSubmitButton
                                                type='submit'
                                                form={deleteFormId}
                                                variant='destructive'
                                                title='Delete challenge?'
                                                description={`Delete ${challenge.title} from ${campaign.name}? This cannot be undone.`}
                                                confirmLabel='Delete challenge'
                                            >
                                                Delete
                                            </ConfirmSubmitButton>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        <div
                            className={`grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-dashed border-border/70 bg-card/40 p-3 lg:items-center ${tableGridColumns}`}
                            role='row'
                        >
                            <div role='cell'>
                                <label
                                    htmlFor={`${campaign.id}-new-title`}
                                    className='sr-only'
                                >
                                    New challenge name
                                </label>
                                <Input
                                    id={`${campaign.id}-new-title`}
                                    name='newTitle'
                                    placeholder='New challenge'
                                />
                            </div>

                            <div role='cell'>
                                <label
                                    htmlFor={`${campaign.id}-new-pointValue`}
                                    className='sr-only'
                                >
                                    New challenge points
                                </label>
                                <Input
                                    id={`${campaign.id}-new-pointValue`}
                                    name='newPointValue'
                                    type='number'
                                    min='0'
                                    step='0.01'
                                    placeholder='0'
                                />
                            </div>

                            <div role='cell'>
                                <label
                                    htmlFor={`${campaign.id}-new-pageMinuteMultiplier`}
                                    className='sr-only'
                                >
                                    New challenge multiplier
                                </label>
                                <Input
                                    id={`${campaign.id}-new-pageMinuteMultiplier`}
                                    name='newPageMinuteMultiplier'
                                    type='number'
                                    min='0'
                                    step='0.01'
                                    placeholder='0'
                                />
                            </div>

                            <div
                                role='cell'
                                aria-hidden='true'
                                className='lg:min-w-34'
                            />
                        </div>
                    </div>

                    <DirtyFormActions
                        formId={formId}
                        pendingLabel='Saving changes...'
                    />
                </form>
            </CardContent>
        </Card>
    )
}

export default async function AdminCampaignsPage({
    searchParams,
}: CampaignsPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const requestedCampaignId = getFirstSearchParamValue(
        resolvedSearchParams.selectedCampaignId
    )
    const notice = getNotice(outcome, detail)
    const campaigns = await loadCampaigns()
    const selectedCampaignId =
        campaigns.find((campaign) => campaign.id === requestedCampaignId)?.id ??
        selectDefaultAdminCampaignId(campaigns) ??
        null
    const selectedCampaign =
        campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null

    return (
        <div className='space-y-6'>
            {notice ? <DismissibleNotice {...notice} /> : null}

            <div className='flex flex-wrap items-start gap-2'>
                {selectedCampaignId ? (
                    <CampaignTabs
                        campaigns={campaigns}
                        selectedCampaignId={selectedCampaignId}
                    />
                ) : campaigns.length > 0 ? (
                    <CampaignTabs
                        campaigns={campaigns}
                        selectedCampaignId={campaigns[0].id}
                    />
                ) : null}

                <NewCampaignButton
                    baseCampaign={selectedCampaign ?? campaigns[0]}
                />
            </div>

            {selectedCampaign ? (
                <>
                    <CampaignSettingsForm campaign={selectedCampaign} />
                    <CompetitorChallengesTable campaign={selectedCampaign} />
                    <CampaignChallengesTable campaign={selectedCampaign} />

                    <form
                        action={deleteCampaignAction}
                        className='flex justify-end pt-2'
                    >
                        <input
                            type='hidden'
                            name='campaignId'
                            value={selectedCampaign.id}
                        />
                        <ConfirmSubmitButton
                            type='submit'
                            variant='destructive'
                            title='Delete campaign?'
                            description={`Delete ${selectedCampaign.name} and all of its challenges? This cannot be undone.`}
                            confirmLabel='Delete campaign'
                        >
                            Delete campaign
                        </ConfirmSubmitButton>
                    </form>
                </>
            ) : (
                <EmptyState
                    title='No campaigns are available.'
                    description='Create a campaign to manage dates, scoring, and challenges inline.'
                />
            )}
        </div>
    )
}
