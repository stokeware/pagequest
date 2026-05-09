import type { ChallengeAvailability } from '@prisma/client'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FormActions,
    FormField,
    Input,
} from '@/components/ui'
import {
    getChallengeAvailabilityLabel,
    getChallengeReviewLabel,
} from '@/lib/challenge-admin'

const selectClassName = [
    'h-10 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

type AvailableChallenge = {
    id: string
    title: string
}

type AssignedQuestChallenge = {
    challenge: {
        availability: ChallengeAvailability
        category: string | null
        requiresReview: boolean
        title: string
    }
    challengeId: string
    id: string
    isActive: boolean
    pointValueOverride: { toString(): string } | null
    sortOrder: number
}

function formatPoints(value: { toString(): string }) {
    const numericValue = Number(value.toString())

    return Number.isInteger(numericValue)
        ? numericValue.toString()
        : numericValue.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

export function QuestChallengeAssignmentsPanel({
    action,
    availableChallenges,
    assignments,
    canEdit,
    questId,
}: {
    action: (formData: FormData) => Promise<void>
    availableChallenges: AvailableChallenge[]
    assignments: AssignedQuestChallenge[]
    canEdit: boolean
    questId: string
}) {
    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Quest challenges</CardTitle>
                <CardDescription>
                    Attach reusable catalog challenges to this quest with an
                    explicit display order and an optional point override.
                </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4'>
                {assignments.length > 0 ? (
                    <div className='grid gap-3'>
                        {assignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'
                            >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div className='stack-sm'>
                                        <strong>
                                            {assignment.sortOrder}.{' '}
                                            {assignment.challenge.title}
                                        </strong>
                                        <p className='type-muted text-xs'>
                                            Category:{' '}
                                            {assignment.challenge.category ||
                                                'Uncategorized'}
                                        </p>
                                    </div>
                                    <div className='stack-sm text-right'>
                                        <p className='type-muted text-xs'>
                                            {getChallengeAvailabilityLabel(
                                                assignment.challenge
                                                    .availability
                                            )}
                                        </p>
                                        <p className='type-muted text-xs'>
                                            {getChallengeReviewLabel(
                                                assignment.challenge
                                                    .requiresReview
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <p className='type-muted mt-3 text-xs'>
                                    Point rule:{' '}
                                    {assignment.pointValueOverride
                                        ? `${formatPoints(assignment.pointValueOverride)} points`
                                        : 'Quest default challenge points'}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className='type-muted text-sm'>
                        No catalog challenges are attached to this quest yet.
                    </p>
                )}

                {canEdit ? (
                    availableChallenges.length > 0 ? (
                        <form
                            action={action}
                            className='grid gap-4 rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/50 p-4'
                        >
                            <input
                                type='hidden'
                                name='questId'
                                value={questId}
                            />
                            <div className='stack-sm'>
                                <h3 className='text-sm font-semibold'>
                                    Add a quest challenge
                                </h3>
                                <p className='type-muted text-xs'>
                                    Pick from the reusable challenge catalog,
                                    then set the order competitors should see.
                                </p>
                            </div>

                            <FormField
                                label='Catalog challenge'
                                htmlFor={`${questId}-challengeId`}
                                hint='Only unassigned catalog entries appear here.'
                            >
                                <select
                                    id={`${questId}-challengeId`}
                                    name='challengeId'
                                    className={selectClassName}
                                    defaultValue={availableChallenges[0]?.id}
                                >
                                    {availableChallenges.map((challenge) => (
                                        <option
                                            key={challenge.id}
                                            value={challenge.id}
                                        >
                                            {challenge.title}
                                        </option>
                                    ))}
                                </select>
                            </FormField>

                            <div className='grid gap-4 md:grid-cols-2'>
                                <FormField
                                    label='Sort order'
                                    htmlFor={`${questId}-sortOrder`}
                                    hint='Lower numbers appear earlier in the quest challenge list.'
                                >
                                    <Input
                                        id={`${questId}-sortOrder`}
                                        name='sortOrder'
                                        type='number'
                                        min='0'
                                        step='1'
                                        defaultValue={assignments.length}
                                    />
                                </FormField>

                                <FormField
                                    label='Point override'
                                    htmlFor={`${questId}-pointValueOverride`}
                                    hint='Leave blank to use the quest-level challenge scoring rule.'
                                >
                                    <Input
                                        id={`${questId}-pointValueOverride`}
                                        name='pointValueOverride'
                                        type='number'
                                        min='0'
                                        step='0.01'
                                        placeholder='Use quest default'
                                    />
                                </FormField>
                            </div>

                            <FormActions note='Assignments stay on the quest record even if the catalog entry is edited later.'>
                                <Button nativeButton type='submit'>
                                    Add challenge to quest
                                </Button>
                            </FormActions>
                        </form>
                    ) : (
                        <p className='type-muted text-xs'>
                            Every current catalog challenge is already attached
                            to this quest.
                        </p>
                    )
                ) : (
                    <p className='type-muted text-xs'>
                        Archived quests keep their challenge lineup visible, but
                        assignments can no longer change from this surface.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
