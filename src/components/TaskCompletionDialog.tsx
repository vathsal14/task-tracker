import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";

interface TaskCompletionDialogProps {
  taskId: string;
  taskTitle: string;
  onComplete: (taskId: string, completionNote: string) => Promise<void>;
  trigger?: React.ReactNode;
}

export function TaskCompletionDialog({ taskId, taskTitle, onComplete, trigger }: TaskCompletionDialogProps) {
  const [open, setOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    if (!completionNote.trim()) return;

    setIsLoading(true);
    try {
      await onComplete(taskId, completionNote.trim());
      setOpen(false);
      setCompletionNote("");
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <Button
      size="sm"
      className="flex-1 h-9 sm:h-9 text-xs sm:text-sm bg-gradient-primary hover:opacity-90"
    >
      Mark as Complete
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Complete Task
          </DialogTitle>
          <DialogDescription>
            Fill out the completion summary for the task "{taskTitle}" before submitting for review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="font-medium text-foreground">{taskTitle}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="completion-note">Completion Summary</Label>
            <Textarea
              id="completion-note"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Please describe what you've completed, any challenges faced, or additional notes for the admin..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This summary will be visible to the admin for review and approval.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={!completionNote.trim() || isLoading}
            className="bg-gradient-primary hover:opacity-90"
          >
            {isLoading ? "Submitting..." : "Submit for Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}