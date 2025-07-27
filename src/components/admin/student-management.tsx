
"use client";

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Trash2, UserPlus, Upload, User, Camera, Video, AlertCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Student } from '@/lib/students';
import { addStudent, deleteStudent, getStudents } from '@/lib/student-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function StudentManagement() {
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentStandard, setNewStudentStandard] = useState('');
    const [newStudentImageBase64, setNewStudentImageBase64] = useState<string | null>(null);
    const { toast } = useToast();
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

    // State for live photo capture
    const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const fetchStudents = async () => {
            setIsLoading(true);
            try {
                const studentList = await getStudents();
                setStudents(studentList);
            } catch (error: any) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Failed to load students',
                    description: error.message || 'Could not fetch student data from the database.'
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchStudents();
    }, [toast]);
    
    useEffect(() => {
        // This effect handles camera permission and stream management
        let isCancelled = false;
        
        const requestCameraPermission = async () => {
            if (isCameraDialogOpen) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (!isCancelled) {
                        setHasCameraPermission(true);
                        streamRef.current = stream;
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                        }
                    } else {
                        stream.getTracks().forEach(track => track.stop());
                    }
                } catch (error) {
                    console.error("Camera access denied:", error);
                    if (!isCancelled) {
                       setHasCameraPermission(false);
                    }
                }
            }
        };

        requestCameraPermission();

        return () => {
            isCancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [isCameraDialogOpen]);

    const processImage = (imageSrc: string) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                toast({ variant: 'destructive', title: 'Image Error', description: 'Could not process the image.' });
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setNewStudentImageBase64(dataUrl);
        };
        img.onerror = () => {
            toast({ variant: 'destructive', title: 'Image Error', description: 'Could not load the selected image file.' });
        };
        img.src = imageSrc;
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                processImage(event.target?.result as string);
            };
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                toast({
                    variant: 'destructive',
                    title: 'Image Error',
                    description: 'Could not read the selected file.'
                });
                resetImageState();
            };
            reader.readAsDataURL(file);
        } else {
            resetImageState();
        }
    };

    const handleCapture = () => {
        if (!videoRef.current) return;
        const canvas = canvasRef.current || document.createElement('canvas');
        if (!canvasRef.current) {
            // @ts-ignore
            canvasRef.current = canvas;
        }

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            toast({ variant: 'destructive', title: 'Capture Error', description: 'Could not get canvas context.' });
            return;
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const capturedImageSrc = canvas.toDataURL('image/jpeg');
        processImage(capturedImageSrc);
        setIsCameraDialogOpen(false); // Close dialog on capture
    };
    
    const resetImageState = () => {
        setNewStudentImageBase64(null);
        const fileInput = document.getElementById('student-image-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudentName || !newStudentStandard) {
            toast({
                variant: 'destructive',
                title: 'Missing fields',
                description: 'Please provide a name and standard.'
            });
            return;
        }

        startTransition(async () => {
            try {
                const newStudent = await addStudent({
                    name: newStudentName,
                    standard: newStudentStandard,
                    photoDataUri: newStudentImageBase64
                });

                setStudents(prevStudents => [...prevStudents, newStudent]);
                toast({
                    title: 'Student Added',
                    description: `${newStudent.name} has been added successfully.`
                });

                setNewStudentName('');
                setNewStudentStandard('');
                resetImageState();

            } catch (error: any) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Failed to add student',
                    description: error.message || 'There was an error saving the student.',
                });
            }
        });
    };

    const handleDeleteStudent = (studentId: string) => {
        startTransition(async () => {
            try {
                await deleteStudent(studentId);
                setStudents(prevStudents => prevStudents.filter(s => s.id !== studentId));
                toast({
                    title: 'Student Deleted',
                    description: 'The student has been removed from the list.'
                });
            } catch (error: any) {
                console.error(error);
                toast({
                    variant: 'destructive',
                    title: 'Failed to delete student',
                    description: error.message || 'There was an error deleting the student.',
                });
            } finally {
                setStudentToDelete(null);
            }
        });
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the student
                            record for <span className='font-bold'>{studentToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setStudentToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => studentToDelete && handleDeleteStudent(studentToDelete.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold font-headline">Student Management</h2>
                <Button asChild variant="outline">
                    <Link href="/admin/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><UserPlus/>Add New Student</CardTitle>
                            <CardDescription>Add a new student record to Firestore.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
                                <form onSubmit={handleAddStudent} className="space-y-4">
                                    <Input
                                        placeholder="Student Name"
                                        value={newStudentName}
                                        onChange={(e) => setNewStudentName(e.target.value)}
                                        disabled={isPending}
                                    />
                                    <Select onValueChange={setNewStudentStandard} value={newStudentStandard} disabled={isPending}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['1', '2', '3', '4', '5'].map(grade => (
                                                <SelectItem key={grade} value={grade}>{`Grade ${grade}`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {newStudentImageBase64 && (
                                        <div className='relative group'>
                                            <Avatar className="w-full h-auto rounded-md">
                                                <AvatarImage src={newStudentImageBase64} alt="Student preview" className='object-contain'/>
                                                <AvatarFallback>Preview</AvatarFallback>
                                            </Avatar>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={resetImageState}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                            <label htmlFor="student-image-upload" className="relative cursor-pointer">
                                                <Input
                                                    id="student-image-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    disabled={isPending || !!newStudentImageBase64}
                                                />
                                                <Button type="button" variant="outline" className="w-full pointer-events-none" disabled={isPending || !!newStudentImageBase64}>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Upload Photo
                                                </Button>
                                            </label>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="outline" disabled={isPending || !!newStudentImageBase64}>
                                                <Camera className="mr-2 h-4 w-4" />
                                                Take Photo
                                            </Button>
                                        </DialogTrigger>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isPending || !newStudentName || !newStudentStandard}>
                                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Add Student
                                    </Button>
                                </form>
                                <DialogContent className="sm:max-w-[625px]">
                                    <DialogHeader>
                                        <DialogTitle className='flex items-center gap-2'><Video/>Live Camera Capture</DialogTitle>
                                        <DialogDescription>
                                            Position the student in the frame and click capture.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-col items-center gap-4 py-4">
                                        <div className="w-full aspect-video bg-black rounded-md overflow-hidden relative">
                                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline/>
                                        </div>
                                        {hasCameraPermission === false && (
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Camera Access Denied</AlertTitle>
                                                <AlertDescription>
                                                    Please enable camera permissions in your browser settings to use this feature.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsCameraDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handleCapture} disabled={!hasCameraPermission}>
                                            <Camera className="mr-2 h-4 w-4" />
                                            Capture Photo
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><User/>Student Roster</CardTitle>
                            <CardDescription>List of students currently in Firestore.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Photo</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Standard</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Avatar><AvatarFallback><Loader2 className='animate-spin'/></AvatarFallback></Avatar></TableCell>
                                                <TableCell className='w-full'><span className='w-24 h-4 bg-muted animate-pulse rounded-md inline-block'></span></TableCell>
                                                <TableCell className='w-full'><span className='w-12 h-4 bg-muted animate-pulse rounded-md inline-block'></span></TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        ))
                                    ) : students.length > 0 ? (
                                        students.map(student => (
                                            <TableRow key={student.id}>
                                                <TableCell>
                                                    <Avatar>
                                                        <AvatarImage src={student.photoDataUri} alt={student.name} />
                                                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell>{student.name}</TableCell>
                                                <TableCell>{student.standard}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setStudentToDelete(student)}
                                                        disabled={isPending}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                                                No students found. Add one to get started, or configure your server credentials.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
