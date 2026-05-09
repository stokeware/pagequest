import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonBaseClass = [
    'group/button inline-flex shrink-0 items-center justify-center',
    'rounded-[calc(var(--radius-lg)-2px)] border border-transparent bg-clip-padding text-sm',
    'font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,color,border-color] outline-none select-none',
    'shadow-[0_0.55rem_1.4rem_rgba(64,105,124,0.08)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'hover:-translate-y-0.5 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none',
    'disabled:opacity-50 aria-invalid:border-destructive',
    'aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    'dark:aria-invalid:border-destructive/50',
    'dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none',
    '[&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
].join(' ')

const buttonVariants = cva(buttonBaseClass, {
    variants: {
        variant: {
            default:
                'bg-[color:var(--button-primary-bg)] hover:bg-[color:var(--button-primary-bg-hover)] hover:shadow-[0_0.85rem_1.8rem_rgba(202,89,47,0.2)]',
            outline:
                'border-border bg-card/72 text-foreground hover:bg-muted hover:text-foreground hover:shadow-[0_0.8rem_1.8rem_rgba(64,105,124,0.12)] aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
            secondary:
                'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary)_84%,white)] hover:shadow-[0_0.75rem_1.6rem_rgba(218,165,24,0.18)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
            ghost: 'shadow-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
            destructive:
                'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:shadow-[0_0.8rem_1.8rem_rgba(156,63,43,0.14)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
            link: 'text-primary underline-offset-4 hover:underline',
        },
        size: {
            default:
                'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
            xs: [
                'h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs',
                'in-data-[slot=button-group]:rounded-lg',
                'has-data-[icon=inline-end]:pr-1.5',
                'has-data-[icon=inline-start]:pl-1.5',
                '[&_svg:not([class*=size-])]:size-3',
            ].join(' '),
            sm: [
                'h-7 gap-1 rounded-[min(var(--radius-md),12px)]',
                'px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg',
                'has-data-[icon=inline-end]:pr-1.5',
                'has-data-[icon=inline-start]:pl-1.5',
                '[&_svg:not([class*=size-])]:size-3.5',
            ].join(' '),
            lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
            icon: 'size-8',
            'icon-xs': [
                'size-6 rounded-[min(var(--radius-md),10px)]',
                'in-data-[slot=button-group]:rounded-lg',
                '[&_svg:not([class*=size-])]:size-3',
            ].join(' '),
            'icon-sm':
                'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
            'icon-lg': 'size-9',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
})

function Button({
    className,
    nativeButton,
    render,
    variant = 'default',
    size = 'default',
    style,
    ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    const resolvedStyle =
        variant === 'default'
            ? {
                  color: 'var(--button-primary-fg)',
                  ...style,
              }
            : style

    const resolvedNativeButton = render ? false : nativeButton

    return (
        <ButtonPrimitive
            data-slot='button'
            className={cn(buttonVariants({ variant, size, className }))}
            nativeButton={resolvedNativeButton}
            render={render}
            style={resolvedStyle}
            {...props}
        />
    )
}

export { Button, buttonVariants }
