import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Check, FolderKanban, Loader2, Settings, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "../_core/hooks/useAuth";

type StudyFormState = {
  code: string;
  name: string;
  description: string;
  clientName: string;
  defaultLanguage: "es" | "en";
};

type StudyEditState = {
  name: string;
  description: string;
  clientName: string;
  status: "draft" | "active" | "paused" | "archived";
  defaultLanguage: "es" | "en";
};

type StudySettingsState = {
  projectName: string;
  exportProjectName: string;
};

const emptyCreateForm: StudyFormState = {
  code: "",
  name: "",
  description: "",
  clientName: "",
  defaultLanguage: "en",
};

const statusTone: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  draft: "secondary",
  paused: "outline",
  archived: "destructive",
};

const membershipRoleLabels: Record<string, string> = {
  administrator: "Administrator",
  interviewer: "Interviewer",
  reviewer: "Reviewer",
};

function StudyStatusBadge({ status }: { status?: string | null }) {
  const normalized = status ?? "draft";
  return (
    <Badge variant={statusTone[normalized] ?? "secondary"} className="uppercase tracking-wide">
      {normalized}
    </Badge>
  );
}

function getUserDisplayName(user: any) {
  return user?.userName
    || user?.name
    || user?.username
    || user?.email
    || user?.userIdentifier
    || user?.identifier
    || `User ${user?.userId ?? user?.id}`;
}

function getUserSecondaryLabel(user: any) {
  return user?.userIdentifier
    || user?.identifier
    || user?.email
    || user?.username
    || "No identifier";
}

export default function StudiesPage() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const studiesQuery = trpc.studies.list.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const currentStudyQuery = trpc.studies.current.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const usersQuery = trpc.users.list.useQuery(undefined, {
    enabled: user?.platformRole === "supervisor",
  });

  const isSupervisor = user?.platformRole === "supervisor";
  const studies = useMemo(() => studiesQuery.data ?? [], [studiesQuery.data]);
  const currentStudy = currentStudyQuery.data?.study ?? null;
  const currentStudySettings = currentStudyQuery.data?.settings ?? null;
  const currentMemberships = useMemo(() => currentStudyQuery.data?.memberships ?? [], [currentStudyQuery.data?.memberships]);
  const currentStudyId = currentStudy?.id ?? user?.activeStudyId ?? null;

  const [createForm, setCreateForm] = useState<StudyFormState>(emptyCreateForm);
  const [editForm, setEditForm] = useState<StudyEditState>({
    name: "",
    description: "",
    clientName: "",
    status: "draft",
    defaultLanguage: "en",
  });
  const [settingsForm, setSettingsForm] = useState<StudySettingsState>({
    projectName: "",
    exportProjectName: "",
  });
  const [assignment, setAssignment] = useState({
    userId: "",
    studyRole: "administrator" as "administrator" | "interviewer" | "reviewer",
  });

  useEffect(() => {
    if (!currentStudy) return;
    setEditForm({
      name: currentStudy.name ?? "",
      description: currentStudy.description ?? "",
      clientName: currentStudy.clientName ?? "",
      status: (currentStudy.status as StudyEditState["status"]) ?? "draft",
      defaultLanguage: (currentStudy.defaultLanguage as StudyEditState["defaultLanguage"]) ?? "en",
    });
    setSettingsForm({
      projectName: currentStudySettings?.projectName ?? currentStudy.name ?? "",
      exportProjectName: currentStudySettings?.exportProjectName ?? currentStudy.code ?? "",
    });
  }, [currentStudy, currentStudySettings]);

  const refreshStudyData = async () => {
    await Promise.all([
      utils.auth.me.invalidate(),
      utils.studies.invalidate(),
      utils.users.invalidate(),
      utils.templates.invalidate(),
      utils.questions.invalidate(),
      utils.responses.invalidate(),
      utils.photos.invalidate(),
      utils.fieldMetrics.invalidate(),
      utils.dashboard.invalidate(),
      utils.pedestrian.invalidate(),
      utils.passes.invalidate(),
      utils.countingSessions.invalidate(),
      utils.appSettings.invalidate(),
      utils.countingPoints.invalidate(),
      utils.directions.invalidate(),
      utils.export.invalidate(),
      utils.exportExtra.invalidate(),
      utils.shifts.invalidate(),
      utils.shiftClosures.invalidate(),
      utils.quotas.invalidate(),
    ]);
  };

  const setActiveMutation = trpc.studies.setActive.useMutation({
    onSuccess: async () => {
      await refreshStudyData();
      toast.success("Active study updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const createMutation = trpc.studies.create.useMutation({
    onSuccess: async (createdStudy) => {
      setCreateForm(emptyCreateForm);
      await refreshStudyData();
      toast.success("Study created successfully");
      if (createdStudy?.id) {
        setActiveMutation.mutate({ studyId: createdStudy.id });
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStudyMutation = trpc.studies.update.useMutation({
    onSuccess: async () => {
      await refreshStudyData();
      toast.success("Study details updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSettingsMutation = trpc.studies.updateSettings.useMutation({
    onSuccess: async () => {
      await refreshStudyData();
      toast.success("Study settings updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const assignUserMutation = trpc.studies.assignUser.useMutation({
    onSuccess: async () => {
      setAssignment({ userId: "", studyRole: "administrator" });
      await refreshStudyData();
      toast.success("User assigned to study");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateAssignmentMutation = trpc.studies.updateAssignment.useMutation({
    onSuccess: async () => {
      await refreshStudyData();
      toast.success("Membership updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const assignedUserIds = useMemo(() => new Set(currentMemberships.map((item: any) => item.userId)), [currentMemberships]);
  const availableUsers = useMemo(
    () => allUsers.filter((candidate: any) => !assignedUserIds.has(candidate.id)),
    [allUsers, assignedUserIds],
  );

  const handleActivateStudy = async (studyId: number) => {
    await setActiveMutation.mutateAsync({ studyId });
    setLocation("/studies");
  };

  const activeStudyName = currentStudy?.name ?? user?.activeStudy?.name ?? "No active study";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Studies</h1>
          <p className="text-muted-foreground max-w-3xl">
            Manage the multi-study workspace, activate the current investigation context, and maintain the people responsible for each study. Supervisors can create new studies, archive old ones and assign administrators, reviewers and interviewers from one screen.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            {isSupervisor && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    Create new study
                  </CardTitle>
                  <CardDescription>
                    Every new investigation starts here. Once created, it can immediately receive members, study-specific settings and an active supervisor context.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="study-code">Study code</Label>
                    <Input
                      id="study-code"
                      value={createForm.code}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
                      placeholder="study-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="study-name">Study name</Label>
                    <Input
                      id="study-name"
                      value={createForm.name}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Mobility and perception baseline"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="study-description">Description</Label>
                    <Textarea
                      id="study-description"
                      value={createForm.description}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Scope, target population and operational notes for the study"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="study-client">Client</Label>
                    <Input
                      id="study-client"
                      value={createForm.clientName}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, clientName: event.target.value }))}
                      placeholder="City Council"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="study-language">Default language</Label>
                    <select
                      id="study-language"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={createForm.defaultLanguage}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, defaultLanguage: event.target.value as "es" | "en" }))}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      onClick={() => createMutation.mutate(createForm)}
                      disabled={createMutation.isPending || !createForm.code.trim() || !createForm.name.trim()}
                    >
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create study"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Available studies</CardTitle>
                <CardDescription>
                  Select a study to enter its administration context. The currently active study is highlighted and drives all study-scoped screens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {studiesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : studies.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                    No studies are available yet.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {studies.map((study: any) => {
                      const membership = "membership" in study ? study.membership : null;
                      const isActive = study.id === currentStudyId;
                      return (
                        <Card key={study.id} className={isActive ? "border-primary shadow-sm" : "border-border/60"}>
                          <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <CardTitle className="text-lg">{study.name}</CardTitle>
                                <CardDescription className="text-xs uppercase tracking-wide">
                                  {study.code}
                                </CardDescription>
                              </div>
                              <StudyStatusBadge status={study.status} />
                            </div>
                            {membership && (
                              <p className="text-xs text-muted-foreground">
                                Membership role: <strong>{membershipRoleLabels[membership.studyRole] ?? membership.studyRole}</strong>
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="min-h-12 text-sm text-muted-foreground">
                              {study.description || "No description provided yet for this study."}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>Client: {study.clientName || "Not set"}</span>
                              <span>•</span>
                              <span>Language: {(study.defaultLanguage || "en").toUpperCase()}</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground">
                                {isActive ? `Current study: ${activeStudyName}` : "Inactive context"}
                              </div>
                              <Button
                                variant={isActive ? "secondary" : "default"}
                                onClick={() => handleActivateStudy(study.id)}
                                disabled={setActiveMutation.isPending}
                              >
                                {isActive ? <><Check className="h-4 w-4" /> Current study</> : "Use this study"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active study workspace</CardTitle>
                <CardDescription>
                  The forms below always act on the currently active study. Use the study cards or the navigation selector to switch context.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!currentStudy ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    No active study is selected. Choose one from the list to load study administration details.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{currentStudy.name}</p>
                          <p className="text-xs text-muted-foreground">{currentStudy.code}</p>
                        </div>
                        <StudyStatusBadge status={currentStudy.status} />
                      </div>
                    </div>

                    {isSupervisor && (
                      <Card className="border-border/60 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">Study details</CardTitle>
                          <CardDescription>
                            Update the study profile, default language and operational status. Archiving keeps data available while removing it from active operations.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-study-name">Study name</Label>
                            <Input
                              id="edit-study-name"
                              value={editForm.name}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-study-description">Description</Label>
                            <Textarea
                              id="edit-study-description"
                              rows={3}
                              value={editForm.description}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="edit-study-client">Client</Label>
                              <Input
                                id="edit-study-client"
                                value={editForm.clientName}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, clientName: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-study-language">Default language</Label>
                              <select
                                id="edit-study-language"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={editForm.defaultLanguage}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, defaultLanguage: event.target.value as "es" | "en" }))}
                              >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-study-status">Status</Label>
                            <select
                              id="edit-study-status"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={editForm.status}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as StudyEditState["status"] }))}
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="paused">Paused</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => updateStudyMutation.mutate({
                                id: currentStudy.id,
                                name: editForm.name,
                                description: editForm.description || null,
                                clientName: editForm.clientName || null,
                                status: editForm.status,
                                defaultLanguage: editForm.defaultLanguage,
                              })}
                              disabled={updateStudyMutation.isPending || !editForm.name.trim()}
                            >
                              {updateStudyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save study details"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-border/60 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4 text-primary" />
                          Study identity settings
                        </CardTitle>
                        <CardDescription>
                          These values define the study-specific project name and export label that will later feed the configuration hub and dynamic exports.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="settings-project-name">Project name</Label>
                          <Input
                            id="settings-project-name"
                            value={settingsForm.projectName}
                            onChange={(event) => setSettingsForm((prev) => ({ ...prev, projectName: event.target.value }))}
                            placeholder="Visible project name inside the app"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="settings-export-name">Export project name</Label>
                          <Input
                            id="settings-export-name"
                            value={settingsForm.exportProjectName}
                            onChange={(event) => setSettingsForm((prev) => ({ ...prev, exportProjectName: event.target.value }))}
                            placeholder="Short label for CSV exports"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={() => updateSettingsMutation.mutate({
                              studyId: currentStudy.id,
                              projectName: settingsForm.projectName,
                              exportProjectName: settingsForm.exportProjectName,
                            })}
                            disabled={
                              updateSettingsMutation.isPending
                              || !settingsForm.projectName.trim()
                              || !settingsForm.exportProjectName.trim()
                            }
                          >
                            {updateSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save study settings"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {isSupervisor && (
                      <Card className="border-border/60 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Study memberships
                          </CardTitle>
                          <CardDescription>
                            Add administrators, reviewers and interviewers to the active study. Existing memberships can be deactivated without removing their historical records.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                            <div className="space-y-2">
                              <Label htmlFor="assignment-user">User</Label>
                              <select
                                id="assignment-user"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={assignment.userId}
                                onChange={(event) => setAssignment((prev) => ({ ...prev, userId: event.target.value }))}
                              >
                                <option value="">Select a user</option>
                                {availableUsers.map((candidate: any) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {getUserDisplayName(candidate)} {getUserSecondaryLabel(candidate) !== getUserDisplayName(candidate) ? `· ${getUserSecondaryLabel(candidate)}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="assignment-role">Study role</Label>
                              <select
                                id="assignment-role"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={assignment.studyRole}
                                onChange={(event) => setAssignment((prev) => ({ ...prev, studyRole: event.target.value as typeof prev.studyRole }))}
                              >
                                <option value="administrator">Administrator</option>
                                <option value="reviewer">Reviewer</option>
                                <option value="interviewer">Interviewer</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                className="w-full"
                                onClick={() => assignUserMutation.mutate({
                                  studyId: currentStudy.id,
                                  userId: Number(assignment.userId),
                                  studyRole: assignment.studyRole,
                                  isActive: true,
                                })}
                                disabled={assignUserMutation.isPending || !assignment.userId}
                              >
                                {assignUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Assign</>}
                              </Button>
                            </div>
                          </div>

                          {currentMemberships.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                              No members have been assigned to this study yet.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {currentMemberships.map((membership: any) => (
                                <div key={membership.id} className="rounded-lg border p-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{getUserDisplayName(membership)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {getUserSecondaryLabel(membership)}
                                        {membership.userRole ? ` · Base role: ${membership.userRole}` : ""}
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                      <select
                                        className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                                        value={membership.studyRole}
                                        onChange={(event) => updateAssignmentMutation.mutate({
                                          id: membership.id,
                                          studyRole: event.target.value as "administrator" | "interviewer" | "reviewer",
                                        })}
                                        disabled={updateAssignmentMutation.isPending}
                                      >
                                        <option value="administrator">Administrator</option>
                                        <option value="reviewer">Reviewer</option>
                                        <option value="interviewer">Interviewer</option>
                                      </select>
                                      <Button
                                        variant={membership.isActive ? "outline" : "secondary"}
                                        onClick={() => updateAssignmentMutation.mutate({ id: membership.id, isActive: !membership.isActive })}
                                        disabled={updateAssignmentMutation.isPending}
                                      >
                                        {membership.isActive ? "Deactivate" : "Reactivate"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
