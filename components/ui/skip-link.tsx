'use client'

type SkipLinkProps = {
    targetId: string
    children: React.ReactNode
}

export function SkipLink({ targetId, children }: SkipLinkProps) {
    function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
        const target = document.getElementById(targetId)

        if (!target) {
            return
        }

        event.preventDefault()
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: 'start' })
    }

    return (
        <a href={`#${targetId}`} className='skip-link' onClick={handleClick}>
            {children}
        </a>
    )
}
