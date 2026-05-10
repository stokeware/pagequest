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
import { resolveEpicReadPageMultiplier } from '@/lib/campaign-admin'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'
import { prisma } from '@/lib/prisma'

import {
    createCampaignChallengeAction,
    deleteCampaignChallengeAction,
    updateCampaignAction,
    updateCampaignChallengeAction,
} from './actions'

type CampaignsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const noticeContent = {
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
    'invalid-epic-read-page-multiplier':
        'Epic read multiplier must be a valid number that is zero or greater.',
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
    'unexpected-error':
        'An unexpected error interrupted the campaign action. Check the server logs if this keeps happening.',
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

function getNoticeClassName(tone: 'error' | 'success') {
    return tone === 'error'
        ? 'border-destructive/30 bg-destructive/8 text-foreground'
        : 'border-[rgba(135,131,85,0.28)] bg-[rgba(135,131,85,0.12)] text-foreground'
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
            campaignChallenges: {
                orderBy: [
                    {
                        sortOrder: 'asc',
                    },
                    {
                        createdAt: 'asc',
                    },
                ],
                select: {
                    challenge: {
                        select: {
                            id: true,
                            pointValue: true,
                            title: true,
                        },
                    },
                    id: true,
                    sortOrder: true,
                },
            },
            challengeCategoryBonuses: true,
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
    campaigns: Awaited<ReturnType<typeof loadCampaigns>>
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

function CampaignSettingsForm({
    campaign,
}: {
    campaign: Awaited<ReturnType<typeof loadCampaigns>>[number]
}) {
    const epicReadPageMultiplier = resolveEpicReadPageMultiplier(
        campaign.challengeCategoryBonuses
    )

    return (
        <Card className='surface-card'>
            <CardContent className='pt-6'>
                <form action={updateCampaignAction} className='ui-form-shell'>
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

                        <FormField
                            label='Epic read page multiplier'
                            htmlFor={`${campaign.id}-epicReadPageMultiplier`}
                        >
                            <Input
                                id={`${campaign.id}-epicReadPageMultiplier`}
                                name='epicReadPageMultiplier'
                                type='number'
                                min='0'
                                step='0.01'
                                defaultValue={
                                    epicReadPageMultiplier?.toString() ?? ''
                                }
                                placeholder='1'
                            />
                        </FormField>
                    </div>

                    <div className='flex justify-end'>
                        <Button nativeButton type='submit'>
                            Save changes
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

function CampaignChallengesTable({
    campaign,
}: {
    campaign: Awaited<ReturnType<typeof loadCampaigns>>[number]
}) {
    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Challenges</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div
                    className='hidden gap-3 border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_auto]'
                    role='row'
                >
                    <div role='columnheader'>Challenge name</div>
                    <div role='columnheader'>Points</div>
                    <div role='columnheader'>Actions</div>
                </div>

                {campaign.campaignChallenges.length > 0 ? (
                    <div
                        className='space-y-4'
                        role='table'
                        aria-label='Campaign challenges'
                    >
                        {campaign.campaignChallenges.map((assignment) => {
                            return (
                                <form
                                    key={assignment.id}
                                    action={updateCampaignChallengeAction}
                                    className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-card/60 p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_auto] lg:items-center'
                                    role='row'
                                >
                                    <input
                                        type='hidden'
                                        name='campaignId'
                                        value={campaign.id}
                                    />
                                    <input
                                        type='hidden'
                                        name='challengeId'
                                        value={assignment.challenge.id}
                                    />
                                    <input
                                        type='hidden'
                                        name='campaignChallengeId'
                                        value={assignment.id}
                                    />

                                    <div role='cell'>
                                        <label
                                            htmlFor={`${assignment.id}-title`}
                                            className='sr-only'
                                        >
                                            Challenge name
                                        </label>
                                        <Input
                                            id={`${assignment.id}-title`}
                                            name='title'
                                            defaultValue={
                                                assignment.challenge.title
                                            }
                                        />
                                    </div>

                                    <div role='cell'>
                                        <label
                                            htmlFor={`${assignment.id}-pointValue`}
                                            className='sr-only'
                                        >
                                            Challenge points
                                        </label>
                                        <Input
                                            id={`${assignment.id}-pointValue`}
                                            name='pointValue'
                                            type='number'
                                            min='0'
                                            step='0.01'
                                            defaultValue={formatPoints(
                                                assignment.challenge.pointValue
                                            )}
                                            placeholder='Campaign default'
                                        />
                                    </div>

                                    <div
                                        role='cell'
                                        className='flex items-start gap-2 lg:justify-end'
                                    >
                                        <Button nativeButton type='submit'>
                                            Save
                                        </Button>

                                        <Button
                                            nativeButton
                                            type='submit'
                                            formAction={
                                                deleteCampaignChallengeAction
                                            }
                                            variant='destructive'
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </form>
                            )
                        })}

                        <form
                            action={createCampaignChallengeAction}
                            className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-dashed border-border/70 bg-card/40 p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_auto] lg:items-center'
                            role='row'
                        >
                            <input
                                type='hidden'
                                name='campaignId'
                                value={campaign.id}
                            />

                            <div role='cell'>
                                <label
                                    htmlFor={`${campaign.id}-new-title`}
                                    className='sr-only'
                                >
                                    New challenge name
                                </label>
                                <Input
                                    id={`${campaign.id}-new-title`}
                                    name='title'
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
                                    name='pointValue'
                                    type='number'
                                    min='0'
                                    step='0.01'
                                    placeholder='Points'
                                />
                            </div>

                            <div
                                role='cell'
                                className='flex items-start lg:justify-end'
                            >
                                <Button nativeButton type='submit'>
                                    Create challenge
                                </Button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <form
                        action={createCampaignChallengeAction}
                        className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-dashed border-border/70 bg-card/40 p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_auto] lg:items-center'
                    >
                        <input
                            type='hidden'
                            name='campaignId'
                            value={campaign.id}
                        />

                        <div>
                            <label
                                htmlFor={`${campaign.id}-empty-new-title`}
                                className='sr-only'
                            >
                                New challenge name
                            </label>
                            <Input
                                id={`${campaign.id}-empty-new-title`}
                                name='title'
                                placeholder='New challenge'
                            />
                        </div>

                        <div>
                            <label
                                htmlFor={`${campaign.id}-empty-new-pointValue`}
                                className='sr-only'
                            >
                                New challenge points
                            </label>
                            <Input
                                id={`${campaign.id}-empty-new-pointValue`}
                                name='pointValue'
                                type='number'
                                min='0'
                                step='0.01'
                                placeholder='Points'
                            />
                        </div>

                        <div className='flex items-start lg:justify-end'>
                            <Button nativeButton type='submit'>
                                Create challenge
                            </Button>
                        </div>
                    </form>
                )}
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

    if (campaigns.length === 0) {
        return (
            <EmptyState
                title='No campaigns are available.'
                description='Create a campaign record first, then return here to manage dates, scoring, and challenges inline.'
            />
        )
    }

    const selectedCampaignId =
        campaigns.find((campaign) => campaign.id === requestedCampaignId)?.id ??
        selectDefaultAdminCampaignId(campaigns) ??
        campaigns[0].id
    const selectedCampaign =
        campaigns.find((campaign) => campaign.id === selectedCampaignId) ??
        campaigns[0]

    return (
        <div className='space-y-6'>
            {notice ? (
                <div
                    className={`rounded-[calc(var(--radius-xl)-4px)] border px-4 py-3 ${getNoticeClassName(
                        notice.tone
                    )}`}
                >
                    <p className='text-sm font-semibold'>{notice.title}</p>
                    {notice.description ? (
                        <p className='text-sm'>{notice.description}</p>
                    ) : null}
                </div>
            ) : null}

            <CampaignTabs
                campaigns={campaigns}
                selectedCampaignId={selectedCampaign.id}
            />

            <CampaignSettingsForm campaign={selectedCampaign} />
            <CampaignChallengesTable campaign={selectedCampaign} />
        </div>
    )
}
