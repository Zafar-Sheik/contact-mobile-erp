"use client";

import * as React from "react";
import {
  Plus,
  Search,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  MoreVertical,
  Calendar,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

interface WorkflowTask {
  _id: string;
  title: string;
  priority: string;
  assignee?: string;
  dueDate: string;
  status: string;
  description?: string;
  isActive?: boolean;
}

interface TaskFormData {
  title: string;
  priority: string;
  assignee: string;
  dueDate: string;
  description: string;
  status: string;
  isActive: boolean;
}

const initialFormData: TaskFormData = {
  title: "",
  priority: "medium",
  assignee: "",
  dueDate: new Date().toISOString().split("T")[0],
  description: "",
  status: "pending",
  isActive: true,
};

const statusOptions = ["pending", "in_progress", "completed", "cancelled"];
const priorityOptions = ["low", "medium", "high"];

export default function WorkflowTasksPage() {
  const { toast } = useToast();
  const { data: tasks, loading, error, refetch } = useApi<WorkflowTask[]>("/api/workflow-tasks");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<WorkflowTask | null>(null);
  const [formData, setFormData] = React.useState<TaskFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignee?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tasks, searchTerm]);

  const handleOpenDialog = (task?: WorkflowTask) => {
    if (task) {
      setSelectedTask(task);
      setFormData({
        title: task.title || "",
        priority: task.priority || "medium",
        assignee: task.assignee || "",
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
        description: task.description || "",
        status: task.status || "pending",
        isActive: task.isActive ?? true,
      });
    } else {
      setSelectedTask(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTask(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const taskData = {
        title: formData.title,
        priority: formData.priority,
        assignee: formData.assignee || undefined,
        dueDate: formData.dueDate,
        description: formData.description || undefined,
        status: formData.status,
        isActive: formData.isActive,
      };

      if (selectedTask) {
        await apiUpdate<WorkflowTask>("/api/workflow-tasks", selectedTask._id, taskData);
        toast({ title: "Success", description: "Task updated successfully" });
      } else {
        await apiCreate<WorkflowTask>("/api/workflow-tasks", taskData);
        toast({ title: "Success", description: "Task created successfully" });
      }

      handleCloseDialog();
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/workflow-tasks", selectedTask._id);
      toast({ title: "Success", description: "Task deleted successfully" });
      handleDeleteCloseDialog();
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCloseDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedTask(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
      completed: "success",
      pending: "warning",
      in_progress: "default",
      cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace("_", " ")}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "destructive" | "warning" | "secondary" | "default"> = {
      high: "destructive",
      medium: "warning",
      low: "secondary",
    };
    return <Badge variant={variants[priority] || "secondary"}>{priority}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workflow Tasks</h1>
            <p className="text-muted-foreground">Manage tasks and workflows</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="w-full gap-2 md:w-auto" size="lg">
            <Plus className="h-5 w-5" />Add Task
          </Button>
        </div>

        {tasks && tasks.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-xl font-bold md:text-2xl">{tasks.length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600 md:text-2xl">{tasks.filter(t => t.status === "completed").length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">In Progress</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-blue-600 md:text-2xl">{tasks.filter(t => t.status === "in_progress").length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-yellow-600 md:text-2xl">{tasks.filter(t => t.status === "pending").length}</div></CardContent></Card>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-12 text-lg md:h-10 md:text-sm" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading tasks</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No tasks found</h3>
                <p className="mt-1 text-sm text-muted-foreground">{searchTerm ? "Try adjusting your search" : "Get started by creating your first task"}</p>
                <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Task</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-3 md:hidden">
            {filteredTasks.map((task) => (
              <Card key={task._id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        {getStatusIcon(task.status)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{task.title}</h3>
                        <p className="text-sm text-muted-foreground">{task.assignee || "Unassigned"}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10"><MoreVertical className="h-5 w-5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleOpenDialog(task)}><ClipboardList className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedTask(task); setIsDeleteDialogOpen(true); }} className="text-destructive"><ClipboardList className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="border-t px-4 py-3 bg-muted/30">
                    <div className="flex items-center justify-between text-sm">
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t px-4 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task._id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{task.assignee || "-"}</TableCell>
                      <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(task)}><ClipboardList className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setSelectedTask(task); setIsDeleteDialogOpen(true); }}><ClipboardList className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedTask ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>{selectedTask ? "Update task information below" : "Enter information to create a new task"}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Enter task title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select id="priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full h-10 px-3 border rounded-md">
                    {priorityOptions.map((priority) => (<option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full h-10 px-3 border rounded-md">
                    {statusOptions.map((status) => (<option key={status} value={status}>{status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <Input id="assignee" value={formData.assignee} onChange={(e) => setFormData({ ...formData, assignee: e.target.value })} placeholder="Enter assignee" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Task description..." />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-5 w-5 rounded border-gray-300" />
                <Label htmlFor="isActive">Active task</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedTask ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this task.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCloseDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
