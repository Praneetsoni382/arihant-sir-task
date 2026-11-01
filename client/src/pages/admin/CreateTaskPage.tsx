import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  User as UserIcon,
  X,
  Clock,
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
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [startDate, setStartDate] = useState('');
  const [managerNote, setManagerNote] = useState('');

  // Reminder settings (Asia/Kolkata / IST Time Slots)
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:30', '12:00', '15:00', '18:00']);
  const [customSlot, setCustomSlot] = useState('16:00');

  const PRESET_TIME_SLOTS = [
    { time: '09:30', label: '09:30 AM', desc: 'Morning Standup' },
    { time: '12:00', label: '12:00 PM', desc: 'Mid-day Review' },
    { time: '15:00', label: '03:00 PM', desc: 'Afternoon Follow-up' },
    { time: '18:00', label: '06:00 PM', desc: 'End of Day Wrap-up' },
    { time: '21:00', label: '09:00 PM', desc: 'Night Urgent Alert' },
  ];

  const formatTime12 = (time24: string): string => {
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

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

  const handleTogglePresetSlot = (time: string) => {
    if (reminderTimes.includes(time)) {
      setReminderTimes(reminderTimes.filter((t) => t !== time));
    } else {
      setReminderTimes([...reminderTimes, time].sort());
    }
  };

  const handleAddCustomSlot = () => {
    if (customSlot && !reminderTimes.includes(customSlot)) {
      setReminderTimes([...reminderTimes, customSlot].sort());
    }
  };

  const handleRemoveReminderTime = (time: string) => {
    setReminderTimes(reminderTimes.filter((t) => t !== time));
  };

  const handleSelectAllPresets = () => {
    const all = PRESET_TIME_SLOTS.map((p) => p.time);
    setReminderTimes([...all].sort());
  };

  const handleClearSlots = () => {
    setReminderTimes([]);
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
      setFormError('Please select a deadline date.');
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

    // Build ISO timestamp in Indian Standard Time (UTC+5:30)
    const timeStr = deadlineTime ? deadlineTime : '18:00';
    let deadlineISO: string;
    try {
      // +05:30 offset for Asia/Kolkata
      deadlineISO = new Date(`${deadlineDate}T${timeStr}:00+05:30`).toISOString();
    } catch {
      deadlineISO = new Date(deadlineDate).toISOString();
    }

    const payload = {
      title,
      description,
      assignmentType,
      priority,
      category,
      department,
      deadline: deadlineISO,
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Section 3: Schedule, Deadlines & Indian Standard Time Slot Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>3. Timeline & Automated Reminder Slots (Indian Standard Time)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3157A4]/10 text-[#3157A4]">
                  IST • UTC+5:30
                </span>
              </CardTitle>
            </CardHeader>

            <div className="space-y-5">
              {/* Deadline & Start Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Target Deadline Date *"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  helperText="Date evaluated in Indian Standard Time (IST)"
                  required
                />

                <Input
                  label="Target Deadline Time (IST) *"
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  helperText="Default: 18:00 (06:00 PM IST)"
                  required
                />

                <Input
                  label="Commencement Date (Optional)"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* Automated Reminders Policy & Slot Selection */}
              <div className="pt-4 border-t border-[#E4E8EF] space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#172033] flex items-center gap-2">
                      <Clock size={16} className="text-[#3157A4]" />
                      <span>Automated Pending Task Reminders (IST Clock Dispatch)</span>
                    </label>
                    <p className="text-[11px] text-[#667085] mt-0.5 leading-relaxed">
                      Automatically dispatches push & in-app alerts of pending tasks to assigned employees at prescribed Indian Standard Time slots until individual submission is approved.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#3157A4] rounded cursor-pointer mt-0.5"
                  />
                </div>

                {reminderEnabled && (
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-4">
                    {/* Presets Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#172033]">
                          Choose Reminder Time Slots (IST):
                        </span>
                        <span className="text-[10px] bg-blue-100 text-[#3157A4] font-semibold px-2 py-0.5 rounded-full">
                          {reminderTimes.length} Active Slot(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={handleSelectAllPresets}
                          className="text-[#3157A4] font-medium hover:underline cursor-pointer"
                        >
                          Select All Standard
                        </button>
                        <span className="text-gray-300">•</span>
                        <button
                          type="button"
                          onClick={handleClearSlots}
                          className="text-[#D64545] font-medium hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Preset Slot Buttons Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      {PRESET_TIME_SLOTS.map((slot) => {
                        const isSelected = reminderTimes.includes(slot.time);
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => handleTogglePresetSlot(slot.time)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#3157A4] border-[#3157A4] text-white shadow-xs'
                                : 'bg-white border-[#E2E8F0] text-[#172033] hover:border-[#3157A4]/50 hover:bg-[#F0F5FF]'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono font-bold text-xs">
                                {slot.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {slot.time}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] mt-1.5 truncate ${
                                isSelected ? 'text-blue-100' : 'text-[#667085]'
                              }`}
                            >
                              {slot.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Time Slot Input */}
                    <div className="pt-2 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-[11px] font-semibold text-[#172033] shrink-0">
                          Custom Time Slot (IST):
                        </label>
                        <input
                          type="time"
                          value={customSlot}
                          onChange={(e) => setCustomSlot(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-[#CBD5E1] bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3157A4] font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomSlot}
                          className="px-3 py-1.5 text-xs bg-[#EBF3FF] hover:bg-[#D9E8FF] text-[#3157A4] font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          + Add Slot
                        </button>
                      </div>

                      <div className="text-[11px] text-[#667085] flex items-center gap-1.5">
                        <Clock size={13} className="text-[#3157A4]" />
                        <span>Dispatches daily at prescribed IST timings</span>
                      </div>
                    </div>

                    {/* Selected Active Slots Summary */}
                    {reminderTimes.length > 0 ? (
                      <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                        <span className="text-[11px] font-semibold text-[#475569]">
                          Active Daily Reminder Schedule (IST):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {reminderTimes.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#3157A4]/30 text-[#172033] text-xs font-medium shadow-2xs"
                            >
                              <span className="font-mono text-[#3157A4] font-bold">{t}</span>
                              <span className="text-[#64748B] text-[11px]">({formatTime12(t)} IST)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveReminderTime(t)}
                                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-0.5"
                                title="Remove time slot"
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        ⚠️ No reminder time slots selected. Please choose at least one slot so pending work notifications can be dispatched automatically.
                      </p>
                    )}
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
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/tasks')}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={createTaskMutation.isPending}
              className="w-full sm:w-auto"
            >
              Issue & Assign Task
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

