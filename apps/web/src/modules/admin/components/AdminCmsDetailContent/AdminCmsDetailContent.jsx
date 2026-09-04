/**
 * AdminCmsDetailContent — `/:locale/admin/cms/:id` (Stage 11.6: CMS).
 * Two independent concerns, each its own save action: the page's own
 * settings (slug, publish state) and a `Tabs`-per-locale editor for
 * title+content (`SUPPORTED_LOCALES` — the same three locales every
 * other translated entity in this app uses), each locale saved via its
 * own `PUT .../translations/:languageCode` call so switching tabs never
 * discards an unsaved edit in another locale.
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Switch, Textarea } from '@desavii/ui/components/form-controls';
import { Button, Card, Badge } from '@desavii/ui/components/primitives';
import { Tabs } from '@desavii/ui/components/navigation';
import {
  Spinner,
  ErrorState,
  EmptyState,
  Alert,
} from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { SUPPORTED_LOCALES } from '../../../../translations/i18n.js';
import { useAdminCmsPageDetailQuery } from '../../queries/useAdminCmsPageDetailQuery.js';
import { useUpdateCmsPageMutation } from '../../mutations/useUpdateCmsPageMutation.js';
import { useUpsertCmsTranslationMutation } from '../../mutations/useUpsertCmsTranslationMutation.js';

function TranslationEditor({
  pageId,
  languageCode,
  translation = undefined,
  onSaved,
  canWrite = true,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const upsertMutation = useUpsertCmsTranslationMutation();
  const [title, setTitle] = useState(translation?.title ?? '');
  const [content, setContent] = useState(translation?.content ?? '');

  useEffect(() => {
    setTitle(translation?.title ?? '');
    setContent(translation?.content ?? '');
  }, [translation]);

  async function handleSave() {
    try {
      await upsertMutation.mutateAsync({
        id: pageId,
        languageCode,
        title,
        content,
      });
      showToast(t('admin.cms.translationSaveSuccess'), {
        variant: 'success',
      });
      onSaved();
    } catch {
      showToast(t('admin.cms.saveError'), { variant: 'danger' });
    }
  }

  return (
    <Stack gap="3">
      {!translation && (
        <Alert variant="info" title={t('admin.cms.localeMissing.title')}>
          {t('admin.cms.localeMissing.description')}
        </Alert>
      )}
      <Input
        label={t('admin.cms.titleLabel')}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        disabled={!canWrite}
      />
      <Textarea
        label={t('admin.cms.contentLabel')}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={10}
        required
        disabled={!canWrite}
      />
      {canWrite && (
        <Inline justify="flex-end">
          <Button
            variant="primary"
            onClick={() => handleSave()}
            loading={upsertMutation.isPending}
          >
            {t('common.save')}
          </Button>
        </Inline>
      )}
    </Stack>
  );
}

TranslationEditor.propTypes = {
  pageId: PropTypes.number.isRequired,
  languageCode: PropTypes.string.isRequired,
  translation: PropTypes.shape({
    title: PropTypes.string,
    content: PropTypes.string,
  }),
  onSaved: PropTypes.func.isRequired,
  canWrite: PropTypes.bool,
};

export default function AdminCmsDetailContent() {
  const { t } = useTranslation();
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canManageCms = permissions.includes('cms.manage');
  const { showToast } = useToast();
  const pageId = Number(id);

  const {
    data: page,
    isPending,
    isError,
    error,
    refetch,
  } = useAdminCmsPageDetailQuery(pageId);
  const updatePageMutation = useUpdateCmsPageMutation();

  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [activeLocale, setActiveLocale] = useState(SUPPORTED_LOCALES[0]);

  useEffect(() => {
    if (page) {
      setSlug(page.slug);
      setIsPublished(page.is_published);
    }
  }, [page]);

  if (isPending) {
    return (
      <Section aria-label={t('admin.cms.loading')}>
        <Spinner label={t('admin.cms.loading')} />
      </Section>
    );
  }

  if (isError) {
    if (error.status === 404) {
      return (
        <EmptyState
          title={t('errors.notFound.title')}
          description={t('errors.notFound.description')}
          actionLabel={t('errors.notFound.action')}
          onAction={() => navigate(`/${locale}/admin/cms`)}
        />
      );
    }
    return (
      <Section>
        <ErrorState
          title={t('admin.cms.errorTitle')}
          retryLabel={t('admin.cms.errorRetry')}
          onRetry={refetch}
        />
      </Section>
    );
  }

  async function handleSaveSettings() {
    try {
      await updatePageMutation.mutateAsync({ id: pageId, slug, isPublished });
      showToast(t('admin.cms.settingsSaveSuccess'), { variant: 'success' });
    } catch {
      showToast(t('admin.cms.saveError'), { variant: 'danger' });
    }
  }

  const translationByLocale = new Map(
    page.translations.map((translation) => [
      translation.language_code,
      translation,
    ]),
  );

  const tabs = SUPPORTED_LOCALES.map((code) => {
    const hasTranslation = translationByLocale.has(code);
    return {
      id: code,
      label: hasTranslation
        ? code.toUpperCase()
        : t('admin.cms.localeTabMissingLabel', { code: code.toUpperCase() }),
      panel: (
        <TranslationEditor
          pageId={pageId}
          languageCode={code}
          translation={translationByLocale.get(code)}
          onSaved={refetch}
          canWrite={canManageCms}
        />
      ),
    };
  });

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.cms.detailHeading', { slug: page.slug })}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          { label: t('admin.cms.heading'), href: `/${locale}/admin/cms` },
          {
            label: page.slug,
            href: `/${locale}/admin/cms/${page.id}`,
          },
        ]}
      />
      <Stack gap="4">
        <Card as="div" padding="lg">
          <Stack gap="3">
            <h2>{t('admin.cms.settingsHeading')}</h2>
            <Input
              label={t('admin.cms.table.slug')}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              required
              disabled={!canManageCms}
            />
            <Switch
              label={t('admin.cms.published')}
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
              disabled={!canManageCms}
            />
            {canManageCms && (
              <Inline justify="flex-end">
                <Button
                  variant="primary"
                  onClick={() => handleSaveSettings()}
                  loading={updatePageMutation.isPending}
                >
                  {t('common.save')}
                </Button>
              </Inline>
            )}
          </Stack>
        </Card>

        <Card as="div" padding="lg">
          <Stack gap="3">
            <h2>{t('admin.cms.translationsHeading')}</h2>
            <Inline gap="2" wrap>
              {SUPPORTED_LOCALES.map((code) => (
                <Badge
                  key={code}
                  size="sm"
                  variant={
                    translationByLocale.has(code) ? 'success' : 'neutral'
                  }
                  label={t('admin.cms.localeStatusBadge', {
                    code: code.toUpperCase(),
                    status: t(
                      translationByLocale.has(code)
                        ? 'admin.cms.localeAuthored'
                        : 'admin.cms.localeMissingShort',
                    ),
                  })}
                />
              ))}
            </Inline>
            <Tabs
              tabs={tabs}
              activeTabId={activeLocale}
              onChange={setActiveLocale}
              ariaLabel={t('admin.cms.translationsHeading')}
            />
          </Stack>
        </Card>
      </Stack>
    </Section>
  );
}
