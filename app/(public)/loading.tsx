import { PublicShell } from '@/components/public/public-shell'
import { LoadingState } from '@/components/ui'

export default function PublicLoading() {
    return (
        <PublicShell
            eyebrow='Loading'
            title='Turning the page to the next route.'
            description='Page Quest is preparing the public shell and the content that belongs on this screen.'
        >
            <LoadingState
                title='Loading public content'
                description='The route shell is ready. The remaining content is on its way.'
            />
        </PublicShell>
    )
}
