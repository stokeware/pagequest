import { LoadingState } from '@/components/ui'

export default function AdminLoading() {
    return (
        <LoadingState
            eyebrow='Admin loading'
            title='Preparing the campaign control surface.'
            description='Campaign, challenge, and member administration data are loading now.'
            lines={4}
        />
    )
}
