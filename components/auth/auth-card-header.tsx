import { Hotel } from "lucide-react";

interface AuthCardHeaderProps {
  title: string;
  description: string;
}

export function AuthCardHeader({ title, description }: AuthCardHeaderProps) {
  return (
    <div className="mb-6">
      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
        <Hotel className="size-5" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
