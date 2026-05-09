import type { InvitationStatus } from '@prisma/client'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    FormActions,
    FormCard,
    FormField,
    Input,
    StatCard,
    TableCard,
} from '@/components/ui'
import {
    canResendInvitation,
    canRevokeInvitation,
    getEffectiveInvitationStatus,
} from '@/lib/invitation-admin'
import { prisma } from '@/lib/prisma'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'

import {
    createInvitationAction,
    resendInvitationAction,
    revokeInvitationAction,
} from './actions'

type InvitationsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const invitationStatusLabels: Record<InvitationStatus, string> = {
    ACCEPTED: 'Accepted',
    EXPIRED: 'Expired',
    PENDING: 'Pending',
    REVOKED: 'Revoked',
}

const selectClassName = [
    'h-10 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

const noticeContent = {
    created: {
        description:
            'The invitation is now tracked for this campaign, and a local copy was sent through the configured email adapter.',
        title: 'Invitation created.',
        tone: 'success',
    },
    error: {
        description:
            'The requested invitation change could not be completed. Review the detail below and try again.',
        title: 'Invitation update blocked.',
        tone: 'error',
    },
    resent: {
        description:
            'The invitation status is back to pending with a fresh token window, updated send timestamp, and a new email send.',
        title: 'Invitation resent.',
        tone: 'success',
    },
    revoked: {
        description:
            'The invitation remains in the history view, but competitors can no longer use it to join the campaign.',
        title: 'Invitation revoked.',
        tone: 'success',
    },
} as const

const errorDetailMessages: Record<string, string> = {
    'accepted-invitation':
        'This invitation was already accepted, so create a new campaign invitation only if you change the participant model later.',
    'action-not-allowed':
        'That invitation status does not allow this action anymore.',
    'duplicate-invitation':
        'An invitation for that email and campaign already exists. Use resend instead of creating another record.',
    'email-send-failed':
        'The invitation record was saved, but delivery failed. Check the local SMTP settings or Mailpit service, then resend the invitation.',
    'missing-email': 'Enter an email address before creating an invitation.',
    'missing-invitation':
        'Choose a valid invitation record before trying again.',
    'missing-campaign': 'Choose a campaign before creating an invitation.',
    'campaign-unavailable':
        'Only non-archived invite-only campaigns can receive new invitation activity.',
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatDateTime(value: Date | null) {
    if (!value) {
        return 'Not yet'
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value)
}

function formatCampaignWindow(startAt: Date, endAt: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
    })

    return `${formatter.format(startAt)} to ${formatter.format(endAt)}`
}

function getEffectiveStatusPillClass(status: InvitationStatus) {
    const baseClassName =
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]'

    if (status === 'ACCEPTED') {
        return `${baseClassName} bg-[rgba(135,131,85,0.16)] text-[color:var(--dusty-olive)]`
    }

    if (status === 'EXPIRED') {
        return `${baseClassName} bg-[rgba(218,165,24,0.18)] text-[color:var(--dusty-olive)]`
    }

    if (status === 'REVOKED') {
        return `${baseClassName} bg-[rgba(156,63,43,0.12)] text-[color:var(--destructive)]`
    }

    return `${baseClassName} bg-[rgba(64,105,124,0.12)] text-[color:var(--blue-slate)]`
}

function getStatusDetail({
    acceptedAt,
    expiresAt,
    revokedAt,
    status,
}: {
    acceptedAt: Date | null
    expiresAt: Date
    revokedAt: Date | null
    status: InvitationStatus
}) {
    if (status === 'ACCEPTED') {
        return `Accepted ${formatDateTime(acceptedAt)}`
    }

    if (status === 'REVOKED') {
        return `Revoked ${formatDateTime(revokedAt)}`
    }

    if (status === 'EXPIRED') {
        return `Expired ${formatDateTime(expiresAt)}`
    }

    return `Expires ${formatDateTime(expiresAt)}`
}

function getNotice(
    outcome: string | null,
    detail: string | null
): {
    description: string
    title: string
    tone: 'error' | 'success'
} | null {
    if (!outcome || !(outcome in noticeContent)) {
        return null
    }

    const content = noticeContent[outcome as keyof typeof noticeContent]

    if (outcome !== 'error') {
        return content
    }

    return {
        ...content,
        description: detail
            ? (errorDetailMessages[detail] ?? content.description)
            : content.description,
    }
}

export default async function AdminInvitationsPage({
    searchParams,
}: InvitationsPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const invitationLink = getFirstSearchParamValue(
        resolvedSearchParams.invitationLink
    )
    const notice = getNotice(outcome, detail)
    const now = new Date()
    await synchronizeDerivedCampaignStatuses(now)
    const [campaigns, invitations] = await Promise.all([
        prisma.campaign.findMany({
            orderBy: [
                {
                    startAt: 'desc',
                },
                {
                    createdAt: 'desc',
                },
            ],
            select: {
                endAt: true,
                id: true,
                name: true,
                startAt: true,
                status: true,
            },
            where: {
                status: {
                    not: 'ARCHIVED',
                },
                visibility: 'INVITE_ONLY',
            },
        }),
        prisma.invitation.findMany({
            include: {
                acceptedBy: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
                invitedBy: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
                campaign: {
                    select: {
                        endAt: true,
                        id: true,
                        name: true,
                        startAt: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        }),
    ])

    const invitationRows = invitations.map((invitation) => {
        const effectiveStatus: InvitationStatus = getEffectiveInvitationStatus(
            invitation,
            now
        )

        return {
            ...invitation,
            effectiveStatus,
        }
    })

    const totalCount = invitationRows.length
    const pendingCount = invitationRows.filter(
        ({ effectiveStatus }) => effectiveStatus === 'PENDING'
    ).length
    const acceptedCount = invitationRows.filter(
        ({ effectiveStatus }) => effectiveStatus === 'ACCEPTED'
    ).length
    const attentionCount = invitationRows.filter(
        ({ effectiveStatus }) =>
            effectiveStatus === 'EXPIRED' || effectiveStatus === 'REVOKED'
    ).length

    const rows = invitationRows.map((invitation) => {
        const allowResend = canResendInvitation(invitation, now)
        const allowRevoke = canRevokeInvitation(invitation, now)

        return {
            cells: [
                <div key='recipient' className='stack-sm'>
                    <strong>{invitation.email}</strong>
                    <p className='type-muted text-xs'>
                        Sent by{' '}
                        {invitation.invitedBy?.name ||
                            invitation.invitedBy?.email ||
                            'an administrator'}
                    </p>
                </div>,
                <div key='campaign' className='stack-sm'>
                    <strong>{invitation.campaign.name}</strong>
                    <p className='type-muted text-xs'>
                        {formatCampaignWindow(
                            invitation.campaign.startAt,
                            invitation.campaign.endAt
                        )}
                    </p>
                </div>,
                <div key='status' className='stack-sm'>
                    <span
                        className={getEffectiveStatusPillClass(
                            invitation.effectiveStatus
                        )}
                    >
                        {invitationStatusLabels[invitation.effectiveStatus]}
                    </span>
                    <p className='type-muted text-xs'>
                        {getStatusDetail({
                            acceptedAt: invitation.acceptedAt,
                            expiresAt: invitation.expiresAt,
                            revokedAt: invitation.revokedAt,
                            status: invitation.effectiveStatus,
                        })}
                    </p>
                </div>,
                <div key='activity' className='stack-sm'>
                    <p className='type-muted text-xs'>
                        Last sent {formatDateTime(invitation.lastSentAt)}
                    </p>
                    <p className='type-muted text-xs'>
                        {invitation.acceptedBy
                            ? `Accepted by ${
                                  invitation.acceptedBy.name ||
                                  invitation.acceptedBy.email
                              }`
                            : 'Waiting for competitor acceptance'}
                    </p>
                </div>,
                <div key='actions' className='flex flex-wrap gap-2'>
                    {allowResend ? (
                        <form action={resendInvitationAction}>
                            <input
                                type='hidden'
                                name='invitationId'
                                value={invitation.id}
                            />
                            <Button nativeButton type='submit' size='sm'>
                                Resend
                            </Button>
                        </form>
                    ) : null}
                    {allowRevoke ? (
                        <form action={revokeInvitationAction}>
                            <input
                                type='hidden'
                                name='invitationId'
                                value={invitation.id}
                            />
                            <Button
                                nativeButton
                                type='submit'
                                size='sm'
                                variant='destructive'
                            >
                                Revoke
                            </Button>
                        </form>
                    ) : null}
                    {!allowResend && !allowRevoke ? (
                        <p className='type-muted text-xs'>
                            This invitation is already settled.
                        </p>
                    ) : null}
                </div>,
            ],
            key: invitation.id,
        }
    })

    return (
        <div className='grid gap-6'>
            {notice ? (
                <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]'>
                    <Card
                        className={
                            notice.tone === 'success'
                                ? 'surface-tint'
                                : 'surface-warm'
                        }
                    >
                        <CardHeader>
                            <CardTitle>{notice.title}</CardTitle>
                            <CardDescription>
                                {notice.description}
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {invitationLink ? (
                        <FormCard
                            title='One-time secure invite link'
                            description='Use this preview for local testing or compare it with the captured email in Mailpit. The raw token is only available immediately after create or resend.'
                        >
                            <FormField
                                label='Join URL'
                                htmlFor='invitation-link'
                                hint='This link points to the token-aware acceptance route and includes the new secure token.'
                            >
                                <Input
                                    id='invitation-link'
                                    value={invitationLink}
                                    readOnly
                                />
                            </FormField>
                            <FormActions note='Mailpit should capture the delivered email at http://127.0.0.1:8025 when the local services are running.'>
                                <Button
                                    variant='outline'
                                    render={
                                        <a
                                            href='http://127.0.0.1:8025'
                                            target='_blank'
                                            rel='noreferrer'
                                        />
                                    }
                                >
                                    Open Mailpit
                                </Button>
                            </FormActions>
                        </FormCard>
                    ) : null}
                </div>
            ) : null}

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <StatCard
                    eyebrow='Invitation roster'
                    title='Tracked invitations'
                    value={totalCount}
                    description='Every campaign invite lives here even after it expires or is revoked.'
                />
                <StatCard
                    eyebrow='Ready to join'
                    title='Pending acceptance'
                    value={pendingCount}
                    description='These recipients still have a live path into the campaign.'
                />
                <StatCard
                    eyebrow='Joined competitors'
                    title='Accepted invites'
                    value={acceptedCount}
                    description='Accepted invitations already map into a participant record or linked account.'
                />
                <StatCard
                    eyebrow='Needs attention'
                    title='Expired or revoked'
                    value={attentionCount}
                    description='These are the rows most likely to need a resend or admin review.'
                />
            </div>

            <div className='grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]'>
                <FormCard
                    title='Create a new invitation'
                    description='Invite a reader into any current invite-only campaign. Token generation, delivery, and acceptance tracking are active now.'
                >
                    <form
                        action={createInvitationAction}
                        className='ui-form-shell'
                    >
                        <FormField
                            label='Campaign'
                            htmlFor='campaignId'
                            hint='Only non-archived invite-only campaigns are available for new invitations.'
                        >
                            <select
                                id='campaignId'
                                name='campaignId'
                                className={selectClassName}
                                defaultValue={campaigns[0]?.id ?? ''}
                                disabled={campaigns.length === 0}
                            >
                                {campaigns.length === 0 ? (
                                    <option value=''>
                                        No eligible campaigns yet
                                    </option>
                                ) : (
                                    campaigns.map((campaign) => (
                                        <option
                                            key={campaign.id}
                                            value={campaign.id}
                                        >
                                            {campaign.name} (
                                            {campaign.status.toLowerCase()})
                                        </option>
                                    ))
                                )}
                            </select>
                        </FormField>

                        <FormField
                            label='Recipient email'
                            htmlFor='email'
                            hint='Each campaign can track one invitation per email address.'
                        >
                            <Input
                                id='email'
                                name='email'
                                type='email'
                                placeholder='reader@example.com'
                                disabled={campaigns.length === 0}
                            />
                        </FormField>

                        <FormActions
                            note={
                                campaigns.length === 0
                                    ? 'Create or unarchive an invite-only campaign first, then return here to send invitations.'
                                    : 'Create stores the invitation immediately. Resend and revoke controls stay available in the history table.'
                            }
                        >
                            <Button
                                nativeButton
                                type='submit'
                                disabled={campaigns.length === 0}
                            >
                                Create invitation
                            </Button>
                        </FormActions>
                    </form>
                </FormCard>

                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Status guide</CardTitle>
                        <CardDescription>
                            Pending invitations can be resent or revoked.
                            Accepted invitations stay read-only so historical
                            joins remain trustworthy.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='grid gap-3'>
                        <div className='pill-row'>
                            <span
                                className={getEffectiveStatusPillClass(
                                    'PENDING'
                                )}
                            >
                                Pending
                            </span>
                            <span
                                className={getEffectiveStatusPillClass(
                                    'ACCEPTED'
                                )}
                            >
                                Accepted
                            </span>
                            <span
                                className={getEffectiveStatusPillClass(
                                    'EXPIRED'
                                )}
                            >
                                Expired
                            </span>
                            <span
                                className={getEffectiveStatusPillClass(
                                    'REVOKED'
                                )}
                            >
                                Revoked
                            </span>
                        </div>
                        <p className='type-muted'>
                            Expired rows are derived from the stored expiration
                            timestamp even if their persisted status is still
                            pending. Resend rotates the token window and moves
                            the row back to pending.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {rows.length > 0 ? (
                <TableCard
                    title='Invitation history and actions'
                    description='This is the admin status view for creation, resend, revoke, and acceptance tracking.'
                    columns={[
                        'Recipient',
                        'Campaign',
                        'Status',
                        'Activity',
                        'Actions',
                    ]}
                    rows={rows}
                    ariaLabel='Invitation management table'
                />
            ) : (
                <EmptyState
                    eyebrow='Invitation history'
                    title='No invitations have been recorded yet.'
                    description='Use the form to invite the first reader into an active campaign. Once invitations exist, resend, revoke, and status tracking will appear here.'
                />
            )}
        </div>
    )
}
