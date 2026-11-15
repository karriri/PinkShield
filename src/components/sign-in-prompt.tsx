import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignInPrompt({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-rose/50 bg-blush/50 p-10 text-center">
      <LockKeyhole className="mx-auto h-10 w-10 text-rose" />
      <p className="mt-3 font-display text-2xl text-primary">Войдите в аккаунт</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      <Button className="mt-4" asChild><Link to="/auth">Войти или зарегистрироваться</Link></Button>
    </div>
  );
}
