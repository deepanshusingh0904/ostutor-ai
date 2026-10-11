import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-primary/12 text-primary",
      secondary: "bg-secondary text-secondary-foreground",
      outline: "border border-border text-muted-foreground",
      success: "bg-success/15 text-success",
      warning: "bg-accent/20 text-accent-foreground dark:text-accent",
      destructive: "bg-destructive/15 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
