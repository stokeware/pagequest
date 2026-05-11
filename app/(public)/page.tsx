import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'

import { HomeCountdown } from '@/components/public/home-countdown'
import { authOptions } from '@/lib/auth'
import { getSignedInLandingPath } from '@/lib/auth/access'
import { getHomePageCountdownTarget } from '@/lib/home-page'

const proclamation = [
    'Hearken, good folk, and attend this noble proclamation:',
    'In the realm of letters and lore there doth rage a most valiant contest, known throughout the lands as Page Quest. Herein do the illustrious houses of Roberson and Lefkowitz, alongside their kin and sworn companions, assemble in spirited rivalry. Each passing year, their champions take up the mantle of reading, striving with keen mind and tireless eye to outmatch their fellows.',
    'For it is no mere pastime, but a grand tourney of wit and wisdom — wherein the victor claims not only triumph, but everlasting renown in the annals of their noble line. Thus is waged the ultimate battle of reading prowess, where glory awaits the most indomitable and peerless of readers.',
]

const backgroundImageUrl =
    'https://izsihmntzljablvq.public.blob.vercel-storage.com/images/pagequest-library.png'

export default async function HomePage() {
    const session = await getServerSession(authOptions)
    const redirectPath = getSignedInLandingPath({
        grantedRoles: Array.isArray(session?.user?.roles)
            ? session.user.roles
            : [],
        isAuthenticated: Boolean(session?.user),
    })

    if (redirectPath) {
        redirect(redirectPath)
    }

    const countdownTarget = await getHomePageCountdownTarget()
    const renderedAt = new Date()

    return (
        <main className='relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:px-12'>
            <div
                aria-hidden='true'
                className='absolute inset-0 bg-cover bg-center bg-no-repeat'
                style={{ backgroundImage: `url(${backgroundImageUrl})` }}
            />
            <div
                aria-hidden='true'
                className='absolute inset-0 bg-[linear-gradient(180deg,rgba(12,10,8,0.52)_0%,rgba(37,22,12,0.34)_40%,rgba(12,10,8,0.68)_100%)]'
            />
            <div
                aria-hidden='true'
                className='absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(223,198,140,0.26),transparent_34%),radial-gradient(circle_at_bottom,rgba(202,89,47,0.24),transparent_34%)]'
            />

            <div className='relative flex h-screen w-full items-center justify-center overflow-hidden p-8'>
                <div
                    className='relative h-[620px] w-full max-w-[900px] p-[3rem_3.5rem] text-center outline outline-1 outline-offset-[6px] outline-[#d4aa50] max-[520px]:p-[2rem_1.5rem]'
                    style={{
                        backgroundColor: '#f5e9c4',
                        backgroundImage:
                            'radial-gradient(ellipse at 18% 25%, rgba(180, 130, 55, 0.18) 0%, transparent 55%), radial-gradient(ellipse at 82% 75%, rgba(120, 75, 15, 0.12) 0%, transparent 50%), linear-gradient(160deg, rgba(255, 248, 225, 0.5) 0%, transparent 45%, rgba(195, 155, 70, 0.18) 100%)',
                        border: '2px solid #b8902a',
                        boxShadow:
                            '0 10px 50px rgba(0, 0, 0, 0.55), inset 0 0 40px rgba(175, 125, 35, 0.18)',
                        fontFamily:
                            "var(--font-fell), 'Palatino Linotype', Georgia, serif",
                    }}
                >
                    <p className='mb-6 text-[1.45rem] italic leading-[1.65] text-[#5a3010]'>
                        {proclamation[0]}
                    </p>
                    <p className='mb-5 text-[1.2rem] leading-[1.8] text-[#3a2008] indent-[2em]'>
                        {proclamation[1]}
                    </p>
                    <p className='mb-5 text-[1.2rem] leading-[1.8] text-[#3a2008] indent-[2em]'>
                        {proclamation[2]}
                    </p>
                    <p className='mb-5 mt-8 text-[1.45rem] italic tracking-[0.04em] text-[#7a3818]'>
                        The quest begins in
                    </p>
                    <HomeCountdown
                        initialNowIso={renderedAt.toISOString()}
                        targetIso={countdownTarget.toISOString()}
                    />
                    <Link
                        href='/sign-in'
                        className='mt-8 inline-block border-b border-[#b8902a] pb-[2px] text-[1.15rem] tracking-[0.08em] text-[#7a2a08] transition-[color,border-color] duration-200 hover:border-[#ca592f] hover:text-[#ca592f]'
                        style={{
                            fontFamily:
                                "var(--font-cinzel), 'Trajan Pro', 'Palatino Linotype', serif",
                        }}
                    >
                        Join the Quest
                    </Link>
                </div>
            </div>
        </main>
    )
}
