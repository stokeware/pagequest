import { LoadingState } from '@/components/ui'

export default function CompetitorLoading() {
    return (
        <LoadingState
            eyebrow='Competitor loading'
            title='Refreshing your reading hub.'
            description='Campaign context, activity summaries, and next actions are loading for this account.'
            lines={4}
        />
    )
}
