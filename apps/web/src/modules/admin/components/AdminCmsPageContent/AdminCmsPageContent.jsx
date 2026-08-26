/**
 * AdminCmsPageContent — `/:locale/admin/cms` (Stage 11.6: CMS). Lists
 * every `cms_pages` row (slug, publish state), lets an admin create a
 * new page or delete one, and links each row to
 * `AdminCmsDetailContent` for the actual per-locale title/content
 * editing (a modal is too small a surface for a rich-text-ish body
 * across three locales, so this follows the list-then-detail pattern
 * Stage 11.1/11.2's Users/Partners pages already established, not
 * Stage 11.5's list-with-modal-form pattern).
 *
 * The six page rows this stage's seed data ships
 * (about/contact/faq/help/become-a-partner/blog) are not yet consumed
 * by any public page — this editor is real, but its output isn't live
 * anywhere yet, per the Phase 11 plan's own scope decision.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Switch } from '@desavii/ui/components/form-controls';
import { Button, Badge } from '@desavii/ui/components/primitives';
import { DataTable } from '@desavii/ui/components/dashboard';
import { Modal, ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminCmsPagesQuery } from '../../queries/useAdminCmsPagesQuery.js';
import { useCreateCmsPageMutation } from '../../mutations/useCreateCmsPageMutation.js';
import { useDeleteCmsPageMutation } from '../../mutations/useDeleteCmsPageMutation.js';

export default function AdminCmsPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { permissions } = useAuth();
  const canManageCms = permissions.includes('cms.manage');
  const confirm = useConfirm();
  const { showToast } = useToast();

  const { data, isPending, isError, refetch } = useAdminCmsPagesQuery();
  const createMutation = useCreateCmsPageMutation();
  const deleteMutation = useDeleteCmsPageMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newIsPublished, setNewIsPublished] = useState(false);

  const closeCreate = useCallback(() => setIsCreateOpen(false), []);

  function openCreate() {
    setNewSlug('');
    setNewIsPublished(false);
    setIsCreateOpen(true);
  }

  async function handleCreate() {
    try {
      await createMutation.mutateAsync({
        slug: newSlug,
        isPublished: newIsPublished,
      });
      showToast(t('admin.cms.createSuccess'), { variant: 'success' });
      setIsCreateOpen(false);
    } catch {
      showToast(t('admin.cms.saveError'), { variant: 'danger' });
    }
  }

  async function handleDelete(page) {
    const confirmed = await confirm({
      title: t('admin.cms.deleteConfirmTitle', { slug: page.slug }),
      description: t('admin.cms.deleteConfirmDescription'),
      confirmLabel: t('admin.cms.deleteAction'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(page.id);
      showToast(t('admin.cms.deleteSuccess'), { variant: 'success' });
    } catch {
      showToast(t('admin.cms.deleteError'), { variant: 'danger' });
    }
  }

  const rows = data ?? [];

  const columns = [
    {
      key: 'slug',
      header: t('admin.cms.table.slug'),
      render: (page) => (
        <RouterLink href={`/${locale}/admin/cms/${page.id}`}>
          {page.slug}
        </RouterLink>
      ),
    },
    {
      key: 'status',
      header: t('admin.cms.table.status'),
      render: (page) => (
        <Badge
          variant={page.is_published ? 'success' : 'neutral'}
          size="sm"
          label={t(
            page.is_published ? 'admin.cms.published' : 'admin.cms.unpublished',
          )}
        />
      ),
    },
  ];
  if (canManageCms) {
    columns.push({
      key: 'actions',
      header: '',
      render: (page) => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDelete(page)}
        >
          {t('admin.cms.deleteAction')}
        </Button>
      ),
    });
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.cms.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          { label: t('admin.cms.heading'), href: `/${locale}/admin/cms` },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.cms.errorTitle')}
          retryLabel={t('admin.cms.errorRetry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          {canManageCms && (
            <Inline justify="flex-end">
              <Button variant="primary" size="sm" onClick={() => openCreate()}>
                {t('admin.cms.addAction')}
              </Button>
            </Inline>
          )}

          <DataTable
            columns={columns}
            rows={rows}
            isLoading={isPending}
            emptyTitle={t('admin.cms.emptyTitle')}
            emptyDescription={t('admin.cms.emptyDescription')}
          />
        </Stack>
      )}

      {isCreateOpen && (
        <Modal
          isOpen
          onClose={closeCreate}
          title={t('admin.cms.formCreateTitle')}
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={() => closeCreate()}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleCreate()}
                loading={createMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </Inline>
          }
        >
          <Stack gap="3">
            <Input
              label={t('admin.cms.table.slug')}
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value)}
              required
            />
            <Switch
              label={t('admin.cms.published')}
              checked={newIsPublished}
              onChange={(event) => setNewIsPublished(event.target.checked)}
            />
          </Stack>
        </Modal>
      )}
    </Section>
  );
}
