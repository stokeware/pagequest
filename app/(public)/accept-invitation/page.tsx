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
    normalizeInvitationEmail,
    normalizeInvitationToken,
} from '@/lib/invitation-admin'
import { buildPasswordSignInPath } from '@/lib/auth/sign-in-path'
import { passwordPolicy } from '@/lib/auth/password'
import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'
import { getRoleAwareSession } from '@/lib/auth/session'
import { getInvitationAccessProfile } from '@/lib/invitation-access'
import { prisma } from '@/lib/prisma'

import {
    acceptInvitationAction,
    createInvitationAccountAction,
} from './actions'

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

function getInvitationSignInPath({
    token,
    email,
}: {
    token: string
    email?: string | null
}) {
    return buildPasswordSignInPath({
        callbackUrl: buildInvitationAcceptPath(token),
        email,
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
                    'The invitation stayed unchanged because the acceptance step failed. Reload the invitation and try again. If it keeps failing, ask an administrator to confirm it is still active.',
                title: 'Invitation acceptance failed.',
            }
        case 'invalid-token':
            return {
                description:
                    'This invitation token is not valid. Reopen the original invitation email or ask an administrator for a new invite.',
                title: 'Invitation link is not valid.',
            }
        case 'account-exists':
            return {
                description:
                    'A password-backed Page Quest account already exists for this invited email. Sign in with that account to finish accepting the invitation.',
                title: 'Account already exists.',
            }
        case 'expired':
            return {
                description:
                    'This invitation has expired. Ask an administrator to send a fresh invite before continuing.',
                title: 'Invitation expired.',
            }
        case 'invitation-unavailable':
            return {
                description:
                    'This invitation can no longer be accepted in its current state. Review the details below and request a fresh invite if needed.',
                title: 'This invitation is no longer ready to accept.',
            }
        case 'invalid-password':
            return {
                description: `Choose a password between ${passwordPolicy.minLength} and ${passwordPolicy.maxLength} characters, then try again.`,
                title: 'Password requirements not met.',
            }
        case 'missing-name':
            return {
                description:
                    'Enter your name before creating the invited account.',
                title: 'Name is required.',
            }
        case 'password-mismatch':
            return {
                description:
                    'The password and confirmation must match before Page Quest can create the account.',
                title: 'Passwords do not match.',
            }
        case 'rate-limit-exceeded':
            return {
                description:
                    'Too many acceptance attempts were made in a short window. Wait a few minutes, then try this invitation again.',
                title: 'Invitation attempts temporarily limited.',
            }
        case 'signup-failed':
            return {
                description:
                    'Page Quest could not create the invited account. Reload the invitation and try again. If it keeps failing, ask an administrator to confirm it is still active.',
                title: 'Account creation failed.',
            }
        case 'signup-rate-limit-exceeded':
            return {
                description:
                    'Too many account creation attempts were made in a short window. Wait a few minutes, then try this invitation again.',
                title: 'Account creation temporarily limited.',
            }
        case 'missing-token':
            return {
                description:
                    'Open the full invitation email again so Page Quest can verify the token before accepting the campaign.',
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

export function InvitationExistingAccountCard({
    access,
    token,
}: {
    access: ReturnType<typeof deriveInvitationAcceptanceProfile>
    token: string
}) {
    return (
        <FormCard
            title='This invited email already has a Page Quest account.'
            description={
                access.state === 'wrong-account'
                    ? access.summary
                    : 'Sign in with the invited email to finish accepting this invitation.'
            }
        >
            <FormField
                label='Invited email'
                htmlFor='existing-account-email'
                hint='Sign in with this email to finish accepting the invitation.'
            >
                <Input
                    id='existing-account-email'
                    value={access.expectedEmail ?? ''}
                    readOnly
                />
            </FormField>

            {access.campaignName ? (
                <FormField
                    label='Campaign'
                    htmlFor='existing-account-campaign'
                    hint='After sign-in, Page Quest will return you to this invite so acceptance can be finalized.'
                >
                    <Input
                        id='existing-account-campaign'
                        value={access.campaignName}
                        readOnly
                    />
                </FormField>
            ) : null}

            <FormActions note='Use the invited email to continue. Page Quest will return you to this invitation after sign-in.'>
                <Button
                    render={
                        <Link
                            href={getInvitationSignInPath({
                                email: access.expectedEmail,
                                token,
                            })}
                        />
                    }
                >
                    Continue to sign in
                </Button>
            </FormActions>
        </FormCard>
    )
}

export function InvitationSignupCard({
    access,
    token,
}: {
    access: ReturnType<typeof deriveInvitationAcceptanceProfile>
    token: string
}) {
    return (
        <FormCard
            title='Create your Page Quest account.'
            description={access.summary}
        >
            <form
                action={createInvitationAccountAction}
                className='ui-form-shell'
            >
                <input type='hidden' name='token' value={token} />

                <FormField
                    label='Invited email'
                    htmlFor='secure-invite-email'
                    hint='This invitation stays reserved for this email while you set a password.'
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
                        hint='The new account will join this campaign immediately.'
                    >
                        <Input
                            id='secure-invite-campaign'
                            value={access.campaignName}
                            readOnly
                        />
                    </FormField>
                ) : null}

                <FormField
                    label='Name'
                    htmlFor='secure-invite-name'
                    hint='This name appears throughout your Page Quest account.'
                >
                    <Input id='secure-invite-name' name='name' required />
                </FormField>

                <FormField
                    label='Password'
                    htmlFor='secure-invite-password'
                    hint={`Use between ${passwordPolicy.minLength} and ${passwordPolicy.maxLength} characters.`}
                >
                    <Input
                        id='secure-invite-password'
                        name='password'
                        type='password'
                        autoComplete='new-password'
                        required
                    />
                </FormField>

                <FormField
                    label='Confirm password'
                    htmlFor='secure-invite-password-confirmation'
                >
                    <Input
                        id='secure-invite-password-confirmation'
                        name='passwordConfirmation'
                        type='password'
                        autoComplete='new-password'
                        required
                    />
                </FormField>

                <FormActions note='Page Quest will create the account, accept the invitation, then send you to sign in.'>
                    <Button nativeButton type='submit'>
                        Create account
                    </Button>
                </FormActions>
            </form>
        </FormCard>
    )
}

export function InvitationTokenCard({
    access,
    hasExistingPasswordAccount,
    token,
}: {
    access: ReturnType<typeof deriveInvitationAcceptanceProfile>
    hasExistingPasswordAccount: boolean
    token: string
}) {
    if (access.state === 'invalid') {
        return (
            <EmptyState
                eyebrow='Invitation'
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

    if (access.state === 'expired') {
        return (
            <EmptyState
                eyebrow='Invitation'
                title='This invite link expired.'
                description={access.summary}
            />
        )
    }

    if (access.state === 'accepted') {
        return (
            <EmptyState
                eyebrow='Invitation'
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
                eyebrow='Invitation'
                title='This invite link was revoked.'
                description={access.summary}
            />
        )
    }

    if (access.state === 'sign-in-required') {
        return hasExistingPasswordAccount ? (
            <InvitationExistingAccountCard access={access} token={token} />
        ) : (
            <InvitationSignupCard access={access} token={token} />
        )
    }

    if (access.state === 'wrong-account') {
        return hasExistingPasswordAccount ? (
            <InvitationExistingAccountCard access={access} token={token} />
        ) : (
            <InvitationSignupCard access={access} token={token} />
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
                    hint='Accepting this invitation adds your account to this campaign.'
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

export function InvitationAccessCard({
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
                    hint='This invitation is recognized for the signed-in account and can be completed from the invitation email.'
                >
                    <Input
                        id='invite-campaign'
                        value={access.campaignName}
                        readOnly
                    />
                </FormField>
            ) : null}

            <FormActions note='Invitation access is active. Use the invitation email to finish setting up your Page Quest account.'>
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
    const invitation = token
        ? await prisma.invitation.findUnique({
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
          })
        : null
    const tokenAcceptance = token
        ? deriveInvitationAcceptanceProfile({
              invitation,
              now: new Date(),
              viewer: {
                  userEmail: viewer.userEmail,
                  userId: viewer.userId,
              },
          })
        : null
    const hasExistingPasswordAccount = invitation?.email
        ? Boolean(
              (
                  await prisma.user.findUnique({
                      select: {
                          passwordHash: true,
                      },
                      where: {
                          email: normalizeInvitationEmail(invitation.email),
                      },
                  })
              )?.passwordHash?.trim()
          )
        : false

    return (
        <PublicShell headerVariant='brand-only' contentVariant='compact'>
            <h1 className='sr-only'>Accept invitation</h1>
            {mutationNotice ? (
                <ErrorState
                    eyebrow='Invitation update'
                    title={mutationNotice.title}
                    description={mutationNotice.description}
                />
            ) : null}
            {token && tokenAcceptance ? (
                <InvitationTokenCard
                    access={tokenAcceptance}
                    hasExistingPasswordAccount={hasExistingPasswordAccount}
                    token={token}
                />
            ) : (
                <InvitationAccessCard access={invitationAccess} />
            )}
        </PublicShell>
    )
}
