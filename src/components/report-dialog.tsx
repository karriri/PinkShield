import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_REASONS, useCommunityActions, type ReportReason } from "@/lib/community";

export function ReportDialog({ target, onOpenChange }: { target: { post_id?: string; comment_id?: string } | null; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<ReportReason>("bullying");
  const [note, setNote] = useState("");
  const act = useCommunityActions();
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl text-primary">Пожаловаться</DialogTitle></DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)} className="grid gap-2">
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm"><RadioGroupItem value={k} /> {REPORT_REASONS[k]}</label>
          ))}
        </RadioGroup>
        <div className="grid gap-2">
          <Label htmlFor="rnote">Пояснение (необязательно)</Label>
          <Textarea id="rnote" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-muted-foreground">Автор не узнает, кто отправил жалобу. Её увидят только модераторы.</p>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!target) return;
            try { await act.report(target, reason, note); toast.success("Жалоба отправлена модераторам"); setNote(""); onOpenChange(false); }
            catch { toast.error("Не удалось отправить жалобу"); }
          }}>Отправить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
