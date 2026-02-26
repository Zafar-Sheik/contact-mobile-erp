"use client";

import * as React from "react";
import {
  Search,
  Edit,
  Trash2,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

// Types
interface WorkflowTask {
  _id: string;
  title: string;
  priority: string;
  assignee?: string;
  dueDate: string;
  status: string;
  description?: string;
}

interface TaskFormData {
  title: string;
  priority: string;
  assignee: string;
  dueDate: string;
  description: string;
  status: string;
}

const initialFormData: TaskFormData = {
  title: "",
  priority: "medium",
  assignee: "",
  dueDate: new Date().toISOString().split("T")[0],
  description: "",
  status: "pending",
};

const statusOptions = ["pending", "in_progress", "completed", "cancelled"];
const priorityOptions = ["low", "medium", "high"];

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Status colors and icons
const getStatusInfo = (status: string) => {
  const info: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending", icon: "Clock" },
    in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress", icon: "Clock" },
    completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed", icon: "CheckCircle" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled", icon: "XCircle" },
  };
  return info[status] || info.pending;
};

// Priority colors
const getPriorityColors = (priority: string) => {
  const colors: Record<string, string> = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700",
  };
  return colors[priority] || colors.medium;
};

export default function WorkflowTasksPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: tasks, loading, error, refetch } = useApi<WorkflowTask[]>("/api/workflow-tasks");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<WorkflowTask | null>(null);
  const [formData, setFormData] = React.useState<TaskFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((task) => {
      const matchesSearch =
        !searchTerm ||
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.assignee && task.assignee.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [tasks, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!tasks) return { pending: 0, inProgress: 0, completed: 0 };
    return {
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
    };
  }, [tasks]);

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
      };

      if (selectedTask) {
        await apiUpdate<WorkflowTask, typeof taskData>("/api/workflow-tasks", selectedTask._id, taskData);
        toast({ title: "Success", description: "Task updated successfully" });
      } else {
        await apiCreate<WorkflowTask, typeof taskData>("/api/workflow-tasks", taskData);
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
      setIsDeleteDialogOpen(false);
      setSelectedTask(null);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Workflow Tasks</h1>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && tasks && tasks.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
            <div className="bg-yellow-50 rounded-xl p-2 text-center">
              <p className="text-xs text-yellow-600">Pending</p>
              <p className="text-lg font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 text-center">
              <p className="text-xs text-blue-600">In Progress</p>
              <p className="text-lg font-bold text-blue-700">{stats.inProgress}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2 text-center">
              <p className="text-xs text-green-600">Completed</p>
              <p className="text-lg font-bold text-green-700">{stats.completed}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 pb-24">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 font-medium">Error loading tasks</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <ClipboardList className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No tasks found" : "No workflow tasks yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Create your first task"}
            </p>
          </div>
        )}

        {/* Tasks List */}
        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredTasks.map((task) => {
              const statusInfo = getStatusInfo(task.status);
              const priorityColor = getPriorityColors(task.priority);
              
              return (
                <div
                  key={task._id}
                  onClick={() => handleOpenDialog(task)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {task.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      ) : task.status === "in_progress" ? (
                        <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        {task.assignee && (
                          <p className="text-sm text-gray-500">@{task.assignee}</p>
                        )}
                      </div>
                    </div>
                    <Badge className={`${priorityColor} ml-2 shrink-0 text-xs`}>
                      {task.priority}
                    </Badge>
                  </div>

                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2 pl-8 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pl-8">
                    <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                      {statusInfo.label}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-sm text-gray-500">
                        Due {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(task);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <Button
          onClick={() => handleOpenDialog()}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        >
          <span className="text-2xl text-white font-bold">+</span>
        </Button>
      </div>

      {/* Bottom More Menu Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe z-20">
        <button
          onClick={openMore}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-700" />
          <span className="text-base font-medium text-gray-700">More</span>
        </button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTask ? "Edit Task" : "New Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Input
                value={formData.assignee}
                onChange={(e) => setFormData((prev) => ({ ...prev, assignee: e.target.value }))}
                placeholder="Assignee name"
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Task description..."
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.title}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedTask ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 h-12 bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
