import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'

export type ChallengeFormDefaults = {
    pageMinuteMultiplier: string
    pointValue: string
    title: string
}

export function getChallengeFormDefaults(
    challenge?: {
        pageMinuteMultiplier?: { toString(): string }
        pointValue: { toString(): string }
        title: string
    } | null
): ChallengeFormDefaults {
    if (!challenge) {
        return {
            pageMinuteMultiplier: '',
            pointValue: '',
            title: '',
        }
    }

    return {
        pageMinuteMultiplier:
            (challenge.pageMinuteMultiplier?.toString() ?? '0') === '0'
                ? ''
                : (challenge.pageMinuteMultiplier?.toString() ?? '0'),
        pointValue:
            challenge.pointValue.toString() === '0'
                ? ''
                : challenge.pointValue.toString(),
        title: challenge.title,
    }
}

export function ChallengePolicyPanel({
    defaults,
}: {
    defaults: Pick<ChallengeFormDefaults, 'pageMinuteMultiplier' | 'pointValue'>
}) {
    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Scoring</CardTitle>
            </CardHeader>

            <div className='px-6 pb-6'>
                <div className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3 sm:grid-cols-2'>
                    <div>
                        <p className='text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
                            Points
                        </p>
                        <strong>{defaults.pointValue || '0'}</strong>
                    </div>

                    <div>
                        <p className='text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
                            Multiplier
                        </p>
                        <strong>{defaults.pageMinuteMultiplier || '0'}</strong>
                    </div>
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
                    label='Point value'
                    htmlFor={`${challengeId ?? 'new'}-pointValue`}
                    hint='Use 0 when this challenge should score through the multiplier instead.'
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

                <FormField
                    label='Pages or minutes multiplier'
                    htmlFor={`${challengeId ?? 'new'}-pageMinuteMultiplier`}
                    hint='Use 0 when this challenge should award a fixed point value instead.'
                >
                    <Input
                        id={`${challengeId ?? 'new'}-pageMinuteMultiplier`}
                        name='pageMinuteMultiplier'
                        type='number'
                        min='0'
                        step='0.01'
                        defaultValue={defaultValues.pageMinuteMultiplier}
                        placeholder='1.5'
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
