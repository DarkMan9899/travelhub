import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MessagingPageContent } from '../../modules/messaging/index.js';

export default function AdminMessagesPage() {
  const { t } = useTranslation();
  const { locale } = useParams();

  return (
    <MessagingPageContent
      breadcrumbs={[
        { label: t('nav.home'), href: `/${locale}` },
        { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
        {
          label: t('messaging.page.heading'),
          href: `/${locale}/admin/messages`,
        },
      ]}
    />
  );
}
