import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXAM_TYPES, type Appointment, type Draft } from "@/lib/appointments";

const empty: Draft = { type: "УЗИ молочных желёз", starts_on: "", start_time: "10:00", place: "", notes: "", remind_day_before: true, remind_same_day: true };

export function AppointmentDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: Appointment | null; onSave: (d: Draft) => Promise<void> | void;
}) {
  const [d, setD] = useState<Draft>(empty);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setD(initial ? { type: initial.type, starts_on: initial.starts_on, start_time: initial.start_time.slice(0, 5), place: initial.place, notes: initial.notes, remind_day_before: initial.remind_day_before, remind_same_day: initial.remind_same_day } : empty);
      setErr(null);
    }
  }, [open, initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.starts_on) return setErr("Выберите дату");
    if (!d.start_time) return setErr("Укажите время");
    setBusy(true);
    try { await onSave(d); onOpenChange(false); } catch { setErr("Не удалось сохранить. Попробуйте ещё раз."); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl text-primary">{initial ? "Изменить запись" : "Новое обследование"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Тип обследования</Label>
            <Select value={d.type} onValueChange={(v) => setD({ ...d, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="date">Дата</Label><Input id="date" type="date" value={d.starts_on} onChange={(e) => setD({ ...d, starts_on: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="time">Время</Label><Input id="time" type="time" value={d.start_time} onChange={(e) => setD({ ...d, start_time: e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="place">Клиника или врач</Label><Input id="place" maxLength={120} placeholder="Например, маммологический центр" value={d.place} onChange={(e) => setD({ ...d, place: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Заметки</Label>
            <Textarea id="notes" maxLength={500} placeholder="Что взять с собой, о чём спросить" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
            <p className="text-xs text-muted-foreground">Не вносите сюда подробные медицинские данные.</p>
          </div>
          <fieldset className="grid gap-2 rounded-2xl bg-blush/60 p-3 text-sm">
            <legend className="sr-only">Напоминания</legend>
            <p className="font-semibold text-primary">Напоминания в приложении</p>
            <label className="flex items-center gap-2"><Checkbox checked={d.remind_day_before} onCheckedChange={(v) => setD({ ...d, remind_day_before: v === true })} /> За день, в 09:00</label>
            <label className="flex items-center gap-2"><Checkbox checked={d.remind_same_day} onCheckedChange={(v) => setD({ ...d, remind_same_day: v === true })} /> В день визита, утром</label>
          </fieldset>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter><Button type="submit" disabled={busy}>Сохранить</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
