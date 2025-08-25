import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Download } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";

interface CompletedTask {
  id: string;
  title: string;
  description: string;
  assignees: string[];
  due_date: string;
  file_path?: string;
  approved_by?: string;
  approvedByName?: string;
  approved_at?: Timestamp;
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export function CompletedTasks() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { profile, isAdmin } = useAuth();

  useEffect(() => {
    if (profile) {
      fetchCompletedTasks();
      fetchProfiles();
    }
  }, [profile, isAdmin]);

  const fetchProfiles = async () => {
    try {
      const profilesCollection = collection(db, 'profiles');
      const snapshot = await getDocs(profilesCollection);
      const profilesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Profile));
      setProfiles(profilesData);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchCompletedTasks = async () => {
    if (!profile) return;
    
    try {
      setIsLoading(true);
      const tasksCollection = collection(db, 'tasks');
      let q;
      
      if (isAdmin) {
        q = query(tasksCollection, where('status', '==', 'completed'));
      } else {
        q = query(tasksCollection, 
          where('status', '==', 'completed'), 
          where('assignees', 'array-contains', profile.user_id)
        );
      }
      
      const snapshot = await getDocs(q);
      const tasksData: CompletedTask[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as any;
        const task: CompletedTask = {
          id: docSnap.id,
          title: data.title || 'No Title',
          description: data.description || '',
          assignees: Array.isArray(data.assignees) ? data.assignees : [],
          due_date: data.due_date || '',
          file_path: data.file_path,
          approved_by: data.approved_by,
          approved_at: data.approved_at,
          approvedByName: undefined
        };

        if (task.approved_by) {
          const approverDoc = await getDoc(doc(db, 'profiles', task.approved_by));
          if (approverDoc.exists()) {
            const approverData = approverDoc.data();
            task.approvedByName = approverData?.name;
          }
        }
        
        tasksData.push(task);
      }

      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching completed tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    try {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.target = "_blank";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const getUserInitials = (userId: any, allProfiles: Profile[]) => {
    try {
      if (typeof userId === 'string') {
        const userProfile = allProfiles.find(p => p.id === userId || p.user_id === userId);
        if (userProfile && userProfile.name) {
          return userProfile.name.substring(0, 2).toUpperCase();
        }
        return userId.substring(0, 2).toUpperCase();
      }
      if (typeof userId === 'object' && userId) {
        if (userId.name && typeof userId.name === 'string') {
          return userId.name.substring(0, 2).toUpperCase();
        }
        if (userId.email && typeof userId.email === 'string') {
          return userId.email.substring(0, 2).toUpperCase();
        }
      }
      return 'UN';
    } catch (error) {
      console.warn('Error getting user initials:', error);
      return 'UN';
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading completed tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Completed Tasks</h2>
        <Badge variant="secondary" className="bg-success/10 text-success">
          {tasks.length} Completed
        </Badge>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No completed tasks found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <Badge className="bg-success text-white">Completed</Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                 <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                   <div className="flex items-center space-x-2">
                     {task.assignees.length > 0 && (
                       <>
                         <div className="flex -space-x-2">
                           {/* We would need to fetch user profiles to display avatars properly */}
                           {/* For now, just show a placeholder for each assignee */}
                           {task.assignees.slice(0, 3).map((userId) => (
                             <Avatar key={userId} className="h-6 w-6 border-2 border-background">
                               <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                 {getUserInitials(userId, profiles)}
                               </AvatarFallback>
                             </Avatar>
                           ))}
                           {task.assignees.length > 3 && (
                             <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                               <span className="text-xs text-muted-foreground">+{task.assignees.length - 3}</span>
                             </div>
                           )}
                         </div>
                         <span>
                           {task.assignees.length === 1 
                             ? `1 assignee` 
                             : `${task.assignees.length} assignees`
                           }
                         </span>
                       </>
                     )}
                   </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {task.due_date}</span>
                  </div>
                </div>

                {task.approved_at && (
                  <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                    <p className="text-sm text-success font-medium">
                      Approved by {task.approvedByName} on {task.approved_at.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}

                {task.file_path && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Download className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Task file available</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(task.file_path!, `${task.title}-submission`)}
                    >
                      Download
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}