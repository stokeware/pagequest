import { cn } from '@/lib/utils'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from './card'

type TableRow = {
    key: string
    cells: React.ReactNode[]
}

type TableCardProps = {
    title: React.ReactNode
    description?: React.ReactNode
    columns: string[]
    rows: TableRow[]
    ariaLabel: string
    className?: string
}

function TableCard({
    title,
    description,
    columns,
    rows,
    ariaLabel,
    className,
}: TableCardProps) {
    return (
        <Card className={cn('surface-card', className)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
            </CardHeader>
            <CardContent>
                <div
                    className='ui-table-shell'
                    role='table'
                    aria-label={ariaLabel}
                >
                    <div
                        className='ui-table-row ui-table-row-head'
                        role='row'
                        style={{
                            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                        }}
                    >
                        {columns.map((column) => (
                            <div key={column} role='columnheader'>
                                {column}
                            </div>
                        ))}
                    </div>

                    {rows.map((row) => (
                        <div
                            key={row.key}
                            className='ui-table-row'
                            role='row'
                            style={{
                                gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                            }}
                        >
                            {row.cells.map((cell, index) => (
                                <div
                                    key={`${row.key}-${index + 1}`}
                                    role='cell'
                                >
                                    {cell}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

export { TableCard }
