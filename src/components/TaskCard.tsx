import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { User, Calendar, CheckCircle, Download, Edit, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "./EditTaskDialog";
import { TaskCompletionDialog } from "./TaskCompletionDialog";
import { TaskHistoryDialog } from "./TaskHistoryDialog";

interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to?: string; // Legacy field, kept for compatibility
  assignees: string[];
  status: "todo" | "in_progress" | "pending_approval" | "completed";
  due_date: string;
  file_path?: string;
  created_by: string;
  approved_by?: string;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task["status"], completionNote?: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  teamMembers: Profile[];
  isAdmin?: boolean;
}

const statusColors = {
  todo: "bg-muted text-muted-foreground",
  "in_progress": "bg-info text-white",
  "pending_approval": "bg-warning text-white",
  completed: "bg-success text-white"
};

const statusLabels = {
  todo: "To Do",
  "in_progress": "In Progress",
  "pending_approval": "Pending Approval",
  completed: "Completed"
};

export function TaskCard({ task, onStatusChange, onTaskUpdate, teamMembers, isAdmin }: TaskCardProps) {
  const { toast } = useToast();

  const handleTaskCompletion = async (taskId: string, completionNote: string) => {
    await onStatusChange(taskId, "completed", completionNote);
  };

  const downloadFile = (fileUrl: string) => {
    try {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.target = "_blank";
      a.download = fileUrl.split('/').pop()?.split('?')[0] || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "File download started successfully.",
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const renderAssignees = () => {
    if (task.assignees.length === 0) return null;
    
    // Find team member details for each assignee ID
    const assigneeDetails = task.assignees.map(userId => {
      const member = teamMembers.find(m => m.user_id === userId);
      return member || { user_id: userId, name: 'Unknown User' };
    });
    
    if (assigneeDetails.length === 1) {
      const assignee = assigneeDetails[0];
      return (
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
            <AvatarFallback className="text-[10px] sm:text-xs bg-primary/10 text-primary">
              {getInitials(assignee.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-none">
            {assignee.name}
          </span>
        </div>
      );
    }
    
    // Multiple assignees
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1.5 sm:-space-x-2">
          {assigneeDetails.slice(0, 3).map((assignee) => (
            <Avatar 
              key={assignee.user_id} 
              className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-background"
              title={assignee.name}
            >
              <AvatarFallback className="text-[10px] sm:text-xs bg-primary/10 text-primary">
                {getInitials(assignee.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {assigneeDetails.length > 3 && (
            <div 
              className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center"
              title={`${assigneeDetails.length - 3} more`}
            >
              <span className="text-[10px] sm:text-xs text-muted-foreground">+{assigneeDetails.length - 3}</span>
            </div>
          )}
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
          {assigneeDetails.length} {assigneeDetails.length === 1 ? 'assignee' : 'assignees'}
        </span>
      </div>
    );
  };

  return (
    <Card className="group hover:shadow-glow transition-all duration-300 animate-scale-in bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                {task.title}
              </h3>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <EditTaskDialog 
                    task={task} 
                    teamMembers={teamMembers}
                    onSave={onTaskUpdate}
                  />
                  <TaskHistoryDialog task={task} />
                </div>
              )}
            </div>
            {task.description && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={statusColors[task.status] + " whitespace-nowrap text-xs sm:text-sm"}>
              {statusLabels[task.status]}
            </Badge>
            {!isAdmin && (
              <TaskHistoryDialog 
                task={task}
                trigger={
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs sm:text-sm text-muted-foreground">
          {renderAssignees()}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Due: {task.due_date}</span>
          </div>
          {task.file_path && (
            <div className="flex items-center gap-1.5 text-success">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">File attached</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadFile(task.file_path!)}
                className="h-6 w-6 p-0 text-success hover:text-success/80 ml-0.5"
                title="Download file"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only">Download file</span>
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0 px-4 sm:px-6 pb-4">
        {(isAdmin || task.status !== "completed") && (
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            {task.status === "todo" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(task.id, "in_progress")}
                className="flex-1 h-9 sm:h-9 text-xs sm:text-sm"
              >
                Start Task
              </Button>
            )}
            
            {task.status === "in_progress" && (
              <TaskCompletionDialog
                taskId={task.id}
                taskTitle={task.title}
                onComplete={handleTaskCompletion}
              />
            )}

            {task.status === "pending_approval" && (
              <div className="w-full text-center">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  {isAdmin 
                    ? "Waiting for your approval" 
                    : "Submitted for admin approval"}
                </p>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatusChange(task.id, "in_progress")}
                      className="flex-1 h-9 sm:h-9 text-xs sm:text-sm"
                    >
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onStatusChange(task.id, "completed")}
                      className="flex-1 h-9 sm:h-9 text-xs sm:text-sm bg-gradient-primary hover:opacity-90"
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isAdmin && task.status === "completed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(task.id, "in_progress")}
                className="flex-1 h-9 sm:h-9 text-xs sm:text-sm"
              >
                Reopen Task
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}