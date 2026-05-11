import Link from 'next/link'

import {
    Button,
    ErrorState,
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
    normalizeInvitationToken,
} from '@/lib/invitation-admin'
import { buildHostedAuthPath } from '@/lib/auth/hosted-sign-in'
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

function getTokenAwareAuthPath({
    token,
    email,
}: {
    token: string
    email?: string | null
}) {
    return buildHostedAuthPath({
        callbackUrl: buildInvitationAcceptPath(token),
        flow: 'signup',
        loginHint: email,
    })
}

function getInvitationMutationNotice(
    outcome: string | null,
    detail: string | null
): {
    description: string
    title: string
} | null {
    if (outcome !== 'error') {
        return null
    }

    switch (detail) {
        case 'acceptance-failed':
            return {
                description:
                    'The invitation stayed unchanged because the acceptance step failed. Reload the secure link and try again. If it keeps failing, ask an administrator to confirm the invitation is still active.',
                title: 'Invitation acceptance failed.',
            }
        case 'invalid-token':
            return {
                description:
                    'This invitation token does not match the secure format issued by Page Quest. Reopen the original invitation link or ask an administrator for a new one.',
                title: 'Invitation link is not valid.',
            }
        case 'invitation-unavailable':
            return {
                description:
                    'This secure link can no longer be accepted in its current state. Review the invitation details below and request a fresh invite if needed.',
                title: 'This invitation is no longer ready to accept.',
            }
        case 'rate-limit-exceeded':
            return {
                description:
                    'Too many acceptance attempts were made in a short window. Wait a few minutes, then try this secure link again.',
                title: 'Invitation attempts temporarily limited.',
            }
        case 'missing-token':
            return {
                description:
                    'Open the full invitation link from the email again so Page Quest can verify the secure token before accepting the campaign.',
                title: 'Invitation link missing.',
            }
        default:
            return {
                description:
                    'An unexpected problem interrupted the invitation flow. Reload the page and try again.',
                title: 'Invitation update blocked.',
            }
    }
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

    if (access.state === 'revoked') {
        return (
            <EmptyState
                eyebrow='Secure invite link'
                title='This invite link was revoked.'
                description={access.summary}
            />
        )
    }

    if (access.state === 'sign-in-required') {
        return (
            <FormCard
                title='Set up your Page Quest account.'
                description={access.summary}
            >
                <FormField
                    label='Invited email'
                    htmlFor='secure-invite-email'
                    hint='This invitation stays reserved for this email while you create an account or sign in.'
                >
                    <Input
                        id='secure-invite-email'
                        value={access.expectedEmail ?? ''}
                        readOnly
                    />
                </FormField>

                <FormActions note='Continue to the hosted account setup flow. Auth0 can create a password for this email and then return you to the secure invitation.'>
                    <Button
                        render={
                            <Link
                                href={getTokenAwareAuthPath({
                                    email: access.expectedEmail,
                                    token,
                                })}
                            />
                        }
                    >
                        Create account or sign in
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
                    hint='Switch to the invited email, or create that account first, then reopen this secure link.'
                >
                    <Input
                        id='wrong-account-email'
                        value={access.expectedEmail ?? ''}
                        readOnly
                    />
                </FormField>

                <FormActions note='The invite stays valid, but only the invited email can finish setup. The next screen can sign in or create that account.'>
                    <Button
                        variant='outline'
                        render={
                            <Link
                                href={getTokenAwareAuthPath({
                                    email: access.expectedEmail,
                                    token,
                                })}
                            />
                        }
                    >
                        Continue with invited email
                    </Button>
                </FormActions>
            </FormCard>
        )
    }

    return (
        <FormCard title='Welcome to Page Quest.' description={access.summary}>
            <FormField
                label='Invited email'
                htmlFor='secure-invite-email'
                hint='The authenticated account must match this email before membership can be finalized.'
            >
                <Input
                    id='secure-invite-email'
                    value={access.expectedEmail ?? ''}
                    readOnly
                />
            </FormField>

            {access.campaignName ? (
                <FormField
                    label='Campaign'
                    htmlFor='secure-invite-campaign'
                    hint='This legacy invite still links the invited account to this campaign.'
                >
                    <Input
                        id='secure-invite-campaign'
                        value={access.campaignName}
                        readOnly
                    />
                </FormField>
            ) : null}

            <form action={acceptInvitationAction} className='ui-form-shell'>
                <input type='hidden' name='token' value={token} />
                <FormActions note='Accepting this invitation completes your Page Quest membership and unlocks current and future invite-only campaigns for this account.'>
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
                title='This account already has Page Quest member access.'
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
                hint='The current sign-in must match the invitation email before the campaign can be joined.'
            >
                <Input
                    id='invite-email'
                    value={access.invitationEmail ?? ''}
                    readOnly
                />
            </FormField>

            {access.campaignName ? (
                <FormField
                    label='Campaign'
                    htmlFor='invite-campaign'
                    hint='This legacy invitation is recognized for the signed-in account and can be completed through the secure link in the email.'
                >
                    <Input
                        id='invite-campaign'
                        value={access.campaignName}
                        readOnly
                    />
                </FormField>
            ) : null}

            <FormActions note='Invitation access is active. Use the secure link from the invitation email to complete your Page Quest account setup.'>
                <Button disabled>
                    {access.state === 'pending'
                        ? 'Check your invitation email'
                        : 'Ask an administrator for a new invite'}
                </Button>
            </FormActions>
        </FormCard>
    )
}

export default async function AcceptInvitationPage({
    searchParams,
}: AcceptInvitationPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const rawToken = getFirstSearchParamValue(resolvedSearchParams.token)
    const token = normalizeInvitationToken(rawToken)
    const mutationNotice =
        getInvitationMutationNotice(outcome, detail) ??
        (rawToken && !token
            ? getInvitationMutationNotice('error', 'invalid-token')
            : null)
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
                      campaign: {
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
            title='Welcome to Page Quest.'
            description='Use your invitation to create or connect your account, then finish acceptance to unlock Page Quest member access.'
        >
            {mutationNotice ? (
                <ErrorState
                    eyebrow='Invitation update'
                    title={mutationNotice.title}
                    description={mutationNotice.description}
                />
            ) : null}
            {token && tokenAcceptance ? (
                <InvitationTokenCard access={tokenAcceptance} token={token} />
            ) : null}
            <InvitationAccessCard access={invitationAccess} />
        </PublicShell>
    )
}
