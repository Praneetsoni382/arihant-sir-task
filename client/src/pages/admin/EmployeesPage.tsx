import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Power,
  Download,
} from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { employeeApi } from '../../services/api';
import { formatDate } from '../../utils/formatDate';
import type { User } from '../../types';

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    employeeId: '',
    email: '',
    department: 'Engineering',
    designation: '',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await employeeApi.exportCsv();
    } catch (err) {
      console.error('Failed to export employee CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', departmentFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (departmentFilter) params.department = departmentFilter;
      if (statusFilter) params.active = statusFilter;
      const res = await employeeApi.getAll(params);
      return (res.data?.data ?? []) as User[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => employeeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to create employee';
      setFormError(errorMsg);
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      employeeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditModalOpen(false);
      setSelectedEmployee(null);
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update employee';
      setFormError(errorMsg);
    },
  });

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      employeeApi.updateStatus(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      employeeId: '',
      email: '',
      department: 'Engineering',
      designation: '',
      password: '',
    });
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    // Auto-generate temporary password and employee ID
    const randomId = `EMP-${Math.floor(100 + Math.random() * 900)}`;
    const randomPass = `Emp@${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData((prev) => ({
      ...prev,
      employeeId: randomId,
      password: randomPass,
    }));
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (emp: User) => {
    setSelectedEmployee(emp);
    setFormData({
      fullName: emp.fullName,
      employeeId: emp.employeeId,
      email: emp.email,
      department: emp.department,
      designation: emp.designation,
      password: '',
    });
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setFormError(null);
    editMutation.mutate({
      id: selectedEmployee.id,
      data: {
        fullName: formData.fullName,
        email: formData.email,
        department: formData.department,
        designation: formData.designation,
      },
    });
  };

  // Filter local search term
  const filteredEmployees = employees.filter((e) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  const departments = ['Engineering', 'Sales', 'Operations', 'Marketing', 'Product', 'Finance', 'HR'];

  if (isLoading) {
    return (
      <AppLayout title="Employee Management">
        <PageLoader />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Employee Directory & Management">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4E8EF]">
          <div>
            <h1 className="text-xl font-bold text-[#172033]">Organizational Employees</h1>
            <p className="text-xs text-[#667085] mt-0.5">Manage personnel profiles, roles, departments, and credentials export</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCsv} disabled={isExporting} size="sm">
              <Download size={16} />
              {isExporting ? 'Exporting CSV...' : 'Export Employee CSV'}
            </Button>
            <Button onClick={handleOpenCreate} size="sm">
              <UserPlus size={16} />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-[#E4E8EF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3157A4]"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Deactivated Only</option>
            </select>
          </div>
        </Card>

        {/* Employee Table */}
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FBFBFC] border-b border-[#E4E8EF] text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Employee ID</th>
                  <th className="py-3 px-4 font-semibold">Full Name</th>
                  <th className="py-3 px-4 font-semibold">Contact Email</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Designation</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Created Date</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E8EF]">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#667085]">
                      No employees match the specified criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#F9FBFF] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#172033]">{emp.employeeId}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#EBF3FF] text-[#3157A4] font-bold text-xs flex items-center justify-center shrink-0 border border-[#B8D0F5]">
                            {emp.fullName.charAt(0)}
                          </div>
                          <span className="font-semibold text-[#172033]">{emp.fullName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#667085]">{emp.email}</td>
                      <td className="py-3.5 px-4 text-[#172033] font-medium">{emp.department}</td>
                      <td className="py-3.5 px-4 text-[#667085]">{emp.designation || 'Staff'}</td>
                      <td className="py-3.5 px-4">
                        {emp.active ? (
                          <Badge bg="#EDFAF4" color="#16865B" border="#A8DFC5">
                            <CheckCircle size={12} className="mr-1 inline" /> Active
                          </Badge>
                        ) : (
                          <Badge bg="#FFF0F0" color="#D64545" border="#F5B8B8">
                            <XCircle size={12} className="mr-1 inline" /> Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#667085]">{formatDate(emp.createdAt)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(emp)}
                            title="Edit Profile"
                            className="p-1.5 text-[#667085] hover:text-[#3157A4] hover:bg-[#EBF3FF] rounded transition-colors cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              statusMutation.mutate({ id: emp.id, active: !emp.active })
                            }
                            title={emp.active ? 'Deactivate Account' : 'Reactivate Account'}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              emp.active
                                ? 'text-[#D64545] hover:bg-[#FFF0F0]'
                                : 'text-[#16865B] hover:bg-[#EDFAF4]'
                            }`}
                          >
                            <Power size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create Employee Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create Employee Account"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateSubmit}
                loading={createMutation.isPending}
              >
                Create Account
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-[#FFF0F0] border border-[#F5B8B8] text-[#D64545] rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Full Name"
                placeholder="e.g. Aditi Rao"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
              <Input
                label="Employee ID (Unique)"
                placeholder="e.g. EMP-101"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                required
              />
            </div>

            <Input
              label="Corporate Email"
              type="email"
              placeholder="e.g. aditi.rao@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                options={departments.map((d) => ({ value: d, label: d }))}
              />
              <Input
                label="Designation (Optional)"
                placeholder="e.g. Lead Analyst"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>

            <div>
              <Input
                label="Initial Password"
                type="text"
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                helperText="Auto-generated secure initial credential for employee login"
                required
              />
            </div>
          </form>
        </Modal>

        {/* Edit Employee Modal */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Employee: ${selectedEmployee?.fullName}`}
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditSubmit}
                loading={editMutation.isPending}
              >
                Save Changes
              </Button>
            </>
          }
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs bg-[#FFF0F0] border border-[#F5B8B8] text-[#D64545] rounded-lg">
                {formError}
              </div>
            )}

            <Input
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />

            <Input
              label="Corporate Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                options={departments.map((d) => ({ value: d, label: d }))}
              />
              <Input
                label="Designation"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}

