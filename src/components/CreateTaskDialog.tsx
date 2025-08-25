import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, getDocs } from "firebase/firestore";

interface CreateTaskDialogProps {
  onCreateTask: (task: {
    title: string;
    description: string;
    assignedTo: string[];
    dueDate: string;
  }) => void;
  trigger?: React.ReactNode;
}

interface TeamMember {
  user_id: string;
  name: string;
  role: string;
}

export function CreateTaskDialog({ onCreateTask, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: [] as string[],
    dueDate: "",
  });

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const profilesCollection = collection(db, 'profiles');
        const q = query(profilesCollection, where('role', '==', 'member'));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(doc => doc.data() as TeamMember);
        setTeamMembers(members);
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    if (open) {
      fetchTeamMembers();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.assignedTo.length > 0 && formData.dueDate) {
      onCreateTask(formData);
      setFormData({ title: "", description: "", assignedTo: [], dueDate: "" });
      setOpen(false);
    }
  };

  const handleAssigneeToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-primary hover:opacity-90 text-white shadow-glow">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="gradient-text">Create New Task</DialogTitle>
          {/* <DialogContent>
            Fill in the details below to create a new task.
          </DialogContent> */}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the task..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Assign To (Select multiple members)</Label>
            <ScrollArea className="h-32 w-full border rounded-md p-2">
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center space-x-2">
                    <Checkbox
                      id={member.user_id}
                      checked={formData.assignedTo.includes(member.user_id)}
                      onCheckedChange={() => handleAssigneeToggle(member.user_id)}
                    />
                    <Label htmlFor={member.user_id} className="text-sm font-normal">
                      {member.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {formData.assignedTo.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {formData.assignedTo.length} member(s) selected
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>
          
          <div className="flex space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary hover:opacity-90">
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}