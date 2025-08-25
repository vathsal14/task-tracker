import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TeamMemberProps {
  name?: string;
  role: "member" | "admin";
  activeTasks: number;
  completedTasks: number;
}

export function TeamMember({ name, role, activeTasks, completedTasks }: TeamMemberProps) {
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    return role === "admin" ? "bg-gradient-primary text-white" : "bg-secondary text-secondary-foreground";
  };

  return (
    <Card className="hover:shadow-soft transition-all duration-300 bg-card/50 backdrop-blur-sm border-border/50 h-full">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm sm:text-base">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-foreground capitalize truncate">
                {name || 'Unnamed User'}
              </h3>
              <Badge 
                className={`${getRoleColor(role)} text-xs sm:text-sm h-5 sm:h-6 whitespace-nowrap`}
              >
                {role === 'admin' ? 'Admin' : 'Member'}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:text-sm text-muted-foreground mt-1">
              <span className="flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-info mr-1.5"></span>
                <span className="font-medium text-foreground">{activeTasks}</span>
                <span className="ml-1">active</span>
              </span>
              <span className="flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-success mr-1.5"></span>
                <span className="font-medium text-foreground">{completedTasks}</span>
                <span className="ml-1">completed</span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}