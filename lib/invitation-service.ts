type InvitationAcceptanceTransaction = {
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
    roleAssignment: {
        upsert: (args: {
            create: {
                role: 'COMPETITOR'
                userId: string
            }
            update: Record<string, never>
            where: {
                userId_role: {
                    role: 'COMPETITOR'
                    userId: string
                }
            }
        }) => Promise<unknown>
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

export async function recordInvitationAcceptance(
    transaction: InvitationAcceptanceTransaction,
    { invitation, now, userId }: InvitationAcceptanceWriteInput
) {
    const campaign = invitation.campaign

    await transaction.roleAssignment.upsert({
        create: {
            role: 'COMPETITOR',
            userId,
        },
        update: {},
        where: {
            userId_role: {
                role: 'COMPETITOR',
                userId,
            },
        },
    })

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
