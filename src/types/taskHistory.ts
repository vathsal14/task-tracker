import { Timestamp, collection, addDoc, serverTimestamp, Firestore } from "firebase/firestore";

export type TaskHistoryAction = 
  | 'created'
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'completed'
  | 'approved'
  | 'reopened'
  | 'edited';

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: TaskHistoryAction;
  oldStatus?: string;
  newStatus?: string;
  note?: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export const createTaskHistoryEntry = async (
  db: Firestore,
  taskId: string,
  userId: string,
  userName: string,
  action: TaskHistoryAction,
  options: {
    oldStatus?: string;
    newStatus?: string;
    note?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> => {
  const historyRef = collection(db, 'taskHistory');
  await addDoc(historyRef, {
    taskId,
    userId,
    userName,
    action,
    ...(options.oldStatus && { oldStatus: options.oldStatus }),
    ...(options.newStatus && { newStatus: options.newStatus }),
    ...(options.note && { note: options.note }),
    timestamp: serverTimestamp(),
    metadata: options.metadata || {}
  });
};
