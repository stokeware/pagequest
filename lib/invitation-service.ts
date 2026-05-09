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
                    questName: string
                }
                questId: string
                questParticipantId: string
            }
        }) => Promise<unknown>
    }
    invitation: {
        update: (args: {
            data: {
                acceptedAt: Date
                acceptedByUserId: string
                acceptedParticipantId: string
                status: 'ACCEPTED'
            }
            where: {
                id: string
            }
        }) => Promise<unknown>
    }
    questParticipant: {
        create: (args: {
            data: {
                joinedAt: Date
                questId: string
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
                questId_userId: {
                    questId: string
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
        quest: {
            id: string
            name: string
        }
    }
    now: Date
    userId: string
}

export async function recordInvitationAcceptance(
    transaction: InvitationAcceptanceTransaction,
    { invitation, now, userId }: InvitationAcceptanceWriteInput
) {
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

    const existingParticipant = await transaction.questParticipant.findUnique({
        select: {
            id: true,
            joinedAt: true,
        },
        where: {
            questId_userId: {
                questId: invitation.quest.id,
                userId,
            },
        },
    })

    const participant = existingParticipant
        ? await transaction.questParticipant.update({
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
        : await transaction.questParticipant.create({
              data: {
                  joinedAt: now,
                  questId: invitation.quest.id,
                  userId,
              },
              select: {
                  id: true,
              },
          })

    await transaction.invitation.update({
        data: {
            acceptedAt: now,
            acceptedByUserId: userId,
            acceptedParticipantId: participant.id,
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
                questName: invitation.quest.name,
            },
            questId: invitation.quest.id,
            questParticipantId: participant.id,
        },
    })

    return {
        participantId: participant.id,
    }
}
