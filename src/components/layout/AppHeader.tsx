import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  userName?: string | null;
  userEmail?: string | null;
  roles?: string[];
};

export function AppHeader({ title, userName, userEmail, roles }: Props) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-none">
            {userName ?? userEmail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(roles ?? []).join(" · ") || "Empleado"}
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
