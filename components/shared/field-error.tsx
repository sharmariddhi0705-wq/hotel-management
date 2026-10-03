interface FieldErrorProps {
  message?: string;
}

/** Inline validation message under a form control. */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
