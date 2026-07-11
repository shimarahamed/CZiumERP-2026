
'use client'

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Candidate, CandidateStatus, InterviewFeedback } from '@/types';
import { MoreHorizontal, PlusCircle, Mail, Briefcase, LayoutGrid, List, Star } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { format, formatDistanceToNow } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const RECRUITMENT_COLUMNS: ColumnDef[] = [
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'position', label: 'Position Applied For' },
  { id: 'status', label: 'Status' },
  { id: 'applicationDate', label: 'Application Date' },
];

const candidateSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required.").regex(/^[+\d][\d\s\-().]{6,19}$/, "Enter a valid phone number."),
  jobRequisitionId: z.string().min(1, "Please select a job position."),
});

type CandidateFormData = z.infer<typeof candidateSchema>;

const statusColumns: { status: CandidateStatus; title: string; color: string }[] = [
    { status: 'applied', title: 'Applied', color: 'bg-blue-500' },
    { status: 'interviewing', title: 'Interviewing', color: 'bg-purple-500' },
    { status: 'offer', title: 'Offer', color: 'bg-yellow-500' },
    { status: 'hired', title: 'Hired', color: 'bg-green-500' },
    { status: 'rejected', title: 'Rejected', color: 'bg-red-500' },
];

const nextStatusMap: Partial<Record<CandidateStatus, CandidateStatus[]>> = {
    applied: ['interviewing', 'rejected'],
    interviewing: ['offer', 'rejected'],
    offer: ['hired', 'rejected'],
};

const statusVariant: { [key in CandidateStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    applied: 'default',
    interviewing: 'secondary',
    offer: 'outline',
    hired: 'default',
    rejected: 'destructive',
};

const RatingStars = ({ rating, className }: { rating: number, className?: string }) => (
    <div className={cn("flex items-center gap-0.5", className)}>
        {[...Array(5)].map((_, i) => (
            <Star key={`star-${i}`} className={cn("h-4 w-4", i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')} />
        ))}
    </div>
);

export default function RecruitmentPage() {
    const { candidates, setCandidates, addActivityLog, user, users, jobRequisitions } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [candidateToEdit, setCandidateToEdit] = useState<Candidate | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const columnVisibility = useColumnVisibility('recruitment-candidates', RECRUITMENT_COLUMNS);
    const { isVisible } = columnVisibility;

    // State for the simple feedback form
    const [newFeedbackNotes, setNewFeedbackNotes] = useState('');
    const [newFeedbackRating, setNewFeedbackRating] = useState(3);

    const form = useForm<CandidateFormData>({
        resolver: zodResolver(candidateSchema),
        defaultValues: { name: '', email: '', phone: '', jobRequisitionId: '' }
    });
    
    const openJobRequisitions = useMemo(() => 
        jobRequisitions.filter(job => job.status === 'open'),
    [jobRequisitions]);

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const filteredCandidates = useMemo(() => {
        if (!searchTerm) return candidates;
        const lowercasedFilter = searchTerm.toLowerCase();
        return candidates.filter(candidate =>
            candidate.name.toLowerCase().includes(lowercasedFilter) ||
            candidate.email.toLowerCase().includes(lowercasedFilter) ||
            candidate.positionAppliedFor.toLowerCase().includes(lowercasedFilter)
        );
    }, [candidates, searchTerm]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full"><Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage recruitment.</p></CardContent></Card></main>
            </div>
        );
    }
    
    const handleOpenForm = (candidate: Candidate | null) => {
        setCandidateToEdit(candidate);
        setNewFeedbackNotes('');
        setNewFeedbackRating(3);
        if (candidate) {
            form.reset({
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
                jobRequisitionId: candidate.jobRequisitionId,
            });
        } else {
            form.reset({ name: '', email: '', phone: '', jobRequisitionId: '' });
        }
        setIsFormOpen(true);
    };

    const onSubmit = (data: CandidateFormData) => {
        const job = openJobRequisitions.find(j => j.id === data.jobRequisitionId);
        if (!job) {
            toast({ variant: 'destructive', title: 'Invalid Job', description: 'The selected job position is not valid.'});
            return;
        }

        if (candidateToEdit) {
            setCandidates(prev => prev.map(c => c.id === candidateToEdit.id ? { 
                ...c, 
                ...data,
                positionAppliedFor: job.title,
            } : c));
            addActivityLog('Candidate Updated', `Updated details for ${data.name}`);
            toast({ title: 'Candidate Updated' });
        } else {
            const newCandidate: Candidate = {
                id: `cand-${Date.now()}`,
                avatar: `https://placehold.co/40x40`,
                status: 'applied',
                applicationDate: new Date().toISOString(),
                name: data.name,
                email: data.email,
                phone: data.phone,
                jobRequisitionId: data.jobRequisitionId,
                positionAppliedFor: job.title,
                feedback: [],
            };
            setCandidates(prev => [newCandidate, ...prev]);
            addActivityLog('Candidate Added', `Added new candidate: ${data.name} for ${job.title}`);
            toast({ title: 'Candidate Added' });
        }
        
        setIsFormOpen(false);
        setCandidateToEdit(null);
    };

    const handleAddFeedback = () => {
        if (!newFeedbackNotes.trim() || !candidateToEdit || !user) return;

        const newFeedback: InterviewFeedback = {
            id: `fb-${Date.now()}`,
            interviewerId: user.id,
            interviewerName: user.name,
            date: new Date().toISOString(),
            notes: newFeedbackNotes,
            rating: newFeedbackRating,
        };
        
        const updatedCandidates = candidates.map(c => {
            if (c.id === candidateToEdit.id) {
                return { ...c, feedback: [...(c.feedback || []), newFeedback] };
            }
            return c;
        });

        setCandidates(updatedCandidates);
        setCandidateToEdit(prev => prev ? { ...prev, feedback: [...(prev.feedback || []), newFeedback] } : null);
        
        toast({ title: "Feedback Added" });
        setNewFeedbackNotes('');
        setNewFeedbackRating(3);
    };

    const handleStatusChange = (candidateId: string, newStatus: CandidateStatus) => {
        setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: newStatus } : c));
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
            addActivityLog('Candidate Status Updated', `${candidate.name}'s status changed to ${newStatus}`);
            toast({ title: 'Status Updated' });
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Recruitment Pipeline" />
            <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources/jobs' }, { label: 'Candidate Pipeline' }]} />
            <main className="flex-1 flex flex-col p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Candidates</h1>
                        <p className="text-muted-foreground">Track applicants through your hiring process.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Input
                            placeholder="Search candidates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                        />
                        <div className="flex items-center gap-2">
                            <Button variant={view === 'kanban' ? 'default' : 'outline'} size="icon" onClick={() => setView('kanban')}><LayoutGrid className="h-4 w-4" /></Button>
                            <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
                        </div>
                        {view === 'list' && <ColumnVisibilityMenu visibility={columnVisibility} />}
                        <Button size="sm" className="gap-1" onClick={() => handleOpenForm(null)}>
                            <PlusCircle className="h-4 w-4" /> Add Candidate
                        </Button>
                    </div>
                </div>
                
                {view === 'kanban' ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 overflow-x-auto">
                        {statusColumns.map(column => (
                            <div key={column.status} className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 px-2">
                                    <span className={cn("h-2 w-2 rounded-full", column.color)} />
                                    <h2 className="font-semibold text-lg">{column.title}</h2>
                                    <span className="text-sm text-muted-foreground">({filteredCandidates.filter(c => c.status === column.status).length})</span>
                                </div>
                                <div className="flex-1 flex flex-col gap-4 bg-muted/50 p-4 rounded-lg min-h-[200px]">
                                    {filteredCandidates.filter(c => c.status === column.status).map(candidate => (
                                        <Card key={candidate.id} onClick={() => handleOpenForm(candidate)} className="cursor-pointer hover:bg-card hover:shadow-md transition-shadow">
                                            <CardHeader className="p-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={candidate.avatar} alt={candidate.name} data-ai-hint="person user"/>
                                                            <AvatarFallback>{candidate.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <CardTitle className="text-base">{candidate.name}</CardTitle>
                                                            <CardDescription className="text-xs">Applied: {new Date(candidate.applicationDate).toLocaleDateString()}</CardDescription>
                                                        </div>
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {nextStatusMap[candidate.status]?.map(nextStatus => (
                                                                <DropdownMenuItem key={nextStatus} onClick={() => handleStatusChange(candidate.id, nextStatus)}>
                                                                    Move to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            {(nextStatusMap[candidate.status]?.length ?? 0) > 0 && <DropdownMenuSeparator />}
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(candidate.id, 'rejected')}>Reject</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0 space-y-2 text-sm">
                                                <p className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" /> {candidate.positionAppliedFor}</p>
                                                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {candidate.email}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Candidate</TableHead>
                                        {isVisible('position') && <TableHead>Position Applied For</TableHead>}
                                        {isVisible('status') && <TableHead>Status</TableHead>}
                                        {isVisible('applicationDate') && <TableHead>Application Date</TableHead>}
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCandidates.map(candidate => (
                                        <TableRow key={candidate.id} onClick={() => handleOpenForm(candidate)} className="cursor-pointer">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={candidate.avatar} alt={candidate.name} data-ai-hint="person user"/>
                                                        <AvatarFallback>{candidate.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div>{candidate.name}</div>
                                                        <div className="text-xs text-muted-foreground">{candidate.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            {isVisible('position') && <TableCell>{candidate.positionAppliedFor}</TableCell>}
                                            {isVisible('status') && <TableCell><Badge variant={statusVariant[candidate.status]} className="capitalize">{candidate.status.replace('-', ' ')}</Badge></TableCell>}
                                            {isVisible('applicationDate') && <TableCell>{new Date(candidate.applicationDate).toLocaleDateString()}</TableCell>}
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {nextStatusMap[candidate.status]?.map(nextStatus => (
                                                            <DropdownMenuItem key={nextStatus} onClick={() => handleStatusChange(candidate.id, nextStatus)}>
                                                                Move to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {(nextStatusMap[candidate.status]?.length ?? 0) > 0 && <DropdownMenuSeparator />}
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(candidate.id, 'rejected')}>Reject</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

            </main>

             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{candidateToEdit ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="details" className="pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                           <TabsTrigger value="details">Candidate Details</TabsTrigger>
                           <TabsTrigger value="feedback" disabled={!candidateToEdit}>Interview Feedback</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="phone" render={({ field }) => (
                                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                     <FormField control={form.control} name="jobRequisitionId" render={({ field }) => (
                                        <FormItem><FormLabel>Position Applied For</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a job" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {openJobRequisitions.map(job => <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        <FormMessage /></FormItem>
                                    )}/>
                                    <DialogFooter><Button type="submit">{candidateToEdit ? 'Save Changes' : 'Add Candidate'}</Button></DialogFooter>
                                </form>
                            </Form>
                        </TabsContent>
                        <TabsContent value="feedback">
                           <div className="py-4 space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold">Existing Feedback</h3>
                                    <div className="mt-4 space-y-4 max-h-48 overflow-y-auto">
                                        {candidateToEdit?.feedback?.length ? candidateToEdit.feedback.map(fb => (
                                            <div key={fb.id} className="flex gap-3">
                                                <Avatar>
                                                    <AvatarImage src={users.find(u=>u.id === fb.interviewerId)?.avatar} data-ai-hint="person user"/>
                                                    <AvatarFallback>{fb.interviewerName.slice(0,2)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center">
                                                        <p className="font-semibold">{fb.interviewerName}</p>
                                                        <RatingStars rating={fb.rating} />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(fb.date), { addSuffix: true })}</p>
                                                    <p className="text-sm mt-1">{fb.notes}</p>
                                                </div>
                                            </div>
                                        )) : <p className="text-sm text-muted-foreground">No feedback yet.</p>}
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Add New Feedback</h3>
                                    <div className="space-y-2">
                                        <Label>Rating: {newFeedbackRating} / 5</Label>
                                        <Slider
                                            min={1} max={5} step={1}
                                            value={[newFeedbackRating]}
                                            onValueChange={(values) => setNewFeedbackRating(values[0])}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="feedback-notes">Notes</Label>
                                        <Textarea 
                                            id="feedback-notes"
                                            value={newFeedbackNotes}
                                            onChange={(e) => setNewFeedbackNotes(e.target.value)}
                                            placeholder={`Feedback from ${user?.name}...`}
                                        />
                                    </div>
                                    <Button type="button" onClick={handleAddFeedback}>Add Feedback</Button>
                                </div>
                           </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}

