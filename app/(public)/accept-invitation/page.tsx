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
import {
    buildInvitationAcceptPath,
    hashInvitationToken,
} from '@/lib/invitation-admin'
import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'
import { getRoleAwareSession } from '@/lib/auth/session'
import { getInvitationAccessProfile } from '@/lib/invitation-access'
import { prisma } from '@/lib/prisma'

import { acceptInvitationAction } from './actions'

type AcceptInvitationPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function getTokenAwareSignInPath(token: string) {
    return `/sign-in?callbackUrl=${encodeURIComponent(
        buildInvitationAcceptPath(token)
    )}`
}

function InvitationTokenCard({
    access,
    token,
}: {
    access: ReturnType<typeof deriveInvitationAcceptanceProfile>
    token: string
}) {
    if (access.state === 'invalid') {
        return (
            <EmptyState
                eyebrow='Secure invite link'
                title='This invite link is not valid.'
                description={access.summary}
                action={
                    <Button variant='outline' render={<Link href='/' />}>
                        Return home
                    </Button>
                }
            />
        )
    }

    if (access.state === 'accepted') {
        return (
            <EmptyState
                eyebrow='Secure invite link'
                title='This invite link has already been used.'
                description={access.summary}
                action={
                    <Button render={<Link href='/dashboard' />}>
                        Open dashboard
                    </Button>
                }
            />
        )
    }

    if (access.state === 'revoked' || access.state === 'expired') {
        return (
            <EmptyState
                eyebrow='Secure invite link'
                title={
                    access.state === 'revoked'
                        ? 'This invite link was revoked.'
                        : 'This invite link expired.'
                }
                description={access.summary}
            />
        )
    }

    if (access.state === 'sign-in-required') {
        return (
            <FormCard
                title='Sign in to continue with this invitation.'
                description={access.summary}
            >
                <FormField
                    label='Invited email'
                    htmlFor='secure-invite-email'
                    hint='Use the invited account when you authenticate, otherwise the accept action will stay locked.'
                >
                    <Input
                        id='secure-invite-email'
                        value={access.expectedEmail ?? ''}
                        readOnly
                    />
                </FormField>

                <FormActions note='After sign-in, this same secure link will return here so you can finish accepting the invitation.'>
                    <Button
                        render={<Link href={getTokenAwareSignInPath(token)} />}
                    >
                        Sign in
                    </Button>
                </FormActions>
            </FormCard>
        )
    }

    if (access.state === 'wrong-account') {
        return (
            <FormCard
                title='This link belongs to a different account.'
                description={access.summary}
            >
                <FormField
                    label='Invited email'
                    htmlFor='wrong-account-email'
                    hint='Switch to the invited account, then reopen this secure link to accept the quest.'
                >
                    <Input
                        id='wrong-account-email'
                        value={access.expectedEmail ?? ''}
                        readOnly
                    />
                </FormField>

                <FormActions note='The invite stays valid, but only the invited account can accept it.'>
                    <Button
                        variant='outline'
                        render={<Link href={getTokenAwareSignInPath(token)} />}
                    >
                        Use a different account
                    </Button>
                </FormActions>
            </FormCard>
        )
    }

    return (
        <FormCard
            title='Secure invite link recognized.'
            description={access.summary}
        >
            <FormField
                label='Invited email'
                htmlFor='secure-invite-email'
                hint='The sign-in account must match this email before the invitation can be accepted.'
            >
                <Input
                    id='secure-invite-email'
                    value={access.invitationEmail ?? ''}
                    readOnly
                />
            </FormField>

            <FormField
                label='Quest'
                htmlFor='secure-invite-quest'
                hint='This secure link is already validated. Accepting it will link the invited account to the quest.'
            >
                <Input
                    id='secure-invite-quest'
                    value={access.questName ?? ''}
                    readOnly
                />
            </FormField>

            <form action={acceptInvitationAction} className='ui-form-shell'>
                <input type='hidden' name='token' value={token} />
                <FormActions note='Accepting this invitation links the signed-in account to the quest and creates the participant record.'>
                    <Button nativeButton type='submit'>
                        Accept invitation
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

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
                hint='This invitation is recognized for the signed-in account and can be completed through the secure link in the email.'
            >
                <Input
                    id='invite-quest'
                    value={access.questName ?? ''}
                    readOnly
                />
            </FormField>

            <FormActions note='Invitation access is active. Use the secure link from the invitation email to complete acceptance and join the quest.'>
                <Button disabled>
                    {access.state === 'pending'
                        ? 'Check your invitation email'
                        : 'Ask an administrator for a fresh invite'}
                </Button>
            </FormActions>
        </FormCard>
    )
}

export default async function AcceptInvitationPage({
    searchParams,
}: AcceptInvitationPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const token = getFirstSearchParamValue(resolvedSearchParams.token)
    const viewer = await getRoleAwareSession('COMPETITOR')
    const invitationAccess = await getInvitationAccessProfile({
        userEmail: viewer.userEmail,
        userId: viewer.userId,
    })
    const tokenAcceptance = token
        ? deriveInvitationAcceptanceProfile({
              invitation: await prisma.invitation.findUnique({
                  select: {
                      acceptedByUserId: true,
                      email: true,
                      expiresAt: true,
                      quest: {
                          select: {
                              name: true,
                              status: true,
                              visibility: true,
                          },
                      },
                      revokedAt: true,
                      status: true,
                  },
                  where: {
                      tokenHash: hashInvitationToken(token),
                  },
              }),
              now: new Date(),
              viewer: {
                  userEmail: viewer.userEmail,
                  userId: viewer.userId,
              },
          })
        : null

    return (
        <PublicShell
            eyebrow='Invitation access'
            title='Accept a quest invitation and join the season.'
            description='This route now validates secure invite links, links the invited account, and unlocks the competitor experience after acceptance.'
        >
            {token && tokenAcceptance ? (
                <InvitationTokenCard access={tokenAcceptance} token={token} />
            ) : null}
            <InvitationAccessCard access={invitationAccess} />
        </PublicShell>
    )
}
