import { useState, useEffect, useMemo } from 'react';
import logo from '/logo.png';
import { TaskCard } from "@/components/TaskCard";
import { TeamMember } from "@/components/TeamMember";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { CompletedTasks } from "@/components/CompletedTasks";
import { AdminApproval } from "@/components/AdminApproval";
import { AddTeamMemberDialog } from "@/components/AddTeamMemberDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Users, BarChart3, LogOut, CheckSquare, Clock, Plus } from "lucide-react";
import { NotificationButton } from "@/components/NotificationButton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { db } from "@/integrations/firebase/client";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
import { createTaskHistoryEntry } from "@/types/taskHistory";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Task {
  id: string;
  title: string;
  description: string;
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

const Index = () => {
  const { user, profile, isAdmin, isLoading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const fetchTasks = async () => {
    if (!profile) return;
    try {
      setTasksLoading(true);
      const tasksCollection = collection(db, 'tasks');
      let tasksQuery = query(tasksCollection);
      if (!isAdmin) {
        tasksQuery = query(tasksCollection, where('assignees', 'array-contains', profile.user_id));
      }
      const snapshot = await getDocs(tasksQuery);
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const profilesCollection = collection(db, 'profiles');
      const snapshot = await getDocs(profilesCollection);
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setTeamMembers(membersData);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (profile) {
      fetchTasks();
      fetchTeamMembers();
    }
  }, [profile, isAdmin]);

  if (isLoading || tasksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const handleStatusChange = async (taskId: string, newStatus: Task["status"], completionNote?: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const oldStatus = task.status;

      if (newStatus === 'completed' && !isAdmin) {
        newStatus = 'pending_approval';
      }

      if (newStatus === 'completed' && task.status === 'pending_approval' && !isAdmin) {
        toast({ title: "Permission Denied", description: "Only administrators can approve tasks.", variant: "destructive" });
        return;
      }

      const taskDocRef = doc(db, 'tasks', taskId);
      const updates: any = {
        status: newStatus,
        ...(newStatus === 'completed' && isAdmin && { approved_by: profile?.user_id }),
        ...(completionNote && { completion_note: completionNote })
      };

      // Update task status
      await updateDoc(taskDocRef, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      
      // Create history entry
      let action: 'status_changed' | 'completed' | 'approved' | 'reopened' = 'status_changed';
      let toastTitle = "Task Updated";
      let toastDescription = `Task status changed to ${newStatus.replace('_', ' ')}`;
      
      if (newStatus === 'pending_approval' && !isAdmin) {
        action = 'completed';
        toastTitle = "Submitted for Approval";
        toastDescription = "Your task has been submitted for admin approval.";
      } else if (newStatus === 'completed' && isAdmin && oldStatus === 'pending_approval') {
        action = 'approved';
        toastTitle = "Task Approved";
        toastDescription = "Task has been marked as completed.";
      } else if (newStatus === 'in_progress' && oldStatus === 'completed') {
        action = 'reopened';
        toastTitle = "Task Reopened";
        toastDescription = "Task has been reopened for work.";
      }

      // Record the history
      if (profile) {
        await createTaskHistoryEntry(
          db,
          taskId,
          profile.user_id,
          profile.name,
          action,
          {
            oldStatus,
            newStatus,
            note: completionNote || undefined, // Use undefined instead of empty string for Firestore
            metadata: {
              ...(action === 'approved' && { approvedBy: profile.user_id }),
              ...(completionNote && { completionNote })
            }
          }
        );
      }

      // Show toast
      toast({ title: toastTitle, description: toastDescription });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({ title: "Error", description: "An error occurred while updating the task status", variant: "destructive" });
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    if (!profile) return;
    
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, updates);
      
      // Check for assignment changes
      if (updates.assignees) {
        const oldAssignees = new Set(task.assignees);
        const newAssignees = new Set(updates.assignees);
        
        // Find newly assigned users
        const addedAssignees = updates.assignees.filter(
          (userId: string) => !oldAssignees.has(userId)
        );
        
        // Record assignment for each new assignee
        for (const userId of addedAssignees) {
          // Find team member name if available
          const member = teamMembers.find(m => m.user_id === userId);
          const memberName = member ? member.name : 'Unknown User';
          
          await createTaskHistoryEntry(
            db,
            taskId,
            profile.user_id,
            profile.name,
            'assigned',
            {
              metadata: {
                assignedTo: userId,
                assignedToName: memberName
              }
            }
          );
        }
        
        // Find removed assignees
        const removedAssignees = task.assignees.filter(
          userId => !newAssignees.has(userId)
        );
        
        // Record unassignment for each removed assignee
        for (const userId of removedAssignees) {
          // Find team member name if available
          const member = teamMembers.find(m => m.user_id === userId);
          const memberName = member ? member.name : 'Unknown User';
          
          await createTaskHistoryEntry(
            db,
            taskId,
            profile.user_id,
            profile.name,
            'unassigned',
            {
              metadata: {
                unassignedFrom: userId,
                unassignedFromName: memberName
              }
            }
          );
        }
      }
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      toast({ title: "Success", description: "Task updated successfully" });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  const handleCreateTask = async (taskData: { title: string; description: string; assignedTo: string[]; dueDate: string; }) => {
    if (!profile) return;
    try {
      const assignees = teamMembers
        .filter(member => taskData.assignedTo.includes(member.user_id))
        .map(member => member.user_id);

      console.log('Profile user ID:', profile.user_id);
      console.log('Auth user ID:', user?.uid);

      const taskRef = await addDoc(collection(db, 'tasks'), {
        title: taskData.title,
        description: taskData.description,
        assignees,
        due_date: taskData.dueDate,
        created_by: profile.user_id,
        status: 'todo',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      // Record task creation in history
      await createTaskHistoryEntry(
        db,
        taskRef.id,
        profile.user_id,
        profile.name,
        'created',
        {
          newStatus: 'todo',
          metadata: {
            title: taskData.title,
            description: taskData.description,
            assignees: assignees
          }
        }
      );

      // Record assignment for each assignee
      for (const userId of assignees) {
        // Find team member name if available
        const member = teamMembers.find(m => m.user_id === userId);
        const memberName = member ? member.name : 'Unknown User';
        
        await createTaskHistoryEntry(
          db,
          taskRef.id,
          profile.user_id,
          profile.name,
          'assigned',
          {
            newStatus: 'todo',
            metadata: {
              assignedTo: userId,
              assignedToName: memberName
            }
          }
        );
      }

      toast({ title: "Success", description: "Task created successfully" });
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getTaskStats = (memberUserId: string) => {
    const memberTasks = tasks.filter(task => task.assignees.includes(memberUserId));
    const activeTasks = memberTasks.filter(t => t.status !== 'completed' && t.status !== 'pending_approval').length;
    const completedTasks = memberTasks.filter(t => t.status === 'completed' || t.status === 'pending_approval').length;
    return { active: activeTasks, completed: completedTasks };
  };

  const filteredTasks = (status?: Task["status"]) => tasks.filter(task => task.status === status);

  const userTasks = tasks;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex-shrink-0 h-14 w-14 sm:h-20 sm:w-20">
                <img src={logo} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">Project Tracker</h1>
                <p className="text-muted-foreground text-xs sm:text-sm truncate">Website Development Team</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 w-full sm:w-auto border-t border-border/50 sm:border-0 pt-2 sm:pt-0">
              <Badge variant="outline" className="text-xs sm:text-sm text-primary border-primary/50 truncate max-w-[120px] sm:max-w-none">
                {profile.name.split(' ')[0]} • {isAdmin ? "Admin" : "Dev"}
              </Badge>
              <div className="flex items-center gap-1 sm:gap-2">
                {/* <NotificationButton isAdmin={isAdmin} userRole={profile.role} userId={user?.uid || ''} /> */}
                {isAdmin && (
                  <CreateTaskDialog 
                    onCreateTask={handleCreateTask}
                    trigger={
                      <Button size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
                        <Plus className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only sm:ml-1">Task</span>
                      </Button>
                    }
                  />
                )}
                <Button variant="outline" size="sm" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="tasks" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto pb-2 sm:pb-0 -mx-2 sm:mx-0">
            <TabsList className={`grid w-full min-w-max ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} gap-1`}>
              <TabsTrigger value="tasks" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Active</span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Done</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="approvals" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">Review</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="team" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Team</span>
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Stats</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="tasks" className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-2 sm:mx-0">
              <div className="flex space-x-2 px-2 sm:px-0">
                <Badge className="whitespace-nowrap text-xs sm:text-sm bg-muted text-muted-foreground">
                  📋 {filteredTasks("todo").length} To Do
                </Badge>
                <Badge className="whitespace-nowrap text-xs sm:text-sm bg-info text-white">
                  🚧 {filteredTasks("in_progress").length} In Progress
                </Badge>
                <Badge className="whitespace-nowrap text-xs sm:text-sm bg-warning text-white">
                  ⏳ {filteredTasks("pending_approval").length} Review
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {userTasks
                .filter(task => task.status !== 'completed')
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onTaskUpdate={handleTaskUpdate}
                    teamMembers={teamMembers}
                    isAdmin={isAdmin}
                  />
                ))}
            </div>
            {userTasks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {isAdmin ? "No active tasks to display." : "You have no active tasks assigned."}
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="completed">
            <CompletedTasks />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="approvals">
              <AdminApproval />
            </TabsContent>
          )}
          <TabsContent value="team" className="space-y-6">
            {isAdmin && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Team Members</h2>
                <AddTeamMemberDialog onMemberAdded={fetchTeamMembers} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {teamMembers.map((member) => {
                const stats = getTaskStats(member.user_id);
                return (
                  <TeamMember
                    key={member.user_id}
                    name={member.name}
                    role={member.role === 'admin' ? 'admin' : 'member'}
                    activeTasks={stats.active}
                    completedTasks={stats.completed}
                  />
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-gradient-primary rounded-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">Total Tasks</h3>
                <p className="text-3xl font-bold">{tasks.length}</p>
              </div>
              <div className="bg-gradient-secondary rounded-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">Completed</h3>
                <p className="text-3xl font-bold">{filteredTasks("completed").length}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-foreground">Team Members</h3>
                <p className="text-3xl font-bold text-primary">{teamMembers.length}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
