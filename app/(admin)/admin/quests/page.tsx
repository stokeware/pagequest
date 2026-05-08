import { ConfirmationDialog, EmptyState } from '@/components/ui'

const questStages = [
    'Draft quests',
    'Scheduled quests',
    'Active quest',
    'Archived quests',
]

export default function AdminQuestsPage() {
    return (
        <EmptyState
            eyebrow='Quest management'
            title='Quest CRUD will replace this placeholder shell.'
            description='Phase 5 will turn this space into list, edit, publish, archive, and duplicate flows across the full quest lifecycle.'
            action={
                <div className='pill-row'>
                    {questStages.map((stage) => (
                        <span key={stage} className='pill'>
                            {stage}
                        </span>
                    ))}
                    <ConfirmationDialog
                        triggerLabel='Preview archive confirmation'
                        title='Archive Spring Story Sprint?'
                        description='This reusable confirmation dialog will later guard sensitive quest lifecycle actions.'
                        confirmLabel='Archive quest'
                        tone='destructive'
                        note='Historical entries stay intact, but the quest would leave the active competition surface.'
                    />
                </div>
            }
        />
    )
}
