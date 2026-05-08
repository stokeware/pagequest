export default function Home() {
    return (
        <main className='page-shell'>
            <section className='hero-panel'>
                <p className='eyebrow'>Seasonal reading competition</p>
                <h1>Page Quest is ready for implementation.</h1>
                <p className='hero-copy'>
                    The Next.js 16 foundation is in place with the App Router,
                    React 19, TypeScript, Tailwind CSS 4, and ESLint wired into
                    a local-first application scaffold.
                </p>
                <div className='status-row' aria-label='foundation status'>
                    <span>Next.js 16</span>
                    <span>React 19</span>
                    <span>Tailwind 4</span>
                    <span>TypeScript</span>
                </div>
            </section>
        </main>
    )
}
