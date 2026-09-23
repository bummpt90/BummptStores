import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Shield,
  Phone,
  Mail,
  Monitor,
  AlertTriangle,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { StaffUser } from '../types';
import { loadStaffRoster, saveStaffRoster } from '../services/staffAuth';

interface StaffManagerProps {
  onRosterUpdated?: (staff: StaffUser[]) => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ onRosterUpdated }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>(() => loadStaffRoster());
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPasswordId, setEditPasswordId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState<string>('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // New Staff Form State
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    role: 'staff' as 'staff' | 'manager' | 'admin',
    password: '',
    email: '',
    phone: '',
    terminalId: 'TERM-01',
  });

  const showAlert = (msg: string) => {
    setAlertMessage(msg);
    setTimeout(() => setAlertMessage(null), 4000);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.name.trim() || !formData.password.trim()) {
      alert('Username, full name, and login password are required');
      return;
    }

    const cleanUser = formData.username.trim().toLowerCase();
    if (staffList.some((s) => s.username.toLowerCase() === cleanUser)) {
      alert('A staff member with this username already exists. Please choose another.');
      return;
    }

    const newStaff: StaffUser = {
      id: `STF-${100 + staffList.length + 1}`,
      username: cleanUser,
      name: formData.name.trim(),
      role: formData.role,
      password: formData.password.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      terminalId: formData.terminalId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [...staffList, newStaff];
    setStaffList(updated);
    saveStaffRoster(updated);
    if (onRosterUpdated) onRosterUpdated(updated);

    // Sync to server backend
    try {
      await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      });
    } catch {
      // server sync failure is non-blocking
    }

    setFormData({
      username: '',
      name: '',
      role: 'staff',
      password: '',
      email: '',
      phone: '',
      terminalId: 'TERM-01',
    });
    setShowAddForm(false);
    showAlert(`Staff account "${newStaff.name}" created successfully.`);
  };

  const handleToggleActive = async (id: string) => {
    const updated = staffList.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s));
    setStaffList(updated);
    saveStaffRoster(updated);
    if (onRosterUpdated) onRosterUpdated(updated);

    const changed = updated.find((s) => s.id === id);
    if (changed) {
      try {
        await fetch(`/api/staff/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: changed.isActive }),
        });
      } catch {}
      showAlert(`Staff status updated: ${changed.name} is now ${changed.isActive ? 'Active' : 'Deactivated'}.`);
    }
  };

  const handleUpdatePassword = async (id: string) => {
    if (!newPasswordVal.trim()) return;
    const updated = staffList.map((s) => (s.id === id ? { ...s, password: newPasswordVal.trim() } : s));
    setStaffList(updated);
    saveStaffRoster(updated);
    if (onRosterUpdated) onRosterUpdated(updated);

    try {
      await fetch(`/api/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordVal.trim() }),
      });
    } catch {}

    setEditPasswordId(null);
    setNewPasswordVal('');
    showAlert('Staff password updated securely.');
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (id === 'CEO-001') {
      alert('The primary CEO administrative account cannot be removed.');
      return;
    }

    if (confirm(`Are you sure you want to remove staff member "${name}"?`)) {
      const updated = staffList.filter((s) => s.id !== id);
      setStaffList(updated);
      saveStaffRoster(updated);
      if (onRosterUpdated) onRosterUpdated(updated);

      try {
        await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      } catch {}
      showAlert(`Staff member "${name}" removed.`);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Staff Accounts & Anti-Manipulation Access Control
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage individual staff login passwords, terminal assignments, and role permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Cancel Form' : 'Add New Staff'}</span>
        </button>
      </div>

      {alertMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{alertMessage}</span>
        </div>
      )}

      {/* Add Staff Drawer / Form */}
      {showAddForm && (
        <form onSubmit={handleCreateStaff} className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Create New Staff Member Account
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Tunde Bakare"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Username / Login ID *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. tunde"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Secret Login Password *
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="e.g. cashierPass2026"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-mono"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Staff Role & Privilege
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold"
              >
                <option value="staff">Staff / Cashier (POS Register & Shift Report)</option>
                <option value="manager">Manager (Inventory & Overrides)</option>
                <option value="admin">Admin / CEO (Full Control & Surveillance)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Assigned Terminal ID
              </label>
              <input
                type="text"
                value={formData.terminalId}
                onChange={(e) => setFormData({ ...formData, terminalId: e.target.value })}
                placeholder="TERM-01"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+234 800 000 0000"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              Save & Activate Staff Account
            </button>
          </div>
        </form>
      )}

      {/* Staff Roster Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase text-[10px] tracking-wider">
              <th className="pb-2.5">Staff Name & ID</th>
              <th className="pb-2.5">Login Username</th>
              <th className="pb-2.5">Role</th>
              <th className="pb-2.5">Password</th>
              <th className="pb-2.5">Terminal</th>
              <th className="pb-2.5">Status</th>
              <th className="pb-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {staffList.map((st) => (
              <tr key={st.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                <td className="py-3">
                  <div className="font-bold text-neutral-900 dark:text-neutral-100">{st.name}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">{st.id}</div>
                </td>
                <td className="py-3 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                  {st.username}
                </td>
                <td className="py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      st.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : st.role === 'manager'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    {st.role}
                  </span>
                </td>
                <td className="py-3 font-mono">
                  {editPasswordId === st.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newPasswordVal}
                        onChange={(e) => setNewPasswordVal(e.target.value)}
                        placeholder="New password"
                        className="px-2 py-1 text-xs rounded border border-emerald-500 bg-white dark:bg-neutral-800 w-28"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdatePassword(st.id)}
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        title="Save Password"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPasswordId(null)}
                        className="p-1 text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                      <span>••••••••</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPasswordId(st.id);
                          setNewPasswordVal(st.password);
                        }}
                        className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                      >
                        <KeyRound className="w-3 h-3" />
                        Reset
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-3 text-neutral-600 dark:text-neutral-400 font-mono">
                  {st.terminalId || 'TERM-01'}
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(st.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                      st.isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {st.isActive ? 'Active' : 'Deactivated'}
                  </button>
                </td>
                <td className="py-3 text-right">
                  {st.id !== 'CEO-001' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(st.id, st.name)}
                      className="text-neutral-400 hover:text-red-600 p-1 transition"
                      title="Remove Staff"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
