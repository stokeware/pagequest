import { cn } from '@/lib/utils'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from './card'
import { Label } from './label'

type FormCardProps = {
    title: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    className?: string
}

type FormFieldProps = {
    label: React.ReactNode
    htmlFor: string
    hint?: React.ReactNode
    children: React.ReactNode
    className?: string
}

type FormActionsProps = {
    note?: React.ReactNode
    children: React.ReactNode
    className?: string
}

function FormCard({ title, description, children, className }: FormCardProps) {
    return (
        <Card className={cn('surface-card', className)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
            </CardHeader>
            <CardContent className='ui-form-shell'>{children}</CardContent>
        </Card>
    )
}

function FormField({
    label,
    htmlFor,
    hint,
    children,
    className,
}: FormFieldProps) {
    return (
        <div className={cn('ui-form-field', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint ? <p className='ui-form-hint'>{hint}</p> : null}
        </div>
    )
}

function FormActions({ note, children, className }: FormActionsProps) {
    return (
        <div className={cn('ui-form-actions', className)}>
            {children}
            {note ? <p className='ui-form-note'>{note}</p> : null}
        </div>
    )
}

export { FormActions, FormCard, FormField }
