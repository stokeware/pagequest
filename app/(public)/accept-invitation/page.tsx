import Link from 'next/link'

import {
    Button,
    EmptyState,
    FormActions,
    FormCard,
    FormField,
    Input,
} from '@/components/ui'
import { PublicShell } from '@/components/public/public-shell'
import { getRoleAwareSession } from '@/lib/auth/session'
import { getInvitationAccessProfile } from '@/lib/invitation-access'

function InvitationAccessCard({
    access,
}: {
    access: Awaited<ReturnType<typeof getInvitationAccessProfile>>
}) {
    if (access.state === 'signed-out') {
        return (
            <EmptyState
                eyebrow='Invitation access'
                title='Sign in to check your invitation.'
                description={access.summary}
                action={
                    <Button
                        render={
                            <Link href={access.redirectPath ?? '/sign-in'} />
                        }
                    >
                        Sign in
                    </Button>
                }
            />
        )
    }

    if (access.state === 'accepted') {
        return (
            <EmptyState
                eyebrow='Invitation access'
                title='This account is already part of the quest.'
                description={access.summary}
                action={
                    <Button render={<Link href='/dashboard' />}>
                        Open dashboard
                    </Button>
                }
            />
        )
    }

    if (access.state === 'missing') {
        return (
            <EmptyState
                eyebrow='Invitation access'
                title='No invitation found for this account.'
                description={access.summary}
                action={
                    <Button variant='outline' render={<Link href='/' />}>
                        Return home
                    </Button>
                }
            />
        )
    }

    const titleByState = {
        expired: 'Your invitation needs a resend.',
        pending: 'Your invitation is ready to accept.',
        revoked: 'This invitation is no longer active.',
    }

    return (
        <FormCard
            title={titleByState[access.state]}
            description={access.summary}
        >
            <FormField
                label='Invited email'
                htmlFor='invite-email'
                hint='The current sign-in must match the invitation email before the quest can be joined.'
            >
                <Input
                    id='invite-email'
                    value={access.invitationEmail ?? ''}
                    readOnly
                />
            </FormField>

            <FormField
                label='Quest'
                htmlFor='invite-quest'
                hint='Later phases will attach token validation and account linking to this recognized invitation context.'
            >
                <Input
                    id='invite-quest'
                    value={access.questName ?? ''}
                    readOnly
                />
            </FormField>

            <FormActions note='The prerequisite check is active now; the final token acceptance workflow arrives in Phase 4.'>
                <Button disabled>
                    {access.state === 'pending'
                        ? 'Invitation acceptance arrives in Phase 4'
                        : 'Ask an administrator for a fresh invite'}
                </Button>
            </FormActions>
        </FormCard>
    )
}

export default async function AcceptInvitationPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const invitationAccess = await getInvitationAccessProfile({
        userEmail: viewer.userEmail,
        userId: viewer.userId,
    })

    return (
        <PublicShell
            eyebrow='Invitation access'
            title='Accept a quest invitation and join the season.'
            description='This route now checks whether the signed-in account is invited before the private competitor experience unlocks.'
        >
            <InvitationAccessCard access={invitationAccess} />
        </PublicShell>
    )
}
