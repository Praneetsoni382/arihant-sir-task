import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  User as UserIcon,
  X,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { employeeApi, taskApi } from '../../services/api';
import type { User } from '../../types';

export function CreateTaskPage() {
  const navigate = useNavigate();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState<'solo' | 'group'>('solo');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [managerNote, setManagerNote] = useState('');

  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTimes, setReminderTimes] = useState<string[]>(['12:00', '15:00']);
  const [newReminderTime, setNewReminderTime] = useState('17:00');

  const [formError, setFormError] = useState<string | null>(null);

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ['active-employees'],
    queryFn: async () => {
      const res = await employeeApi.getAll({ active: 'true' });
      return (res.data?.data ?? []) as User[];
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: unknown) => taskApi.create(payload),
    onSuccess: (res) => {
      const created = res.data?.data as { id: string };
      navigate(`/admin/tasks/${created.id}`);
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to create task';
      setFormError(errorMsg);
    },
  });

  const handleToggleUser = (userId: string) => {
    if (assignmentType === 'solo') {
      setSelectedUserIds([userId]);
    } else {
      if (selectedUserIds.includes(userId)) {
        setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
      } else {
        setSelectedUserIds([...selectedUserIds, userId]);
      }
    }
  };

  const handleAddReminderTime = () => {
    if (newReminderTime && !reminderTimes.includes(newReminderTime)) {
      setReminderTimes([...reminderTimes, newReminderTime].sort());
    }
  };

  const handleRemoveReminderTime = (time: string) => {
    setReminderTimes(reminderTimes.filter((t) => t !== time));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Task description is required.');
      return;
    }
    if (!deadlineDate) {
      setFormError('Please select a deadline.');
      return;
    }
    if (assignmentType === 'solo' && selectedUserIds.length !== 1) {
      setFormError('Solo tasks must have exactly one employee selected.');
      return;
    }
    if (assignmentType === 'group' && selectedUserIds.length < 2) {
      setFormError('Group tasks require at least two assigned employees.');
      return;
    }

    const payload = {
      title,
      description,
      assignmentType,
      priority,
      category,
      department,
      deadline: new Date(deadlineDate).toISOString(),
      startDate: startDate ? new Date(startDate).toISOString() : null,
      timezone: 'Asia/Kolkata',
      reminderEnabled,
      reminderTimes,
      managerNote,
      assignedUserIds: selectedUserIds,
    };

    createTaskMutation.mutate(payload);
  };

  return (
    <AppLayout title="Create New Task">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/admin/tasks')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3157A4] hover:underline cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to All Tasks</span>
        </button>

        <div className="pb-3 border-b border-[#E4E8EF]">
          <h1 className="text-xl font-bold text-[#172033]">Define Task Assignment</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Set responsibilities, group collaboration, deadlines, and automated reminder policies
          </p>
        </div>

        {formError && (
          <div className="p-4 bg-[#FFF0F0] border border-[#F5B8B8] text-[#D64545] rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>1. Task Specifications</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Input
                label="Task Title *"
                placeholder="e.g. Conduct Client Onboarding Audit"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <Textarea
                label="Detailed Description & Deliverable Scope *"
                placeholder="Provide clear guidelines, requirements, external tools needed, and success criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Priority Level"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')
                  }
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'critical', label: 'Critical' },
                  ]}
                />

                <Input
                  label="Category (Optional)"
                  placeholder="e.g. Compliance, Dev, QA"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />

                <Select
                  label="Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  options={[
                    { value: 'Engineering', label: 'Engineering' },
                    { value: 'Sales', label: 'Sales' },
                    { value: 'Operations', label: 'Operations' },
                    { value: 'Marketing', label: 'Marketing' },
                    { value: 'Finance', label: 'Finance' },
                    { value: 'Product', label: 'Product' },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Section 2: Assignment Mode & Personnel Picker */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>2. Responsibility & Assignees</CardTitle>
                <p className="text-xs text-[#667085]">Solo assignment or multi-employee group collaboration</p>
              </div>
            </CardHeader>

            <div className="space-y-4">
              {/* Assignment Mode Radio */}
              <div className="grid grid-cols-2 gap-3">
                <label
                  onClick={() => {
                    setAssignmentType('solo');
                    if (selectedUserIds.length > 1) setSelectedUserIds([selectedUserIds[0]]);
                  }}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    assignmentType === 'solo'
                      ? 'border-[#3157A4] bg-[#EBF3FF]/40 text-[#3157A4]'
                      : 'border-[#E4E8EF] hover:bg-[#F9FBFF] text-[#172033]'
                  }`}
                >
                  <UserIcon size={18} />
                  <div>
                    <p className="text-xs font-bold">Solo Assignment</p>
                    <p className="text-[11px] text-[#667085]">Delegated to exactly one employee</p>
                  </div>
                </label>

                <label
                  onClick={() => setAssignmentType('group')}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    assignmentType === 'group'
                      ? 'border-[#3157A4] bg-[#EBF3FF]/40 text-[#3157A4]'
                      : 'border-[#E4E8EF] hover:bg-[#F9FBFF] text-[#172033]'
                  }`}
                >
                  <Users size={18} />
                  <div>
                    <p className="text-xs font-bold">Group Assignment</p>
                    <p className="text-[11px] text-[#667085]">Cross-functional team (Min. 2 members)</p>
                  </div>
                </label>
              </div>

              {/* Selected Chips */}
              {selectedUserIds.length > 0 && (
                <div className="p-3 bg-[#FBFBFC] border border-[#E4E8EF] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span>Selected Personnel ({selectedUserIds.length})</span>
                    {assignmentType === 'group' && selectedUserIds.length < 2 && (
                      <span className="text-[#D64545] font-medium">Select at least 1 more member</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserIds.map((userId) => {
                      const emp = employees.find((e) => e.id === userId);
                      if (!emp) return null;
                      return (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-[#3157A4] text-[#3157A4] shadow-xs"
                        >
                          <span>{emp.fullName} ({emp.employeeId})</span>
                          <button
                            type="button"
                            onClick={() => handleToggleUser(userId)}
                            className="hover:text-[#D64545] cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Employee Selection List */}
              <div className="border border-[#E4E8EF] rounded-xl max-h-56 overflow-y-auto divide-y divide-[#E4E8EF]">
                {employees.length === 0 ? (
                  <p className="p-4 text-xs text-center text-[#667085]">No active employees available.</p>
                ) : (
                  employees.map((emp) => {
                    const isSelected = selectedUserIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleUser(emp.id)}
                        className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#F0F5FF]' : 'hover:bg-[#F9FBFF]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={assignmentType === 'solo' ? 'radio' : 'checkbox'}
                            checked={isSelected}
                            onChange={() => {}}
                            className="text-[#3157A4] focus:ring-[#3157A4]"
                          />
                          <div>
                            <p className="font-semibold text-[#172033]">{emp.fullName}</p>
                            <p className="text-[11px] text-[#667085]">
                              {emp.employeeId} • {emp.department} • {emp.designation || 'Staff'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-[#667085]">{emp.email}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>

          {/* Section 3: Schedule, Deadlines & Reminder Settings */}
          <Card>
            <CardHeader>
              <CardTitle>3. Timeline & Automated Reminders (Asia/Kolkata)</CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Target Deadline Date (DD/MM/YYYY) *"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  helperText="Evaluated in Indian Standard Time (IST / Asia/Kolkata)"
                  required
                />

                <Input
                  label="Commencement / Start Date (Optional)"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* Reminders policy */}
              <div className="pt-3 border-t border-[#E4E8EF]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-xs font-semibold text-[#172033] flex items-center gap-2">
                      <Clock size={15} className="text-[#3157A4]" />
                      <span>Task Submission Reminders</span>
                    </label>
                    <p className="text-[11px] text-[#667085]">
                      Sends internal in-app notifications until individual submission is approved
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#3157A4] rounded cursor-pointer"
                  />
                </div>

                {reminderEnabled && (
                  <div className="p-3 bg-[#FBFBFC] rounded-xl border border-[#E4E8EF] space-y-3">
                    <p className="text-xs font-medium text-[#172033]">Scheduled Daily Reminder Times (IST):</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {reminderTimes.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#E4E8EF] text-[#172033] font-medium flex items-center gap-1.5"
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveReminderTime(t)}
                            className="text-[#667085] hover:text-[#D64545] cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={newReminderTime}
                          onChange={(e) => setNewReminderTime(e.target.value)}
                          className="px-2 py-1 text-xs border border-[#E4E8EF] bg-white rounded-lg focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddReminderTime}
                          className="px-2 py-1 text-xs bg-[#EBF3FF] text-[#3157A4] font-semibold rounded-lg hover:bg-[#D9E8FF] cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal Manager Note */}
              <Textarea
                label="Internal Manager Note (Optional)"
                placeholder="Confidential notes or context visible to managers..."
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                rows={2}
              />
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/tasks')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={createTaskMutation.isPending}
            >
              Issue & Assign Task
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

