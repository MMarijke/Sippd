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
import { Loader2 } from 'lucide-react';

export default function DeleteConfirmDialog({ open, onCancel, onConfirm, isPending, canName }) {
  return (
    <AlertDialog open={open} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-foreground">Remove from Collection?</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-muted-foreground text-xs">
            <span className="text-foreground font-semibold">{canName}</span> will be removed from your vault. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="font-mono text-xs border-border bg-transparent hover:bg-secondary"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}