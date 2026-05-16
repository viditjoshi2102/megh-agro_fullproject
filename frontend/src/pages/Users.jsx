import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, roleApi } from '../services/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import { getErrorMessage } from '../utils/helpers';

function UserForm({ user, onClose }) {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey: ['roles-list'], queryFn: () => roleApi.list().then(r => r.data.data) });
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: user ? { ...user, password: '' } : { is_active: true } });
  const isEdit = !!user;
  const mutation = useMutation({
    mutationFn: (d) => isEdit ? userApi.update(user.id, d) : userApi.create(d),
    onSuccess: () => { toast.success(isEdit ? 'User updated' : 'User created'); qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Full Name *</label><input className="input" {...register('name', { required: true })} /></div>
        <div><label className="label">Username *</label><input className="input" {...register('username', { required: true })} disabled={isEdit} /></div>
        <div><label className="label">Email</label><input className="input" type="email" {...register('email')} /></div>
        <div><label className="label">Mobile</label><input className="input" type="tel" {...register('mobile')} /></div>
        <div><label className="label">Role *</label>
          <select className="input" {...register('role_id', { required: true })}>
            <option value="">-- Select --</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input type="checkbox" id="active" {...register('is_active')} className="w-4 h-4" />
          <label htmlFor="active" className="text-sm text-gray-700">Active</label>
        </div>
        {!isEdit && (
          <div className="sm:col-span-2"><label className="label">Password *</label>
            <input className="input" type="password" {...register('password', { required: !isEdit, minLength: 8 })} />
            {errors.password && <p className="text-red-500 text-xs mt-1">Min 8 characters</p>}
          </div>
        )}
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

function ResetPasswordModal({ userId, onClose }) {
  const { register, handleSubmit } = useForm();
  const mutation = useMutation({
    mutationFn: (d) => userApi.resetPassword(userId, d),
    onSuccess: () => { toast.success('Password reset'); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div><label className="label">New Password</label><input className="input" type="password" {...register('newPassword', { required: true, minLength: 8 })} /></div>
      <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={mutation.isPending}>Reset</button></div>
    </form>
  );
}

export default function Users() {
  const [modal, setModal] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => userApi.list().then(r => r.data.data) });

  const cols = [
    { key: 'name',       label: 'Name' },
    { key: 'username',   label: 'Username' },
    { key: 'role_label', label: 'Role' },
    { key: 'email',      label: 'Email' },
    { key: 'mobile',     label: 'Mobile' },
    { key: 'is_active',  label: 'Status', render: r => <span className={r.is_active ? 'badge-active' : 'badge-inactive'}>{r.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'actions',    label: 'Actions', render: r => (
      <div className="flex gap-2">
        <button className="text-brand-600 hover:underline text-sm" onClick={() => setModal({ type: 'edit', user: r })}>Edit</button>
        <button className="text-orange-500 hover:underline text-sm" onClick={() => setModal({ type: 'reset', id: r.id })}>Reset Pwd</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage system users and roles"
        action={<button className="btn-primary" onClick={() => setModal({ type: 'add' })}>+ Add User</button>} />
      <Table columns={cols} data={data || []} loading={isLoading} />
      <Modal open={modal?.type === 'add' || modal?.type === 'edit'} onClose={() => setModal(null)} title={modal?.type === 'edit' ? 'Edit User' : 'Add User'} size="md">
        <UserForm user={modal?.user} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === 'reset'} onClose={() => setModal(null)} title="Reset Password" size="sm">
        <ResetPasswordModal userId={modal?.id} onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}
