'use client'

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
    pointValue: number
    pointsLabel: string
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
    recommendationTitle,
    rowId,
}: {
    campaignChallenges: LogProgressCampaignChallenge[]
    progressRows: ProgressRow[]
    recommendationTitle: string
    rowId: string
}) {
    const selectedChallengeIds = new Set(
        progressRows.flatMap((row) =>
            row.id !== rowId && row.challengeId ? [row.challengeId] : []
        )
    )
    const currentRow = progressRows.find((row) => row.id === rowId)
    const isOwnRecommendationBook =
        currentRow != null &&
        normalizeText(currentRow.bookName).length > 0 &&
        normalizeText(currentRow.bookName) ===
            normalizeText(recommendationTitle)

    return campaignChallenges.filter((challenge) => {
        if (selectedChallengeIds.has(challenge.id)) {
            return false
        }

        if (
            isOwnRecommendationBook &&
            isRecommendationChallengeTitle(challenge.title)
        ) {
            return false
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
    const [activeTab, setActiveTab] =
        useState<LogProgressTabId>(initialActiveTab)
    const [recommendationTitle, setRecommendationTitle] = useState(
        workspaceState.recommendationTitle
    )
    const [epicReadTitle, setEpicReadTitle] = useState(
        workspaceState.epicReadTitle
    )
    const [progressRows, setProgressRows] = useState<ProgressRow[]>([
        ...(workspaceState.progressRows.length > 0
            ? workspaceState.progressRows
            : [createEmptyProgressRow(1)]),
    ])
    const [nextProgressRowNumber, setNextProgressRowNumber] = useState(
        getNextProgressRowNumber(workspaceState.progressRows)
    )
    const [saveFeedbackMessage, setSaveFeedbackMessage] = useState<
        string | null
    >(null)
    const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(
        null
    )
    const [pendingSaveTarget, setPendingSaveTarget] =
        useState<LogProgressTabId | null>(null)
    const [isPending, startTransition] = useTransition()
    const baseId = useId()

    const updateProgressRows = (
        updater: ProgressRow[] | ((rows: ProgressRow[]) => ProgressRow[]),
        nextRecommendationTitle = recommendationTitle
    ) => {
        setProgressRows((currentRows) => {
            const updatedRows =
                typeof updater === 'function' ? updater(currentRows) : updater

            return sanitizeProgressRows(
                updatedRows,
                campaignChallenges,
                nextRecommendationTitle
            )
        })
    }

    const persistWorkspace = (saveTarget: LogProgressTabId) => {
        setSaveFeedbackMessage(null)
        setSaveErrorMessage(null)
        setPendingSaveTarget(saveTarget)

        const nextWorkspaceState: CampaignWorkspaceState = {
            epicReadTitle,
            progressRows: sanitizeProgressRows(
                progressRows.filter((row) => row.bookName.length > 0),
                campaignChallenges,
                recommendationTitle
            ),
            recommendationTitle,
        }

        startTransition(async () => {
            const result = await saveCampaignWorkspaceAction({
                campaignParticipantId,
                workspaceState: nextWorkspaceState,
            })

            setPendingSaveTarget(null)

            if (result.outcome === 'error') {
                setSaveErrorMessage(result.message)

                return
            }

            const nextRows =
                result.workspaceState.progressRows.length > 0
                    ? result.workspaceState.progressRows
                    : [createEmptyProgressRow(nextProgressRowNumber)]

            setRecommendationTitle(result.workspaceState.recommendationTitle)
            setEpicReadTitle(result.workspaceState.epicReadTitle)
            setProgressRows(nextRows)
            setNextProgressRowNumber(getNextProgressRowNumber(nextRows))
            setSaveFeedbackMessage(result.message)
        })
    }

    const addProgressRow = () => {
        setSaveFeedbackMessage(null)
        setSaveErrorMessage(null)
        setProgressRows((currentRows) => [
            ...currentRows,
            createEmptyProgressRow(nextProgressRowNumber),
        ])
        setNextProgressRowNumber((currentValue) => currentValue + 1)
    }

    const deleteProgressRow = (rowId: string) => {
        setSaveFeedbackMessage(null)
        setSaveErrorMessage(null)
        setProgressRows((currentRows) => {
            const nextRows = currentRows.filter((row) => row.id !== rowId)

            if (nextRows.length > 0) {
                return nextRows
            }

            return [createEmptyProgressRow(nextProgressRowNumber)]
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
                                            label='Recommendation Challenge (For Others)'
                                            htmlFor='recommendation-challenge'
                                        >
                                            <Input
                                                id='recommendation-challenge'
                                                name='recommendationChallenge'
                                                placeholder='Enter a book title'
                                                value={recommendationTitle}
                                                onChange={(event) => {
                                                    const nextValue =
                                                        event.target.value

                                                    setRecommendationTitle(
                                                        nextValue
                                                    )
                                                    updateProgressRows(
                                                        (rows) => rows,
                                                        nextValue
                                                    )
                                                }}
                                            />
                                        </FormField>

                                        <FormField
                                            label='Epic Read Challenge (For Myself)'
                                            htmlFor='epic-read'
                                        >
                                            <Input
                                                id='epic-read'
                                                name='epicRead'
                                                placeholder='Enter a book title'
                                                value={epicReadTitle}
                                                onChange={(event) =>
                                                    setEpicReadTitle(
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </FormField>
                                    </div>

                                    <div className='flex justify-end'>
                                        <Button
                                            type='button'
                                            disabled={!campaignParticipantId}
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

                                    {saveFeedbackMessage ? (
                                        <p className='type-muted text-sm'>
                                            {saveFeedbackMessage}
                                        </p>
                                    ) : null}

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
                                    className='hidden gap-3 border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_minmax(5rem,0.4fr)]'
                                    role='row'
                                >
                                    <div role='columnheader'>
                                        Challenge name
                                    </div>
                                    <div role='columnheader'>Points</div>
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
                                                className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-card/60 p-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(7rem,0.5fr)_minmax(5rem,0.4fr)] lg:items-center'
                                                role='row'
                                            >
                                                <div role='cell'>
                                                    <p className='font-medium text-foreground'>
                                                        {challenge.title}
                                                    </p>
                                                </div>

                                                <div role='cell'>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {challenge.pointsLabel}
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
                                <table className='min-w-[68rem] w-full border-collapse table-fixed'>
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
                                                    recommendationTitle,
                                                    rowId: row.id,
                                                })

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
                                                                                          bookName:
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
                                                                campaignChallenges.length ===
                                                                0
                                                            }
                                                            value={
                                                                row.challengeId
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
                                                            <option value=''>
                                                                {campaignChallenges.length >
                                                                0
                                                                    ? 'Select challenge'
                                                                    : 'No challenges available'}
                                                            </option>

                                                            {availableChallenges.map(
                                                                (challenge) => (
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
                                                        </select>
                                                    </td>

                                                    <td className='px-3 py-3 align-top text-right'>
                                                        <span className='block pt-2 text-sm font-medium text-muted-foreground'>
                                                            {formatProgressPoints(
                                                                calculateProgressRowPoints(
                                                                    {
                                                                        campaignChallenges,
                                                                        row,
                                                                        pointsPerMinute:
                                                                            progressScoring.pointsPerMinute,
                                                                        pointsPerPage:
                                                                            progressScoring.pointsPerPage,
                                                                    }
                                                                )
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className='px-3 py-3 align-top text-right'>
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
                                    disabled={!campaignParticipantId}
                                    onClick={() => persistWorkspace('progress')}
                                >
                                    {isPending &&
                                    pendingSaveTarget === 'progress'
                                        ? 'Saving...'
                                        : 'Save Changes'}
                                </Button>
                            </div>

                            {saveFeedbackMessage ? (
                                <p className='type-muted mt-3 text-sm'>
                                    {saveFeedbackMessage}
                                </p>
                            ) : null}

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
    recommendationTitle: string
) {
    const usedChallengeIds = new Set<string>()

    const sanitizedRows = rows.map((row) => {
        if (!row.challengeId) {
            return row
        }

        const selectedChallenge = campaignChallenges.find(
            (challenge) => challenge.id === row.challengeId
        )
        const isOwnRecommendationBook =
            normalizeText(row.bookName).length > 0 &&
            normalizeText(row.bookName) === normalizeText(recommendationTitle)

        if (
            !selectedChallenge ||
            usedChallengeIds.has(row.challengeId) ||
            (isOwnRecommendationBook &&
                isRecommendationChallengeTitle(selectedChallenge.title))
        ) {
            return {
                ...row,
                challengeId: '',
            }
        }

        usedChallengeIds.add(row.challengeId)

        return row
    })

    return sanitizedRows
}

function normalizeText(value: string) {
    return value.trim().toLowerCase()
}

function isRecommendationChallengeTitle(title: string) {
    return title.toLowerCase().includes('recommend')
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
    const selectedChallenge = campaignChallenges.find(
        (challenge) => challenge.id === row.challengeId
    )
    const challengePoints =
        row.completed && selectedChallenge ? selectedChallenge.pointValue : 0

    return pages * pointsPerPage + minutes * pointsPerMinute + challengePoints
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
