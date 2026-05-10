'use client'

import { useEffect, useState } from 'react'

type HomeCountdownProps = {
    initialNowIso: string
    targetIso: string
}

type CountdownParts = {
    days: string
    hours: string
    minutes: string
    seconds: string
}

function getCountdownParts(
    targetTime: number,
    nowTime: number
): CountdownParts {
    const remainingMilliseconds = Math.max(targetTime - nowTime, 0)
    const totalSeconds = Math.floor(remainingMilliseconds / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return {
        days: String(days).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
    }
}

export function HomeCountdown({
    initialNowIso,
    targetIso,
}: HomeCountdownProps) {
    const targetTime = Date.parse(targetIso)
    const [countdown, setCountdown] = useState(() =>
        getCountdownParts(targetTime, Date.parse(initialNowIso))
    )

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCountdown(getCountdownParts(targetTime, Date.now()))
        }, 1000)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [targetTime])

    const segments = [
        {
            label: 'Days',
            value: countdown.days,
        },
        {
            label: 'Hours',
            value: countdown.hours,
        },
        {
            label: 'Minutes',
            value: countdown.minutes,
        },
        {
            label: 'Seconds',
            value: countdown.seconds,
        },
    ]

    return (
        <div
            className='flex justify-center gap-5 max-[520px]:gap-3'
            role='timer'
        >
            {segments.map((segment) => (
                <div
                    key={segment.label}
                    className='flex min-w-18 flex-col items-center max-[520px]:min-w-14'
                >
                    <p
                        className='text-[2.6rem] leading-none font-bold text-[#7a2a08] tabular-nums max-[520px]:text-[2rem]'
                        style={{
                            fontFamily:
                                "var(--font-cinzel), 'Trajan Pro', 'Palatino Linotype', serif",
                        }}
                    >
                        {segment.value}
                    </p>
                    <p className='mt-[0.35rem] text-[0.8rem] uppercase tracking-[0.14em] text-[#8a5030]'>
                        {segment.label}
                    </p>
                </div>
            ))}
        </div>
    )
}
