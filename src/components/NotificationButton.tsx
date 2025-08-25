import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, writeBatch, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "../hooks/useAuth";

export interface Notification {
  id: string;
  type: "task_assigned" | "task_completed" | "task_approved" | "task_overdue";
  title: string;
  message: string;
  timestamp: any; // Firestore timestamp
  read: boolean;
  taskId?: string;
  userId: string;
}

interface NotificationButtonProps {
  isAdmin: boolean;
  userRole: string;
  userId: string;
}

export function NotificationButton({ isAdmin, userRole, userId }: NotificationButtonProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  // Fetch real-time notifications from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      orderBy('read')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList: Notification[] = [];
      snapshot.forEach((doc) => {
        notificationsList.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        } as Notification);
      });
      setNotifications(notificationsList);
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [user?.uid, userId]);

  // Listen for new tasks assigned to the current user
  useEffect(() => {
    if (!user?.uid) return;

    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(
      tasksRef,
      where('assignees', 'array-contains', user.uid),
      where('status', '==', 'todo')
    );

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const task = change.doc.data();
          // Check if this is a new assignment
          if (task.createdAt.toDate() > new Date(Date.now() - 60000)) { // Within the last minute
            // Add notification for new task assignment
            const newNotification = {
              type: 'task_assigned' as const,
              title: 'New Task Assigned',
              message: `You have been assigned '${task.title}'`,
              timestamp: new Date(),
              read: false,
              taskId: change.doc.id,
              userId: user.uid
            };
            
            // Add to Firestore
            const notificationsRef = collection(db, 'notifications');
            addDoc(notificationsRef, newNotification);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "task_assigned": return <AlertCircle className="h-4 w-4 text-info" />;
      case "task_completed": return <CheckCircle className="h-4 w-4 text-success" />;
      case "task_approved": return <CheckCircle className="h-4 w-4 text-success" />;
      case "task_overdue": return <Clock className="h-4 w-4 text-destructive" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    // Update in Firestore
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });

    // Update local state
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = async () => {
    // Update all unread notifications in Firestore
    const batch = writeBatch(db);
    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('userId', '==', userId), where('read', '==', false));
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const notificationRef = doc.ref;
      batch.update(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
    });

    await batch.commit();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only sm:not-sr-only sm:ml-1">
            {unreadCount > 0 ? `${unreadCount} notifications` : "Notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs h-auto p-1"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div key={notification.id}>
                <div 
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {notification.message}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                {index < notifications.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}