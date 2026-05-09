import Link from 'next/link'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui'

type PendingChallengeReviewItem = {
    awardedPoints: { toString(): string } | null
    challengeTitle: string
    createdAtLabel: string
    defaultAwardedPoints: { toString(): string }
    evidenceText: string | null
    href: string
    id: string
    participantLabel: string
    campaignLabel: string
    reviewNotes: string | null
    readingEntryNotes: string | null
    submittedActivityLabel: string
}

type ResolvedChallengeReviewItem = {
    awardedPoints: { toString(): string }
    challengeTitle: string
    participantLabel: string
    campaignLabel: string
    reviewStateLabel: string
    reviewedAtLabel: string
    reviewerLabel: string
}

function formatPoints(value: { toString(): string } | null) {
    if (!value) {
        return 'Campaign default'
    }

    const numericValue = Number(value.toString())

    return Number.isInteger(numericValue)
        ? `${numericValue} points`
        : `${numericValue
              .toFixed(2)
              .replace(/\.00$/, '')
              .replace(/0$/, '')} points`
}

export function ChallengeReviewQueuePanel({
    action,
    pendingReviews,
    resolvedReviews,
    selectedChallengeId,
    selectedReviewId,
}: {
    action: (formData: FormData) => Promise<void>
    pendingReviews: PendingChallengeReviewItem[]
    resolvedReviews: ResolvedChallengeReviewItem[]
    selectedChallengeId: string | null
    selectedReviewId: string | null
}) {
    const selectedReview =
        pendingReviews.find((review) => review.id === selectedReviewId) ??
        pendingReviews[0] ??
        null

    return (
        <Card className='surface-card'>
            <CardHeader>
                <CardTitle>Pending challenge reviews</CardTitle>
                <CardDescription>
                    Review-required challenge completions wait here until an
                    administrator decides how the submission should count.
                </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'>
                <div className='grid gap-3'>
                    {pendingReviews.length > 0 ? (
                        pendingReviews.map((review) => {
                            const isSelected = review.id === selectedReview?.id

                            return (
                                <div
                                    key={review.id}
                                    className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'
                                >
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='stack-sm'>
                                            <strong>
                                                {review.challengeTitle}
                                            </strong>
                                            <p className='type-muted text-xs'>
                                                {review.participantLabel} in{' '}
                                                {review.campaignLabel}
                                            </p>
                                            <p className='type-muted text-xs'>
                                                Activity{' '}
                                                {review.submittedActivityLabel}
                                            </p>
                                        </div>
                                        <Button
                                            size='sm'
                                            variant={
                                                isSelected
                                                    ? 'secondary'
                                                    : 'outline'
                                            }
                                            render={<Link href={review.href} />}
                                        >
                                            {isSelected
                                                ? 'Reviewing'
                                                : 'Open review'}
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <p className='type-muted text-sm'>
                            No challenge completions are waiting for manual
                            review right now.
                        </p>
                    )}
                </div>

                {selectedReview ? (
                    <div className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/50 p-4'>
                        <div className='stack-sm'>
                            <h3 className='text-sm font-semibold'>
                                Review detail
                            </h3>
                            <p className='type-muted text-xs'>
                                Submitted {selectedReview.createdAtLabel}
                            </p>
                        </div>

                        <div className='stack-sm'>
                            <p className='type-muted text-xs'>Challenge</p>
                            <strong>{selectedReview.challengeTitle}</strong>
                            <p className='type-muted text-xs'>
                                {selectedReview.participantLabel} in{' '}
                                {selectedReview.campaignLabel}
                            </p>
                        </div>

                        <div className='grid gap-3 md:grid-cols-2'>
                            <div className='stack-sm'>
                                <p className='type-muted text-xs'>
                                    Activity date
                                </p>
                                <strong>
                                    {selectedReview.submittedActivityLabel}
                                </strong>
                            </div>
                            <div className='stack-sm'>
                                <p className='type-muted text-xs'>
                                    Current points
                                </p>
                                <strong>
                                    {formatPoints(selectedReview.awardedPoints)}
                                </strong>
                            </div>
                        </div>

                        <div className='stack-sm'>
                            <p className='type-muted text-xs'>
                                Suggested points
                            </p>
                            <strong>
                                {formatPoints(
                                    selectedReview.defaultAwardedPoints
                                )}
                            </strong>
                        </div>

                        <div className='stack-sm'>
                            <p className='type-muted text-xs'>Evidence</p>
                            <p>
                                {selectedReview.evidenceText ||
                                    'No evidence text was submitted.'}
                            </p>
                        </div>

                        <div className='stack-sm'>
                            <p className='type-muted text-xs'>Entry notes</p>
                            <p>
                                {selectedReview.readingEntryNotes ||
                                    'No reading-entry notes were submitted.'}
                            </p>
                        </div>

                        <form action={action} className='grid gap-4'>
                            <input
                                type='hidden'
                                name='challengeCompletionId'
                                value={selectedReview.id}
                            />
                            {selectedChallengeId ? (
                                <input
                                    type='hidden'
                                    name='selectedChallengeId'
                                    value={selectedChallengeId}
                                />
                            ) : null}
                            <div className='grid gap-3 md:grid-cols-2'>
                                <label className='stack-sm'>
                                    <span className='type-muted text-xs'>
                                        Approved points override
                                    </span>
                                    <input
                                        name='awardedPointsOverride'
                                        type='number'
                                        min='0'
                                        step='0.01'
                                        className='h-10 rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow] focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50'
                                        placeholder={selectedReview.defaultAwardedPoints.toString()}
                                    />
                                </label>
                                <label className='stack-sm'>
                                    <span className='type-muted text-xs'>
                                        Review notes
                                    </span>
                                    <textarea
                                        name='reviewNotes'
                                        defaultValue={
                                            selectedReview.reviewNotes ?? ''
                                        }
                                        className='min-h-28 rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow] focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50'
                                        placeholder='Add context for the decision or leave blank.'
                                    />
                                </label>
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <Button
                                    nativeButton
                                    type='submit'
                                    name='decision'
                                    value='approve'
                                >
                                    Approve submission
                                </Button>
                                <Button
                                    nativeButton
                                    type='submit'
                                    name='decision'
                                    value='reject'
                                    variant='destructive'
                                >
                                    Reject submission
                                </Button>
                            </div>
                            <p className='ui-form-note'>
                                Leave the point override blank to use campaign
                                and challenge defaults. Rejections always zero
                                out awarded points.
                            </p>
                        </form>
                    </div>
                ) : null}
            </CardContent>

            <CardContent className='px-4 pt-0 group-data-[size=sm]/card:px-3'>
                <div className='grid gap-3 rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/50 p-4'>
                    <div className='stack-sm'>
                        <h3 className='text-sm font-semibold'>
                            Recent review outcomes
                        </h3>
                        <p className='type-muted text-xs'>
                            Approved, rejected, and auto-approved submissions
                            stay visible here as the moderation history builds.
                        </p>
                    </div>
                    {resolvedReviews.length > 0 ? (
                        <div className='grid gap-3'>
                            {resolvedReviews.map((review) => (
                                <div
                                    key={`${review.challengeTitle}-${review.reviewedAtLabel}-${review.participantLabel}`}
                                    className='rounded-[calc(var(--radius-lg)-2px)] border border-(--line-strong) bg-card/72 p-3'
                                >
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='stack-sm'>
                                            <strong>
                                                {review.challengeTitle}
                                            </strong>
                                            <p className='type-muted text-xs'>
                                                {review.participantLabel} in{' '}
                                                {review.campaignLabel}
                                            </p>
                                        </div>
                                        <div className='stack-sm text-right'>
                                            <strong>
                                                {review.reviewStateLabel}
                                            </strong>
                                            <p className='type-muted text-xs'>
                                                {formatPoints(
                                                    review.awardedPoints
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <p className='type-muted mt-3 text-xs'>
                                        Reviewed {review.reviewedAtLabel} by{' '}
                                        {review.reviewerLabel}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='type-muted text-sm'>
                            No challenge submissions have been resolved yet.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
