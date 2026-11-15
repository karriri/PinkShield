import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXAM_TYPES, type Appointment, type ExamType } from "@/lib/appointments";

type Draft = Omit<Appointment, "id" | "completed" | "demo">;
const empty: Draft = { type: "УЗИ молочных желёз", date: "", time: "10:00", place: "", notes: "" };

export function AppointmentDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: Appointment | null; onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(empty);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setD(initial ? { type: initial.type, date: initial.date, time: initial.time, place: initial.place, notes: initial.notes } : empty); setErr(null); }
  }, [open, initial]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.date) return setErr("Выберите дату");
    if (!d.time) return setErr("Укажите время");
    onSave({ ...d, place: d.place.trim().slice(0, 120), notes: d.notes.trim().slice(0, 500) });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl text-primary">{initial ? "Изменить запись" : "Новое обследование"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Тип обследования</Label>
            <Select value={d.type} onValueChange={(v) => setD({ ...d, type: v as ExamType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="date">Дата</Label><Input id="date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="time">Время</Label><Input id="time" type="time" value={d.time} onChange={(e) => setD({ ...d, time: e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="place">Клиника или врач</Label><Input id="place" maxLength={120} placeholder="Например, маммологический центр" value={d.place} onChange={(e) => setD({ ...d, place: e.target.value })} /></div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Заметки</Label>
            <Textarea id="notes" maxLength={500} placeholder="Что взять с собой, о чём спросить" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
            <p className="text-xs text-muted-foreground">Заметки хранятся только в этом браузере. Не вносите сюда подробные медицинские данные.</p>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <DialogFooter><Button type="submit">Сохранить</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
