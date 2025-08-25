import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Edit, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to?: string;
  assignees: string[];
  status: "todo" | "in_progress" | "pending_approval" | "completed";
  due_date: string;
  file_path?: string;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

interface EditTaskDialogProps {
  task: Task;
  teamMembers: Profile[];
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  trigger?: React.ReactNode;
}

export function EditTaskDialog({ task, teamMembers, onSave, trigger }: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    task.assignees
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !dueDate) return;

    setIsLoading(true);
    try {
      const assignees = selectedAssignees;

      await onSave(task.id, {
        title: title.trim(),
        description: description.trim(),
        assignees,
        due_date: format(dueDate, "yyyy-MM-dd")
      });
      setOpen(false);
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const defaultTrigger = (
    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
      <Edit className="h-4 w-4" />
      <span className="sr-only">Edit task</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to the task here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Assign to Team Members</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
              {teamMembers.filter(m => m.role !== 'admin').map((member) => (
                <div key={member.user_id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`member-${member.user_id}`}
                    checked={selectedAssignees.includes(member.user_id)}
                    onChange={() => toggleAssignee(member.user_id)}
                    className="rounded border-border"
                  />
                  <label 
                    htmlFor={`member-${member.user_id}`}
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    {member.name}
                  </label>
                </div>
              ))}
            </div>
            {selectedAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedAssignees.map(userId => {
                  const member = teamMembers.find(m => m.user_id === userId);
                  return member ? (
                    <Badge key={userId} variant="secondary" className="text-xs">
                      {member.name}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto w-auto p-0 ml-1"
                        onClick={() => toggleAssignee(userId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!title.trim() || !dueDate || isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}