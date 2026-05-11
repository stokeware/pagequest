import {
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    TableCard,
} from '@/components/ui'
import { getEffectiveInvitationStatus } from '@/lib/invitation-admin'
import { prisma } from '@/lib/prisma'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'

import {
    createInvitationAction,
    removeMemberAction,
    resendInvitationAction,
    revokeInvitationAction,
} from '../invitations/actions'

type MembersPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const createInvitationFormId = 'member-invitation-create-form'

const noticeContent = {
    created: {
        description:
            'The invitation was sent and is now listed in Invitations.',
        title: 'Invitation sent.',
        tone: 'success',
    },
    error: {
        description:
            'The requested member change could not be completed. Review the detail below and try again.',
        title: 'Member update blocked.',
        tone: 'error',
    },
    removed: {
        description:
            'The confirmed competitor was removed from membership and any linked campaign participation was closed.',
        title: 'Competitor removed.',
        tone: 'success',
    },
    resent: {
        description: 'The invitation was resent and remains pending.',
        title: 'Invitation resent.',
        tone: 'success',
    },
    revoked: {
        description: 'The invitation was deleted from the pending list.',
        title: 'Invitation revoked.',
        tone: 'success',
    },
} as const

const errorDetailMessages: Record<string, string> = {
    'accepted-invitation':
        'That email already belongs to a confirmed competitor, so a new invitation is not needed.',
    'action-not-allowed': 'That record is no longer available for this action.',
    'campaign-unavailable':
        'Create or publish an invite-only active or scheduled campaign before sending invitations.',
    'duplicate-invitation':
        'That recipient already has a pending invitation. Resend or revoke the existing one instead.',
    'email-send-failed':
        'The invitation record was saved, but delivery failed. Check the local SMTP settings or Mailpit service, then resend it.',
    'invalid-email':
        'Enter a valid email address before sending an invitation. Existing invalid invitations should be revoked and recreated.',
    'missing-email': 'Enter an email address before sending an invitation.',
    'missing-invitation': 'Choose a valid invitation row before trying again.',
    'missing-member': 'Choose a valid competitor row before trying again.',
    'rate-limit-exceeded':
        'Invitation sending is temporarily limited for this admin session. Wait a few minutes before sending more invitations.',
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
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

function formatDateTime(value: Date | null) {
    if (!value) {
        return 'No activity yet'
    }

    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value)
}

function getLatestDate(dates: Array<Date | null | undefined>) {
    return dates.reduce<Date | null>((latest, value) => {
        if (!value) {
            return latest
        }

        if (!latest || value.getTime() > latest.getTime()) {
            return value
        }

        return latest
    }, null)
}

export default async function AdminMembersPage({
    searchParams,
}: MembersPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const notice = getNotice(outcome, detail)
    const now = new Date()

    await synchronizeDerivedCampaignStatuses(now)

    const invitations = await prisma.invitation.findMany({
        include: {
            acceptedBy: {
                select: {
                    campaignParticipants: {
                        select: {
                            lastActivityAt: true,
                        },
                        where: {
                            removedAt: null,
                        },
                    },
                    email: true,
                    id: true,
                    lastSignedInAt: true,
                    name: true,
                },
            },
            invitedBy: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
        orderBy: [
            {
                acceptedAt: 'desc',
            },
            {
                createdAt: 'desc',
            },
        ],
        where: {
            status: {
                not: 'REVOKED',
            },
        },
    })

    const invitationRows = invitations.map((invitation) => ({
        ...invitation,
        effectiveStatus: getEffectiveInvitationStatus(invitation, now),
    }))

    const competitorsByKey = new Map<
        string,
        {
            email: string
            lastActivityAt: Date | null
            memberUserId: string | null
            name: string | null
        }
    >()

    for (const invitation of invitationRows) {
        if (invitation.effectiveStatus !== 'ACCEPTED') {
            continue
        }

        const member = invitation.acceptedBy
        const key = member?.id ?? invitation.email
        const lastActivityAt = getLatestDate([
            member?.lastSignedInAt,
            ...(member?.campaignParticipants.map(
                (participant) => participant.lastActivityAt
            ) ?? []),
        ])
        const existing = competitorsByKey.get(key)

        if (!existing) {
            competitorsByKey.set(key, {
                email: member?.email ?? invitation.email,
                lastActivityAt,
                memberUserId: member?.id ?? null,
                name: member?.name ?? null,
            })
            continue
        }

        competitorsByKey.set(key, {
            email: existing.email,
            lastActivityAt: getLatestDate([
                existing.lastActivityAt,
                lastActivityAt,
            ]),
            memberUserId: existing.memberUserId,
            name: existing.name ?? member?.name ?? null,
        })
    }

    const competitorRows = Array.from(competitorsByKey.values())
        .sort((left, right) => {
            const leftTime = left.lastActivityAt?.getTime() ?? 0
            const rightTime = right.lastActivityAt?.getTime() ?? 0

            if (leftTime !== rightTime) {
                return rightTime - leftTime
            }

            return left.email.localeCompare(right.email)
        })
        .map((member) => ({
            cells: [
                <strong key='email'>{member.email}</strong>,
                <span key='name'>{member.name ?? 'Not provided'}</span>,
                <span key='last-activity' className='type-muted text-sm'>
                    {formatDateTime(member.lastActivityAt)}
                </span>,
                <form key='actions' action={removeMemberAction}>
                    <input type='hidden' name='email' value={member.email} />
                    <input
                        type='hidden'
                        name='memberUserId'
                        value={member.memberUserId ?? ''}
                    />
                    <Button
                        nativeButton
                        type='submit'
                        size='sm'
                        variant='destructive'
                    >
                        Remove
                    </Button>
                </form>,
            ],
            key: member.memberUserId ?? member.email,
        }))

    if (competitorRows.length === 0) {
        competitorRows.push({
            cells: [
                <span key='email' className='type-muted'>
                    No confirmed competitors yet
                </span>,
                <span key='name' className='type-muted'>
                    -
                </span>,
                <span key='last-activity' className='type-muted'>
                    -
                </span>,
                <span key='actions' className='type-muted'>
                    -
                </span>,
            ],
            key: 'competitors-empty',
        })
    }

    const pendingInvitationRows = invitationRows
        .filter((invitation) => invitation.effectiveStatus !== 'ACCEPTED')
        .map((invitation) => ({
            cells: [
                <strong key='recipient'>{invitation.email}</strong>,
                <span key='sent-by'>
                    {invitation.invitedBy?.name ||
                        invitation.invitedBy?.email ||
                        'An administrator'}
                </span>,
                <span key='date-sent' className='type-muted text-sm'>
                    {formatDateTime(
                        invitation.lastSentAt ?? invitation.createdAt
                    )}
                </span>,
                <div key='actions' className='flex flex-wrap gap-2'>
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
                </div>,
            ],
            key: invitation.id,
        }))

    pendingInvitationRows.push({
        cells: [
            <Input
                key='recipient'
                id='member-invitation-email'
                form={createInvitationFormId}
                name='email'
                type='email'
                placeholder='reader@example.com'
                aria-label='Recipient email'
            />,
            <span key='sent-by' className='type-muted text-sm'>
                -
            </span>,
            <span key='date-sent' className='type-muted text-sm'>
                -
            </span>,
            <form
                key='actions'
                id={createInvitationFormId}
                action={createInvitationAction}
            >
                <Button nativeButton type='submit' size='sm'>
                    Send
                </Button>
            </form>,
        ],
        key: 'create-invitation',
    })

    return (
        <div className='grid gap-6 xl:mx-auto xl:w-full xl:max-w-5xl'>
            {notice ? (
                <Card
                    className={
                        notice.tone === 'success'
                            ? 'surface-tint'
                            : 'surface-warm'
                    }
                >
                    <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.description}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            <TableCard
                title={
                    <span className='text-lg font-semibold'>Competitors</span>
                }
                columns={['Email', 'Name', 'Last Activity', 'Actions']}
                rows={competitorRows}
                ariaLabel='Competitors table'
            />

            <TableCard
                title={
                    <span className='text-lg font-semibold'>Invitations</span>
                }
                columns={['Recipient', 'Sent By', 'Date Sent', 'Actions']}
                rows={pendingInvitationRows}
                ariaLabel='Invitations table'
            />
        </div>
    )
}
