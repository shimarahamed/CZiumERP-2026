"use client";

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Project, Task, TaskStatus, TaskPriority, ProjectStatus, Employee } from '@/types';
import { sendDepartmentEmail } from '@/lib/email';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, User, Users, Calendar, Flag, DollarSign, MoreHorizontal, Briefcase as BriefcaseIcon } from '@/components/icons';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Task as GanttTask } from 'gantt-task-react';
import { Combobox } from '@/components/ui/combobox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const GanttChart = dynamic(() => import('@/components/GanttChart'), {
  ssr: false,
  loading: () => <p className="text-center p-4">Loading Chart...</p>,
});


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
  }),
  budget: z.coerce.number().min(0, "Budget must be non-negative."),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  description: z.string().optional(),
  assigneeId: z.string().min(1, "Please assign this task to someone."),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }),
  priority: z.enum(['Low', 'Medium', 'High']),
  cost: z.coerce.number().min(0).optional(),
}).refine(data => data.dateRange.to >= data.dateRange.from, {
    message: "End date cannot be before start date.",
    path: ["dateRange"],
});

type TaskFormData = z.infer<typeof taskSchema>;

const statusDisplay: { [key in TaskStatus | ProjectStatus]: string } = {
  'in-progress': 'In Progress',
  'done': 'Done',
  'todo': 'To Do',
  'completed': 'Completed',
  'not-started': 'Not Started',
  'on-hold': 'On Hold',
  'cancelled': 'Cancelled',
};

const priorityVariant: { [key in TaskPriority]: 'default' | 'secondary' | 'destructive' } = {
    'High': 'destructive',
    'Medium': 'default',
    'Low': 'secondary',
};

const defaultTaskValues = {
    title: '',
    description: '',
    assigneeId: '',
    dateRange: { from: new Date(), to: new Date() },
    priority: 'Medium' as TaskPriority,
    cost: 0,
};

export default function ProjectDetailPage() {
    const { id } = useParams();
    const { projects, setProjects, tasks, setTasks, employees, employeesMap, addActivityLog, currencySymbol, user, companyName, smtpConfigList, emailTemplates, setEmailLogs } = useAppContext();
    const { toast } = useToast();
    
    // Task form state
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    // Project form state
    const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
    const [teamSearchTerm, setTeamSearchTerm] = useState('');

    const project = useMemo(() => projects.find(p => p.id === id), [id, projects]);
    const projectTasks = useMemo(() => tasks.filter(t => t.projectId === id), [id, tasks]);
    const manager = useMemo(() => project?.managerId ? employeesMap.get(project.managerId) : undefined, [project, employeesMap]);
    const teamMembers = useMemo(() => project ? project.teamIds.map(id => employeesMap.get(id)).filter(Boolean) as Employee[] : [], [project, employeesMap]);
    
    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const actualCost = useMemo(() => {
        return projectTasks
            .filter(task => task.status === 'done')
            .reduce((sum, task) => sum + (task.cost || 0), 0);
    }, [projectTasks]);

    const projectForm = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema),
    });

    const taskForm = useForm<TaskFormData>({
        resolver: zodResolver(taskSchema),
        defaultValues: defaultTaskValues,
    });
    
    const employeeOptions = useMemo(() => 
        teamMembers.map(e => ({ label: e.name, value: e.id })), 
    [teamMembers]);

    const allEmployeeOptions = useMemo(() => 
        employees.map(e => ({ label: e.name, value: e.id })), 
    [employees]);
    
    const filteredTeamMembers = useMemo(() => 
        employees.filter(e => 
            e.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
        ), 
    [employees, teamSearchTerm]);

    const ganttTasks: GanttTask[] = useMemo(() => {
        return projectTasks
            .filter(task => typeof task.startDate === 'string' && task.startDate && typeof task.endDate === 'string' && task.endDate)
            .map(task => {
                let progress = 0;
                if (task.status === 'in-progress') progress = 50;
                else if (task.status === 'done') progress = 100;
                
                return {
                    id: task.id,
                    name: task.title,
                    start: parseISO(task.startDate),
                    end: parseISO(task.endDate),
                    type: 'task',
                    progress: progress,
                    isDisabled: false,
                    project: project?.name,
                    dependencies: [],
                };
            });
    }, [projectTasks, project?.name]);

    if (!project) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Project Not Found" showBackButton />
                <main className="flex-1 p-6">
                    <Card>
                        <CardHeader><CardTitle>Error</CardTitle></CardHeader>
                        <CardContent><p>The requested project could not be found.</p></CardContent>
                    </Card>
                </main>
            </div>
        );
    }
    
    const budgetProgress = project.budget > 0 ? (actualCost / project.budget) * 100 : 0;

    const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
        setTasks(currentTasks => currentTasks.map(task => 
            task.id === taskId ? { ...task, status: newStatus } : task
        ));
        const task = tasks.find(t => t.id === taskId);
        addActivityLog('Task Status Updated', `Task "${task?.title}" in project "${project.name}" set to ${newStatus}.`);
    };

    const handleProjectStatusChange = (newStatus: ProjectStatus) => {
        if (!project) return;
        const updatedProjects = projects.map(p => 
            p.id === project.id ? { ...p, status: newStatus } : p
        );
        setProjects(updatedProjects);
        addActivityLog('Project Status Updated', `Project "${project.name}" status changed to ${statusDisplay[newStatus]}.`);
        toast({ title: "Project Status Updated" });
    };

    const handleOpenTaskForm = (task: Task | null) => {
        setTaskToEdit(task);
        if (task) {
            taskForm.reset({
                title: task.title,
                description: task.description || '',
                assigneeId: task.assigneeId,
                dateRange: {
                    from: task.startDate ? parseISO(task.startDate) : new Date(),
                    to: task.endDate ? parseISO(task.endDate) : new Date(),
                },
                priority: task.priority,
                cost: task.cost || 0,
            });
        } else {
            taskForm.reset(defaultTaskValues);
        }
        setIsTaskFormOpen(true);
    };

    const onSubmitTask = (data: TaskFormData) => {
        if (taskToEdit) {
            const updatedTasks = tasks.map(t => 
                t.id === taskToEdit.id ? {
                    ...t,
                    ...data,
                    startDate: format(data.dateRange.from, 'yyyy-MM-dd'),
                    endDate: format(data.dateRange.to, 'yyyy-MM-dd'),
                } : t
            );
            setTasks(updatedTasks);
            toast({ title: "Task Updated" });
        } else {
            const newTask: Task = {
                id: `task-${Date.now()}`,
                projectId: project.id,
                status: 'todo',
                title: data.title,
                description: data.description || '',
                assigneeId: data.assigneeId,
                priority: data.priority,
                startDate: format(data.dateRange.from, 'yyyy-MM-dd'),
                endDate: format(data.dateRange.to, 'yyyy-MM-dd'),
                cost: data.cost || 0,
            };
            setTasks(prev => [newTask, ...prev]);
            toast({ title: "Task Added" });
            if (data.assigneeId) {
                const assignee = employeesMap.get(data.assigneeId);
                if (assignee?.email) {
                    void sendDepartmentEmail(
                        { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                        'Project Management',
                        'task-assigned',
                        assignee.email,
                        { assigneeName: assignee.name, taskTitle: newTask.title, projectName: project.name },
                        user?.name ?? 'system'
                    );
                }
            }
        }
        setIsTaskFormOpen(false);
        setTaskToEdit(null);
    };

    const handleDeleteTask = () => {
        if (!taskToDelete) return;
        setTasks(tasks.filter(t => t.id !== taskToDelete.id));
        toast({ title: "Task Deleted" });
        setTaskToDelete(null);
    };

    const handleOpenProjectForm = () => {
        setTeamSearchTerm('');
        projectForm.reset({
            name: project.name,
            description: project.description,
            client: project.client || '',
            status: project.status,
            managerId: project.managerId,
            teamIds: project.teamIds,
            dateRange: { from: parseISO(project.startDate), to: parseISO(project.endDate) },
            budget: project.budget,
        });
        setIsProjectFormOpen(true);
    };

    function onProjectSubmit(data: ProjectFormData) {
        const projectData = {
          ...data,
          teamIds: data.teamIds || [],
          startDate: format(data.dateRange.from, 'yyyy-MM-dd'),
          endDate: format(data.dateRange.to, 'yyyy-MM-dd'),
        };
        
        const updatedProjects = projects.map(p => p.id === project?.id ? { ...p, ...projectData, dateRange: undefined } : p);
        setProjects(updatedProjects);
        toast({ title: "Project Updated" });
        addActivityLog('Project Updated', `Updated project: ${data.name}`);
        
        setIsProjectFormOpen(false);
    }
    
    return (
        <div className="flex flex-col h-full">
            <Header title={project.name} showBackButton />
            <Breadcrumb items={[{ label: 'Projects', href: '/projects' }, { label: project.name }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row justify-between items-start">
                                <div>
                                <CardTitle>Tasks</CardTitle>
                                <CardDescription>All tasks associated with this project.</CardDescription>
                                </div>
                                {canManage && <Button size="sm" onClick={() => handleOpenTaskForm(null)}><PlusCircle className="mr-2 h-4 w-4"/> Add Task</Button>}
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="list">
                                    <TabsList className="mb-4">
                                        <TabsTrigger value="list">Task List</TabsTrigger>
                                        <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="list">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Task</TableHead>
                                                    <TableHead>Assignee</TableHead>
                                                    <TableHead>Timeline</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {projectTasks.map(task => {
                                                    const assignee = employeesMap.get(task.assigneeId);
                                                    return (
                                                        <TableRow key={task.id}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex flex-col">
                                                                    <span>{task.title}</span>
                                                                    <Badge variant={priorityVariant[task.priority]} className="capitalize w-fit mt-1">{task.priority}</Badge>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{assignee?.name || 'Unassigned'}</TableCell>
                                                            <TableCell>{task.startDate && task.endDate ? `${format(parseISO(task.startDate), 'MMM d')} - ${format(parseISO(task.endDate), 'MMM d, yyyy')}` : 'N/A'}</TableCell>
                                                            <TableCell>
                                                                <Select value={task.status} onValueChange={(value: TaskStatus) => handleTaskStatusChange(task.id, value)} disabled={!canManage}>
                                                                    <SelectTrigger className="h-8 w-[120px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {['todo', 'in-progress', 'done'].map((key) => (
                                                                            <SelectItem key={key} value={key as TaskStatus}>{statusDisplay[key as TaskStatus]}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" disabled={!canManage}><MoreHorizontal className="h-4 w-4" /></Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onSelect={() => handleOpenTaskForm(task)} disabled={!canManage}>Edit</DropdownMenuItem>
                                                                        <DropdownMenuItem className="text-destructive" onSelect={() => setTaskToDelete(task)} disabled={!canManage}>Delete</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TabsContent>
                                    <TabsContent value="gantt">
                                        <GanttChart tasks={ganttTasks} />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <CardTitle>Project Details</CardTitle>
                                {canManage && <Button variant="outline" size="sm" onClick={handleOpenProjectForm}>Edit Project</Button>}
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex items-center gap-2"><Flag className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Status:</span>
                                    <Select value={project.status} onValueChange={(value: ProjectStatus) => handleProjectStatusChange(value)} disabled={!canManage}>
                                        <SelectTrigger className="h-8 w-fit gap-1 capitalize">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(statusDisplay)
                                                .filter(([key]) => !['todo', 'done'].includes(key))
                                                .map(([key, value]) => (
                                                    <SelectItem key={key} value={key as ProjectStatus} className="capitalize">{value}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                                {project.client && <div className="flex items-center gap-2"><BriefcaseIcon className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Client:</span><span>{project.client}</span></div>}
                                
                                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Timeline:</span><span>{format(parseISO(project.startDate), 'MMM d, yyyy')} - {format(parseISO(project.endDate), 'MMM d, yyyy')}</span></div>
                                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Manager:</span><span>{manager?.name}</span></div>

                                <Separator className="my-4"/>

                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground"/>Budget Utilization</h4>
                                    <Progress value={budgetProgress} className={cn(budgetProgress > 100 && "[&>div]:bg-destructive")} />
                                    <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                                        <span>{currencySymbol}{actualCost.toLocaleString()} Spent</span>
                                        <span>{currencySymbol}{(project.budget - actualCost).toLocaleString()} Remaining</span>
                                    </div>
                                    {budgetProgress > 100 && 
                                        <p className="text-xs text-destructive mt-1">
                                            Project is {currencySymbol}{(actualCost - project.budget).toLocaleString()} over budget.
                                        </p>
                                    }
                                </div>

                                <Separator className="my-4"/>

                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground"/>Team</h4>
                                    <div className="space-y-2">
                                        {teamMembers.map(member => (
                                            <div key={member.id} className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarImage src={member.avatar} data-ai-hint="person user" /><AvatarFallback>{member.name.charAt(0)}</AvatarFallback></Avatar>
                                                <span>{member.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Task Edit/Add Dialog */}
            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{taskToEdit ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                    </DialogHeader>
                    <Form {...taskForm}>
                        <form onSubmit={taskForm.handleSubmit(onSubmitTask)} className="space-y-4 py-4">
                            <FormField control={taskForm.control} name="title" render={({ field }) => (
                                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={taskForm.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={taskForm.control} name="assigneeId" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Assign To</FormLabel>
                                    <Combobox
                                        options={employeeOptions}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Select a team member..."
                                        searchPlaceholder="Search team..."
                                        emptyText="No team member found."
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <FormField control={taskForm.control} name="dateRange" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Task Timeline</FormLabel><FormControl><DateRangePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={taskForm.control} name="priority" render={({ field }) => (
                                    <FormItem><FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Low">Low</SelectItem>
                                                <SelectItem value="Medium">Medium</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )}/>
                            </div>
                            <FormField control={taskForm.control} name="cost" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Task Cost ({currencySymbol})</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit">{taskToEdit ? 'Save Changes' : 'Add Task'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the task &quot;{taskToDelete?.title}&quot;.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">Delete Task</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            {/* Project Edit Dialog */}
            <Dialog open={isProjectFormOpen} onOpenChange={setIsProjectFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>Update the details for &quot;{project.name}&quot;</DialogDescription>
                    </DialogHeader>
                    <Form {...projectForm}>
                        <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto px-2">
                            <FormField control={projectForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={projectForm.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={projectForm.control} name="client" render={({ field }) => (
                                <FormItem><FormLabel>Client / Department</FormLabel><FormControl><Input placeholder="e.g. Acme Corp or Marketing Dept." {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={projectForm.control} name="managerId" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2">
                                        <FormLabel>Project Manager</FormLabel>
                                        <Combobox
                                            options={allEmployeeOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Select a manager..."
                                            searchPlaceholder="Search managers..."
                                            emptyText="No manager found."
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={projectForm.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{Object.entries(statusDisplay).filter(([key]) => key !== 'todo' && key !== 'done').map(([key, value]) => <SelectItem key={key} value={key as ProjectStatus}>{value}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )}/>
                            </div>
                            <FormField control={projectForm.control} name="dateRange" render={({ field }) => (
                                <FormItem className="flex flex-col pt-2"><FormLabel>Project Timeline</FormLabel><FormControl><DateRangePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={projectForm.control} name="budget" render={({ field }) => (
                                <FormItem><FormLabel>Budget ({currencySymbol})</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={projectForm.control} name="teamIds" render={() => (
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
                                            <FormField key={item.id} control={projectForm.control} name="teamIds"
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
                                <Button type="submit">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
