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
    pointValue: string
    title: string
}

export function getChallengeFormDefaults(
    challenge?: {
        pointValue: { toString(): string } | null
        title: string
    } | null
): ChallengeFormDefaults {
    if (!challenge) {
        return {
            pointValue: '',
            title: '',
        }
    }

    return {
        pointValue: challenge.pointValue?.toString() ?? '',
        title: challenge.title,
    }
}

export function ChallengePolicyPanel({
    defaults,
}: {
    defaults: Pick<ChallengeFormDefaults, 'pointValue'>
}) {
    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Point rule</CardTitle>
            </CardHeader>

            <div className='px-6 pb-6'>
                <div className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'>
                    <strong>
                        {defaults.pointValue
                            ? `${defaults.pointValue} points`
                            : 'Campaign default'}
                    </strong>
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

                <FormActions note={note}>
                    <Button nativeButton type='submit'>
                        {submitLabel}
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}
