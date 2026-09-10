import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  isPending,
  title,
  description,
  confirmLabel = 'Delete',
  requireTypedConfirmation,
  typedConfirmationValue = 'DELETE',
}) {
  const [typed, setTyped] = useState('');
  const confirmDisabled = isPending || (requireTypedConfirmation && typed !== typedConfirmationValue);

  return (
    <AlertDialog open={open} onOpenChange={o => !o && onCancel()}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-muted-foreground text-xs">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireTypedConfirmation && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-typed-value" className="text-xs font-mono text-muted-foreground">
              Type {typedConfirmationValue} to confirm
            </Label>
            <Input
              id="confirm-typed-value"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              className="h-11 bg-secondary border-border font-mono"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="h-11 font-mono text-xs border-border bg-transparent hover:bg-secondary">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="h-11 font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
