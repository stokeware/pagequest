import type { ChallengeAvailability } from '@prisma/client'

import {
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import {
    describeChallengeReviewRequirement,
    getChallengeAvailabilityLabel,
    getChallengeReviewLabel,
} from '@/lib/challenge-admin'

export type ChallengeFormDefaults = {
    availability: ChallengeAvailability
    category: string
    description: string
    evidencePrompt: string
    pointValue: string
    requiresReview: boolean
    title: string
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

const checkboxClassName =
    'size-4 rounded border border-input accent-[color:var(--spicy-paprika)]'

export function getChallengeFormDefaults(
    challenge?: {
        availability: ChallengeAvailability
        category: string | null
        description: string | null
        evidencePrompt: string | null
        pointValue: { toString(): string } | null
        requiresReview: boolean
        title: string
    } | null
): ChallengeFormDefaults {
    if (!challenge) {
        return {
            availability: 'ONE_TIME',
            category: '',
            description: '',
            evidencePrompt: '',
            pointValue: '',
            requiresReview: false,
            title: '',
        }
    }

    return {
        availability: challenge.availability,
        category: challenge.category ?? '',
        description: challenge.description ?? '',
        evidencePrompt: challenge.evidencePrompt ?? '',
        pointValue: challenge.pointValue?.toString() ?? '',
        requiresReview: challenge.requiresReview,
        title: challenge.title,
    }
}

export function ChallengePolicyPanel({
    defaults,
}: {
    defaults: Pick<
        ChallengeFormDefaults,
        'availability' | 'pointValue' | 'requiresReview'
    >
}) {
    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Catalog rules</CardTitle>
                <CardDescription>
                    Challenge entries store repeatability, point behavior, and
                    moderation expectations before they are attached to
                    campaigns.
                </CardDescription>
            </CardHeader>

            <div className='grid gap-3 px-6 pb-6 md:grid-cols-3'>
                <div className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'>
                    <p className='type-muted text-xs'>Availability</p>
                    <strong>
                        {getChallengeAvailabilityLabel(defaults.availability)}
                    </strong>
                    <p className='type-muted text-xs'>
                        One-time challenges credit once per participant.
                        Repeatable challenges can be logged more than once.
                    </p>
                </div>

                <div className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'>
                    <p className='type-muted text-xs'>Point rule</p>
                    <strong>
                        {defaults.pointValue
                            ? `${defaults.pointValue} points`
                            : 'Campaign default'}
                    </strong>
                    <p className='type-muted text-xs'>
                        Leave point value blank when the campaign-wide challenge
                        scoring rule should apply.
                    </p>
                </div>

                <div className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'>
                    <p className='type-muted text-xs'>Review flow</p>
                    <strong>
                        {getChallengeReviewLabel(defaults.requiresReview)}
                    </strong>
                    <p className='type-muted text-xs'>
                        {describeChallengeReviewRequirement(
                            defaults.requiresReview
                        )}
                    </p>
                </div>
            </div>
        </Card>
    )
}

export function ChallengeForm({
    action,
    defaultValues,
    challengeId,
    note,
    submitLabel,
    title,
}: {
    action: (formData: FormData) => Promise<void>
    defaultValues: ChallengeFormDefaults
    challengeId?: string
    note: string
    submitLabel: string
    title: string
}) {
    return (
        <FormCard
            title={title}
            description='Build the reusable challenge catalog here before assigning entries to specific campaigns.'
        >
            <form action={action} className='ui-form-shell'>
                {challengeId ? (
                    <input
                        type='hidden'
                        name='challengeId'
                        value={challengeId}
                    />
                ) : null}

                <FormField
                    label='Challenge title'
                    htmlFor={`${challengeId ?? 'new'}-title`}
                    hint='Use a name that is short enough for tables but clear enough for participants.'
                >
                    <Input
                        id={`${challengeId ?? 'new'}-title`}
                        name='title'
                        defaultValue={defaultValues.title}
                        placeholder='Biography bonus'
                    />
                </FormField>

                <FormField
                    label='Description'
                    htmlFor={`${challengeId ?? 'new'}-description`}
                    hint='Optional admin-facing copy that can later surface in participant instructions.'
                >
                    <textarea
                        id={`${challengeId ?? 'new'}-description`}
                        name='description'
                        defaultValue={defaultValues.description}
                        className={textareaClassName}
                        placeholder='Read a biography or memoir during this campaign.'
                    />
                </FormField>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FormField
                        label='Category'
                        htmlFor={`${challengeId ?? 'new'}-category`}
                        hint='Optional grouping for themed campaigns, badges, or future filters.'
                    >
                        <Input
                            id={`${challengeId ?? 'new'}-category`}
                            name='category'
                            defaultValue={defaultValues.category}
                            placeholder='Genre prompt'
                        />
                    </FormField>

                    <FormField
                        label='Point value'
                        htmlFor={`${challengeId ?? 'new'}-pointValue`}
                        hint='Leave blank to use the campaign-wide challenge scoring rule.'
                    >
                        <Input
                            id={`${challengeId ?? 'new'}-pointValue`}
                            name='pointValue'
                            type='number'
                            min='0'
                            step='0.01'
                            defaultValue={defaultValues.pointValue}
                            placeholder='15'
                        />
                    </FormField>
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FormField
                        label='Repeatability'
                        htmlFor={`${challengeId ?? 'new'}-availability`}
                        hint='This controls whether one participant can claim the same challenge multiple times.'
                    >
                        <select
                            id={`${challengeId ?? 'new'}-availability`}
                            name='availability'
                            className={selectClassName}
                            defaultValue={defaultValues.availability}
                        >
                            <option value='ONE_TIME'>One-time</option>
                            <option value='REPEATABLE'>Repeatable</option>
                        </select>
                    </FormField>

                    <FormField
                        label='Review requirement'
                        htmlFor={`${challengeId ?? 'new'}-requiresReview`}
                        hint='Enable this when evidence needs a moderator decision before points should count.'
                    >
                        <label
                            htmlFor={`${challengeId ?? 'new'}-requiresReview`}
                            className='flex min-h-10 items-center gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2'
                        >
                            <input
                                id={`${challengeId ?? 'new'}-requiresReview`}
                                name='requiresReview'
                                type='checkbox'
                                value='true'
                                defaultChecked={defaultValues.requiresReview}
                                className={checkboxClassName}
                            />
                            <span className='text-sm'>
                                Require admin approval before crediting the
                                completion.
                            </span>
                        </label>
                    </FormField>
                </div>

                <FormField
                    label='Evidence prompt'
                    htmlFor={`${challengeId ?? 'new'}-evidencePrompt`}
                    hint='Optional guidance for what a participant should submit when completing the challenge.'
                >
                    <textarea
                        id={`${challengeId ?? 'new'}-evidencePrompt`}
                        name='evidencePrompt'
                        defaultValue={defaultValues.evidencePrompt}
                        className={textareaClassName}
                        placeholder='Share the title and a note about how the book matched the prompt.'
                    />
                </FormField>

                <FormActions note={note}>
                    <Button nativeButton type='submit'>
                        {submitLabel}
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}
