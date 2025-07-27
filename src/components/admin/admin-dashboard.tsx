
"use client";

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { analyzeStudentEngagement, AnalyzeStudentEngagementOutput } from '@/ai/flows/analyze-student-engagement';
import { logStudentPerformance, LogStudentPerformanceInput } from '@/ai/flows/log-student-performance';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, AlertCircle, Smile, Frown, Meh, User, VideoOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Student } from '@/lib/students';
import { getStudents } from '@/lib/student-actions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getTodaysTimetable } from '@/lib/timetable-actions';
import { TimetableEntry } from '@/lib/timetable';
import { useAuth } from '@/context/auth-provider';

type EngagementReading = {
    [studentId: string]: number[]; // Array of scores
};

const engagementToScore = {
    attentive: 100,
    confused: 50,
    distracted: 0,
};


const EngagementIcon = ({ level }: { level: string }) => {
    switch (level.toLowerCase()) {
        case 'attentive':
            return <Smile className="h-5 w-5 text-green-500" />;
        case 'confused':
            return <Meh className="h-5 w-5 text-yellow-500" />;
        case 'distracted':
            return <Frown className="h-5 w-5 text-red-500" />;
        default:
            return <Meh className="h-5 w-5 text-gray-500" />;
    }
};

export function AdminDashboard() {
  const [isPending, startTransition] = useTransition();
  const [analysis, setAnalysis] = useState<AnalyzeStudentEngagementOutput | null>(null);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [studentsWithPhotos, setStudentsWithPhotos] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  
  const [isAutoAnalyzeOn, setIsAutoAnalyzeOn] = useState(false);
  const [isFeedOn, setIsFeedOn] = useState(false);
  
  const [todaysTimetable, setTodaysTimetable] = useState<TimetableEntry[]>([]);
  const [liveClass, setLiveClass] = useState<TimetableEntry | null>(null);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(true);

  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { login } = useAuth();

  const handleSwitchToTeacherView = () => {
    // We can't just link, we need to change auth state.
    // The simplest way is to just call the login function for the teacher.
    login('teacher@classroom.ai');
  };

  const handleAnalyze = () => {
    if (!videoRef.current || !videoRef.current.srcObject || isPending) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const photoDataUri = canvas.toDataURL('image/jpeg');

    startTransition(async () => {
      try {
        const result = await analyzeStudentEngagement({ 
            photoDataUri,
            students: studentsWithPhotos.map(s => ({
                id: s.id,
                name: s.name,
                photoDataUri: s.photoDataUri,
            })),
        });
        setAnalysis(result);
        
        logStudentPerformance({ 
            studentEngagements: result.studentEngagements,
            subject: liveClass?.subject,
        }).then(logResult => {
             if (logResult.success) {
                 toast({ title: 'Performance Logged', description: logResult.message, duration: 3000 });
             } else {
                 toast({ variant: 'default', title: 'Performance Log Info', description: logResult.message, duration: 3000 });
             }
        });

      } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Analysis Failed",
            description: "Could not analyze the classroom snapshot. Please try again.",
        });
        setAnalysis(null);
      }
    });
  };

   useEffect(() => {
    const fetchTodaysSchedule = async () => {
      try {
        setIsLoadingTimetable(true);
        const schedule = await getTodaysTimetable();
        setTodaysTimetable(schedule);
      } catch (e) {
        console.error("Failed to fetch today's timetable", e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: "Could not fetch today's schedule.",
        });
      } finally {
        setIsLoadingTimetable(false);
      }
    };

    fetchTodaysSchedule();
  }, [toast]);
  
  useEffect(() => {
    const checkLiveClass = () => {
      if (todaysTimetable.length === 0) {
        setLiveClass(null);
        return;
      }

      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const currentClass = todaysTimetable.find(c => {
        return c.startTime <= currentTime && c.endTime > currentTime;
      });
      
      setLiveClass(currentClass || null);
    };

    // Check immediately and then every 10 seconds
    checkLiveClass();
    timeCheckIntervalRef.current = setInterval(checkLiveClass, 10000);

    return () => {
      if (timeCheckIntervalRef.current) {
        clearInterval(timeCheckIntervalRef.current);
      }
    };
  }, [todaysTimetable]);

  useEffect(() => {
    if (liveClass) {
        setIsFeedOn(true);
        setIsAutoAnalyzeOn(true);
        if (!isLoadingTimetable) {
            toast({
                title: "Class is Live!",
                description: `Subject: ${liveClass.subject}. Live feed and auto-analysis are ON.`
            });
        }
    }
  }, [liveClass, isLoadingTimetable, toast]);

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!isFeedOn) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
        }
        setHasCameraPermission(false);
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        streamRef.current = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        setIsFeedOn(false); 
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this feature.',
        });
      }
    };
    
    getCameraPermission();

    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    }
  }, [isFeedOn, toast]);

  useEffect(() => {
    const loadStudentData = async () => {
        setIsLoadingStudents(true);
        try {
            const studentsFromDb = await getStudents();
            const studentsWithPhotos = studentsFromDb.filter(s => s.photoDataUri);

            if (studentsWithPhotos.length === 0 && studentsFromDb.length > 0) {
                 toast({
                    variant: 'default',
                    title: 'No Student Photos',
                    description: 'For best results, add photos to your students in the management page.',
                })
            }
            setStudentsWithPhotos(studentsWithPhotos);
        } catch (error) {
            console.error("Failed to load student data:", error);
            toast({
                variant: 'destructive',
                title: 'Error Loading Student Data',
                description: 'Could not load student data from the database.'
            })
        } finally {
            setIsLoadingStudents(false);
        }
    }

    loadStudentData();
  }, [toast]);
  
  useEffect(() => {
      if (isAutoAnalyzeOn && hasCameraPermission && !isLoadingStudents) {
          handleAnalyze(); // Run once immediately
          analysisIntervalRef.current = setInterval(handleAnalyze, 15000);
      } else {
          if (analysisIntervalRef.current) {
              clearInterval(analysisIntervalRef.current);
          }
      }

      return () => {
          if (analysisIntervalRef.current) {
              clearInterval(analysisIntervalRef.current);
          }
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAnalyzeOn, hasCameraPermission, isLoadingStudents]);

  const allLoading = isLoadingTimetable || isLoadingStudents;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className='flex justify-between items-center mb-6'>
        <h2 className="text-3xl font-bold font-headline">Admin Dashboard</h2>
        <Button onClick={handleSwitchToTeacherView}>Go to Teacher View</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card className="overflow-hidden shadow-lg">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className='flex items-center gap-2'>
                           {isFeedOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                           <CardTitle className='font-headline'>Live Classroom Feed</CardTitle>
                        </div>
                        {isFeedOn && (
                            <span className={`text-xs font-mono flex items-center gap-1.5 ${liveClass ? 'text-green-500' : 'text-red-500'}`}>
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveClass ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${liveClass ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                </span>
                                {liveClass ? `${liveClass.subject.toUpperCase()} - LIVE` : 'LIVE'}
                            </span>
                        )}
                    </div>
                    <CardDescription>
                        {allLoading ? "Checking timetable..." : liveClass ? `Currently in ${liveClass.subject} class. Live analysis is active.` : "No class is currently live according to the timetable."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                       <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                       {allLoading && (
                             <div className='absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center text-muted-foreground'>
                                <Loader2 className="mx-auto h-12 w-12 animate-spin" />
                                <p className="mt-4 text-sm">Checking schedule and loading data...</p>
                            </div>
                        )}
                       {!isFeedOn && !allLoading && (
                            <div className='absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center text-muted-foreground'>
                                <VideoOff className="mx-auto h-12 w-12" />
                                <p className="mt-4 text-sm">Video feed is off</p>
                            </div>
                        )}
                    </div>
                    {!hasCameraPermission && isFeedOn && (
                        <Alert variant="destructive" className='mt-4'>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Camera Access Required</AlertTitle>
                            <AlertDescription>
                                Please allow camera access in your browser to use this feature.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <Switch 
                                    id="feed-toggle" 
                                    checked={isFeedOn} 
                                    onCheckedChange={setIsFeedOn}
                                    disabled={allLoading || !!liveClass}
                                />
                                <Label htmlFor="feed-toggle" className={allLoading || !!liveClass ? 'text-muted-foreground' : ''}>Live Feed</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch 
                                    id="auto-analyze-toggle" 
                                    checked={isAutoAnalyzeOn} 
                                    onCheckedChange={setIsAutoAnalyzeOn}
                                    disabled={allLoading || !isFeedOn || !hasCameraPermission || !!liveClass}
                                />
                                <Label htmlFor="auto-analyze-toggle" className={allLoading || !isFeedOn || !!liveClass ? 'text-muted-foreground' : ''}>Auto-Analyze (15s)</Label>
                            </div>
                        </div>

                        {!isAutoAnalyzeOn && (
                            <Button onClick={handleAnalyze} disabled={isPending || !isFeedOn || !hasCameraPermission || allLoading}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : allLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Initializing...
                                    </>
                                ) : "Analyze Student Engagement"}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline">Engagement Analysis</CardTitle>
              <CardDescription>Results from the latest snapshot analysis.</CardDescription>
            </CardHeader>
            <CardContent>
                {isPending && !analysis && (
                    <div className='grid grid-cols-2 gap-4'>
                        {[...Array(4)].map((_, i) => (
                             <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2 animate-pulse">
                                <div className="h-16 w-16 bg-muted rounded-full mx-auto flex items-center justify-center"><User className="h-8 w-8 text-muted-foreground"/></div>
                                <div className="h-4 w-20 bg-muted rounded-md mx-auto"></div>
                                <div className="h-4 w-16 bg-muted rounded-md mx-auto"></div>
                            </div>
                        ))}
                    </div>
                )}
                {analysis && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-4">
                        {analysis.studentEngagements.map((student, index) => (
                             <Card key={student.studentId || index} className="text-center p-4">
                                <div className="flex items-center justify-center mb-2">
                                    <EngagementIcon level={student.engagementLevel} />
                                </div>
                                <p className="text-sm font-semibold capitalize">{student.studentName || `Student ${index + 1}`}</p>
                                <p className="text-xs text-muted-foreground capitalize">{student.engagementLevel}</p>
                            </Card>
                        ))}
                    </div>
                )}
                {!isPending && !analysis && (
                     <div className="text-center py-10 text-muted-foreground">
                        <AlertCircle className="mx-auto h-12 w-12" />
                        <p className="mt-4 text-sm">{allLoading ? "Initializing..." : "Turn on the live feed and click analyze to see student engagement levels."}</p>
                    </div>
                )}
                 {isPending && analysis && (
                    <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">Analyzing in background...</p>
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

    