/**
 * AssetMT - Tenant Application Users & Role Management
 * Commercial Multi-Tenant Asset-Management SaaS by Akshigo Tech
 * Strict separation: Application User != Employee. Explicit link optional.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Link as LinkIcon,
  Unlink,
  Clock,
  Key,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  Membership,
  TenantInvitation,
  Employee,
  UserRole,
  CreateTenantInvitationInput,
} from '../../shared/types.ts';
import { canManageUsers } from '../../shared/permissions.ts';

interface TenantUsersViewProps {
  token: string;
  currentUserRole: UserRole;
  currentUserId: string;
  onNavigateToEmployee?: (employeeId: string) => void;
}

export const TenantUsersView: React.FC<TenantUsersViewProps> = ({
  token,
  currentUserRole,
  currentUserId,
  onNavigateToEmployee,
}) => {
  const [users, setUsers] = useState<Array<Membership & { email?: string; company_name?: string }>>([]);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('MEMBER');
  const [inviteEmployeeId, setInviteEmployeeId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string } | null>(null);

  // Change Role Modal
  const [selectedUserForRole, setSelectedUserForRole] = useState<Membership | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('MEMBER');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Link Employee Modal
  const [selectedUserForLink, setSelectedUserForLink] = useState<Membership | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [linking, setLinking] = useState(false);

  const isAdmin = canManageUsers(currentUserRole);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, empRes] = await Promise.all([
        api.getTenantUsers(token),
        api.getEmployees(token),
      ]);

      if (usersRes.success) {
        setUsers(usersRes.data.users);
        setInvitations(usersRes.data.invitations);
      } else {
        setError(usersRes.error || 'Failed to load tenant users');
      }

      if (empRes.success) {
        setEmployees(empRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading users and invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle Send Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    try {
      const payload: CreateTenantInvitationInput = {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        employee_id: inviteEmployeeId || null,
      };

      const res = await api.inviteUser(token, payload);
      if (res.success) {
        setInviteResult({ token: res.data.token, email: res.data.email });
        setSuccessMessage(`Invitation generated for ${res.data.email}.`);
        loadData();
      } else {
        setError(res.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Invitation processing failed');
    } finally {
      setInviting(false);
    }
  };

  // Resend Invite
  const handleResend = async (invitationId: string) => {
    try {
      const res = await api.resendInvitation(token, invitationId);
      if (res.success) {
        setSuccessMessage(res.message || 'Invitation resent and expiry extended.');
        loadData();
      } else {
        setError(res.error || 'Failed to resend invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Error resending invitation');
    }
  };

  // Cancel Invite
  const handleCancelInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this pending invitation?')) return;
    try {
      const res = await api.cancelInvitation(token, invitationId);
      if (res.success) {
        setSuccessMessage('Invitation cancelled successfully.');
        loadData();
      } else {
        setError(res.error || 'Failed to cancel invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Error cancelling invitation');
    }
  };

  // Toggle User Active Status
  const handleToggleStatus = async (user: Membership) => {
    const nextState = !user.is_active;
    const actionLabel = nextState ? 'activate' : 'deactivate';

    if (user.user_id === currentUserId && !nextState) {
      alert('You cannot deactivate your own account.');
      return;
    }

    if (!confirm(`Are you sure you want to ${actionLabel} access for this user?`)) return;

    try {
      const res = await api.toggleUserStatus(token, user.id, nextState);
      if (res.success) {
        setSuccessMessage(`User successfully ${nextState ? 'activated' : 'deactivated'}.`);
        loadData();
      } else {
        setError(res.error || `Failed to ${actionLabel} user`);
      }
    } catch (err: any) {
      setError(err.message || `Error changing user status`);
    }
  };

  // Change Role Submit
  const handleUpdateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    setUpdatingRole(true);
    try {
      const res = await api.updateUserRole(token, selectedUserForRole.id, { role: newRole });
      if (res.success) {
        setSuccessMessage(`User role updated to ${newRole}.`);
        setSelectedUserForRole(null);
        loadData();
      } else {
        setError(res.error || 'Failed to update user role');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating user role');
    } finally {
      setUpdatingRole(false);
    }
  };

  // Link Employee Submit
  const handleLinkEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForLink) return;

    setLinking(true);
    try {
      const res = await api.linkUserEmployee(token, selectedUserForLink.id, {
        employee_id: selectedEmpId || null,
      });
      if (res.success) {
        setSuccessMessage(
          selectedEmpId ? 'User linked to employee record.' : 'User unlinked from employee record.'
        );
        setSelectedUserForLink(null);
        loadData();
      } else {
        setError(res.error || 'Failed to link employee');
      }
    } catch (err: any) {
      setError(err.message || 'Error linking employee');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A1A] tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" />
            <span>Tenant Access & Security</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            Tenant Users & Permissions
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage application login credentials, role assignments, and pending invitations.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setInviteEmail('');
              setInviteRole('MEMBER');
              setInviteEmployeeId('');
              setInviteResult(null);
              setShowInviteModal(true);
            }}
            className="px-4 py-2 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Application User</span>
          </button>
        )}
      </div>

      {/* Distinction Banner: User != Employee */}
      <div className="p-3.5 bg-neutral-100 rounded-lg border border-neutral-200 text-xs text-neutral-700 flex items-start gap-3">
        <Users className="w-4 h-4 text-[#FF6A1A] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-neutral-900">Architecture Distinction:</span>{' '}
          <span className="text-neutral-600">
            Application Users possess secure authentication identities and workspace access roles.
            Employees represent human custodians and internal personnel in the company directory.
            Linking an application user to an employee record is explicit, optional, and separate.
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users Section */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900">Active Tenant Users</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 font-mono">
              {users.length}
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#FF6A1A] rounded-full animate-spin mx-auto mb-2"></div>
            Loading user registry...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No registered users in this workspace.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                  <th className="py-2.5 px-4">User Email / Identity</th>
                  <th className="py-2.5 px-4">Tenant Role</th>
                  <th className="py-2.5 px-4">Access Status</th>
                  <th className="py-2.5 px-4">Linked Employee</th>
                  <th className="py-2.5 px-4">Last Activity</th>
                  {isAdmin && <th className="py-2.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((u) => {
                  const isCurrent = u.user_id === currentUserId;
                  const emp = employees.find((e) => e.id === u.employee_id) || u.employee;

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* Email / ID */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span>{u.email || u.user_id.slice(0, 18) + '...'}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FF6A1A] text-white">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          ID: {u.user_id}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1 ${
                            u.role === 'TENANT_ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'TECHNICIAN'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {u.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-700 font-medium">
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Linked Employee */}
                      <td className="py-3 px-4">
                        {emp ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onNavigateToEmployee && onNavigateToEmployee(emp.id)}
                              className="text-neutral-900 font-medium hover:text-[#FF6A1A] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>{emp.full_name}</span>
                              <ExternalLink className="w-3 h-3 text-neutral-400" />
                            </button>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ({emp.employee_code})
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">Unlinked</span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {u.last_active_at ? (
                          <span title={new Date(u.last_active_at).toLocaleString()}>
                            {new Date(u.last_active_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-neutral-400">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUserForRole(u);
                              setNewRole(u.role);
                            }}
                            className="px-2 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[11px] font-medium rounded transition-colors cursor-pointer"
                          >
                            Change Role
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUserForLink(u);
                              setSelectedEmpId(u.employee_id || '');
                            }}
                            className="px-2 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[11px] font-medium rounded transition-colors cursor-pointer"
                          >
                            {u.employee_id ? 'Relink Employee' : 'Link Employee'}
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrent}
                            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                              u.is_active !== false
                                ? 'border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-30'
                                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invitations Section */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-900">Tenant Invitations</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 text-neutral-700 font-mono">
              {invitations.length}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400">
            Pending user registrations
          </span>
        </div>

        {invitations.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            No pending or recent user invitations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                  <th className="py-2.5 px-4">Invited Email</th>
                  <th className="py-2.5 px-4">Assigned Role</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Invited Date</th>
                  <th className="py-2.5 px-4">Expires</th>
                  {isAdmin && <th className="py-2.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-neutral-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{inv.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {inv.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : inv.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {new Date(inv.invited_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-2">
                        {inv.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => {
                                const link = `${window.location.origin}/?invite=${inv.token}`;
                                navigator.clipboard.writeText(link);
                                setSuccessMessage(`Copied invitation link for ${inv.email}`);
                                setTimeout(() => setSuccessMessage(null), 3000);
                              }}
                              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-medium rounded transition-colors cursor-pointer"
                              title="Copy direct invitation link"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => handleResend(inv.id)}
                              className="px-2 py-1 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-[11px] font-medium rounded transition-colors cursor-pointer"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleCancelInvite(inv.id)}
                              className="px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-medium rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#FF6A1A]" />
                <h3 className="text-sm font-bold text-neutral-900">Invite Tenant User</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>EMAIL DELIVERY NOT CONFIGURED</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Invitation created for <strong>{inviteResult.email}</strong>. Outbound email is not connected; copy the invitation link below to send directly to the user.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">
                    Direct Invitation URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/?invite=${inviteResult.token}`}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded text-xs font-mono bg-neutral-50 text-neutral-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?invite=${inviteResult.token}`);
                        setSuccessMessage('Invitation link copied to clipboard!');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="px-3 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white text-xs font-semibold rounded shrink-0 cursor-pointer"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setInviteResult(null);
                      setShowInviteModal(false);
                    }}
                    className="px-4 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Tenant Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
                  >
                    <option value="MEMBER">MEMBER (Read-only reports & asset viewing)</option>
                    <option value="TECHNICIAN">TECHNICIAN (Operational custody, maintenance & scans)</option>
                    <option value="TENANT_ADMIN">TENANT_ADMIN (Full workspace administration)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Optional Linked Employee
                  </label>
                  <select
                    value={inviteEmployeeId}
                    onChange={(e) => setInviteEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
                  >
                    <option value="">No linked employee (Standalone User)</option>
                    {employees.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.full_name} ({em.employee_code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    User != Employee: Linking binds asset custody records to this login.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white font-semibold rounded cursor-pointer disabled:opacity-50"
                  >
                    {inviting ? 'Generating...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Change Tenant Role</h3>
            <p className="text-xs text-neutral-500">
              Update authorization role for <strong>{selectedUserForRole.email || selectedUserForRole.user_id}</strong>
            </p>

            <form onSubmit={handleUpdateRoleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  New Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                  <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {updatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Employee Modal */}
      {selectedUserForLink && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Link / Unlink Employee</h3>
            <p className="text-xs text-neutral-500">
              Select an employee record from the directory to associate with{' '}
              <strong>{selectedUserForLink.email || selectedUserForLink.user_id}</strong>
            </p>

            <form onSubmit={handleLinkEmployeeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Directory Employee
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:outline-none focus:border-[#FF6A1A] bg-white"
                >
                  <option value="">No linked employee (Unlink)</option>
                  {employees.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.full_name} ({em.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForLink(null)}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-4 py-1.5 bg-[#FF6A1A] hover:bg-[#e55910] text-white font-semibold rounded cursor-pointer disabled:opacity-50"
                >
                  {linking ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
