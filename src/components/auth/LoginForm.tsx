import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { auth } from "@/integrations/firebase/client";
import { signInWithEmailAndPassword, updateProfile } from "firebase/auth";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Sign in the user
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      // Get the user's profile from Firestore
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore();
      const profileRef = doc(db, 'profiles', userCredential.user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        // Update the user's display name if it's different
        if (profileData.name && userCredential.user.displayName !== profileData.name) {
          await updateProfile(userCredential.user, {
            displayName: profileData.name
          });
        }
      }
      
      // Force refresh the ID token to get the latest claims
      await userCredential.user.getIdToken(true);
      
      // Force a reload of the user to get the latest data
      await userCredential.user.reload();
      
      toast({
        title: `Welcome back, ${userCredential.user.displayName || 'User'}!`,
        description: "You have successfully logged in.",
      });
      
      // Add a small delay to ensure token is refreshed before proceeding
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access the task tracker
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your email" 
                      type="email" 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your password" 
                      type="password" 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>
        
        <div className="mt-6 text-sm text-muted-foreground">
          {/* <p className="text-center font-medium mb-2">Team Login Credentials:</p>
          <div className="space-y-1 text-xs">
            <div>• Vathsal: vathsal@gmail.com</div>
            <div>• Nagasri: nagasri@gmail.com</div>
            <div>• Sravan: sravan@gmail.com</div>
            <div>• Lavanya: lavanya@gmail.com</div>
            <div>• Bhavana (Admin): bhavana@gmail.com</div>
            <div className="mt-2">Password for all: 12345678</div>
          </div> */}
        </div>
      </CardContent>
    </Card>
  );
}