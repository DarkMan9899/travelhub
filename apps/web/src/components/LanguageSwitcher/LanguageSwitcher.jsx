/**
 * LanguageSwitcher — FRONTEND_ARCHITECTURE.md §16.6's locale-switching
 * mechanics: rewrites only the URL's leading locale segment, preserving
 * the rest of the path and query string, and updates i18next's active
 * language to match. (§16.6's steps 3–4 — updating `Accept-Language` on
 * subsequent API calls, and refetching locale-dependent queries — are
 * handled elsewhere: `api/client.js`'s request interceptor already
 * re-derives the header from the URL on every request, and no
 * locale-dependent query exists yet in this phase to refetch.)
 *
 * No dedicated `LocaleContext` yet — the URL segment IS the source of
 * truth (§13.3), and this is its only non-route consumer so far; a
 * Context is introduced once a second one exists (§7's promotion rule).
 */

import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SUPPORTED_LOCALES } from '../../translations/i18n.js';
import styles from './LanguageSwitcher.module.scss';

const LOCALE_LABELS = { hy: 'ՀՅ', ru: 'РУ', en: 'EN' };

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  function switchTo(nextLocale) {
    if (nextLocale === locale) return;
    i18n.changeLanguage(nextLocale);
    const restOfPath = location.pathname.replace(`/${locale}`, '');
    navigate(`/${nextLocale}${restOfPath}${location.search}`);
  }

  return (
    <div
      role="group"
      aria-label={t('a11y.switchLanguage')}
      className={styles.switcher}
    >
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={[styles.option, code === locale && styles.optionActive]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={code === locale}
          onClick={() => switchTo(code)}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
