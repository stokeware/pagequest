'use client'
import type { ChallengeKind } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'

import { Button, Card, CardContent, FormField, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

import { saveCampaignWorkspaceAction } from './actions'
import {
    type CampaignWorkspaceState,
    type PersistedProgressRow,
} from './workspace-state'

export type LogProgressCampaignChallenge = {
    achieved: boolean
    id: string
    kind: ChallengeKind
    ownedByCurrentParticipant: boolean
    pageMinuteMultiplier: number
    pointValue: number
    sourceBookTitle: string | null
    title: string
}

export type LogProgressViewModel = {
    campaignDateRange: string | null
    campaignParticipantId: string | null
    campaignChallenges: LogProgressCampaignChallenge[]
    campaignName: string
    progressScoring: {
        pointsPerMinute: number
        pointsPerPage: number
    }
    workspaceState: CampaignWorkspaceState
}

export type ProgressRow = PersistedProgressRow

type LogProgressTabId = 'challenges' | 'progress'

const selectClassName = [
    'h-10 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

const checkboxClassName = [
    'h-5 w-5 rounded border border-input bg-card/72',
    'accent-[color:var(--button-primary-bg)] outline-none transition-[border-color,box-shadow]',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const rowActionButtonClassName =
    'h-10 min-w-20 rounded-[calc(var(--radius-lg)-2px)]'

const tabLabels: Array<{
    id: LogProgressTabId
    label: string
}> = [
    {
        id: 'progress',
        label: 'Progress',
    },
    {
        id: 'challenges',
        label: 'Challenges',
    },
]

export function getAvailableProgressChallenges({
    campaignChallenges,
    progressRows,
    rowId,
}: {
    campaignChallenges: LogProgressCampaignChallenge[]
    progressRows: ProgressRow[]
    rowId: string
}) {
    const currentRow = progressRows.find((row) => row.id === rowId)

    if (!currentRow) {
        return []
    }

    const selectedChallengeIds = new Set(
        progressRows.flatMap((row) =>
            row.id !== rowId && row.challengeId ? [row.challengeId] : []
        )
    )

    if (currentRow.rowType === 'PERSONAL_GOAL') {
        return campaignChallenges.filter(
            (challenge) => challenge.kind === 'PERSONAL_GOAL_INSTANCE'
        )
    }

    return campaignChallenges.filter((challenge) => {
        if (selectedChallengeIds.has(challenge.id)) {
            return false
        }

        if (challenge.kind === 'PERSONAL_GOAL_INSTANCE') {
            return false
        }

        if (challenge.kind === 'RECOMMENDATION_INSTANCE') {
            if (challenge.ownedByCurrentParticipant) {
                return false
            }

            return (
                normalizeText(challenge.sourceBookTitle ?? '') ===
                normalizeText(currentRow.bookName)
            )
        }

        return true
    })
}

type LogProgressScreenProps = LogProgressViewModel & {
    initialActiveTab?: LogProgressTabId
}

export function LogProgressScreen({
    campaignDateRange,
    campaignParticipantId,
    campaignChallenges,
    campaignName,
    initialActiveTab = 'progress',
    progressScoring,
    workspaceState,
}: LogProgressScreenProps) {
    const router = useRouter()
    const initialProgressRows = ensurePersonalGoalRow(
        workspaceState.progressRows.length > 0
            ? workspaceState.progressRows
            : [createEmptyProgressRow(1)],
        campaignChallenges,
        workspaceState.personalGoalTitle
    )
    const [activeTab, setActiveTab] =
        useState<LogProgressTabId>(initialActiveTab)
    const [recommendationTitle, setRecommendationTitle] = useState(
        workspaceState.recommendationTitle
    )
    const [personalGoalTitle, setPersonalGoalTitle] = useState(
        workspaceState.personalGoalTitle
    )
    const [progressRows, setProgressRows] =
        useState<ProgressRow[]>(initialProgressRows)
    const [nextProgressRowNumber, setNextProgressRowNumber] = useState(
        getNextProgressRowNumber(workspaceState.progressRows)
    )
    const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(
        null
    )
    const [savedWorkspaceStateKey, setSavedWorkspaceStateKey] = useState(() =>
        serializeWorkspaceState(
            buildWorkspaceState({
                campaignChallenges,
                personalGoalTitle: workspaceState.personalGoalTitle,
                progressRows: initialProgressRows,
                recommendationTitle: workspaceState.recommendationTitle,
            })
        )
    )
    const [pendingSaveTarget, setPendingSaveTarget] =
        useState<LogProgressTabId | null>(null)
    const [isPending, startTransition] = useTransition()
    const baseId = useId()
    const currentWorkspaceState = buildWorkspaceState({
        campaignChallenges,
        personalGoalTitle,
        progressRows,
        recommendationTitle,
    })
    const hasUnsavedChanges =
        serializeWorkspaceState(currentWorkspaceState) !==
        savedWorkspaceStateKey

    const updateProgressRows = (
        updater: ProgressRow[] | ((rows: ProgressRow[]) => ProgressRow[]),
        nextPersonalGoalTitle = personalGoalTitle
    ) => {
        setProgressRows((currentRows) => {
            const updatedRows =
                typeof updater === 'function' ? updater(currentRows) : updater

            return sanitizeProgressRows(
                updatedRows,
                campaignChallenges,
                nextPersonalGoalTitle
            )
        })
    }

    const persistWorkspace = (saveTarget: LogProgressTabId) => {
        setSaveErrorMessage(null)
        setPendingSaveTarget(saveTarget)

        startTransition(async () => {
            const result = await saveCampaignWorkspaceAction({
                campaignParticipantId,
                workspaceState: currentWorkspaceState,
            })

            setPendingSaveTarget(null)

            if (result.outcome === 'error') {
                setSaveErrorMessage(result.message)

                return
            }

            const nextRows = ensurePersonalGoalRow(
                result.workspaceState.progressRows.length > 0
                    ? result.workspaceState.progressRows
                    : [createEmptyProgressRow(nextProgressRowNumber)],
                campaignChallenges,
                result.workspaceState.personalGoalTitle
            )

            setRecommendationTitle(result.workspaceState.recommendationTitle)
            setPersonalGoalTitle(result.workspaceState.personalGoalTitle)
            setProgressRows(nextRows)
            setNextProgressRowNumber(getNextProgressRowNumber(nextRows))
            setSavedWorkspaceStateKey(
                serializeWorkspaceState(
                    buildWorkspaceState({
                        campaignChallenges,
                        personalGoalTitle:
                            result.workspaceState.personalGoalTitle,
                        progressRows: nextRows,
                        recommendationTitle:
                            result.workspaceState.recommendationTitle,
                    })
                )
            )
            router.refresh()
        })
    }

    const addProgressRow = () => {
        setSaveErrorMessage(null)
        setProgressRows((currentRows) =>
            sanitizeProgressRows(
                [...currentRows, createEmptyProgressRow(nextProgressRowNumber)],
                campaignChallenges,
                personalGoalTitle
            )
        )
        setNextProgressRowNumber((currentValue) => currentValue + 1)
    }

    const deleteProgressRow = (rowId: string) => {
        setSaveErrorMessage(null)
        setProgressRows((currentRows) => {
            const nextRows = currentRows.filter(
                (row) => row.id !== rowId || row.rowType === 'PERSONAL_GOAL'
            )

            return sanitizeProgressRows(
                nextRows.length > 0
                    ? nextRows
                    : [createEmptyProgressRow(nextProgressRowNumber)],
                campaignChallenges,
                personalGoalTitle
            )
        })

        setNextProgressRowNumber((currentValue) => currentValue + 1)
    }

    return (
        <div className='stack-lg'>
            <header className='surface-card rounded-[calc(var(--radius-xl)+4px)] border border-(--line-strong) bg-card/72 px-6 py-8 shadow-[0_1.25rem_3rem_rgba(64,105,124,0.12)]'>
                <h1 className='text-center text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl'>
                    {campaignName}
                </h1>
                {campaignDateRange ? (
                    <p className='mt-2 text-center text-xl text-muted-foreground'>
                        {campaignDateRange}
                    </p>
                ) : null}
            </header>

            <div className='flex justify-center'>
                <div
                    className='inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-(--line-strong) bg-card/70 p-2'
                    role='tablist'
                    aria-label='Competitor challenge and progress views'
                >
                    {tabLabels.map((tab) => {
                        const isActive = tab.id === activeTab

                        return (
                            <button
                                key={tab.id}
                                id={`${baseId}-${tab.id}-tab`}
                                type='button'
                                role='tab'
                                aria-controls={`${baseId}-${tab.id}-panel`}
                                aria-selected={isActive}
                                className={cn(
                                    'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                                    isActive
                                        ? 'bg-(--button-primary-bg) text-(--button-primary-fg) shadow-[0_0.85rem_1.8rem_rgba(202,89,47,0.18)]'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div
                id={`${baseId}-${activeTab}-panel`}
                role='tabpanel'
                aria-labelledby={`${baseId}-${activeTab}-tab`}
            >
                {activeTab === 'challenges' ? (
                    <div className='stack-lg'>
                        <Card className='surface-card'>
                            <CardContent className='pt-6'>
                                <form className='ui-form-shell'>
                                    <div className='grid gap-4'>
                                        <FormField
                                            label='Recommendation Book'
                                            htmlFor='recommendation-challenge'
                                        >
                                            <Input
                                                id='recommendation-challenge'
                                                name='recommendationChallenge'
                                                placeholder='Enter a book title'
                                                value={recommendationTitle}
                                                onChange={(event) => {
                                                    setRecommendationTitle(
                                                        event.target.value
                                                    )
                                                }}
                                            />
                                        </FormField>

                                        <FormField
                                            label='Personal Goal Book'
                                            htmlFor='personal-goal-book'
                                        >
                                            <Input
                                                id='personal-goal-book'
                                                name='personalGoal'
                                                placeholder='Enter a book title'
                                                value={personalGoalTitle}
                                                onChange={(event) => {
                                                    const nextValue =
                                                        event.target.value

                                                    setPersonalGoalTitle(
                                                        nextValue
                                                    )
                                                    updateProgressRows(
                                                        (rows) => rows,
                                                        nextValue
                                                    )
                                                }}
                                            />
                                        </FormField>
                                    </div>

                                    <div className='flex justify-end'>
                                        <Button
                                            type='button'
                                            disabled={
                                                !campaignParticipantId ||
                                                !hasUnsavedChanges ||
                                                isPending
                                            }
                                            onClick={() =>
                                                persistWorkspace('challenges')
                                            }
                                        >
                                            {isPending &&
                                            pendingSaveTarget === 'challenges'
                                                ? 'Saving...'
                                                : 'Save changes'}
                                        </Button>
                                    </div>

                                    {saveErrorMessage ? (
                                        <p className='text-sm text-destructive'>
                                            {saveErrorMessage}
                                        </p>
                                    ) : null}
                                </form>
                            </CardContent>
                        </Card>

                        <Card className='surface-card'>
                            <CardContent className='space-y-4 pt-6'>
                                <div
                                    className='hidden gap-3 border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)_minmax(5rem,0.4fr)]'
                                    role='row'
                                >
                                    <div role='columnheader'>
                                        Challenge name
                                    </div>
                                    <div role='columnheader'>Points</div>
                                    <div role='columnheader'>Multiplier</div>
                                    <div
                                        role='columnheader'
                                        className='text-center'
                                    >
                                        Achieved
                                    </div>
                                </div>

                                {campaignChallenges.length > 0 ? (
                                    <div
                                        className='space-y-4'
                                        role='table'
                                        aria-label='Campaign challenges'
                                    >
                                        {campaignChallenges.map((challenge) => (
                                            <div
                                                key={challenge.id}
                                                className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-card/60 p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)_minmax(5rem,0.4fr)] lg:items-center'
                                                role='row'
                                            >
                                                <div role='cell'>
                                                    <p className='font-medium text-foreground'>
                                                        {challenge.title}
                                                    </p>
                                                </div>

                                                <div role='cell'>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {formatChallengeValue(
                                                            challenge.pointValue
                                                        )}
                                                    </p>
                                                </div>

                                                <div role='cell'>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {formatChallengeValue(
                                                            challenge.pageMinuteMultiplier
                                                        )}
                                                    </p>
                                                </div>

                                                <div
                                                    role='cell'
                                                    className='flex min-h-5 items-center justify-center'
                                                >
                                                    {challenge.achieved ? (
                                                        <span
                                                            aria-label='Achieved'
                                                            className='text-(--button-primary-bg) text-2xl font-semibold leading-none'
                                                        >
                                                            ✓
                                                        </span>
                                                    ) : (
                                                        <span
                                                            aria-hidden='true'
                                                            className='block h-7 w-7'
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='type-muted text-sm'>
                                        No active challenges are attached to
                                        this campaign yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <Card className='surface-card'>
                        <CardContent className='pt-6'>
                            <div className='overflow-x-auto'>
                                <table className='min-w-272 w-full border-collapse table-fixed'>
                                    <colgroup>
                                        <col className='w-[44%]' />
                                        <col className='w-28' />
                                        <col className='w-28' />
                                        <col className='w-28' />
                                        <col className='w-[20%]' />
                                        <col className='w-28' />
                                        <col className='w-24' />
                                    </colgroup>
                                    <thead>
                                        <tr className='border-b border-border/70 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
                                            <th className='px-3 py-2'>
                                                Book name
                                            </th>
                                            <th className='px-3 py-2'>Pages</th>
                                            <th className='px-3 py-2'>
                                                Minutes
                                            </th>
                                            <th className='px-3 py-2 text-center'>
                                                Completed
                                            </th>
                                            <th className='px-3 py-2'>
                                                Challenge
                                            </th>
                                            <th className='px-3 py-2 text-right'>
                                                Points
                                            </th>
                                            <th className='px-3 py-2 text-right'>
                                                <span className='sr-only'>
                                                    Delete
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {progressRows.map((row) => {
                                            const availableChallenges =
                                                getAvailableProgressChallenges({
                                                    campaignChallenges,
                                                    progressRows,
                                                    rowId: row.id,
                                                })
                                            const isPersonalGoalRow =
                                                row.rowType === 'PERSONAL_GOAL'
                                            const personalGoalChallenge =
                                                getPersonalGoalChallenge(
                                                    campaignChallenges
                                                )
                                            const challengeValue =
                                                isPersonalGoalRow
                                                    ? row.challengeId ||
                                                      '__personal-goal__'
                                                    : row.challengeId

                                            return (
                                                <tr
                                                    key={row.id}
                                                    className='border-b border-border/50 last:border-b-0'
                                                >
                                                    <td className='px-3 py-3 align-top'>
                                                        <Input
                                                            aria-label={`Book name ${row.id}`}
                                                            placeholder='Enter a book title'
                                                            value={row.bookName}
                                                            onChange={(
                                                                event
                                                            ) => {
                                                                const nextValue =
                                                                    event.target
                                                                        .value

                                                                if (
                                                                    isPersonalGoalRow
                                                                ) {
                                                                    setPersonalGoalTitle(
                                                                        nextValue
                                                                    )
                                                                }

                                                                updateProgressRows(
                                                                    (rows) =>
                                                                        rows.map(
                                                                            (
                                                                                currentRow
                                                                            ) =>
                                                                                currentRow.id ===
                                                                                row.id
                                                                                    ? {
                                                                                          ...currentRow,
                                                                                          bookName:
                                                                                              nextValue,
                                                                                      }
                                                                                    : currentRow
                                                                        ),
                                                                    isPersonalGoalRow
                                                                        ? nextValue
                                                                        : personalGoalTitle
                                                                )
                                                            }}
                                                        />
                                                    </td>

                                                    <td className='px-3 py-3 align-top'>
                                                        <Input
                                                            aria-label={`Pages ${row.id}`}
                                                            min='0'
                                                            placeholder='0'
                                                            type='number'
                                                            value={row.pages}
                                                            onChange={(event) =>
                                                                updateProgressRows(
                                                                    (rows) =>
                                                                        rows.map(
                                                                            (
                                                                                currentRow
                                                                            ) =>
                                                                                currentRow.id ===
                                                                                row.id
                                                                                    ? {
                                                                                          ...currentRow,
                                                                                          pages: event
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : currentRow
                                                                        )
                                                                )
                                                            }
                                                        />
                                                    </td>

                                                    <td className='px-3 py-3 align-top'>
                                                        <Input
                                                            aria-label={`Minutes ${row.id}`}
                                                            min='0'
                                                            placeholder='0'
                                                            type='number'
                                                            value={row.minutes}
                                                            onChange={(event) =>
                                                                updateProgressRows(
                                                                    (rows) =>
                                                                        rows.map(
                                                                            (
                                                                                currentRow
                                                                            ) =>
                                                                                currentRow.id ===
                                                                                row.id
                                                                                    ? {
                                                                                          ...currentRow,
                                                                                          minutes:
                                                                                              event
                                                                                                  .target
                                                                                                  .value,
                                                                                      }
                                                                                    : currentRow
                                                                        )
                                                                )
                                                            }
                                                        />
                                                    </td>

                                                    <td className='px-3 py-3 align-top text-center'>
                                                        <div className='flex justify-center pt-2'>
                                                            <input
                                                                aria-label={`Completed ${row.id}`}
                                                                checked={
                                                                    row.completed
                                                                }
                                                                className={
                                                                    checkboxClassName
                                                                }
                                                                type='checkbox'
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    updateProgressRows(
                                                                        (
                                                                            rows
                                                                        ) =>
                                                                            rows.map(
                                                                                (
                                                                                    currentRow
                                                                                ) =>
                                                                                    currentRow.id ===
                                                                                    row.id
                                                                                        ? {
                                                                                              ...currentRow,
                                                                                              completed:
                                                                                                  event
                                                                                                      .target
                                                                                                      .checked,
                                                                                          }
                                                                                        : currentRow
                                                                            )
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </td>

                                                    <td className='px-3 py-3 align-top'>
                                                        <select
                                                            aria-label={`Challenge ${row.id}`}
                                                            className={
                                                                selectClassName
                                                            }
                                                            disabled={
                                                                availableChallenges.length ===
                                                                    0 ||
                                                                isPersonalGoalRow
                                                            }
                                                            value={
                                                                challengeValue
                                                            }
                                                            onChange={(event) =>
                                                                updateProgressRows(
                                                                    (rows) =>
                                                                        rows.map(
                                                                            (
                                                                                currentRow
                                                                            ) =>
                                                                                currentRow.id ===
                                                                                row.id
                                                                                    ? {
                                                                                          ...currentRow,
                                                                                          challengeId:
                                                                                              event
                                                                                                  .target
                                                                                                  .value,
                                                                                      }
                                                                                    : currentRow
                                                                        )
                                                                )
                                                            }
                                                        >
                                                            {isPersonalGoalRow ? (
                                                                <option
                                                                    value={
                                                                        challengeValue
                                                                    }
                                                                >
                                                                    {personalGoalChallenge?.title ??
                                                                        'Personal Goal'}
                                                                </option>
                                                            ) : (
                                                                <>
                                                                    <option value=''>
                                                                        {availableChallenges.length >
                                                                        0
                                                                            ? 'Select challenge'
                                                                            : 'No challenges available'}
                                                                    </option>

                                                                    {availableChallenges.map(
                                                                        (
                                                                            challenge
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    challenge.id
                                                                                }
                                                                                value={
                                                                                    challenge.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    challenge.title
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </>
                                                            )}
                                                        </select>
                                                    </td>

                                                    <td className='px-3 py-3 align-top text-right'>
                                                        <span className='block pt-2 text-sm font-medium text-muted-foreground'>
                                                            {formatProgressPoints(
                                                                calculateProgressRowPoints(
                                                                    {
                                                                        campaignChallenges,
                                                                        pointsPerMinute:
                                                                            progressScoring.pointsPerMinute,
                                                                        pointsPerPage:
                                                                            progressScoring.pointsPerPage,
                                                                        row,
                                                                    }
                                                                )
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className='px-3 py-3 align-top text-right'>
                                                        {isPersonalGoalRow ? null : (
                                                            <Button
                                                                type='button'
                                                                variant='destructive'
                                                                className={
                                                                    rowActionButtonClassName
                                                                }
                                                                onClick={() =>
                                                                    deleteProgressRow(
                                                                        row.id
                                                                    )
                                                                }
                                                            >
                                                                Delete
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className='mt-6 flex flex-wrap items-center justify-between gap-3'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={addProgressRow}
                                >
                                    New Book
                                </Button>

                                <Button
                                    type='button'
                                    disabled={
                                        !campaignParticipantId ||
                                        !hasUnsavedChanges ||
                                        isPending
                                    }
                                    onClick={() => persistWorkspace('progress')}
                                >
                                    {isPending &&
                                    pendingSaveTarget === 'progress'
                                        ? 'Saving...'
                                        : 'Save Changes'}
                                </Button>
                            </div>

                            {saveErrorMessage ? (
                                <p className='mt-3 text-sm text-destructive'>
                                    {saveErrorMessage}
                                </p>
                            ) : null}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

function createEmptyProgressRow(index: number): ProgressRow {
    return {
        bookName: '',
        challengeId: '',
        completed: false,
        id: `progress-row-${index}`,
        minutes: '',
        pages: '',
        rowType: 'STANDARD',
    }
}

function buildWorkspaceState({
    campaignChallenges,
    personalGoalTitle,
    progressRows,
    recommendationTitle,
}: {
    campaignChallenges: LogProgressCampaignChallenge[]
    personalGoalTitle: string
    progressRows: ProgressRow[]
    recommendationTitle: string
}): CampaignWorkspaceState {
    return {
        personalGoalTitle,
        progressRows: sanitizeProgressRows(
            progressRows.filter(
                (row) =>
                    row.rowType === 'PERSONAL_GOAL' ||
                    row.bookName.trim().length > 0
            ),
            campaignChallenges,
            personalGoalTitle
        ),
        recommendationTitle,
    }
}

function getNextProgressRowNumber(rows: ProgressRow[]) {
    const highestIndex = rows.reduce((currentMax, row) => {
        const match = /progress-row-(\d+)$/.exec(row.id)
        const numericIndex = match ? Number(match[1]) : 0

        return numericIndex > currentMax ? numericIndex : currentMax
    }, 0)

    return highestIndex + 1
}

function sanitizeProgressRows(
    rows: ProgressRow[],
    campaignChallenges: LogProgressCampaignChallenge[],
    personalGoalTitle: string
) {
    const usedChallengeIds = new Set<string>()
    const normalizedRows = ensurePersonalGoalRow(
        rows,
        campaignChallenges,
        personalGoalTitle
    )

    return normalizedRows.map((row) => {
        const availableChallenges = getAvailableProgressChallenges({
            campaignChallenges,
            progressRows: normalizedRows,
            rowId: row.id,
        })
        const isAllowedSelection = availableChallenges.some(
            (challenge) => challenge.id === row.challengeId
        )

        if (row.rowType === 'PERSONAL_GOAL') {
            const personalGoalChallenge =
                getPersonalGoalChallenge(campaignChallenges)

            if (personalGoalChallenge?.id) {
                usedChallengeIds.add(personalGoalChallenge.id)
            }

            return {
                ...row,
                bookName: personalGoalTitle,
                challengeId: personalGoalChallenge?.id ?? '',
                rowType: 'PERSONAL_GOAL' as const,
            }
        }

        if (
            !row.challengeId ||
            !isAllowedSelection ||
            usedChallengeIds.has(row.challengeId)
        ) {
            return {
                ...row,
                challengeId: '',
                rowType: 'STANDARD' as const,
            }
        }

        usedChallengeIds.add(row.challengeId)

        return {
            ...row,
            rowType: 'STANDARD' as const,
        }
    })
}

function ensurePersonalGoalRow(
    rows: ProgressRow[],
    campaignChallenges: LogProgressCampaignChallenge[],
    personalGoalTitle: string
) {
    const personalGoalChallenge = getPersonalGoalChallenge(campaignChallenges)
    const existingPersonalGoalRow = rows.find(
        (row) => row.rowType === 'PERSONAL_GOAL'
    )
    const standardRows = rows.filter((row) => row.rowType !== 'PERSONAL_GOAL')
    const personalGoalRow: ProgressRow = {
        bookName: personalGoalTitle,
        challengeId: personalGoalChallenge?.id ?? '',
        completed: existingPersonalGoalRow?.completed ?? false,
        id: existingPersonalGoalRow?.id ?? 'progress-row-personal-goal',
        minutes: existingPersonalGoalRow?.minutes ?? '',
        pages: existingPersonalGoalRow?.pages ?? '',
        rowType: 'PERSONAL_GOAL',
    }

    return [personalGoalRow, ...standardRows]
}

function getPersonalGoalChallenge(
    campaignChallenges: LogProgressCampaignChallenge[]
) {
    return campaignChallenges.find(
        (challenge) => challenge.kind === 'PERSONAL_GOAL_INSTANCE'
    )
}

function normalizeText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function calculateProgressRowPoints({
    campaignChallenges,
    pointsPerMinute,
    pointsPerPage,
    row,
}: {
    campaignChallenges: LogProgressCampaignChallenge[]
    pointsPerMinute: number
    pointsPerPage: number
    row: ProgressRow
}) {
    const pages = toNonNegativeNumber(row.pages)
    const minutes = toNonNegativeNumber(row.minutes)
    const basePoints = pages * pointsPerPage + minutes * pointsPerMinute
    const selectedChallenge = campaignChallenges.find(
        (challenge) => challenge.id === row.challengeId
    )

    if (!row.completed || !selectedChallenge) {
        return basePoints
    }

    if (selectedChallenge.pageMinuteMultiplier > 0) {
        return basePoints * selectedChallenge.pageMinuteMultiplier
    }

    return basePoints + selectedChallenge.pointValue
}

function toNonNegativeNumber(value: string) {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return 0
    }

    return numericValue
}

function formatProgressPoints(value: number) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(value)
}

function formatChallengeValue(value: number) {
    if (value === 0) {
        return ''
    }

    return Number.isInteger(value)
        ? value.toString()
        : value.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

function serializeWorkspaceState(workspaceState: CampaignWorkspaceState) {
    return JSON.stringify(workspaceState)
}
