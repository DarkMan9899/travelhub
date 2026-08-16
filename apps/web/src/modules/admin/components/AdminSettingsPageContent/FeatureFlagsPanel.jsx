/**
 * FeatureFlagsPanel — Stage 11.9 (Settings), `feature_flags` tab. Each
 * row's `is_enabled` toggles inline via the shared `Switch` primitive
 * (no modal round-trip for the one action admins do most) — Add/Edit
 * metadata (code/name/description) and Delete still go through a modal,
 * same mechanics as `ConfigEntityPanel`/`SettingsPanel`.
 */

import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { Input, Switch } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { DataTable } from '@travelhub/ui/components/dashboard';
import { Modal, ErrorState } from '@travelhub/ui/components/feedback-overlays';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';

const EMPTY_FORM = { code: '', name: '', description: '' };

export default function FeatureFlagsPanel({ resource, copy, canWrite = true }) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { listQuery, createMutation, updateMutation, deleteMutation } =
    resource;
  const [formTarget, setFormTarget] = useState(null); // null | 'create' | row
  const [values, setValues] = useState(EMPTY_FORM);
  const [togglingId, setTogglingId] = useState(null);

  const rows = listQuery.data ?? [];

  function openCreate() {
    setValues(EMPTY_FORM);
    setFormTarget('create');
  }

  const closeForm = useCallback(() => setFormTarget(null), []);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function submitCreate() {
    try {
      await createMutation.mutateAsync({
        code: values.code,
        name: values.name,
        description: values.description || null,
        isEnabled: false,
      });
      showToast(copy.createSuccess, { variant: 'success' });
      setFormTarget(null);
    } catch {
      showToast(copy.saveError, { variant: 'danger' });
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    submitCreate();
  }

  async function handleToggle(row, isEnabled) {
    setTogglingId(row.id);
    try {
      await updateMutation.mutateAsync({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        isEnabled,
      });
    } catch {
      showToast(copy.saveError, { variant: 'danger' });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(row) {
    const confirmed = await confirm({
      title: copy.deleteConfirmTitle(row.name),
      description: copy.deleteConfirmDescription,
      confirmLabel: copy.deleteAction,
      cancelLabel: copy.cancelAction,
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(row.id);
      showToast(copy.deleteSuccess, { variant: 'success' });
    } catch {
      showToast(copy.deleteError, { variant: 'danger' });
    }
  }

  const columns = [
    { key: 'code', header: copy.table.code },
    { key: 'name', header: copy.table.name },
    {
      key: 'description',
      header: copy.table.description,
      render: (row) => row.description || '—',
    },
    {
      key: 'enabled',
      header: copy.table.enabled,
      render: (row) => (
        <Switch
          checked={row.is_enabled}
          onChange={(event) => handleToggle(row, event.target.checked)}
          label={copy.enabledSwitchLabel(row.name)}
          disabled={!canWrite || togglingId === row.id}
        />
      ),
    },
  ];
  if (canWrite) {
    columns.push({
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDelete(row)}
        >
          {copy.deleteAction}
        </Button>
      ),
    });
  }

  return (
    <Stack gap="4">
      <Inline justify="space-between" align="center">
        <h2>{copy.heading}</h2>
        {canWrite && (
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            {copy.addLabel}
          </Button>
        )}
      </Inline>

      {listQuery.isError ? (
        <ErrorState
          title={copy.errorTitle}
          retryLabel={copy.errorRetry}
          onRetry={() => listQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          isLoading={listQuery.isPending}
          emptyTitle={copy.emptyTitle}
          emptyDescription={copy.emptyDescription}
        />
      )}

      {formTarget !== null && (
        <Modal
          isOpen
          onClose={closeForm}
          title={copy.formCreateTitle}
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={() => closeForm()}>
                {copy.cancelAction}
              </Button>
              <Button
                variant="primary"
                onClick={() => submitCreate()}
                loading={createMutation.isPending}
              >
                {copy.saveAction}
              </Button>
            </Inline>
          }
        >
          <form onSubmit={handleFormSubmit}>
            <Stack gap="3">
              <Input
                label={copy.fields.code}
                value={values.code}
                onChange={(event) => setField('code', event.target.value)}
                required
              />
              <Input
                label={copy.fields.name}
                value={values.name}
                onChange={(event) => setField('name', event.target.value)}
                required
              />
              <Input
                label={copy.fields.description}
                value={values.description}
                onChange={(event) =>
                  setField('description', event.target.value)
                }
              />
            </Stack>
          </form>
        </Modal>
      )}
    </Stack>
  );
}

FeatureFlagsPanel.propTypes = {
  resource: PropTypes.shape({
    listQuery: PropTypes.shape({
      data: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.node)),
      isPending: PropTypes.bool.isRequired,
      isError: PropTypes.bool.isRequired,
      refetch: PropTypes.func.isRequired,
    }).isRequired,
    createMutation: PropTypes.shape({
      mutateAsync: PropTypes.func.isRequired,
      isPending: PropTypes.bool,
    }).isRequired,
    updateMutation: PropTypes.shape({
      mutateAsync: PropTypes.func.isRequired,
      isPending: PropTypes.bool,
    }).isRequired,
    deleteMutation: PropTypes.shape({
      mutateAsync: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
  copy: PropTypes.shape({
    heading: PropTypes.node.isRequired,
    addLabel: PropTypes.node.isRequired,
    table: PropTypes.shape({
      code: PropTypes.node.isRequired,
      name: PropTypes.node.isRequired,
      description: PropTypes.node.isRequired,
      enabled: PropTypes.node.isRequired,
    }).isRequired,
    fields: PropTypes.shape({
      code: PropTypes.node.isRequired,
      name: PropTypes.node.isRequired,
      description: PropTypes.node.isRequired,
    }).isRequired,
    enabledSwitchLabel: PropTypes.func.isRequired,
    formCreateTitle: PropTypes.node.isRequired,
    deleteConfirmTitle: PropTypes.func.isRequired,
    deleteConfirmDescription: PropTypes.node.isRequired,
    saveAction: PropTypes.node.isRequired,
    cancelAction: PropTypes.node.isRequired,
    deleteAction: PropTypes.node.isRequired,
    emptyTitle: PropTypes.node.isRequired,
    emptyDescription: PropTypes.node.isRequired,
    errorTitle: PropTypes.node.isRequired,
    errorRetry: PropTypes.node.isRequired,
    createSuccess: PropTypes.node.isRequired,
    deleteSuccess: PropTypes.node.isRequired,
    saveError: PropTypes.node.isRequired,
    deleteError: PropTypes.node.isRequired,
  }).isRequired,
  canWrite: PropTypes.bool,
};
