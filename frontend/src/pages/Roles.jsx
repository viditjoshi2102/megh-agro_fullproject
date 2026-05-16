import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleApi } from '../services/api';
import toast from 'react-hot-toast';
import Spinner from '../components/common/Spinner';

// ─── module display config ────────────────────────────────────────────────────
const MODULE_LABELS = {
  dashboard: 'Dashboard',
  orders:    'Orders',
  invoices:  'Invoices',
  estimates: 'Estimates',
  dealers:   'Dealers',
  products:  'Products',
  users:     'Users',
  hsn:       'HSN-GST',
  roles:     'Roles',
};
const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'generate', 'download'];
const ACTION_LABELS = {
  view:     'View',
  create:   'Create',
  edit:     'Edit',
  delete:   'Delete',
  generate: 'Generate',
  download: 'Download',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function groupByModule(permissions) {
  return permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = {};
    acc[p.module][p.action] = p;
    return acc;
  }, {});
}

// ─── Create / Edit Role modal ─────────────────────────────────────────────────
function RoleFormModal({ role, onClose, onSaved }) {
  const [name, setName]   = useState(role?.name  || '');
  const [label, setLabel] = useState(role?.label || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (role) {
        await roleApi.update(role.id, { name, label });
        toast.success('Role updated');
      } else {
        await roleApi.create({ name, label });
        toast.success('Role created');
      }
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save role');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {role ? 'Edit Role' : 'Create Role'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(!role || !role.is_system) && (
            <div>
              <label className="label">Role Name <span className="text-gray-400 font-normal">(slug)</span></label>
              <input
                className="input"
                placeholder="e.g. field_manager"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!!role}
                required
              />
              {!role && (
                <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers and underscores only.</p>
              )}
            </div>
          )}
          <div>
            <label className="label">Display Label</label>
            <input
              className="input"
              placeholder="e.g. Field Manager"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving && <Spinner size="sm" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Permission Matrix modal ──────────────────────────────────────────────────
function PermissionsModal({ role, allPermissions, onClose, onSaved }) {
  const grouped = groupByModule(allPermissions);
  const modules = Object.keys(MODULE_LABELS);

  // initialise selected set from role's current permissions
  const [selected, setSelected] = useState(
    () => new Set((role.permissions || []).map(p => p.id))
  );
  const [saving, setSaving] = useState(false);

  function toggle(pid) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }

  function toggleRow(mod) {
    const modPerms = Object.values(grouped[mod] || {});
    const allChecked = modPerms.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      modPerms.forEach(p => allChecked ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  }

  function toggleColumn(action) {
    const colPerms = modules.flatMap(m => grouped[m]?.[action] ? [grouped[m][action]] : []);
    const allChecked = colPerms.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      colPerms.forEach(p => allChecked ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  }

  function selectAll() { setSelected(new Set(allPermissions.map(p => p.id))); }
  function clearAll()  { setSelected(new Set()); }

  async function handleSave() {
    setSaving(true);
    try {
      await roleApi.setPermissions(role.id, { permission_ids: [...selected] });
      toast.success('Permissions saved');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save permissions');
    } finally { setSaving(false); }
  }

  // which actions are present in the data at all
  const presentActions = ALL_ACTIONS.filter(a =>
    modules.some(m => grouped[m]?.[a])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        {/* header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Permissions — {role.label}</h2>
            <p className="text-sm text-gray-500">{selected.size} of {allPermissions.length} permissions selected</p>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-secondary text-xs py-1 px-2">All</button>
            <button onClick={clearAll}  className="btn-secondary text-xs py-1 px-2">None</button>
          </div>
        </div>

        {/* scrollable matrix */}
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 font-semibold text-gray-700 w-36 sticky left-0 bg-white">Module</th>
                {presentActions.map(a => (
                  <th key={a} className="py-2 px-2 font-semibold text-gray-700 text-center whitespace-nowrap">
                    <button
                      onClick={() => toggleColumn(a)}
                      className="text-xs font-semibold text-gray-600 hover:text-brand-700 transition-colors"
                    >
                      {ACTION_LABELS[a]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => {
                const modPerms = Object.values(grouped[mod] || {});
                if (modPerms.length === 0) return null;
                const rowChecked = modPerms.every(p => selected.has(p.id));
                const rowIndet  = !rowChecked && modPerms.some(p => selected.has(p.id));
                return (
                  <tr key={mod} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 pr-3 sticky left-0 bg-inherit">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rowChecked}
                          ref={el => { if (el) el.indeterminate = rowIndet; }}
                          onChange={() => toggleRow(mod)}
                          className="w-3.5 h-3.5 accent-brand-600"
                        />
                        <span className="font-medium text-gray-800">{MODULE_LABELS[mod]}</span>
                      </label>
                    </td>
                    {presentActions.map(action => {
                      const perm = grouped[mod]?.[action];
                      return (
                        <td key={action} className="py-2.5 px-2 text-center">
                          {perm ? (
                            <input
                              type="checkbox"
                              checked={selected.has(perm.id)}
                              onChange={() => toggle(perm.id)}
                              className="w-4 h-4 accent-brand-600 cursor-pointer"
                            />
                          ) : (
                            <span className="inline-block w-4 h-0.5 bg-gray-200 rounded mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Roles page ──────────────────────────────────────────────────────────
export default function Roles() {
  const qc = useQueryClient();

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => roleApi.list().then(r => r.data.data),
  });

  const { data: allPermsData, isLoading: permsLoading } = useQuery({
    queryKey: ['allPermissions'],
    queryFn:  () => roleApi.allPermissions().then(r => r.data.data),
  });

  // modals
  const [createModal, setCreateModal]   = useState(false);
  const [editRole, setEditRole]         = useState(null);
  const [permRole, setPermRole]         = useState(null);  // role object with permissions
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  async function openPermissions(role) {
    try {
      const { data } = await roleApi.get(role.id);
      setPermRole(data.data);
    } catch {
      toast.error('Failed to load role permissions');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await roleApi.remove(deleteTarget.id);
      toast.success('Role deleted');
      qc.invalidateQueries({ queryKey: ['roles'] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete role');
    } finally { setDeleting(false); }
  }

  function onSaved() {
    qc.invalidateQueries({ queryKey: ['roles'] });
    setCreateModal(false);
    setEditRole(null);
    setPermRole(null);
  }

  const loading = rolesLoading || permsLoading;

  return (
    <div className="max-w-4xl mx-auto">
      {/* page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage roles and their module access</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateModal(true)}>
          + New Role
        </button>
      </div>

      {/* roles table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Users</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Permissions</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rolesData || []).map(role => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{role.label}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{role.name}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{role.user_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        {role.permission_count}
                        <span className="text-gray-400 text-xs">/ {allPermsData?.length || '—'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {role.is_system
                        ? <span className="badge-active">System</span>
                        : <span className="badge-inactive">Custom</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openPermissions(role)}
                          className="text-xs px-2.5 py-1 rounded-md font-medium text-white transition-colors"
                          style={{ backgroundColor: '#163082' }}
                          title="Edit permissions"
                        >
                          Permissions
                        </button>
                        {!role.is_system && (
                          <>
                            <button
                              onClick={() => setEditRole(role)}
                              className="text-xs px-2.5 py-1 rounded-md font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(role)}
                              className="text-xs px-2.5 py-1 rounded-md font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {createModal && (
        <RoleFormModal onClose={() => setCreateModal(false)} onSaved={onSaved} />
      )}

      {/* Edit modal */}
      {editRole && (
        <RoleFormModal role={editRole} onClose={() => setEditRole(null)} onSaved={onSaved} />
      )}

      {/* Permissions matrix modal */}
      {permRole && allPermsData && (
        <PermissionsModal
          role={permRole}
          allPermissions={allPermsData}
          onClose={() => setPermRole(null)}
          onSaved={onSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Role?</h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <strong>{deleteTarget.label}</strong>?
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn-danger flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting && <Spinner size="sm" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
