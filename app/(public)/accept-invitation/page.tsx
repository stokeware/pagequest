import {
    Button,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import { PublicShell } from '@/components/public/public-shell'

export default function AcceptInvitationPage() {
    return (
        <PublicShell
            eyebrow='Invitation access'
            title='Accept a quest invitation and join the season.'
            description='This route is where secure invite tokens, expiration rules, and account linking will connect in the onboarding phase.'
        >
            <FormCard
                title='Accept invitation'
                description='The final onboarding flow will validate tokens, link accounts, and create quest participation from this form.'
            >
                <FormField
                    label='Invitation code'
                    htmlFor='invite-token'
                    hint='Paste the secure token from your invitation email.'
                >
                    <Input
                        id='invite-token'
                        placeholder='Paste your invitation token'
                        autoComplete='off'
                    />
                </FormField>

                <FormField
                    label='Display name'
                    htmlFor='display-name'
                    hint='This is the name shown on the leaderboard and participant detail pages.'
                >
                    <Input
                        id='display-name'
                        placeholder='Choose the name shown on the leaderboard'
                        autoComplete='nickname'
                    />
                </FormField>

                <FormActions note='The route is in place for local email links, expiry checks, and participant creation.'>
                    <Button disabled>
                        Token validation arrives in Phase 4
                    </Button>
                </FormActions>
            </FormCard>
        </PublicShell>
    )
}
