
"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-provider";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = 'admin' | 'teacher';

export function LoginForm() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Please select a role to continue.",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const email = selectedRole === 'admin' ? 'admin@classroom.ai' : 'teacher@classroom.ai';
      login(email);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message,
        });
    } finally {
        // The page will redirect on success, so we only need to handle the failure case.
        setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-2xl font-headline">Login</CardTitle>
            <CardDescription>Select a role to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
                <Select onValueChange={(value: Role) => setSelectedRole(value)} value={selectedRole}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="submit" className="w-full !mt-8" disabled={isSubmitting}>
                    {isSubmitting ? "Signing In..." : "Sign In"}
                </Button>
            </form>
        </CardContent>
    </Card>
  );
}
