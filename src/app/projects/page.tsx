
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from '@/lib/money';
import { useAppContext } from '@/context/AppContext';
import type { Project, ProjectStatus, Employee } from '@/types';
import { PlusCircle, Calendar, Flag, User, Users } from '@/components/icons';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/ui/combobox';
import { PageSkeleton } from '@/components/PageSkeleton';

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required."),
  description: z.string().optional(),
  client: z.string().optional(),
  status: z.enum(['not-started', 'in-progress', 'completed', 'on-hold', 'cancelled']),
  managerId: z.string().min(1, "A project manager is required."),
  teamIds: z.array(z.string()).optional(),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }).refine(range => range.to >= range.from, {
    message: "End date cannot be before start date.",
    path: ["to"],
  }),
  budget: z.coerce.number().min(0, "Budget must be non-negative."),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const statusVariant: { [key in ProjectStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
  'in-progress': 'default',
  'completed': 'outline',
  'not-started': 'secondary',
  'on-hold': 'secondary',
  'cancelled': 'destructive',
};

const statusDisplay: { [key in ProjectStatus]: string } = {
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'not-started': 'Not Started',
  'on-hold': 'On Hold',
  'cancelled': 'Cancelled',
};

export default function ProjectsPage() {
  usePageTitle('Projects');
    const { setProjects, projects, tasks, employees, employeesMap, addActivityLog, user: currentUser, currencySymbol, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [teamSearchTerm, setTeamSearchTerm] = useState('');

    const form = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema),
    });

    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const employeeOptions = useMemo(() => 
        employees.map(e => ({ label: e.name, value: e.id })), 
    [employees]);

    const filteredTeamMembers = useMemo(() => 
        employees.filter(e => 
            e.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
        ), 
    [employees, teamSearchTerm]);

    const handleOpenForm = () => {
        setTeamSearchTerm('');
        form.reset({
            name: '',
            description: '',
            client: '',
            status: 'not-started',
            managerId: '',
            teamIds: [],
            dateRange: { from: new Date(), to: new Date() },
            budget: 0,
        });
        setIsFormOpen(true);
    };

    const onSubmit = (data: ProjectFormData) => {
        const { dateRange, ...rest } = data;
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            ...rest,
            description: rest.description ?? '',
            teamIds: rest.teamIds || [],
            startDate: format(dateRange.from, 'yyyy-MM-dd'),
            endDate: format(dateRange.to, 'yyyy-MM-dd'),
        };
        setProjects(prev => [newProject, ...prev]);
        toast({ title: "Project Created" });
        addActivityLog('Project Created', `Created new project: ${data.name}`);
        
        setIsFormOpen(false);
    };

    if (!isDataLoaded) return <PageSkeleton cardCount={6} hasFilters />;

    return (
        <div className="flex flex-col h-full">
            <Header title="Projects" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex justify-end items-center mb-6">
                    {canManage && (
                        <Button size="sm" className="gap-1" onClick={handleOpenForm}>
                            <PlusCircle className="h-4 w-4" /> New Project
                        </Button>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map(project => {
                        const projectTasks = tasks.filter(t => t.projectId === project.id);
                        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
                        const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
                        const manager = employeesMap.get(project.managerId);
                        const teamMembers = project.teamIds.map(id => employeesMap.get(id)).filter(Boolean) as Employee[];

                        return (
                            <Card key={project.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg">
                                            <Link href={`/projects/${project.id}`} className="hover:underline">{project.name}</Link>
                                        </CardTitle>
                                        <Badge variant={statusVariant[project.status]}>{statusDisplay[project.status]}</Badge>
                                    </div>
                                    <CardDescription className="line-clamp-2 h-10">{project.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>Progress</span>
                                                <span className="font-semibold">{formatNumber(progress, 0, 0)}%</span>
                                            </div>
                                            <Progress value={progress} />
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>{format(parseISO(project.startDate), 'MMM d')} - {format(parseISO(project.endDate), 'MMM d, yyyy')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Flag className="h-4 w-4 text-muted-foreground" />
                                                <span>{projectTasks.length} Tasks</span>
                                            </div>
                                        </div>
                                         <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{manager?.name || 'N/A'}</span>
                                            </div>
                                             <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <div className="flex -space-x-2 overflow-hidden">
                                                {teamMembers.slice(0,3).map(member => (
                                                    <Avatar key={member.id} className="h-6 w-6 border-2 border-card">
                                                        <AvatarImage src={member.avatar} data-ai-hint="person user" />
                                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {teamMembers.length > 3 && <Avatar className="h-6 w-6 border-2 border-card"><AvatarFallback>+{teamMembers.length - 3}</AvatarFallback></Avatar>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="secondary" className="w-full">
                                        <Link href={`/projects/${project.id}`}>View Project</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </main>
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto px-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="client" render={({ field }) => (
                                <FormItem><FormLabel>Client / Department</FormLabel><FormControl><Input placeholder="e.g. Acme Corp or Marketing Dept."/></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="managerId" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2">
                                        <FormLabel>Project Manager</FormLabel>
                                        <Combobox
                                            options={employeeOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Select a manager..."
                                            searchPlaceholder="Search managers..."
                                            emptyText="No manager found."
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{Object.entries(statusDisplay).map(([key, value]) => <SelectItem key={key} value={key as ProjectStatus}>{value}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="dateRange" render={({ field }) => (
                                <FormItem className="flex flex-col pt-2"><FormLabel>Project Timeline</FormLabel><FormControl><DateRangePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="budget" render={({ field }) => (
                                <FormItem><FormLabel>Budget ({currencySymbol})</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="teamIds" render={() => (
                                <FormItem>
                                    <FormLabel>Team Members</FormLabel>
                                    <div className="rounded-md border p-4">
                                        <Input 
                                            placeholder="Search team members..."
                                            value={teamSearchTerm}
                                            onChange={(e) => setTeamSearchTerm(e.target.value)}
                                            className="mb-4"
                                        />
                                        <ScrollArea className="h-40">
                                        {filteredTeamMembers.map((item) => (
                                            <FormField key={item.id} control={form.control} name="teamIds"
                                                render={({ field }) => (
                                                    <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 my-2">
                                                        <FormControl><Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                            return checked
                                                                ? field.onChange([...(field.value || []), item.id])
                                                                : field.onChange(field.value?.filter((value) => value !== item.id))
                                                            }}
                                                        /></FormControl>
                                                        <FormLabel className="font-normal">{item.name}</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                        </ScrollArea>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <DialogFooter>
                                <Button type="submit">Create Project</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

