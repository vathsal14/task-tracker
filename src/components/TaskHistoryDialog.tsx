import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Calendar, User, CheckCircle, FileText, Clock, Check, UserPlus, FileEdit, UserMinus } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, Timestamp, DocumentData } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "pending_approval" | "completed";
  due_date: string;
  created_by: string;
  assignees: string[];
}

interface TaskHistoryEntry extends DocumentData {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: 'created' | 'assigned' | 'unassigned' | 'status_changed' | 'completed' | 'approved' | 'reopened' | 'edited';
  oldStatus?: string;
  newStatus?: string;
  note?: string;
  timestamp: Timestamp;
  metadata?: {
    assignedTo?: string;
    assignedToName?: string;
    unassignedFrom?: string;
    unassignedFromName?: string;
    [key: string]: any;
  };
}

interface TaskHistoryDialogProps {
  task: Task;
  trigger?: React.ReactNode;
}

export function TaskHistoryDialog({ task, trigger }: TaskHistoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const q = query(
      collection(db, 'taskHistory'),
      where('taskId', '==', task.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries: TaskHistoryEntry[] = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as TaskHistoryEntry);
      });
      setHistory(entries);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching task history:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [task.id, isOpen]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'assigned':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'unassigned':
        return <UserMinus className="h-4 w-4 text-red-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'approved':
        return <Check className="h-4 w-4 text-purple-500" />;
      case 'reopened':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'status_changed':
        return <CheckCircle className="h-4 w-4 text-yellow-500" />;
      case 'edited':
        return <FileEdit className="h-4 w-4 text-blue-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionText = (entry: TaskHistoryEntry) => {
    switch (entry.action) {
      case 'created':
        return 'created this task';
      case 'assigned': {
        const assignedTo = entry.metadata?.assignedToName || 'someone';
        return `assigned this task to ${assignedTo}`;
      }
      case 'unassigned': {
        const unassignedFrom = entry.metadata?.unassignedFromName || 'a user';
        return `unassigned ${unassignedFrom} from this task`;
      }
      case 'completed':
        return 'marked this task as complete';
      case 'approved':
        return 'approved this task';
      case 'reopened':
        return 'reopened this task';
      case 'status_changed':
        return `changed status from ${formatStatus(entry.oldStatus)} to ${formatStatus(entry.newStatus)}`;
      case 'edited':
        return 'edited this task';
      default:
        return 'updated this task';
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return '';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-8 px-2">
      <MessageSquare className="h-4 w-4 mr-1" />
      <span className="hidden sm:inline">History</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task History</DialogTitle>
          <DialogDescription>
            View the complete history of changes and activities for this task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium">{task.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Assigned to: {task.assignees.join(', ')}</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history available for this task.
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Activity</h3>
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="p-2 rounded-full bg-primary/10">
                        {getActionIcon(entry.action)}
                      </div>
                      <div className="w-px h-full bg-border mt-2"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{entry.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(entry.timestamp?.toDate() || new Date(), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        {getActionText(entry)}
                      </p>
                      {entry.note && (
                        <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
                          <p className="font-medium">Note:</p>
                          <p className="whitespace-pre-wrap">{entry.note}</p>
                        </div>
                      )}
                      {(entry.oldStatus || entry.newStatus) && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          {entry.oldStatus && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {formatStatus(entry.oldStatus)}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          {entry.newStatus && (
                            <Badge variant="outline" className="text-xs">
                              {formatStatus(entry.newStatus)}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}