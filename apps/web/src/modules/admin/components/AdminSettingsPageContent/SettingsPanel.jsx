/**
 * SettingsPanel — Stage 11.9 (Settings), `system_settings` tab. Unlike
 * `ConfigEntityPanel` (Stage 11.5's fixed-string/select-field panel),
 * `value` here is genuinely arbitrary JSON (a string, number, boolean,
 * or object) — edited as raw JSON text and `JSON.parse`d on submit,
 * with an inline error (never a thrown/uncaught parse failure) when the
 * text isn't valid JSON.
 */

import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Textarea } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import { DataTable } from '@desavii/ui/components/dashboard';
import { Modal, ErrorState } from '@desavii/ui/components/feedback-overlays';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';

const EMPTY_FORM = { key: '', valueText: '', description: '' };

export default function SettingsPanel({
  resource,
  copy,
  dateFormatter,
  canWrite = true,
}) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { listQuery, createMutation, updateMutation, deleteMutation } =
    resource;
  const [formTarget, setFormTarget] = useState(null); // null | 'create' | row
  const [values, setValues] = useState(EMPTY_FORM);
  const [valueError, setValueError] = useState(null);

  const rows = listQuery.data ?? [];

  function openCreate() {
    setValues(EMPTY_FORM);
    setValueError(null);
    setFormTarget('create');
  }

  function openEdit(row) {
    setValues({
      key: row.key,
      valueText: JSON.stringify(row.value, null, 2),
      description: row.description ?? '',
    });
    setValueError(null);
    setFormTarget(row);
  }

  const closeForm = useCallback(() => setFormTarget(null), []);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function submitForm() {
    let parsedValue;
    try {
      parsedValue = JSON.parse(values.valueText);
    } catch {
      setValueError(copy.invalidValueError);
      return;
    }
    setValueError(null);

    const payload = {
      key: values.key,
      value: parsedValue,
      description: values.description || null,
    };

    try {
      if (formTarget === 'create') {
        await createMutation.mutateAsync(payload);
        showToast(copy.createSuccess, { variant: 'success' });
      } else {
        await updateMutation.mutateAsync({ id: formTarget.id, ...payload });
        showToast(copy.updateSuccess, { variant: 'success' });
      }
      setFormTarget(null);
    } catch {
      showToast(copy.saveError, { variant: 'danger' });
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    submitForm();
  }

  async function handleDelete(row) {
    const confirmed = await confirm({
      title: copy.deleteConfirmTitle(row.key),
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
    { key: 'key', header: copy.table.key },
    {
      key: 'value',
      header: copy.table.value,
      render: (row) => JSON.stringify(row.value),
    },
    {
      key: 'description',
      header: copy.table.description,
      render: (row) => row.description || '—',
    },
    {
      key: 'updatedAt',
      header: copy.table.updatedAt,
      render: (row) => dateFormatter.format(new Date(row.updated_at)),
    },
  ];
  if (canWrite) {
    columns.push({
      key: 'actions',
      header: '',
      render: (row) => (
        <Inline gap="2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            {copy.editAction}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(row)}
          >
            {copy.deleteAction}
          </Button>
        </Inline>
      ),
    });
  }

  const isFormOpen = formTarget !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

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

      {isFormOpen && (
        <Modal
          isOpen
          onClose={closeForm}
          title={
            formTarget === 'create' ? copy.formCreateTitle : copy.formEditTitle
          }
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={() => closeForm()}>
                {copy.cancelAction}
              </Button>
              <Button
                variant="primary"
                onClick={() => submitForm()}
                loading={isSaving}
              >
                {copy.saveAction}
              </Button>
            </Inline>
          }
        >
          <form onSubmit={handleFormSubmit}>
            <Stack gap="3">
              <Input
                label={copy.fields.key}
                value={values.key}
                onChange={(event) => setField('key', event.target.value)}
                required
                disabled={formTarget !== 'create'}
              />
              <Textarea
                label={copy.fields.value}
                value={values.valueText}
                onChange={(event) => setField('valueText', event.target.value)}
                error={valueError}
                helperText={copy.valueHelperText}
                rows={4}
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

SettingsPanel.propTypes = {
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
      key: PropTypes.node.isRequired,
      value: PropTypes.node.isRequired,
      description: PropTypes.node.isRequired,
      updatedAt: PropTypes.node.isRequired,
    }).isRequired,
    fields: PropTypes.shape({
      key: PropTypes.node.isRequired,
      value: PropTypes.node.isRequired,
      description: PropTypes.node.isRequired,
    }).isRequired,
    valueHelperText: PropTypes.node.isRequired,
    invalidValueError: PropTypes.node.isRequired,
    formCreateTitle: PropTypes.node.isRequired,
    formEditTitle: PropTypes.node.isRequired,
    deleteConfirmTitle: PropTypes.func.isRequired,
    deleteConfirmDescription: PropTypes.node.isRequired,
    saveAction: PropTypes.node.isRequired,
    cancelAction: PropTypes.node.isRequired,
    editAction: PropTypes.node.isRequired,
    deleteAction: PropTypes.node.isRequired,
    emptyTitle: PropTypes.node.isRequired,
    emptyDescription: PropTypes.node.isRequired,
    errorTitle: PropTypes.node.isRequired,
    errorRetry: PropTypes.node.isRequired,
    createSuccess: PropTypes.node.isRequired,
    updateSuccess: PropTypes.node.isRequired,
    deleteSuccess: PropTypes.node.isRequired,
    saveError: PropTypes.node.isRequired,
    deleteError: PropTypes.node.isRequired,
  }).isRequired,
  dateFormatter: PropTypes.shape({ format: PropTypes.func.isRequired })
    .isRequired,
  canWrite: PropTypes.bool,
};
