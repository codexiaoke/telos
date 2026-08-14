import { cva, type VariantProps } from 'class-variance-authority'
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'window-no-drag inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-[11px] font-medium outline-none transition-[color,background-color,box-shadow,transform] duration-150 data-[focus-visible]:ring-2 data-[focus-visible]:ring-black/15 data-[pressed]:scale-[0.97] data-[disabled]:pointer-events-none data-[disabled]:opacity-35',
  {
    variants: {
      variant: {
        ghost: 'text-[var(--telos-text-secondary)] hover:bg-black/[0.05] data-[pressed]:bg-black/[0.075]',
        soft: 'border border-black/[0.06] bg-white/75 text-[var(--telos-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.025)] hover:bg-white',
        primary: 'bg-[var(--telos-ink)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:bg-black'
      },
      size: {
        default: 'h-9 px-3',
        icon: 'size-8'
      }
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends Omit<AriaButtonProps, 'className'>,
    VariantProps<typeof buttonVariants> {
  className?: string
}

export function Button({ className, size, variant, ...props }: ButtonProps) {
  return <AriaButton className={cn(buttonVariants({ size, variant }), className)} {...props} />
}
