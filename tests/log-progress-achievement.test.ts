import { describe, expect, it } from 'vitest'

import { getAchievedChallengeIds } from '@/app/(competitor)/log-progress/challenge-achievement'

describe('getAchievedChallengeIds', () => {
    it('includes completed workspace rows in the achieved set', () => {
        const achievedChallengeIds = getAchievedChallengeIds({
            approvedChallengeIds: [],
            workspaceState: {
                personalGoalTitle: 'Epic page turner',
                progressRows: [
                    {
                        bookName: 'Epic page turner',
                        challengeId: 'personal-goal-1',
                        completed: true,
                        id: 'progress-row-personal-goal',
                        minutes: '',
                        pages: '320',
                        rowType: 'PERSONAL_GOAL',
                    },
                    {
                        bookName: 'Other book',
                        challengeId: 'challenge-2',
                        completed: false,
                        id: 'progress-row-2',
                        minutes: '',
                        pages: '20',
                        rowType: 'STANDARD',
                    },
                ],
                recommendationTitle: '',
            },
        })

        expect([...achievedChallengeIds]).toEqual(['personal-goal-1'])
    })

    it('merges approved challenge completions with completed workspace rows', () => {
        const achievedChallengeIds = getAchievedChallengeIds({
            approvedChallengeIds: ['challenge-1'],
            workspaceState: {
                personalGoalTitle: 'Epic page turner',
                progressRows: [
                    {
                        bookName: 'Epic page turner',
                        challengeId: 'personal-goal-1',
                        completed: true,
                        id: 'progress-row-personal-goal',
                        minutes: '',
                        pages: '320',
                        rowType: 'PERSONAL_GOAL',
                    },
                    {
                        bookName: 'Library visit',
                        challengeId: 'challenge-1',
                        completed: true,
                        id: 'progress-row-2',
                        minutes: '15',
                        pages: '0',
                        rowType: 'STANDARD',
                    },
                ],
                recommendationTitle: '',
            },
        })

        expect([...achievedChallengeIds]).toEqual([
            'challenge-1',
            'personal-goal-1',
        ])
    })
})
