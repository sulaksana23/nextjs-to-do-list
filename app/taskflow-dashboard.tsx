"use client";

import { startTransition, useDeferredValue, useEffect, useId, useState } from "react";

type Priority = "Low" | "Medium" | "High";
type StatusFilter = "All" | "Open" | "Done";
type SortOption = "Newest" | "Oldest" | "Priority" | "Due soon";
type TaskStatus = "Hold" | "In Progress" | "Done";

type WorkspaceUser = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  telegramNumber: string;
  telegramChatId: string;
  hasPassword: boolean;
};

type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  taskCount: number;
  openTaskCount: number;
};

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
  assigneeId: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  category: string;
  projectId: string;
  projectName: string;
  assigneeId: string;
  status: TaskStatus;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
};

type TaskDraft = {
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  projectId: string;
  assigneeId: string;
  status: TaskStatus;
  subtaskInput: string;
  subtasks: Subtask[];
};

type ProjectDraft = {
  name: string;
};

type UserDraft = {
  name: string;
  telegramNumber: string;
  telegramChatId: string;
  password: string;
  color: string;
};

type AuthForm = {
  name: string;
  telegramNumber: string;
  password: string;
  telegramChatId: string;
};

type SessionUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
  telegramNumber: string;
  telegramChatId: string;
};

type WorkspaceResponse = {
  users: WorkspaceUser[];
  projects: WorkspaceProject[];
  tasks: Task[];
  currentUser: SessionUser;
};

type WorkspaceView = "Dashboard" | "Home" | "Inbox" | "My Tasks" | "Replies" | "Assigned";
type ProductView = "Docs" | "Forms" | "Whiteboards" | "Goals" | "Timesheet";
type ActiveView = WorkspaceView | ProductView;

const WORKSPACE_ITEMS = [
  { label: "Dashboard", icon: "◫" },
  { label: "Home", icon: "⌂" },
  { label: "Inbox", icon: "◔" },
  { label: "My Tasks", icon: "✓" },
  { label: "Replies", icon: "↩" },
  { label: "Assigned", icon: "@" },
] as const satisfies ReadonlyArray<{ label: WorkspaceView; icon: string }>;

const PRODUCT_ITEMS = [
  { label: "Docs", icon: "◧" },
  { label: "Forms", icon: "☑" },
  { label: "Whiteboards", icon: "✎" },
  { label: "Goals", icon: "◉" },
  { label: "Timesheet", icon: "◷" },
] as const satisfies ReadonlyArray<{ label: ProductView; icon: string }>;

const RAIL_ITEMS = ["⌘", "⌂", "☰", "◨", "✦", "⚙"];

const MODAL_TABS = ["Task", "Doc", "Reminder", "Whiteboard", "Dashboard"] as const;

const priorityWeight: Record<Priority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const defaultDraft: TaskDraft = {
  title: "",
  description: "",
  dueDate: "",
  priority: "Medium",
  projectId: "",
  assigneeId: "",
  status: "In Progress",
  subtaskInput: "",
  subtasks: [],
};

const defaultProjectDraft: ProjectDraft = {
  name: "",
};

const defaultUserDraft: UserDraft = {
  name: "",
  telegramNumber: "",
  telegramChatId: "",
  password: "",
  color: "",
};

const defaultAuthForm: AuthForm = {
  name: "",
  telegramNumber: "",
  password: "",
  telegramChatId: "",
};

function normalizeUsers(value: unknown): WorkspaceUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const user = item as Partial<WorkspaceUser>;

      if (typeof user.id !== "string" || typeof user.name !== "string") {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        initials: typeof user.initials === "string" ? user.initials : user.name.slice(0, 2),
        tone: typeof user.tone === "string" ? user.tone : "muted",
        telegramNumber:
          typeof user.telegramNumber === "string" ? user.telegramNumber : "",
        telegramChatId:
          typeof user.telegramChatId === "string" ? user.telegramChatId : "",
        hasPassword: Boolean(user.hasPassword),
      };
    })
    .filter((item): item is WorkspaceUser => item !== null);
}

function normalizeSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const subtask = item as Partial<Subtask>;
      const title = typeof subtask.title === "string" ? subtask.title.trim() : "";

      if (!title) {
        return null;
      }

      return {
        id:
          typeof subtask.id === "string" && subtask.id
            ? subtask.id
            : `subtask-${index}`,
        title,
        completed: Boolean(subtask.completed),
        assigneeId: typeof subtask.assigneeId === "string" ? subtask.assigneeId : "",
      };
    })
    .filter((item): item is Subtask => item !== null);
}

function normalizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const task = item as Partial<Task>;

      if (typeof task.title !== "string" || !task.title.trim()) {
        return null;
      }

      return {
        id: typeof task.id === "string" && task.id ? task.id : `task-${index}`,
        title: task.title.trim(),
        description: typeof task.description === "string" ? task.description : "",
        dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
        priority:
          task.priority === "High" || task.priority === "Medium" || task.priority === "Low"
            ? task.priority
            : "Medium",
        category:
          typeof task.category === "string" && task.category.trim()
            ? task.category
            : "General",
        projectId: typeof task.projectId === "string" ? task.projectId : "",
        projectName:
          typeof task.projectName === "string" && task.projectName.trim()
            ? task.projectName
            : typeof task.category === "string" && task.category.trim()
              ? task.category
              : "General",
        assigneeId: typeof task.assigneeId === "string" ? task.assigneeId : "",
        status:
          task.status === "Hold" ||
          task.status === "In Progress" ||
          task.status === "Done"
            ? task.status
            : "In Progress",
        subtasks: normalizeSubtasks(task.subtasks),
        createdAt:
          typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
        updatedAt:
          typeof task.updatedAt === "string" ? task.updatedAt : new Date().toISOString(),
      };
    })
    .filter((item): item is Task => item !== null);
}

function normalizeProjects(value: unknown): WorkspaceProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const project = item as Partial<WorkspaceProject>;

      if (typeof project.name !== "string" || !project.name.trim()) {
        return null;
      }

      return {
        id: typeof project.id === "string" && project.id ? project.id : `project-${index}`,
        name: project.name.trim(),
        slug: typeof project.slug === "string" ? project.slug : project.name.trim(),
        taskCount: typeof project.taskCount === "number" ? project.taskCount : 0,
        openTaskCount: typeof project.openTaskCount === "number" ? project.openTaskCount : 0,
      };
    })
    .filter((item): item is WorkspaceProject => item !== null);
}

function toPayload(draft: TaskDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    dueDate: draft.dueDate,
    priority: draft.priority,
    projectId: draft.projectId,
    assigneeId: draft.assigneeId,
    status: draft.status,
    subtasks: normalizeSubtasks(draft.subtasks),
  };
}

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const user = value as Partial<SessionUser>;

  if (typeof user.id !== "string" || typeof user.name !== "string") {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    initials: typeof user.initials === "string" ? user.initials : user.name.slice(0, 2),
    color: typeof user.color === "string" ? user.color : "teal",
    telegramNumber: typeof user.telegramNumber === "string" ? user.telegramNumber : "",
    telegramChatId: typeof user.telegramChatId === "string" ? user.telegramChatId : "",
  };
}

export default function TaskflowDashboard() {
  const titleId = useId();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(defaultDraft);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [userDraft, setUserDraft] = useState<UserDraft>(defaultUserDraft);
  const [authForm, setAuthForm] = useState<AuthForm>(defaultAuthForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("Home");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<TaskStatus, boolean>>({
    Hold: false,
    "In Progress": false,
    Done: false,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [projectValidationMessage, setProjectValidationMessage] = useState("");
  const [projectRequestError, setProjectRequestError] = useState("");
  const [userValidationMessage, setUserValidationMessage] = useState("");
  const [userRequestError, setUserRequestError] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const [isUserSaving, setIsUserSaving] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  async function loadWorkspace() {
    setIsLoading(true);
    setRequestError("");

    try {
      const response = await fetch("/api/workspace", {
        cache: "no-store",
      });

      const payload = (await response.json()) as Partial<WorkspaceResponse> & {
        error?: string;
        detail?: string;
      };

      if (response.status === 401) {
        setCurrentUser(null);
        setUsers([]);
        setProjects([]);
        setTasks([]);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Failed to load workspace.");
      }

      const nextUsers = normalizeUsers(payload.users);
      const nextProjects = normalizeProjects(payload.projects);
      const nextTasks = normalizeTasks(payload.tasks);
      const nextCurrentUser = normalizeSessionUser(payload.currentUser);
      setCurrentUser(nextCurrentUser);
      setUsers(nextUsers);
      setProjects(nextProjects);
      setTasks(nextTasks);
      setSelectedProjectId((current) => current || nextProjects[0]?.id || "");
      setDraft((current) => ({
        ...current,
        projectId: current.projectId || nextProjects[0]?.id || "",
        assigneeId: current.assigneeId || nextUsers[0]?.id || "",
      }));
      setSubtaskAssigneeId((current) => current || nextUsers[0]?.id || "");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to load workspace.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const activeProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const currentWorkspaceUser =
    users.find((user) => user.id === currentUser?.id) ??
    (currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          initials: currentUser.initials,
          tone: currentUser.color,
          telegramNumber: currentUser.telegramNumber,
          telegramChatId: currentUser.telegramChatId,
          hasPassword: true,
        }
      : null);

  const scopedTasks = selectedProjectId
    ? tasks.filter((task) => task.projectId === selectedProjectId)
    : tasks;

  const filteredTasks = scopedTasks
    .filter((task) => {
      if (statusFilter === "Open" && task.status === "Done") {
        return false;
      }

      if (statusFilter === "Done" && task.status !== "Done") {
        return false;
      }

      const keyword = deferredSearchQuery.trim().toLowerCase();

      if (!keyword) {
        return true;
      }

      const assignee = users.find((user) => user.id === task.assigneeId)?.name ?? "";
      const subtaskText = normalizeSubtasks(task.subtasks)
        .map((subtask) => subtask.title)
        .join(" ");

      return [
        task.title,
        task.description,
        task.projectName,
        assignee,
        task.status,
        subtaskText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    })
    .sort((first, second) => {
      if (sortBy === "Oldest") {
        return (
          new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
        );
      }

      if (sortBy === "Priority") {
        return priorityWeight[first.priority] - priorityWeight[second.priority];
      }

      if (sortBy === "Due soon") {
        const firstDue = first.dueDate ? new Date(first.dueDate).getTime() : Infinity;
        const secondDue = second.dueDate ? new Date(second.dueDate).getTime() : Infinity;

        return firstDue - secondDue;
      }

      return (
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      );
    });

  const openCount = scopedTasks.filter((task) => task.status !== "Done").length;
  const doneCount = scopedTasks.filter((task) => task.status === "Done").length;
  const dueSoonCount = scopedTasks.filter(
    (task) => task.status !== "Done" && getDaysLeft(task.dueDate) <= 2,
  ).length;
  const completionRate =
    scopedTasks.length === 0 ? 0 : Math.round((doneCount / scopedTasks.length) * 100);

  const groupedTasks = (["Hold", "In Progress", "Done"] as TaskStatus[]).map((status) => ({
    status,
    tasks: filteredTasks.filter((task) => task.status === status),
  }));
  const myTasks = filteredTasks.filter((task) => task.assigneeId === currentUser?.id);
  const holdTasks = scopedTasks.filter((task) => task.status === "Hold").length;
  const assignedTasks = scopedTasks.filter((task) => task.assigneeId);
  const inboxTasks = scopedTasks.slice(0, 6);
  const replyTasks = scopedTasks.filter((task) =>
    normalizeSubtasks(task.subtasks).some((subtask) => !subtask.completed),
  );
  const docsItems = projects.map((project) => project.name);
  const goalsSummary = [
    { label: "Done", value: doneCount },
    {
      label: "In Progress",
      value: scopedTasks.filter((task) => task.status === "In Progress").length,
    },
    { label: "Hold", value: holdTasks },
  ];

  function handleDraftChange<Key extends keyof TaskDraft>(
    field: Key,
    value: TaskDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetDraft() {
    setDraft({
      ...defaultDraft,
      projectId: selectedProjectId || projects[0]?.id || "",
      assigneeId: currentUser?.id || users[0]?.id || "",
    });
    setSubtaskAssigneeId(currentUser?.id || users[0]?.id || "");
    setEditingTaskId(null);
    setValidationMessage("");
    setIsModalOpen(false);
  }

  function openCreateProjectModal() {
    setProjectDraft(defaultProjectDraft);
    setEditingProjectId(null);
    setProjectValidationMessage("");
    setProjectRequestError("");
    setIsProjectModalOpen(true);
  }

  function resetProjectDraft() {
    setProjectDraft(defaultProjectDraft);
    setEditingProjectId(null);
    setProjectValidationMessage("");
    setProjectRequestError("");
    setIsProjectModalOpen(false);
  }

  function openCreateUserModal() {
    setUserDraft(defaultUserDraft);
    setEditingUserId(null);
    setUserValidationMessage("");
    setUserRequestError("");
    setIsUserModalOpen(true);
  }

  function resetUserDraft() {
    setUserDraft(defaultUserDraft);
    setEditingUserId(null);
    setUserValidationMessage("");
    setUserRequestError("");
    setIsUserModalOpen(false);
  }

  function addSubtaskToDraft() {
    const title = draft.subtaskInput.trim();

    if (!title) {
      return;
    }

    setDraft((current) => ({
      ...current,
      subtaskInput: "",
      subtasks: [
        ...normalizeSubtasks(current.subtasks),
        {
          id: `subtask-${crypto.randomUUID()}`,
          title,
          completed: false,
          assigneeId: subtaskAssigneeId,
        },
      ],
    }));
  }

  function removeDraftSubtask(subtaskId: string) {
    setDraft((current) => ({
      ...current,
      subtasks: normalizeSubtasks(current.subtasks).filter(
        (subtask) => subtask.id !== subtaskId,
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toPayload(draft);

    if (!payload.title) {
      setValidationMessage("Task title wajib diisi.");
      return;
    }

    if (!payload.projectId) {
      setValidationMessage("Project wajib dipilih.");
      return;
    }

    try {
      setIsSaving(true);
      setValidationMessage("");
      setRequestError("");

      const response = await fetch(
        editingTaskId ? `/api/workspace/tasks/${editingTaskId}` : "/api/workspace",
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as { task?: Task; error?: string; detail?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.detail || data.error || "Failed to save task.");
      }

      const task = normalizeTasks([data.task])[0];

      if (!task) {
        throw new Error("Invalid task response.");
      }

      setTasks((current) =>
        editingTaskId
          ? current.map((item) => (item.id === editingTaskId ? task : item))
          : [task, ...current],
      );

      resetDraft();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to save task.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string) {
    try {
      setRequestError("");
      const response = await fetch(
        `/api/workspace/tasks/${taskId}/subtasks/${subtaskId}`,
        {
          method: "PATCH",
        },
      );

      const data = (await response.json()) as { task?: Task; error?: string; detail?: string };

      if (!response.ok || !data.task) {
        throw new Error(data.detail || data.error || "Failed to toggle subtask.");
      }

      const task = normalizeTasks([data.task])[0];

      if (!task) {
        throw new Error("Invalid task response.");
      }

      setTasks((current) => current.map((item) => (item.id === taskId ? task : item)));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to toggle subtask.");
    }
  }

  function handleEdit(task: Task) {
    setDraft({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      status: task.status,
      subtaskInput: "",
      subtasks: normalizeSubtasks(task.subtasks),
    });
    setSubtaskAssigneeId(task.assigneeId);
    setEditingTaskId(task.id);
    setIsModalOpen(true);
    setValidationMessage("");
    setRequestError("");
  }

  async function handleDelete(taskId: string) {
    try {
      setRequestError("");
      const response = await fetch(`/api/workspace/tasks/${taskId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Failed to delete task.");
      }

      setTasks((current) => current.filter((task) => task.id !== taskId));

      if (editingTaskId === taskId) {
        resetDraft();
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to delete task.");
    }
  }

  function handleProjectEdit(project: WorkspaceProject) {
    setProjectDraft({
      name: project.name,
    });
    setEditingProjectId(project.id);
    setProjectValidationMessage("");
    setProjectRequestError("");
    setIsProjectModalOpen(true);
  }

  async function handleProjectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectDraft.name.trim()) {
      setProjectValidationMessage("Project name wajib diisi.");
      return;
    }

    try {
      setIsProjectSaving(true);
      setProjectValidationMessage("");
      setProjectRequestError("");

      const response = await fetch(
        editingProjectId
          ? `/api/workspace/projects/${editingProjectId}`
          : "/api/workspace/projects",
        {
          method: editingProjectId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(projectDraft),
        },
      );

      const data = (await response.json()) as {
        project?: WorkspaceProject;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !data.project) {
        throw new Error(data.detail || data.error || "Failed to save project.");
      }

      const nextProject = normalizeProjects([data.project])[0];

      if (!nextProject) {
        throw new Error("Invalid project response.");
      }

      setProjects((current) =>
        editingProjectId
          ? current.map((project) => (project.id === editingProjectId ? nextProject : project))
          : [...current, nextProject],
      );
      setSelectedProjectId(nextProject.id);
      setTasks((current) =>
        editingProjectId
          ? current.map((task) =>
              task.projectId === editingProjectId
                ? {
                    ...task,
                    category: nextProject.name,
                    projectName: nextProject.name,
                  }
                : task,
            )
          : current,
      );
      setDraft((current) => ({
        ...current,
        projectId: nextProject.id,
      }));
      resetProjectDraft();
    } catch (error) {
      setProjectRequestError(
        error instanceof Error ? error.message : "Failed to save project.",
      );
    } finally {
      setIsProjectSaving(false);
    }
  }

  async function handleProjectDelete(projectId: string) {
    try {
      setProjectRequestError("");
      const response = await fetch(`/api/workspace/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Failed to delete project.");
      }

      const remainingProjects = projects.filter((project) => project.id !== projectId);
      setProjects(remainingProjects);

      if (selectedProjectId === projectId) {
        setSelectedProjectId(remainingProjects[0]?.id || "");
      }

      resetProjectDraft();
    } catch (error) {
      setProjectRequestError(
        error instanceof Error ? error.message : "Failed to delete project.",
      );
    }
  }

  function handleUserEdit(user: WorkspaceUser) {
    setUserDraft({
      name: user.name,
      telegramNumber: user.telegramNumber,
      telegramChatId: user.telegramChatId,
      password: "",
      color: user.tone,
    });
    setEditingUserId(user.id);
    setUserValidationMessage("");
    setUserRequestError("");
    setIsUserModalOpen(true);
  }

  async function handleUserSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userDraft.name.trim()) {
      setUserValidationMessage("Nama user wajib diisi.");
      return;
    }

    if (!userDraft.telegramNumber.trim()) {
      setUserValidationMessage("Nomor Telegram wajib diisi.");
      return;
    }

    try {
      setIsUserSaving(true);
      setUserValidationMessage("");
      setUserRequestError("");

      const response = await fetch(
        editingUserId ? `/api/workspace/users/${editingUserId}` : "/api/workspace/users",
        {
          method: editingUserId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userDraft),
        },
      );

      const data = (await response.json()) as {
        user?: WorkspaceUser;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !data.user) {
        throw new Error(data.detail || data.error || "Failed to save user.");
      }

      const nextUser = normalizeUsers([data.user])[0];

      if (!nextUser) {
        throw new Error("Invalid user response.");
      }

      setUsers((current) =>
        editingUserId
          ? current.map((user) => (user.id === editingUserId ? nextUser : user))
          : [...current, nextUser],
      );
      setDraft((current) => ({
        ...current,
        assigneeId: current.assigneeId || nextUser.id,
      }));
      setSubtaskAssigneeId((current) => current || nextUser.id);
      resetUserDraft();
    } catch (error) {
      setUserRequestError(error instanceof Error ? error.message : "Failed to save user.");
    } finally {
      setIsUserSaving(false);
    }
  }

  async function handleUserDelete(userId: string) {
    try {
      setUserRequestError("");
      const response = await fetch(`/api/workspace/users/${userId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Failed to delete user.");
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
      setTasks((current) =>
        current.map((task) => ({
          ...task,
          assigneeId: task.assigneeId === userId ? "" : task.assigneeId,
          subtasks: task.subtasks.map((subtask) => ({
            ...subtask,
            assigneeId: subtask.assigneeId === userId ? "" : subtask.assigneeId,
          })),
        })),
      );
      resetUserDraft();
    } catch (error) {
      setUserRequestError(error instanceof Error ? error.message : "Failed to delete user.");
    }
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authForm.telegramNumber.trim()) {
      setAuthError("Nomor Telegram wajib diisi.");
      return;
    }

    if (!authForm.password.trim()) {
      setAuthError("Password wajib diisi.");
      return;
    }

    if (!isLoginMode && !authForm.name.trim()) {
      setAuthError("Nama wajib diisi untuk register.");
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError("");

      const response = await fetch(isLoginMode ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authForm),
      });

      const data = (await response.json()) as {
        user?: SessionUser;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !data.user) {
        throw new Error(data.detail || data.error || "Failed to authenticate.");
      }

      setCurrentUser(normalizeSessionUser(data.user));
      setAuthForm(defaultAuthForm);
      await loadWorkspace();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Failed to authenticate.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    setCurrentUser(null);
    setUsers([]);
    setProjects([]);
    setTasks([]);
  }

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (!currentUser) {
    return (
      <AuthShell
        authForm={authForm}
        authError={authError}
        isAuthenticating={isAuthenticating}
        isLoginMode={isLoginMode}
        onSubmit={handleAuthSubmit}
        onChange={(field, value) =>
          setAuthForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onToggleMode={() => {
          setIsLoginMode((current) => !current);
          setAuthError("");
        }}
      />
    );
  }

  return (
    <main className={isSidebarCollapsed ? "workspace-shell sidebar-collapsed" : "workspace-shell"}>
      <aside className="workspace-rail">
        <div className="workspace-railStack">
          {RAIL_ITEMS.map((item, index) => (
            <button
              key={item}
              type="button"
              className={index === 1 ? "workspace-railButton active" : "workspace-railButton"}
            >
              {item}
            </button>
          ))}
        </div>
      </aside>

      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <div className="workspace-brandMark">M</div>
          <div className="workspace-sidebarText">
            <p className="workspace-brandTitle">{activeProject?.name || "Projects"}</p>
            <p className="workspace-brandMeta">Project workspace</p>
          </div>
          <button
            type="button"
            className="workspace-collapseButton"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="workspace-nav">
          {WORKSPACE_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveView(item.label)}
              className={activeView === item.label ? "workspace-navItem active" : "workspace-navItem"}
            >
              <span className="workspace-navLead">
                <span className="workspace-navIcon">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="workspace-section">
          <div className="workspace-sectionHeader">
            <span>Products</span>
            <span>+</span>
          </div>
          <div className="workspace-spaceList">
            {PRODUCT_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveView(item.label)}
                className={activeView === item.label ? "workspace-spaceItem active" : "workspace-spaceItem"}
              >
                <span className="workspace-navLead">
                  <span className="workspace-navIcon">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-section">
          <div className="workspace-sectionHeader">
            <span>Spaces</span>
            <button
              type="button"
              className="workspace-sectionAction"
              onClick={openCreateProjectModal}
            >
              +
            </button>
          </div>
          <div className="workspace-spaceList">
            {projects.map((project) => (
              <div key={project.id} className="workspace-spaceRow">
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={
                    selectedProjectId === project.id
                      ? "workspace-spaceItem active"
                      : "workspace-spaceItem"
                  }
                >
                  <span>{project.name}</span>
                  <span>{project.openTaskCount}</span>
                </button>
                <button
                  type="button"
                  className="workspace-spaceAction"
                  onClick={() => handleProjectEdit(project)}
                  aria-label={`Edit ${project.name}`}
                >
                  •••
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="workspace-sidebarFooter">
          {currentWorkspaceUser ? (
            <div className="workspace-sessionCard">
              <Avatar user={currentWorkspaceUser} />
              <div className="workspace-sessionMeta">
                <span>{currentWorkspaceUser.name}</span>
                <span>{currentWorkspaceUser.telegramNumber || "No Telegram number"}</span>
              </div>
            </div>
          ) : null}
          <div className="workspace-statLine">
            <span>Open</span>
            <span>{openCount}</span>
          </div>
          <div className="workspace-statLine">
            <span>Done</span>
            <span>{doneCount}</span>
          </div>
          <div className="workspace-statLine">
            <span>Progress</span>
            <span>{completionRate}%</span>
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="workspace-crumb">
              IT / HO Software Development / {activeProject?.name || "Projects"}
            </p>
            <h1 className="workspace-title">
              {activeView === "Home"
                ? `${activeProject?.name || "Project"} workspace`
                : activeView === "Dashboard"
                  ? `${activeProject?.name || "Project"} dashboard`
                  : `${activeView} workspace`}
            </h1>
          </div>

          <div className="workspace-topActions">
            <div className="workspace-searchWrap">
              <input
                value={searchQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    setSearchQuery(nextValue);
                  });
                }}
                placeholder="Search task, assignee, subtask"
                className="workspace-search"
              />
            </div>

            <select
              value={sortBy}
              onChange={(event) => {
                const nextValue = event.target.value as SortOption;
                startTransition(() => {
                  setSortBy(nextValue);
                });
              }}
              className="workspace-control"
            >
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="Priority">Priority</option>
              <option value="Due soon">Due soon</option>
            </select>

            <button
              type="button"
              className="workspace-ghostButton"
              onClick={() => setActiveView("Timesheet")}
            >
              Team
            </button>

            <button type="button" className="workspace-ghostButton" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {activeView === "Home" ? (
          <section className="workspace-subbar">
            <div className="workspace-subbarLeft">
              <span className="workspace-tab muted">Add Channel</span>
              <span className="workspace-tab">Board</span>
              <span className="workspace-tab active">List</span>
              <span className="workspace-tab">+ View</span>
            </div>
            <div className="workspace-subbarRight">
              <span className="workspace-miniIcon">☰</span>
              <span className="workspace-miniIcon">◎</span>
              <span className="workspace-miniIcon">👥</span>
              <button
                type="button"
                className="workspace-primaryButton"
                onClick={() => {
                  setEditingTaskId(null);
                  setDraft((current) => ({
                    ...defaultDraft,
                    projectId: selectedProjectId || projects[0]?.id || current.projectId,
                    assigneeId: currentUser?.id || users[0]?.id || current.assigneeId,
                  }));
                  setSubtaskAssigneeId(currentUser?.id || users[0]?.id || "");
                  setValidationMessage("");
                  setRequestError("");
                  setIsModalOpen(true);
                  setActiveView("Home");
                }}
              >
                + Task
              </button>
            </div>
          </section>
        ) : null}

        {activeView === "Dashboard" ? (
          <section className="workspace-home">
            <div className="workspace-homeHero">
              <div>
                <p className="workspace-sectionEyebrow">Home</p>
                <h2 className="workspace-homeTitle">Welcome back, {currentUser?.name || "Team"}.</h2>
                <p className="workspace-homeText">
                  Ringkasan cepat untuk melihat apa yang masih hold, apa yang lagi jalan,
                  dan task mana yang paling butuh perhatian hari ini.
                </p>
              </div>
              <div className="workspace-homeStats">
                <HomeStatCard label="Open Tasks" value={openCount} />
                <HomeStatCard label="On Hold" value={holdTasks} />
                <HomeStatCard label="Due Soon" value={dueSoonCount} />
                <HomeStatCard label="My Tasks" value={myTasks.length} />
              </div>
            </div>

            <div className="workspace-homeGrid">
              <section className="workspace-homePanel">
                <div className="workspace-homePanelHeader">
                  <div>
                    <p className="workspace-sectionEyebrow">Priority</p>
                    <h3 className="workspace-homePanelTitle">Need attention</h3>
                  </div>
                  <span className="workspace-homeMeta">{filteredTasks.length} items</span>
                </div>
                <div className="workspace-homeList">
                  {filteredTasks.slice(0, 4).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="workspace-homeItem"
                      onClick={() => {
                        setActiveView("Home");
                        handleEdit(task);
                      }}
                    >
                      <div>
                        <p className="workspace-homeItemTitle">{task.title}</p>
                        <p className="workspace-homeItemMeta">
                          {task.projectName} • {task.status}
                        </p>
                      </div>
                      <span className={`workspace-statusChip ${getStatusTone(task.status)}`}>
                        {task.priority}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="workspace-homePanel">
                <div className="workspace-homePanelHeader">
                  <div>
                    <p className="workspace-sectionEyebrow">Assigned</p>
                    <h3 className="workspace-homePanelTitle">My tasks</h3>
                  </div>
                  <span className="workspace-homeMeta">{myTasks.length} tasks</span>
                </div>
                <div className="workspace-homeList">
                  {myTasks.length > 0 ? (
                    myTasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="workspace-homeItem static">
                        <div>
                          <p className="workspace-homeItemTitle">{task.title}</p>
                          <p className="workspace-homeItemMeta">
                            Due {formatDate(task.dueDate)} • {task.subtasks.length} subtasks
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="workspace-homeEmpty">No tasks assigned yet.</div>
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "Home" ? (
        <section className="workspace-toolbar">
          <div className="workspace-pills">
            {(["All", "Open", "Done"] as StatusFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setStatusFilter(option);
                  });
                }}
                className={statusFilter === option ? "workspace-pill active" : "workspace-pill"}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="workspace-summary">
            <span>{openCount} open</span>
            <span>{dueSoonCount} due soon</span>
            <span>{doneCount} done</span>
          </div>
        </section>
        ) : null}

        {activeView === "Home" ? (
        <section className="workspace-table">
          <div className="workspace-tableHead">
            <span>Name</span>
            <span>Assignee</span>
            <span>Priority</span>
            <span>Due date</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Action</span>
          </div>

          {groupedTasks.map((group) => (
            <div key={group.status} className="workspace-group">
              <div className="workspace-groupHeader">
                <button
                  type="button"
                  className="workspace-groupToggle"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [group.status]: !current[group.status],
                    }))
                  }
                >
                  <span className="workspace-groupChevron">
                    {collapsedGroups[group.status] ? "▸" : "▾"}
                  </span>
                  <span className={`workspace-statusChip ${getStatusTone(group.status)}`}>
                    {group.status.toUpperCase()}
                  </span>
                  <span className="workspace-groupCount">{group.tasks.length}</span>
                </button>
              </div>

              {!collapsedGroups[group.status] && group.tasks.length > 0 ? (
                group.tasks.map((task) => {
                  const assignee = users.find((user) => user.id === task.assigneeId);
                  const subtasks = normalizeSubtasks(task.subtasks);
                  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length;
                  const progressLabel =
                    subtasks.length > 0 ? `${completedSubtasks}/${subtasks.length}` : "-";

                  return (
                    <div key={task.id} className="workspace-row">
                      <div className="workspace-nameCell">
                        <div className="workspace-rowDot" />
                        <div>
                          <p className="workspace-rowTitle">{task.title}</p>
                          <p className="workspace-rowMeta">
                            {task.projectName}
                            {task.description ? ` • ${task.description}` : ""}
                          </p>
                          {subtasks.length > 0 ? (
                            <div className="workspace-subtaskList">
                              {subtasks.map((subtask) => (
                                <div key={subtask.id} className="workspace-subtaskLine">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubtask(task.id, subtask.id)}
                                    className="workspace-subtaskToggle"
                                  >
                                    <span
                                      className={
                                        subtask.completed
                                          ? "workspace-subtaskDot done"
                                          : "workspace-subtaskDot"
                                      }
                                    />
                                    <span
                                      className={
                                        subtask.completed
                                          ? "workspace-subtaskText done"
                                          : "workspace-subtaskText"
                                      }
                                    >
                                      {subtask.title}
                                    </span>
                                  </button>
                                  <span className="workspace-subtaskAssignee">
                                    {users.find((user) => user.id === subtask.assigneeId)?.name ||
                                      "Unassigned"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="workspace-assigneeCell">
                        {assignee ? <Avatar user={assignee} /> : <span>-</span>}
                      </div>

                      <div className="workspace-mutedCell">{task.priority}</div>
                      <div className="workspace-mutedCell">{formatDate(task.dueDate)}</div>
                      <div>
                        <span className={`workspace-statusChip ${getStatusTone(task.status)}`}>
                          {task.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="workspace-progressCell">{progressLabel}</div>
                      <div className="workspace-actionsCell">
                        <button
                          type="button"
                          onClick={() => handleEdit(task)}
                          className="workspace-ghostButton"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="workspace-dangerButton"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : !collapsedGroups[group.status] ? (
                <div className="workspace-emptyRow">No tasks in this group.</div>
              ) : null}
            </div>
          ))}
        </section>
        ) : null}

        {activeView === "Inbox" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Inbox</p>
                  <h3 className="workspace-homePanelTitle">Recent task activity</h3>
                </div>
                <span className="workspace-homeMeta">{inboxTasks.length} latest items</span>
              </div>
              <div className="workspace-homeList">
                {inboxTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="workspace-homeItem"
                    onClick={() => {
                      setActiveView("Dashboard");
                      handleEdit(task);
                    }}
                  >
                    <div>
                      <p className="workspace-homeItemTitle">{task.title}</p>
                      <p className="workspace-homeItemMeta">
                        Updated {formatDate(task.updatedAt)} • {task.status}
                      </p>
                    </div>
                    <span className={`workspace-statusChip ${getStatusTone(task.status)}`}>
                      Open
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "My Tasks" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">My Tasks</p>
                  <h3 className="workspace-homePanelTitle">Assigned to {currentUser?.name || "you"}</h3>
                </div>
                <span className="workspace-homeMeta">{myTasks.length} tasks</span>
              </div>
              <div className="workspace-homeList">
                {myTasks.length > 0 ? (
                  myTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="workspace-homeItem"
                      onClick={() => {
                        setActiveView("Dashboard");
                        handleEdit(task);
                      }}
                    >
                      <div>
                        <p className="workspace-homeItemTitle">{task.title}</p>
                        <p className="workspace-homeItemMeta">
                          {task.projectName} • Due {formatDate(task.dueDate)}
                        </p>
                      </div>
                      <span className={`workspace-statusChip ${getStatusTone(task.status)}`}>
                        {task.status}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="workspace-homeEmpty">No task assigned to the primary user yet.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Replies" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Replies</p>
                  <h3 className="workspace-homePanelTitle">Subtasks needing response</h3>
                </div>
                <span className="workspace-homeMeta">{replyTasks.length} tasks</span>
              </div>
              <div className="workspace-homeList">
                {replyTasks.length > 0 ? (
                  replyTasks.map((task) => (
                    <div key={task.id} className="workspace-homeItem static">
                      <div>
                        <p className="workspace-homeItemTitle">{task.title}</p>
                        <p className="workspace-homeItemMeta">
                          {
                            normalizeSubtasks(task.subtasks).filter((subtask) => !subtask.completed)
                              .length
                          }{" "}
                          subtasks pending
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="workspace-homeEmpty">No pending replies right now.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Assigned" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Assigned</p>
                  <h3 className="workspace-homePanelTitle">All assigned tasks</h3>
                </div>
                <span className="workspace-homeMeta">{assignedTasks.length} tasks</span>
              </div>
              <div className="workspace-homeList">
                {assignedTasks.map((task) => {
                  const assignee = users.find((user) => user.id === task.assigneeId);

                  return (
                    <div key={task.id} className="workspace-homeItem static">
                      <div>
                        <p className="workspace-homeItemTitle">{task.title}</p>
                        <p className="workspace-homeItemMeta">
                          {assignee?.name || "Unassigned"} • {task.status}
                        </p>
                      </div>
                      {assignee ? <Avatar user={assignee} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Docs" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Docs</p>
                  <h3 className="workspace-homePanelTitle">Workspace documentation</h3>
                </div>
              </div>
              <div className="workspace-homeList">
                {docsItems.map((item) => (
                  <div key={item} className="workspace-homeItem static">
                    <div>
                      <p className="workspace-homeItemTitle">{item} handbook</p>
                      <p className="workspace-homeItemMeta">
                        Reference docs for this project workspace
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Forms" ? (
          <section className="workspace-home">
            <div className="workspace-homeGrid">
              <section className="workspace-homePanel">
                <div className="workspace-homePanelHeader">
                  <div>
                    <p className="workspace-sectionEyebrow">Forms</p>
                    <h3 className="workspace-homePanelTitle">Quick request forms</h3>
                  </div>
                </div>
                <div className="workspace-homeList">
                  {["Bug report", "Feature request", "QA handoff", "Deployment request"].map(
                    (item) => (
                      <div key={item} className="workspace-homeItem static">
                        <div>
                          <p className="workspace-homeItemTitle">{item}</p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
              <section className="workspace-homePanel">
                <div className="workspace-homePanelHeader">
                  <div>
                    <p className="workspace-sectionEyebrow">Usage</p>
                    <h3 className="workspace-homePanelTitle">Current intake</h3>
                  </div>
                </div>
                <div className="workspace-homeEmpty">
                  Forms view is active. You can turn these into real DB-backed submissions next.
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "Whiteboards" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Whiteboards</p>
                  <h3 className="workspace-homePanelTitle">Planning boards</h3>
                </div>
              </div>
              <div className="workspace-homeList">
                {[
                  "Architecture flow",
                  `${activeProject?.name || "Project"} roadmap`,
                  "Release prep board",
                ].map((item) => (
                  <div key={item} className="workspace-homeItem static">
                    <div>
                      <p className="workspace-homeItemTitle">{item}</p>
                      <p className="workspace-homeItemMeta">Collaborative planning surface</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Goals" ? (
          <section className="workspace-home">
            <div className="workspace-homeStats">
              {goalsSummary.map((goal) => (
                <HomeStatCard key={goal.label} label={goal.label} value={goal.value} />
              ))}
            </div>
            <div className="workspace-homePanel" style={{ marginTop: "1rem" }}>
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Goals</p>
                  <h3 className="workspace-homePanelTitle">Team execution status</h3>
                </div>
              </div>
              <div className="workspace-homeEmpty">
                Goal tracking sekarang menampilkan rangkuman task. Kalau mau, ini bisa
                disambungkan ke entity goals terpisah.
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "Timesheet" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">Timesheet</p>
                  <h3 className="workspace-homePanelTitle">Team, login, and Telegram routing</h3>
                </div>
                <button type="button" className="workspace-primaryButton" onClick={openCreateUserModal}>
                  + User
                </button>
              </div>
              <div className="workspace-homeList">
                {users.map((user) => {
                  const total = tasks.filter((task) => task.assigneeId === user.id).length;
                  const assignedSubtasks = tasks.reduce(
                    (count, task) =>
                      count +
                      task.subtasks.filter((subtask) => subtask.assigneeId === user.id).length,
                    0,
                  );

                  return (
                    <div key={user.id} className="workspace-homeItem static">
                      <div>
                        <p className="workspace-homeItemTitle">{user.name}</p>
                        <p className="workspace-homeItemMeta">
                          {user.telegramNumber || "No Telegram number"} • {total} tasks •{" "}
                          {assignedSubtasks} subtasks
                        </p>
                        <p className="workspace-homeItemMeta">
                          Chat ID: {user.telegramChatId || "Belum diisi"} • Login:{" "}
                          {user.hasPassword ? "Ready" : "Belum diset"}
                        </p>
                      </div>
                      <div className="workspace-userActions">
                        <Avatar user={user} />
                        <button
                          type="button"
                          onClick={() => handleUserEdit(user)}
                          className="workspace-ghostButton"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUserDelete(user.id)}
                          className="workspace-dangerButton"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {activeView !== "Home" &&
        activeView !== "Dashboard" &&
        activeView !== "Inbox" &&
        activeView !== "My Tasks" &&
        activeView !== "Replies" &&
        activeView !== "Assigned" &&
        activeView !== "Docs" &&
        activeView !== "Forms" &&
        activeView !== "Whiteboards" &&
        activeView !== "Goals" &&
        activeView !== "Timesheet" ? (
          <section className="workspace-home">
            <div className="workspace-homePanel">
              <div className="workspace-homePanelHeader">
                <div>
                  <p className="workspace-sectionEyebrow">{activeView}</p>
                  <h3 className="workspace-homePanelTitle">{activeView} is coming next</h3>
                </div>
              </div>
              <div className="workspace-homeEmpty">
                Menu ini sudah bisa dipilih. Kalau kamu mau, saya bisa lanjut bikin halaman
                `{activeView}` benar-benar hidup juga.
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {isModalOpen ? (
        <div className="workspace-modalOverlay" onClick={resetDraft}>
          <div
            className="workspace-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-modalHeader">
              <div className="workspace-modalTabs" aria-label="Task modal tabs">
                {MODAL_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={tab === "Task" ? "workspace-modalTab active" : "workspace-modalTab"}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="workspace-modalHeaderActions">
                <button type="button" className="workspace-modalIconButton" aria-label="Close">
                  ↘
                </button>
                <button
                  type="button"
                  onClick={resetDraft}
                  className="workspace-modalIconButton"
                  aria-label="Close task modal"
                >
                  ×
                </button>
              </div>
            </div>

            <form className="workspace-taskModalForm" onSubmit={handleSubmit}>
              <div className="workspace-taskModalBody">
                <div className="workspace-taskModalMeta">
                  <select
                    value={draft.projectId}
                    onChange={(event) => handleDraftChange("projectId", event.target.value)}
                    className="workspace-input workspace-modalCompactInput"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      handleDraftChange("priority", event.target.value as Priority)
                    }
                    className="workspace-input workspace-modalCompactInput"
                  >
                    <option value="Low">Low priority</option>
                    <option value="Medium">Medium priority</option>
                    <option value="High">High priority</option>
                  </select>
                </div>

                <div className="workspace-modalFieldBlock">
                  <label htmlFor={`${titleId}-title`} className="workspace-modalFieldLabel">
                    Task Name
                  </label>
                  <input
                    id={`${titleId}-title`}
                    value={draft.title}
                    onChange={(event) => handleDraftChange("title", event.target.value)}
                    placeholder="Enter task title"
                    className="workspace-input workspace-modalTitleInput"
                  />
                </div>

                <div className="workspace-modalFieldBlock">
                  <label
                    htmlFor={`${titleId}-description`}
                    className="workspace-modalFieldLabel"
                  >
                    Description
                  </label>
                  <textarea
                    id={`${titleId}-description`}
                    value={draft.description}
                    onChange={(event) => handleDraftChange("description", event.target.value)}
                    placeholder="Add description"
                    rows={3}
                    className="workspace-input workspace-modalDescription"
                  />
                </div>

                <div className="workspace-taskModalPills">
                  <label className="workspace-modalFieldPill">
                    <span>Status</span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        handleDraftChange("status", event.target.value as TaskStatus)
                      }
                      className="workspace-modalFieldControl"
                    >
                      <option value="Hold">TO DO</option>
                      <option value="In Progress">IN PROGRESS</option>
                      <option value="Done">DONE</option>
                    </select>
                  </label>

                  <label className="workspace-modalFieldPill">
                    <span>Assignee</span>
                    <select
                      value={draft.assigneeId}
                      onChange={(event) => handleDraftChange("assigneeId", event.target.value)}
                      className="workspace-modalFieldControl"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="workspace-modalFieldPill">
                    <span>Due date</span>
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) => handleDraftChange("dueDate", event.target.value)}
                      className="workspace-modalFieldControl"
                    />
                  </label>

                  <label className="workspace-modalFieldPill">
                    <span>Priority</span>
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        handleDraftChange("priority", event.target.value as Priority)
                      }
                      className="workspace-modalFieldControl"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                </div>

                <div className="workspace-taskModalSubtaskRow">
                  <div className="workspace-subtaskComposer">
                    <input
                      value={draft.subtaskInput}
                      onChange={(event) =>
                        handleDraftChange("subtaskInput", event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSubtaskToDraft();
                        }
                      }}
                      placeholder="Add subtask"
                      className="workspace-input workspace-modalSubtaskInput"
                    />
                    <select
                      value={subtaskAssigneeId}
                      onChange={(event) => setSubtaskAssigneeId(event.target.value)}
                      className="workspace-modalFieldControl workspace-modalSubtaskAssignee"
                    >
                      <option value="">Assign subtask</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addSubtaskToDraft}
                      className="workspace-ghostButton workspace-modalSubtaskButton"
                    >
                      Add
                    </button>
                  </div>

                  {draft.subtasks.length > 0 ? (
                    <div className="workspace-subtaskDrafts">
                      {draft.subtasks.map((subtask) => (
                        <div key={subtask.id} className="workspace-subtaskDraft">
                          <span>
                            {subtask.title}
                            {subtask.assigneeId
                              ? ` • ${
                                  users.find((user) => user.id === subtask.assigneeId)?.name ||
                                  "Assigned"
                                }`
                              : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDraftSubtask(subtask.id)}
                            className="workspace-subtaskRemove"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {validationMessage ? (
                  <p className="workspace-validation">{validationMessage}</p>
                ) : null}
                {requestError ? <p className="workspace-validation">{requestError}</p> : null}
              </div>

              <div className="workspace-modalFooter">
                <button type="button" className="workspace-ghostButton workspace-modalTemplateButton">
                  Templates
                </button>

                <div className="workspace-modalFooterActions">
                  <span className="workspace-modalFooterNote">
                    {draft.subtasks.length} subtasks
                  </span>
                  <button
                    type="submit"
                    className="workspace-primaryButton workspace-modalSubmitButton"
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving..."
                      : editingTaskId
                        ? "Save Task"
                        : "Create Task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isProjectModalOpen ? (
        <div className="workspace-modalOverlay" onClick={resetProjectDraft}>
          <div className="workspace-modal workspace-projectModal" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-modalHeader">
              <div>
                <p className="workspace-sectionEyebrow">Project</p>
                <h2 className="workspace-sectionTitle">
                  {editingProjectId ? "Edit project" : "Create project"}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetProjectDraft}
                className="workspace-modalIconButton"
                aria-label="Close project modal"
              >
                ×
              </button>
            </div>

            <form className="workspace-taskModalForm" onSubmit={handleProjectSubmit}>
              <div className="workspace-taskModalBody">
                <div className="workspace-modalFieldBlock">
                  <label htmlFor={`${titleId}-project`} className="workspace-modalFieldLabel">
                    Project Name
                  </label>
                  <input
                    id={`${titleId}-project`}
                    value={projectDraft.name}
                    onChange={(event) =>
                      setProjectDraft({
                        name: event.target.value,
                      })
                    }
                    placeholder="PR"
                    className="workspace-input workspace-modalTitleInput"
                  />
                </div>

                {projectValidationMessage ? (
                  <p className="workspace-validation">{projectValidationMessage}</p>
                ) : null}
                {projectRequestError ? (
                  <p className="workspace-validation">{projectRequestError}</p>
                ) : null}
              </div>

              <div className="workspace-modalFooter">
                <div className="workspace-modalFooterActions">
                  {editingProjectId ? (
                    <button
                      type="button"
                      className="workspace-dangerButton"
                      onClick={() => handleProjectDelete(editingProjectId)}
                    >
                      Delete Project
                    </button>
                  ) : null}
                </div>
                <div className="workspace-modalFooterActions">
                  <button type="button" className="workspace-ghostButton" onClick={resetProjectDraft}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="workspace-primaryButton workspace-modalSubmitButton"
                    disabled={isProjectSaving}
                  >
                    {isProjectSaving
                      ? "Saving..."
                      : editingProjectId
                        ? "Save Project"
                        : "Create Project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUserModalOpen ? (
        <div className="workspace-modalOverlay" onClick={resetUserDraft}>
          <div
            className="workspace-modal workspace-projectModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workspace-modalHeader">
              <div>
                <p className="workspace-sectionEyebrow">User</p>
                <h2 className="workspace-sectionTitle">
                  {editingUserId ? "Edit user" : "Create user"}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetUserDraft}
                className="workspace-modalIconButton"
                aria-label="Close user modal"
              >
                ×
              </button>
            </div>

            <form className="workspace-taskModalForm" onSubmit={handleUserSubmit}>
              <div className="workspace-taskModalBody">
                <div className="workspace-modalFieldBlock">
                  <label htmlFor={`${titleId}-user-name`} className="workspace-modalFieldLabel">
                    Name
                  </label>
                  <input
                    id={`${titleId}-user-name`}
                    value={userDraft.name}
                    onChange={(event) =>
                      setUserDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Bayu"
                    className="workspace-input workspace-modalTitleInput"
                  />
                </div>

                <div className="workspace-modalFieldBlock">
                  <label htmlFor={`${titleId}-user-number`} className="workspace-modalFieldLabel">
                    Telegram Number
                  </label>
                  <input
                    id={`${titleId}-user-number`}
                    value={userDraft.telegramNumber}
                    onChange={(event) =>
                      setUserDraft((current) => ({
                        ...current,
                        telegramNumber: event.target.value,
                      }))
                    }
                    placeholder="+628123456789"
                    className="workspace-input workspace-modalTitleInput"
                  />
                </div>

                <div className="workspace-modalFieldBlock">
                  <label htmlFor={`${titleId}-user-chat`} className="workspace-modalFieldLabel">
                    Telegram Chat ID
                  </label>
                  <input
                    id={`${titleId}-user-chat`}
                    value={userDraft.telegramChatId}
                    onChange={(event) =>
                      setUserDraft((current) => ({
                        ...current,
                        telegramChatId: event.target.value,
                      }))
                    }
                    placeholder="Optional: 123456789"
                    className="workspace-input workspace-modalTitleInput"
                  />
                </div>

                <div className="workspace-taskModalPills">
                  <label className="workspace-modalFieldPill">
                    <span>Password</span>
                    <input
                      type="password"
                      value={userDraft.password}
                      onChange={(event) =>
                        setUserDraft((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      placeholder={editingUserId ? "Leave blank to keep" : "At least 6 characters"}
                      className="workspace-modalFieldControl"
                    />
                  </label>

                  <label className="workspace-modalFieldPill">
                    <span>Color</span>
                    <input
                      value={userDraft.color}
                      onChange={(event) =>
                        setUserDraft((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      placeholder="teal"
                      className="workspace-modalFieldControl"
                    />
                  </label>
                </div>

                {userValidationMessage ? (
                  <p className="workspace-validation">{userValidationMessage}</p>
                ) : null}
                {userRequestError ? <p className="workspace-validation">{userRequestError}</p> : null}
              </div>

              <div className="workspace-modalFooter">
                <div className="workspace-modalFooterActions">
                  {editingUserId ? (
                    <button
                      type="button"
                      className="workspace-dangerButton"
                      onClick={() => handleUserDelete(editingUserId)}
                    >
                      Delete User
                    </button>
                  ) : null}
                </div>

                <div className="workspace-modalFooterActions">
                  <button type="button" className="workspace-ghostButton" onClick={resetUserDraft}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="workspace-primaryButton workspace-modalSubmitButton"
                    disabled={isUserSaving}
                  >
                    {isUserSaving ? "Saving..." : editingUserId ? "Save User" : "Create User"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function AuthShell({
  authForm,
  authError,
  isAuthenticating,
  isLoginMode,
  onSubmit,
  onChange,
  onToggleMode,
}: {
  authForm: AuthForm;
  authError: string;
  isAuthenticating: boolean;
  isLoginMode: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (field: keyof AuthForm, value: string) => void;
  onToggleMode: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-showcase">
          <div className="auth-badge">Todo Flow</div>
          <p className="workspace-sectionEyebrow">Telegram-Ready Workspace</p>
          <h1 className="auth-title">Akses workspace dengan identitas Telegram yang rapi dan aman.</h1>
          <p className="auth-copy">
            User bisa login memakai nomor Telegram, lalu assignment task dan subtask akan siap
            diarahkan ke Telegram begitu `chat id` user terhubung.
          </p>

          <div className="auth-featureList">
            <div className="auth-featureCard">
              <span className="auth-featureLabel">Account Access</span>
              <strong>Login berbasis nomor Telegram</strong>
              <p>Password tetap dipakai agar akses internal lebih aman.</p>
            </div>
            <div className="auth-featureCard">
              <span className="auth-featureLabel">Assignment Flow</span>
              <strong>Task dan subtask langsung terhubung</strong>
              <p>Siap dipakai untuk notifikasi Telegram per user yang di-assign.</p>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-cardHeader">
            <div>
              <p className="workspace-sectionEyebrow">{isLoginMode ? "Sign In" : "Create Account"}</p>
              <h2 className="auth-cardTitle">
                {isLoginMode ? "Welcome back" : "Register your team access"}
              </h2>
            </div>

            <div className="auth-switch" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={isLoginMode ? "auth-switchButton active" : "auth-switchButton"}
                onClick={() => {
                  if (!isLoginMode) {
                    onToggleMode();
                  }
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={!isLoginMode ? "auth-switchButton active" : "auth-switchButton"}
                onClick={() => {
                  if (isLoginMode) {
                    onToggleMode();
                  }
                }}
              >
                Register
              </button>
            </div>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {!isLoginMode ? (
              <label className="auth-field">
                <span className="auth-label">Full Name</span>
                <input
                  value={authForm.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  placeholder="Bayu Pratama"
                  className="workspace-input auth-input"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span className="auth-label">Telegram Number</span>
              <input
                value={authForm.telegramNumber}
                onChange={(event) => onChange("telegramNumber", event.target.value)}
                placeholder="+628123456789"
                className="workspace-input auth-input"
              />
            </label>

            {!isLoginMode ? (
              <label className="auth-field">
                <span className="auth-label">Telegram Chat ID</span>
                <input
                  value={authForm.telegramChatId}
                  onChange={(event) => onChange("telegramChatId", event.target.value)}
                  placeholder="Optional, isi jika sudah tahu"
                  className="workspace-input auth-input"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => onChange("password", event.target.value)}
                placeholder={isLoginMode ? "Enter your password" : "Minimal 6 karakter"}
                className="workspace-input auth-input"
              />
            </label>

            {authError ? <p className="workspace-validation">{authError}</p> : null}

            <button
              type="submit"
              className="workspace-primaryButton auth-submit"
              disabled={isAuthenticating}
            >
              {isAuthenticating
                ? "Please wait..."
                : isLoginMode
                  ? "Login To Workspace"
                  : "Create Account"}
            </button>
          </form>

          <div className="auth-footer">
            <span>{isLoginMode ? "Belum punya akun?" : "Sudah punya akun?"}</span>
            <button type="button" className="auth-inlineButton" onClick={onToggleMode}>
              {isLoginMode ? "Register sekarang" : "Masuk di sini"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeStatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="workspace-homeStat">
      <p className="workspace-homeStatLabel">{label}</p>
      <p className="workspace-homeStatValue">{value}</p>
    </article>
  );
}

function Avatar({
  user,
}: {
  user: Pick<WorkspaceUser, "initials" | "tone"> | Pick<SessionUser, "initials" | "color">;
}) {
  const tone = "tone" in user ? user.tone : user.color;
  return <span className={`workspace-avatar ${tone}`}>{user.initials}</span>;
}

function getStatusTone(status: TaskStatus) {
  if (status === "Hold") {
    return "hold";
  }

  if (status === "In Progress") {
    return "progress";
  }

  return "done";
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getDaysLeft(value: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  const dueDate = new Date(value);
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const dueStart = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  ).getTime();

  return Math.round((dueStart - todayStart) / 86_400_000);
}

function WorkspaceSkeleton() {
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-skeletonBox h-16" />
        <div className="workspace-skeletonStack">
          <div className="workspace-skeletonBox h-10" />
          <div className="workspace-skeletonBox h-10" />
          <div className="workspace-skeletonBox h-10" />
        </div>
      </aside>

      <section className="workspace-main">
        <div className="workspace-skeletonBox h-22" />
        <div className="workspace-skeletonBox h-36" />
        <div className="workspace-skeletonBox h-[560px]" />
      </section>
    </main>
  );
}
