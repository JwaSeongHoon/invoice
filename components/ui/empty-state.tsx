import { Button } from "@/components/ui/button";

/**
 * EmptyState Props
 *
 * action은 ReactNode 또는 { label, onClick } 둘 다 지원
 */
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?:
    | React.ReactNode
    | {
        label: string;
        onClick: () => void;
      };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {Icon && <Icon className="text-muted-foreground mb-4 h-16 w-16" />}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mb-4">{description}</p>}
      {action && (
        <div className="mt-4">
          {typeof action === "object" && "label" in action ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
