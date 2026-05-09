'use client'

import { useState, useTransition } from 'react'
import type { ChallengeAvailability, ReadingEntryType } from '@prisma/client'
import { BookCheck, BookOpenText, Headphones, Sparkles } from 'lucide-react'
import {
    useForm,
    useWatch,
    type FieldError,
    type Resolver,
} from 'react-hook-form'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import {
    getLogProgressFormDefaults,
    getEntryWindowPolicyLabel,
    getReadingEntryMetadataSummary,
    getReadingMetadataFieldCopy,
    getQuestDateWindowHint,
    getQuestDateWindowLabel,
    type LogProgressQuestPolicy,
    normalizeReadingEntryMetadata,
    validateLogProgressFormValues,
    type LogProgressFormValues,
} from '@/lib/log-progress'
import { cn } from '@/lib/utils'

import { submitLogProgressAction } from './actions'

export type LogProgressChallengeOption = {
    availability: ChallengeAvailability
    description: string | null
    evidencePrompt: string | null
    id: string
    pointsLabel: string
    requiresReview: boolean
    title: string
}

export type LogProgressViewModel = {
    challengeOptions: LogProgressChallengeOption[]
    hasLiveQuest: boolean
    participantSummary: string
    questParticipantId: string | null
    questPolicy: LogProgressQuestPolicy | null
    questName: string
    scoringSummary: {
        audiobookMinutes: string
        bookCompletion: string
        challengeCompletion: string
        pagesRead: string
    }
}

type EntryTypeDefinition = {
    description: string
    icon: typeof BookOpenText
    label: string
    quantityHint: string
    quantityLabel: string
    type: ReadingEntryType
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

const entryTypeDefinitions: EntryTypeDefinition[] = [
    {
        description: 'Capture a finished title and optional book details.',
        icon: BookCheck,
        label: 'Book completion',
        quantityHint:
            'Use a whole number when you finish multiple books at once.',
        quantityLabel: 'Books finished',
        type: 'BOOK_COMPLETION',
    },
    {
        description: 'Add a quick page total from your latest reading session.',
        icon: BookOpenText,
        label: 'Pages read',
        quantityHint: 'Enter the pages you read for this session.',
        quantityLabel: 'Pages read',
        type: 'PAGES_READ',
    },
    {
        description: 'Track listening time without leaving the mobile flow.',
        icon: Headphones,
        label: 'Audiobook minutes',
        quantityHint: 'Count the minutes listened during this session.',
        quantityLabel: 'Minutes listened',
        type: 'AUDIOBOOK_MINUTES',
    },
    {
        description: 'Select a quest challenge and record the supporting note.',
        icon: Sparkles,
        label: 'Challenge completion',
        quantityHint: 'Challenge completions are logged one at a time.',
        quantityLabel: 'Completion count',
        type: 'CHALLENGE_COMPLETION',
    },
]

const challengeAvailabilityLabels: Record<ChallengeAvailability, string> = {
    ONE_TIME: 'One-time',
    REPEATABLE: 'Repeatable',
}

function getChallengeReviewLabel(requiresReview: boolean) {
    return requiresReview ? 'Manual review' : 'Auto-approved'
}

function getEntryTypeDefinition(type: ReadingEntryType) {
    return entryTypeDefinitions.find((definition) => definition.type === type)
}

function getErrorMessage(error: FieldError | undefined) {
    return typeof error?.message === 'string' ? error.message : null
}

function createLogProgressResolver(
    challengeOptions: LogProgressChallengeOption[],
    questPolicy: LogProgressQuestPolicy | null
): Resolver<LogProgressFormValues> {
    return async (values) => {
        const result = validateLogProgressFormValues(values, {
            availableChallengeIds: challengeOptions.map(
                (challenge) => challenge.id
            ),
            questPolicy,
        })

        if (result.success) {
            return {
                errors: {},
                values: result.data,
            }
        }

        const errors: Partial<Record<keyof LogProgressFormValues, FieldError>> =
            {}

        for (const issue of result.error.issues) {
            const fieldName = issue.path[0]

            if (
                typeof fieldName !== 'string' ||
                fieldName in errors ||
                !isLogProgressFieldName(fieldName)
            ) {
                continue
            }

            errors[fieldName] = {
                message: issue.message,
                type: issue.code,
            }
        }

        return {
            errors,
            values: {},
        }
    }
}

function isLogProgressFieldName(
    value: string
): value is keyof LogProgressFormValues {
    return [
        'activityDate',
        'bookAuthor',
        'bookTitle',
        'challengeId',
        'notes',
        'type',
        'value',
    ].includes(value)
}

export function LogProgressScreen({
    challengeOptions,
    hasLiveQuest,
    participantSummary,
    questParticipantId,
    questPolicy,
    questName,
    scoringSummary,
}: LogProgressViewModel) {
    const [validationMessage, setValidationMessage] = useState<string | null>(
        null
    )
    const [submissionErrorMessage, setSubmissionErrorMessage] = useState<
        string | null
    >(null)
    const [isPending, startTransition] = useTransition()

    const {
        control,
        formState: { errors },
        getValues,
        handleSubmit,
        register,
        reset,
        setValue,
    } = useForm<LogProgressFormValues>({
        defaultValues: getLogProgressFormDefaults(
            challengeOptions[0]?.id ?? ''
        ),
        resolver: createLogProgressResolver(challengeOptions, questPolicy),
    })

    const selectedType = useWatch({
        control,
        name: 'type',
    })
    const selectedChallengeId = useWatch({
        control,
        name: 'challengeId',
    })

    const quantityField = register('value', {
        onChange: () => setValidationMessage(null),
    })
    const activityDateField = register('activityDate', {
        onChange: () => setValidationMessage(null),
    })
    const bookTitleField = register('bookTitle', {
        onChange: () => setValidationMessage(null),
    })
    const bookAuthorField = register('bookAuthor', {
        onChange: () => setValidationMessage(null),
    })
    const notesField = register('notes', {
        onChange: () => setValidationMessage(null),
    })
    const challengeIdField = register('challengeId', {
        onChange: () => setValidationMessage(null),
    })

    const activeDefinition = getEntryTypeDefinition(selectedType)
    const selectedChallenge =
        challengeOptions.find(
            (challenge) => challenge.id === selectedChallengeId
        ) ??
        challengeOptions[0] ??
        null
    const questDateWindowHint = getQuestDateWindowHint(questPolicy)
    const metadataFieldCopy = getReadingMetadataFieldCopy(selectedType)

    if (!activeDefinition) {
        return null
    }

    const activityDateError = getErrorMessage(errors.activityDate)
    const bookAuthorError = getErrorMessage(errors.bookAuthor)
    const bookTitleError = getErrorMessage(errors.bookTitle)
    const challengeIdError = getErrorMessage(errors.challengeId)
    const notesError = getErrorMessage(errors.notes)
    const valueError = getErrorMessage(errors.value)
    const defaultFormValues = getLogProgressFormDefaults(
        challengeOptions[0]?.id ?? ''
    )

    const onValidSubmit = (values: LogProgressFormValues) => {
        setSubmissionErrorMessage(null)
        setValidationMessage(null)

        startTransition(async () => {
            const result = await submitLogProgressAction({
                questParticipantId,
                values,
            })

            if (result.outcome === 'error') {
                setSubmissionErrorMessage(result.message)

                return
            }

            const metadataSummary = getReadingEntryMetadataSummary(
                normalizeReadingEntryMetadata(values)
            )
            const prefix =
                values.type === 'CHALLENGE_COMPLETION'
                    ? `Challenge completion for ${selectedChallenge?.title ?? 'the selected quest challenge'} saved.`
                    : `${activeDefinition.label} for ${values.activityDate} saved${metadataSummary ? ` with ${metadataSummary}.` : '.'}`

            reset(defaultFormValues)
            setValidationMessage(`${prefix} ${result.message}`)
        })
    }

    return (
        <div className='progress-layout'>
            <FormCard
                title='Quick entry form'
                description={`Track progress for ${questName} from one focused screen.`}
            >
                <div
                    className={cn(
                        'progress-status-banner',
                        hasLiveQuest ? 'surface-muted' : 'surface-warm'
                    )}
                >
                    <p className='progress-status-label'>Quest context</p>
                    <p className='progress-status-title'>{questName}</p>
                    <p className='progress-status-copy'>{participantSummary}</p>
                </div>

                <div
                    className='progress-type-list'
                    role='tablist'
                    aria-label='Progress entry type'
                >
                    {entryTypeDefinitions.map((definition) => {
                        const Icon = definition.icon
                        const isActive = definition.type === selectedType

                        return (
                            <button
                                key={definition.type}
                                id={`entry-type-${definition.type}`}
                                type='button'
                                role='tab'
                                aria-controls={`entry-panel-${definition.type}`}
                                aria-selected={isActive}
                                className={cn(
                                    'progress-type-button',
                                    isActive && 'progress-type-button-active'
                                )}
                                onClick={() => {
                                    setValidationMessage(null)
                                    setValue('type', definition.type, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                    })

                                    if (
                                        definition.type ===
                                            'CHALLENGE_COMPLETION' &&
                                        !getValues('challengeId')
                                    ) {
                                        setValue(
                                            'challengeId',
                                            challengeOptions[0]?.id ?? '',
                                            {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            }
                                        )
                                    }

                                    if (
                                        definition.type ===
                                        'CHALLENGE_COMPLETION'
                                    ) {
                                        setValue('value', '1', {
                                            shouldDirty: true,
                                        })
                                    }

                                    if (
                                        definition.type !==
                                            'CHALLENGE_COMPLETION' &&
                                        !getValues('value')
                                    ) {
                                        setValue('value', '1', {
                                            shouldDirty: true,
                                        })
                                    }
                                }}
                            >
                                <span className='progress-type-icon'>
                                    <Icon
                                        className='size-4'
                                        aria-hidden='true'
                                    />
                                </span>
                                <span className='progress-type-copy'>
                                    <span className='progress-type-title'>
                                        {definition.label}
                                    </span>
                                    <span className='progress-type-description'>
                                        {definition.description}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div
                    id={`entry-panel-${selectedType}`}
                    role='tabpanel'
                    aria-labelledby={`entry-type-${selectedType}`}
                    className='progress-panel'
                >
                    <div className='progress-panel-copy'>
                        <p className='progress-panel-kicker'>Now logging</p>
                        <h2 className='progress-panel-title'>
                            {activeDefinition.label}
                        </h2>
                        <p className='progress-panel-description'>
                            {activeDefinition.quantityHint}
                        </p>
                    </div>

                    {validationMessage ? (
                        <div className='progress-feedback surface-muted'>
                            <p className='progress-feedback-title'>
                                Entry saved
                            </p>
                            <p className='progress-feedback-copy'>
                                {validationMessage}
                            </p>
                        </div>
                    ) : null}

                    {submissionErrorMessage ? (
                        <p className='progress-field-error'>
                            {submissionErrorMessage}
                        </p>
                    ) : null}

                    <form
                        className='ui-form-shell'
                        onSubmit={handleSubmit(onValidSubmit)}
                    >
                        {selectedType === 'CHALLENGE_COMPLETION' ? (
                            <div className='progress-field-grid'>
                                <FormField
                                    label='Challenge'
                                    htmlFor='challengeId'
                                    hint={
                                        challengeOptions.length > 0
                                            ? 'Pick the quest challenge you completed.'
                                            : 'No active challenges are attached to this quest yet.'
                                    }
                                >
                                    <select
                                        id='challengeId'
                                        className={selectClassName}
                                        aria-invalid={
                                            challengeIdError ? true : undefined
                                        }
                                        value={selectedChallenge?.id ?? ''}
                                        disabled={challengeOptions.length === 0}
                                        {...challengeIdField}
                                        onChange={(event) => {
                                            challengeIdField.onChange(event)
                                            setValidationMessage(null)
                                        }}
                                    >
                                        {challengeOptions.length === 0 ? (
                                            <option value=''>
                                                No challenge options available
                                            </option>
                                        ) : null}

                                        {challengeOptions.map((challenge) => (
                                            <option
                                                key={challenge.id}
                                                value={challenge.id}
                                            >
                                                {challenge.title}
                                            </option>
                                        ))}
                                    </select>
                                    {challengeIdError ? (
                                        <p className='progress-field-error'>
                                            {challengeIdError}
                                        </p>
                                    ) : null}
                                </FormField>

                                <FormField
                                    label='Completion date'
                                    htmlFor='activityDate'
                                    hint={`Use the date you completed the challenge. ${questDateWindowHint}`}
                                >
                                    <Input
                                        id='activityDate'
                                        type='date'
                                        aria-invalid={
                                            activityDateError ? true : undefined
                                        }
                                        min={
                                            questPolicy
                                                ? getQuestDateWindowLabel(
                                                      questPolicy
                                                  ).split(' through ')[0]
                                                : undefined
                                        }
                                        max={
                                            questPolicy
                                                ? getQuestDateWindowLabel(
                                                      questPolicy
                                                  ).split(' through ')[1]
                                                : undefined
                                        }
                                        {...activityDateField}
                                    />
                                    {activityDateError ? (
                                        <p className='progress-field-error'>
                                            {activityDateError}
                                        </p>
                                    ) : null}
                                </FormField>
                            </div>
                        ) : (
                            <div className='progress-field-grid'>
                                <FormField
                                    label={activeDefinition.quantityLabel}
                                    htmlFor='value'
                                    hint={activeDefinition.quantityHint}
                                >
                                    <Input
                                        id='value'
                                        type='number'
                                        min='1'
                                        placeholder='1'
                                        aria-invalid={
                                            valueError ? true : undefined
                                        }
                                        {...quantityField}
                                    />
                                    {valueError ? (
                                        <p className='progress-field-error'>
                                            {valueError}
                                        </p>
                                    ) : null}
                                </FormField>

                                <FormField
                                    label='Activity date'
                                    htmlFor='activityDate'
                                    hint={`Record the date for this reading session. ${questDateWindowHint}`}
                                >
                                    <Input
                                        id='activityDate'
                                        type='date'
                                        aria-invalid={
                                            activityDateError ? true : undefined
                                        }
                                        min={
                                            questPolicy
                                                ? getQuestDateWindowLabel(
                                                      questPolicy
                                                  ).split(' through ')[0]
                                                : undefined
                                        }
                                        max={
                                            questPolicy
                                                ? getQuestDateWindowLabel(
                                                      questPolicy
                                                  ).split(' through ')[1]
                                                : undefined
                                        }
                                        {...activityDateField}
                                    />
                                    {activityDateError ? (
                                        <p className='progress-field-error'>
                                            {activityDateError}
                                        </p>
                                    ) : null}
                                </FormField>
                            </div>
                        )}

                        {selectedType === 'CHALLENGE_COMPLETION' ? null : (
                            <div className='progress-field-grid'>
                                <FormField
                                    label={metadataFieldCopy.titleLabel}
                                    htmlFor='bookTitle'
                                    hint={metadataFieldCopy.titleHint}
                                >
                                    <Input
                                        id='bookTitle'
                                        placeholder={
                                            metadataFieldCopy.titlePlaceholder
                                        }
                                        aria-invalid={
                                            bookTitleError ? true : undefined
                                        }
                                        {...bookTitleField}
                                    />
                                    {bookTitleError ? (
                                        <p className='progress-field-error'>
                                            {bookTitleError}
                                        </p>
                                    ) : null}
                                </FormField>

                                <FormField
                                    label={metadataFieldCopy.authorLabel}
                                    htmlFor='bookAuthor'
                                    hint={metadataFieldCopy.authorHint}
                                >
                                    <Input
                                        id='bookAuthor'
                                        placeholder={
                                            metadataFieldCopy.authorPlaceholder
                                        }
                                        aria-invalid={
                                            bookAuthorError ? true : undefined
                                        }
                                        {...bookAuthorField}
                                    />
                                    {bookAuthorError ? (
                                        <p className='progress-field-error'>
                                            {bookAuthorError}
                                        </p>
                                    ) : null}
                                </FormField>
                            </div>
                        )}

                        <FormField
                            label={
                                selectedType === 'CHALLENGE_COMPLETION'
                                    ? 'Evidence or notes'
                                    : 'Reading notes'
                            }
                            htmlFor='notes'
                            hint={
                                selectedType === 'CHALLENGE_COMPLETION'
                                    ? (selectedChallenge?.evidencePrompt ??
                                      'Leave a short note that helps an admin review the completion when needed.')
                                    : 'Optional notes can capture context like edition, chapter, or reading sprint details.'
                            }
                        >
                            <textarea
                                id='notes'
                                className={textareaClassName}
                                placeholder={
                                    selectedType === 'CHALLENGE_COMPLETION'
                                        ? 'Finished the biography prompt with a title swap recommendation from Sam.'
                                        : 'Wrapped up three chapters during the Saturday library sprint.'
                                }
                                aria-invalid={notesError ? true : undefined}
                                {...notesField}
                            />
                            {notesError ? (
                                <p className='progress-field-error'>
                                    {notesError}
                                </p>
                            ) : null}
                        </FormField>

                        <FormActions note='React Hook Form and Zod validate each entry before the server saves it and refreshes participant totals.'>
                            <Button
                                type='submit'
                                disabled={isPending || !questParticipantId}
                            >
                                {isPending ? 'Saving entry...' : 'Save entry'}
                            </Button>
                            {selectedType === 'CHALLENGE_COMPLETION' ? null : (
                                <p className='progress-form-note'>
                                    Title and author stay optional. When you add
                                    them, future history and detail views can
                                    show richer reading context.
                                </p>
                            )}
                        </FormActions>
                    </form>
                </div>
            </FormCard>

            <div className='progress-side-stack'>
                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Entry policy</CardTitle>
                        <CardDescription>
                            Quest dates and mutation windows stay visible while
                            you log progress.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='progress-rule-list'>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>Quest dates</p>
                            <p className='progress-rule-value'>
                                {questPolicy
                                    ? getQuestDateWindowLabel(questPolicy)
                                    : 'Quest dates unavailable'}
                            </p>
                            <p className='progress-challenge-text'>
                                {questDateWindowHint}
                            </p>
                        </div>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>Edit window</p>
                            <p className='progress-challenge-text'>
                                {questPolicy
                                    ? getEntryWindowPolicyLabel({
                                          action: 'edit',
                                          windowMinutes:
                                              questPolicy.entryEditWindowMinutes,
                                      })
                                    : 'Edit rules appear when a quest is assigned.'}
                            </p>
                        </div>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>Delete window</p>
                            <p className='progress-challenge-text'>
                                {questPolicy
                                    ? getEntryWindowPolicyLabel({
                                          action: 'delete',
                                          windowMinutes:
                                              questPolicy.entryDeleteWindowMinutes,
                                      })
                                    : 'Delete rules appear when a quest is assigned.'}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Scoring at a glance</CardTitle>
                        <CardDescription>
                            Keep the active quest rules visible while you log a
                            new entry.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='progress-rule-list'>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>
                                Book completion
                            </p>
                            <p className='progress-rule-value'>
                                {scoringSummary.bookCompletion}
                            </p>
                        </div>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>Pages read</p>
                            <p className='progress-rule-value'>
                                {scoringSummary.pagesRead}
                            </p>
                        </div>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>
                                Audiobook minutes
                            </p>
                            <p className='progress-rule-value'>
                                {scoringSummary.audiobookMinutes}
                            </p>
                        </div>
                        <div className='progress-rule-item'>
                            <p className='progress-rule-label'>
                                Challenge completion
                            </p>
                            <p className='progress-rule-value'>
                                {scoringSummary.challengeCompletion}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Challenge prompts</CardTitle>
                        <CardDescription>
                            Review the quest challenge catalog before you log a
                            completion.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {challengeOptions.length === 0 ? (
                            <p className='progress-empty-note'>
                                No active challenges are attached to this quest
                                yet. Reading entries are still ready to log from
                                this screen.
                            </p>
                        ) : (
                            <div className='progress-challenge-list'>
                                {challengeOptions.map((challenge) => (
                                    <article
                                        key={challenge.id}
                                        className='progress-challenge-card'
                                    >
                                        <div className='progress-challenge-copy'>
                                            <p className='progress-challenge-title'>
                                                {challenge.title}
                                            </p>
                                            <p className='progress-challenge-text'>
                                                {challenge.description ??
                                                    'No extra description has been added yet.'}
                                            </p>
                                        </div>
                                        <div className='progress-meta-row'>
                                            <span className='progress-meta-pill'>
                                                {challenge.pointsLabel}
                                            </span>
                                            <span className='progress-meta-pill'>
                                                {
                                                    challengeAvailabilityLabels[
                                                        challenge.availability
                                                    ]
                                                }
                                            </span>
                                            <span className='progress-meta-pill'>
                                                {getChallengeReviewLabel(
                                                    challenge.requiresReview
                                                )}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
