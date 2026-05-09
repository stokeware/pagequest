import Link from 'next/link'

import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    FormActions,
    FormCard,
    FormField,
    Input,
    StatCard,
    TableCard,
} from '@/components/ui'
import type { AdminReportsViewModel } from '@/lib/admin-reports'

type AdminReportsNotice = {
    description: string
    title: string
    tone: 'error' | 'success'
}

type AdminReportsScreenProps = {
    notice: AdminReportsNotice | null
    updateReadingEntryAction: (formData: FormData) => Promise<void>
    viewModel: AdminReportsViewModel
}

const selectClassName = [
    'h-10 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

const textareaClassName = [
    'min-h-28 w-full rounded-[calc(var(--radius-lg)-2px)] border border-input bg-card/72 px-3 py-2',
    'text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] outline-none transition-[border-color,background-color,box-shadow]',
    'focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
].join(' ')

function AdminReportsScreen({
    notice,
    updateReadingEntryAction,
    viewModel,
}: AdminReportsScreenProps) {
    const selectedQuestId =
        viewModel.questOptions.find((option) => option.isSelected)?.id ?? null
    const exportHref = selectedQuestId
        ? `/admin/reports/export?questId=${encodeURIComponent(selectedQuestId)}`
        : '/admin/reports/export'

    if (!viewModel.hasQuest) {
        return (
            <EmptyState
                eyebrow='Reports'
                title='Quest reports will appear here once a quest is ready.'
                description={viewModel.questDescription}
                action={
                    <div className='auth-inline-actions'>
                        <Button render={<Link href='/admin/quests' />}>
                            Open quests
                        </Button>
                        <Button
                            variant='outline'
                            render={<Link href='/admin/invitations' />}
                        >
                            Review invitations
                        </Button>
                    </div>
                }
            />
        )
    }

    return (
        <div className='auth-page-stack'>
            {notice ? (
                <Card
                    className={
                        notice.tone === 'error'
                            ? 'surface-warm'
                            : 'surface-card'
                    }
                >
                    <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.description}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            <Card className='surface-card'>
                <CardHeader>
                    <CardTitle>{viewModel.questName}</CardTitle>
                    <CardDescription>
                        {viewModel.questStatusLabel}.{' '}
                        {viewModel.questWindowLabel}.{' '}
                        {viewModel.questDescription}
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='auth-inline-actions'>
                        <Button render={<Link href='/admin/quests' />}>
                            Open quests
                        </Button>
                        <Button
                            variant='outline'
                            render={<Link href='/admin/invitations' />}
                        >
                            Review invitations
                        </Button>
                        <Button
                            variant='secondary'
                            render={<Link href={exportHref} />}
                        >
                            Export CSV
                        </Button>
                    </div>

                    {viewModel.questOptions.length > 1 ? (
                        <div className='flex flex-wrap gap-2'>
                            {viewModel.questOptions.map((option) => (
                                <Button
                                    key={option.id}
                                    size='sm'
                                    variant={
                                        option.isSelected
                                            ? 'secondary'
                                            : 'outline'
                                    }
                                    render={
                                        <Link
                                            href={option.href}
                                            aria-current={
                                                option.isSelected
                                                    ? 'page'
                                                    : undefined
                                            }
                                        />
                                    }
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <div className='auth-card-grid'>
                {viewModel.summaryCards.map((card) => (
                    <StatCard
                        key={card.label}
                        eyebrow='Quest report'
                        title={card.label}
                        value={card.value}
                        description={card.detail}
                    />
                ))}
            </div>

            <TableCard
                title='Participation by activity type'
                description='Each row summarizes how readers are contributing to the quest totals.'
                columns={['Activity', 'Entries', 'Total logged', 'Share']}
                ariaLabel='Quest activity breakdown'
                rows={viewModel.entryBreakdownRows.map((row) => ({
                    cells: [
                        row.label,
                        row.entriesLabel,
                        row.totalLabel,
                        row.shareLabel,
                    ],
                    key: row.key,
                }))}
            />

            {viewModel.participantRows.length > 0 ? (
                <TableCard
                    title='Participant snapshot'
                    description='Tie-aware ranking mirrors the competitor leaderboard while keeping raw totals visible for admin review.'
                    columns={['Rank', 'Reader', 'Activity', 'Totals', 'Points']}
                    ariaLabel='Quest participant summary'
                    rows={viewModel.participantRows.map((row) => ({
                        cells: [
                            row.rankLabel,
                            row.readerLabel,
                            row.activityLabel,
                            row.totalsLabel,
                            row.pointsLabel,
                        ],
                        key: row.key,
                    }))}
                />
            ) : (
                <Card className='surface-warm'>
                    <CardHeader>
                        <CardTitle>Participant snapshot</CardTitle>
                        <CardDescription>
                            No readers are linked to this quest yet.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <TableCard
                title='Recent audit trail'
                description='Sensitive admin changes, invitation actions, and challenge reviews are recorded here for the selected quest.'
                columns={['When', 'Action', 'Actor', 'Detail']}
                ariaLabel='Quest audit trail'
                rows={
                    viewModel.auditRows.length > 0
                        ? viewModel.auditRows.map((row) => ({
                              cells: [
                                  row.timestampLabel,
                                  row.actionLabel,
                                  row.actorLabel,
                                  row.detailLabel,
                              ],
                              key: row.key,
                          }))
                        : [
                              {
                                  cells: [
                                      'No recent events',
                                      'Audit trail empty',
                                      'System',
                                      'Sensitive quest activity will appear here once admins begin making changes.',
                                  ],
                                  key: 'audit-empty',
                              },
                          ]
                }
            />

            <div className='grid gap-6 xl:grid-cols-[1.1fr_0.9fr]'>
                <Card className='surface-card'>
                    <CardHeader>
                        <CardTitle>Recent entries to moderate</CardTitle>
                        <CardDescription>
                            Select a standard reading entry to correct its date,
                            type, quantity, or optional metadata.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {viewModel.moderationRows.length > 0 ? (
                            viewModel.moderationRows.map((entry) => {
                                const cardClassName = entry.isSelected
                                    ? 'border-primary/50 bg-background'
                                    : 'border-border/70 bg-background/80'

                                if (!entry.editHref) {
                                    return (
                                        <div
                                            key={entry.key}
                                            className={`rounded-3xl border px-4 py-4 ${cardClassName}`}
                                        >
                                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                                <div className='space-y-1'>
                                                    <p className='font-medium'>
                                                        {entry.summaryLabel}
                                                    </p>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {entry.readerLabel} •{' '}
                                                        {entry.activityLabel}
                                                    </p>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {entry.typeLabel}
                                                    </p>
                                                </div>
                                                <span className='rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'>
                                                    Review queue only
                                                </span>
                                            </div>
                                            {entry.noteLabel ? (
                                                <p className='mt-3 text-sm text-muted-foreground'>
                                                    {entry.noteLabel}
                                                </p>
                                            ) : null}
                                        </div>
                                    )
                                }

                                return (
                                    <Link
                                        key={entry.key}
                                        href={entry.editHref}
                                        className={`block rounded-3xl border px-4 py-4 transition-colors hover:border-primary/40 hover:bg-background ${cardClassName}`}
                                    >
                                        <div className='flex flex-wrap items-start justify-between gap-3'>
                                            <div className='space-y-1'>
                                                <p className='font-medium'>
                                                    {entry.summaryLabel}
                                                </p>
                                                <p className='text-sm text-muted-foreground'>
                                                    {entry.readerLabel} •{' '}
                                                    {entry.activityLabel}
                                                </p>
                                                <p className='text-sm text-muted-foreground'>
                                                    {entry.typeLabel}
                                                </p>
                                            </div>
                                            {entry.isSelected ? (
                                                <span className='rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground'>
                                                    Selected
                                                </span>
                                            ) : (
                                                <span className='text-sm font-medium text-primary'>
                                                    Edit entry
                                                </span>
                                            )}
                                        </div>
                                        {entry.noteLabel ? (
                                            <p className='mt-3 text-sm text-muted-foreground'>
                                                {entry.noteLabel}
                                            </p>
                                        ) : null}
                                    </Link>
                                )
                            })
                        ) : (
                            <p className='text-sm text-muted-foreground'>
                                No entries are available for moderation in this
                                quest yet.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {viewModel.selectedModerationEntry ? (
                    viewModel.selectedModerationEntry.isEditable ? (
                        <FormCard
                            title='Correct selected entry'
                            description={`${viewModel.selectedModerationEntry.participantLabel} • ${viewModel.selectedModerationEntry.summaryLabel}`}
                        >
                            <form
                                action={updateReadingEntryAction}
                                className='ui-form-shell'
                            >
                                <input
                                    type='hidden'
                                    name='questId'
                                    value={
                                        viewModel.questOptions.find(
                                            (option) => option.isSelected
                                        )?.id ?? ''
                                    }
                                />
                                <input
                                    type='hidden'
                                    name='readingEntryId'
                                    value={
                                        viewModel.selectedModerationEntry
                                            .entryId
                                    }
                                />

                                <div className='rounded-[calc(var(--radius-lg)-2px)] border border-border/70 bg-muted/55 px-4 py-3 text-sm text-muted-foreground'>
                                    {
                                        viewModel.selectedModerationEntry
                                            .statusMessage
                                    }
                                </div>

                                <div className='grid gap-4 md:grid-cols-2'>
                                    <FormField
                                        label='Activity date'
                                        htmlFor='moderation-activityDate'
                                        hint='Keep the correction inside the quest window.'
                                    >
                                        <Input
                                            id='moderation-activityDate'
                                            name='activityDate'
                                            type='date'
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .activityDate
                                            }
                                        />
                                    </FormField>

                                    <FormField
                                        label='Entry type'
                                        htmlFor='moderation-type'
                                        hint='Challenge completions stay in the dedicated review tools.'
                                    >
                                        <select
                                            id='moderation-type'
                                            name='type'
                                            className={selectClassName}
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .type
                                            }
                                        >
                                            <option value='BOOK_COMPLETION'>
                                                Book completion
                                            </option>
                                            <option value='PAGES_READ'>
                                                Pages read
                                            </option>
                                            <option value='AUDIOBOOK_MINUTES'>
                                                Audiobook minutes
                                            </option>
                                        </select>
                                    </FormField>
                                </div>

                                <div className='grid gap-4 md:grid-cols-2'>
                                    <FormField
                                        label='Quantity'
                                        htmlFor='moderation-value'
                                        hint='Use whole numbers for books, pages, and minutes.'
                                    >
                                        <Input
                                            id='moderation-value'
                                            name='value'
                                            type='number'
                                            min='1'
                                            step='1'
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .value
                                            }
                                        />
                                    </FormField>

                                    <FormField
                                        label='Book title'
                                        htmlFor='moderation-bookTitle'
                                        hint='Optional metadata helps history views stay readable.'
                                    >
                                        <Input
                                            id='moderation-bookTitle'
                                            name='bookTitle'
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .bookTitle
                                            }
                                            placeholder='The Giver'
                                        />
                                    </FormField>
                                </div>

                                <div className='grid gap-4 md:grid-cols-2'>
                                    <FormField
                                        label='Author'
                                        htmlFor='moderation-bookAuthor'
                                        hint='Optional when the title already makes the correction clear.'
                                    >
                                        <Input
                                            id='moderation-bookAuthor'
                                            name='bookAuthor'
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .bookAuthor
                                            }
                                            placeholder='Lois Lowry'
                                        />
                                    </FormField>

                                    <FormField
                                        label='Notes'
                                        htmlFor='moderation-notes'
                                        hint='Keep the original participant context when possible.'
                                    >
                                        <textarea
                                            id='moderation-notes'
                                            name='notes'
                                            defaultValue={
                                                viewModel
                                                    .selectedModerationEntry
                                                    .notes
                                            }
                                            className={textareaClassName}
                                            placeholder='Corrected after confirming the original reading log.'
                                        />
                                    </FormField>
                                </div>

                                <FormActions
                                    note={
                                        viewModel.selectedModerationEntry
                                            .helperText
                                    }
                                >
                                    <Button nativeButton type='submit'>
                                        Save correction
                                    </Button>
                                </FormActions>
                            </form>
                        </FormCard>
                    ) : (
                        <Card className='surface-warm'>
                            <CardHeader>
                                <CardTitle>Selected entry</CardTitle>
                                <CardDescription>
                                    {
                                        viewModel.selectedModerationEntry
                                            .summaryLabel
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-3 text-sm text-muted-foreground'>
                                <p>
                                    {
                                        viewModel.selectedModerationEntry
                                            .statusMessage
                                    }
                                </p>
                                <p>
                                    {
                                        viewModel.selectedModerationEntry
                                            .helperText
                                    }
                                </p>
                            </CardContent>
                        </Card>
                    )
                ) : (
                    <Card className='surface-warm'>
                        <CardHeader>
                            <CardTitle>Entry correction</CardTitle>
                            <CardDescription>
                                Select a recent entry to start moderating it.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </div>
    )
}

export { AdminReportsScreen, type AdminReportsNotice }
