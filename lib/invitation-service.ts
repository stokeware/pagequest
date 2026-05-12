import { normalizeInvitationEmail } from '@/lib/invitation-admin'

type InvitationMutationTransaction = {
    auditLog: {
        create: (args: {
            data: {
                action: string
                actorUserId: string
                entityId: string
                entityType: string
                invitationId: string
                metadata: {
                    acceptedAt: string
                    email: string
                    campaignName: string | null
                }
                campaignId?: string | null
                campaignParticipantId?: string | null
            }
        }) => Promise<unknown>
    }
    roleAssignment: {
        findUnique: (args: {
            where: {
                userId_role: {
                    role: 'COMPETITOR'
                    userId: string
                }
            }
        }) => Promise<{
            id: string
        } | null>
        create: (args: {
            data: {
                role: 'COMPETITOR'
                userId: string
            }
        }) => Promise<unknown>
    }
    invitation: {
        update: (args: {
            data: {
                acceptedAt: Date
                acceptedByUserId: string
                acceptedParticipantId: string | null
                status: 'ACCEPTED'
            }
            where: {
                id: string
            }
        }) => Promise<unknown>
    }
    user: {
        create: (args: {
            data: {
                authMethod: 'PASSWORD'
                email: string
                lastPasswordChangeAt: Date
                name: string
                passwordHash: string
                passwordSetAt: Date
            }
        }) => Promise<{
            id: string
        }>
        update: (args: {
            data: {
                authMethod: 'PASSWORD'
                lastPasswordChangeAt: Date
                name: string
                passwordHash: string
                passwordSetAt: Date
            }
            where: {
                id: string
            }
        }) => Promise<{
            id: string
        }>
    }
    campaignParticipant: {
        create: (args: {
            data: {
                joinedAt: Date
                campaignId: string
                userId: string
            }
            select: {
                id: true
            }
        }) => Promise<{
            id: string
        }>
        findUnique: (args: {
            select: {
                id: true
                joinedAt: true
            }
            where: {
                campaignId_userId: {
                    campaignId: string
                    userId: string
                }
            }
        }) => Promise<{
            id: string
            joinedAt: Date | null
        } | null>
        update: (args: {
            data: {
                joinedAt: Date
                removedAt: null
            }
            select: {
                id: true
            }
            where: {
                id: string
            }
        }) => Promise<{
            id: string
        }>
    }
}

export type InvitationAcceptanceWriteInput = {
    invitation: {
        email: string
        id: string
        campaign?: {
            id: string
            name: string
        } | null
    }
    now: Date
    userId: string
}

export type InvitationAccountProvisionInput = {
    existingUserId?: string | null
    invitation: {
        email: string
        id: string
        campaign?: {
            id: string
            name: string
        } | null
    }
    name: string
    now: Date
    passwordHash: string
}

async function ensureCompetitorRole(
    transaction: InvitationMutationTransaction,
    userId: string
) {
    const roleAssignment = await transaction.roleAssignment.findUnique({
        where: {
            userId_role: {
                role: 'COMPETITOR',
                userId,
            },
        },
    })

    if (!roleAssignment) {
        await transaction.roleAssignment.create({
            data: {
                role: 'COMPETITOR',
                userId,
            },
        })
    }
}

export async function recordInvitationAcceptance(
    transaction: InvitationMutationTransaction,
    { invitation, now, userId }: InvitationAcceptanceWriteInput
) {
    const campaign = invitation.campaign

    const participant = campaign
        ? await (async () => {
              const existingParticipant =
                  await transaction.campaignParticipant.findUnique({
                      select: {
                          id: true,
                          joinedAt: true,
                      },
                      where: {
                          campaignId_userId: {
                              campaignId: campaign.id,
                              userId,
                          },
                      },
                  })

              return existingParticipant
                  ? await transaction.campaignParticipant.update({
                        data: {
                            joinedAt: existingParticipant.joinedAt ?? now,
                            removedAt: null,
                        },
                        select: {
                            id: true,
                        },
                        where: {
                            id: existingParticipant.id,
                        },
                    })
                  : await transaction.campaignParticipant.create({
                        data: {
                            joinedAt: now,
                            campaignId: campaign.id,
                            userId,
                        },
                        select: {
                            id: true,
                        },
                    })
          })()
        : null

    await transaction.invitation.update({
        data: {
            acceptedAt: now,
            acceptedByUserId: userId,
            acceptedParticipantId: participant?.id ?? null,
            status: 'ACCEPTED',
        },
        where: {
            id: invitation.id,
        },
    })

    await transaction.auditLog.create({
        data: {
            action: 'invitation.accepted',
            actorUserId: userId,
            entityId: invitation.id,
            entityType: 'Invitation',
            invitationId: invitation.id,
            metadata: {
                acceptedAt: now.toISOString(),
                email: invitation.email,
                campaignName: invitation.campaign?.name ?? null,
            },
            campaignId: invitation.campaign?.id ?? null,
            campaignParticipantId: participant?.id ?? null,
        },
    })

    return {
        participantId: participant?.id ?? null,
    }
}

export async function provisionInvitationAccount(
    transaction: InvitationMutationTransaction,
    {
        existingUserId,
        invitation,
        name,
        now,
        passwordHash,
    }: InvitationAccountProvisionInput
) {
    const user = existingUserId
        ? await transaction.user.update({
              data: {
                  authMethod: 'PASSWORD',
                  lastPasswordChangeAt: now,
                  name,
                  passwordHash,
                  passwordSetAt: now,
              },
              where: {
                  id: existingUserId,
              },
          })
        : await transaction.user.create({
              data: {
                  authMethod: 'PASSWORD',
                  email: normalizeInvitationEmail(invitation.email),
                  lastPasswordChangeAt: now,
                  name,
                  passwordHash,
                  passwordSetAt: now,
              },
          })

    await ensureCompetitorRole(transaction, user.id)

    const acceptance = await recordInvitationAcceptance(transaction, {
        invitation,
        now,
        userId: user.id,
    })

    return {
        ...acceptance,
        userId: user.id,
    }
}
