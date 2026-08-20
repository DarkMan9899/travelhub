/**
 * Email copy templates (Phase 13, localized as of P0.3 — Master Roadmap).
 *
 * Every other user-facing string in this codebase is rendered
 * client-side via i18n (Phase 4.2's "i18n owns all labels" rule), but
 * email has to be rendered server-side (there is no client involved).
 * This app still has no general-purpose server-side i18n renderer —
 * building one is out of scope here — so these templates are a plain,
 * hand-maintained EN/HY/RU dictionary, not routed through the
 * client-side i18next instance. `NotificationDeliveryService` resolves
 * the recipient's locale from `users.preferred_language_id`
 * (`languageRepository.findLanguageCodeById`, defaulting to the
 * server's default language) and passes it through to `renderEmail`.
 *
 * `admin.announcement` is intentionally NOT per-locale — its
 * title/body come directly from whatever an admin actually typed, in
 * whatever language they chose; there's nothing here to translate.
 */

const DEFAULT_LOCALE = 'en';

const TEMPLATES = {
  'booking.created': {
    en: ({ bookingReference }) => ({
      subject: 'Booking received',
      body: `Your booking ${bookingReference ?? ''} has been received and is awaiting vendor confirmation.`,
    }),
    hy: ({ bookingReference }) => ({
      subject: 'Ամրագրումն ստացվել է',
      body: `Ձեր ${bookingReference ?? ''} ամրագրումն ստացվել է և սպասում է կազմակերպչի հաստատմանը:`,
    }),
    ru: ({ bookingReference }) => ({
      subject: 'Бронирование получено',
      body: `Ваше бронирование ${bookingReference ?? ''} получено и ожидает подтверждения от поставщика услуг.`,
    }),
  },
  'booking.confirmed': {
    en: ({ bookingReference }) => ({
      subject: 'Booking confirmed',
      body: `Your booking ${bookingReference ?? ''} has been confirmed.`,
    }),
    hy: ({ bookingReference }) => ({
      subject: 'Ամրագրումը հաստատվել է',
      body: `Ձեր ${bookingReference ?? ''} ամրագրումը հաստատվել է:`,
    }),
    ru: ({ bookingReference }) => ({
      subject: 'Бронирование подтверждено',
      body: `Ваше бронирование ${bookingReference ?? ''} подтверждено.`,
    }),
  },
  'booking.rejected': {
    en: ({ bookingReference }) => ({
      subject: 'Booking rejected',
      body: `Your booking ${bookingReference ?? ''} was rejected by the vendor.`,
    }),
    hy: ({ bookingReference }) => ({
      subject: 'Ամրագրումը մերժվել է',
      body: `Ձեր ${bookingReference ?? ''} ամրագրումը մերժվել է կազմակերպչի կողմից:`,
    }),
    ru: ({ bookingReference }) => ({
      subject: 'Бронирование отклонено',
      body: `Ваше бронирование ${bookingReference ?? ''} было отклонено поставщиком услуг.`,
    }),
  },
  'booking.cancelled': {
    en: ({ bookingReference }) => ({
      subject: 'Booking cancelled',
      body: `Your booking ${bookingReference ?? ''} has been cancelled.`,
    }),
    hy: ({ bookingReference }) => ({
      subject: 'Ամրագրումը չեղարկվել է',
      body: `Ձեր ${bookingReference ?? ''} ամրագրումը չեղարկվել է:`,
    }),
    ru: ({ bookingReference }) => ({
      subject: 'Бронирование отменено',
      body: `Ваше бронирование ${bookingReference ?? ''} отменено.`,
    }),
  },
  'booking.completed': {
    en: ({ bookingReference }) => ({
      subject: 'Trip completed',
      body: `Your booking ${bookingReference ?? ''} is complete. We'd love to hear about your stay.`,
    }),
    hy: ({ bookingReference }) => ({
      subject: 'Ուղևորությունն ավարտվել է',
      body: `Ձեր ${bookingReference ?? ''} ամրագրումն ավարտվել է: Մեզ հետաքրքրում է ձեր կարծիքը:`,
    }),
    ru: ({ bookingReference }) => ({
      subject: 'Поездка завершена',
      body: `Ваше бронирование ${bookingReference ?? ''} завершено. Будем рады узнать ваше мнение о поездке.`,
    }),
  },
  'review.submitted': {
    en: ({ listingTitle, rating }) => ({
      subject: 'New review received',
      body: `Your listing "${listingTitle ?? ''}" received a new ${rating ?? '?'}-star review.`,
    }),
    hy: ({ listingTitle, rating }) => ({
      subject: 'Նոր կարծիք է ստացվել',
      body: `Ձեր «${listingTitle ?? ''}» հայտարարությունը ստացել է նոր ${rating ?? '?'}-աստղանի կարծիք:`,
    }),
    ru: ({ listingTitle, rating }) => ({
      subject: 'Получен новый отзыв',
      body: `Ваше объявление «${listingTitle ?? ''}» получило новый отзыв на ${rating ?? '?'} звёзд.`,
    }),
  },
  'favorite.added': {
    en: ({ listingTitle }) => ({
      subject: 'Someone favorited your listing',
      body: `A traveler favorited your listing "${listingTitle ?? ''}".`,
    }),
    hy: ({ listingTitle }) => ({
      subject: 'Ձեր հայտարարությունն ավելացվել է ընտրյալների մեջ',
      body: `Ճանապարհորդը ձեր «${listingTitle ?? ''}» հայտարարությունն ավելացրել է ընտրյալների մեջ:`,
    }),
    ru: ({ listingTitle }) => ({
      subject: 'Ваше объявление добавлено в избранное',
      body: `Путешественник добавил ваше объявление «${listingTitle ?? ''}» в избранное.`,
    }),
  },
  'partner.approved': {
    en: ({ partnerName }) => ({
      subject: 'Partner application approved',
      body: `Congratulations — "${partnerName ?? 'Your partner account'}" has been approved.`,
    }),
    hy: ({ partnerName }) => ({
      subject: 'Գործընկերոջ հայտն հաստատվել է',
      body: `Շնորհավորում ենք․ «${partnerName ?? 'Ձեր գործընկերոջ հաշիվը'}»-ը հաստատվել է:`,
    }),
    ru: ({ partnerName }) => ({
      subject: 'Заявка партнёра одобрена',
      body: `Поздравляем — «${partnerName ?? 'Ваш партнёрский аккаунт'}» одобрено.`,
    }),
  },
  // P1.2 (Master Roadmap) — the two other real review outcomes.
  'partner.rejected': {
    en: ({ partnerName }) => ({
      subject: 'Partner application not approved',
      body: `Your application for "${partnerName ?? 'your business'}" was not approved.`,
    }),
    hy: ({ partnerName }) => ({
      subject: 'Գործընկերոջ հայտը մերժվել է',
      body: `Ձեր «${partnerName ?? 'ձեր բիզնեսի'}» հայտը չի հաստատվել:`,
    }),
    ru: ({ partnerName }) => ({
      subject: 'Заявка партнёра отклонена',
      body: `Ваша заявка на «${partnerName ?? 'ваш бизнес'}» не была одобрена.`,
    }),
  },
  'partner.needs_changes': {
    en: ({ partnerName, reviewNote }) => ({
      subject: 'Changes requested on your partner application',
      body: `Your application for "${partnerName ?? 'your business'}" needs some changes before it can be approved.${reviewNote ? ` Reviewer note: ${reviewNote}` : ''}`,
    }),
    hy: ({ partnerName, reviewNote }) => ({
      subject: 'Ձեր հայտում փոփոխություններ են պահանջվում',
      body: `Ձեր «${partnerName ?? 'ձեր բիզնեսի'}» հայտը հաստատվելուց առաջ պահանջում է որոշ փոփոխություններ:${reviewNote ? ` Գրախոսի նշում. ${reviewNote}` : ''}`,
    }),
    ru: ({ partnerName, reviewNote }) => ({
      subject: 'По вашей заявке партнёра запрошены изменения',
      body: `Ваша заявка на «${partnerName ?? 'ваш бизнес'}» требует изменений перед одобрением.${reviewNote ? ` Комментарий проверяющего: ${reviewNote}` : ''}`,
    }),
  },
  'listing.approved': {
    en: ({ listingTitle }) => ({
      subject: 'Listing approved',
      body: `Your listing "${listingTitle ?? ''}" has been approved and is now live.`,
    }),
    hy: ({ listingTitle }) => ({
      subject: 'Հայտարարությունը հաստատվել է',
      body: `Ձեր «${listingTitle ?? ''}» հայտարարությունը հաստատվել է և այժմ հասանելի է:`,
    }),
    ru: ({ listingTitle }) => ({
      subject: 'Объявление одобрено',
      body: `Ваше объявление «${listingTitle ?? ''}» одобрено и теперь опубликовано.`,
    }),
  },
  'listing.rejected': {
    en: ({ listingTitle, notes }) => ({
      subject: 'Listing rejected',
      body: `Your listing "${listingTitle ?? ''}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
    }),
    hy: ({ listingTitle, notes }) => ({
      subject: 'Հայտարարությունը մերժվել է',
      body: `Ձեր «${listingTitle ?? ''}» հայտարարությունը մերժվել է:${notes ? ` Նշում. ${notes}` : ''}`,
    }),
    ru: ({ listingTitle, notes }) => ({
      subject: 'Объявление отклонено',
      body: `Ваше объявление «${listingTitle ?? ''}» отклонено.${notes ? ` Примечание: ${notes}` : ''}`,
    }),
  },
  // P1.4 (Master Roadmap) — sent directly via `emailAdapter` from
  // `partnerStaffService.js`, bypassing the notification pipeline: the
  // invitee may not have a `users` row (and therefore no
  // `recipientUserId`) yet, which every other template here assumes.
  'partner.staff_invited': {
    en: ({ partnerName, roleName, inviteUrl }) => ({
      subject: `You've been invited to join ${partnerName ?? 'a company'} on Desavii`,
      body: `You've been invited to join "${partnerName ?? 'a company'}" as ${roleName ?? 'a team member'}. Accept the invitation: ${inviteUrl ?? ''}`,
    }),
    hy: ({ partnerName, roleName, inviteUrl }) => ({
      subject: `Ձեզ հրավիրել են միանալու «${partnerName ?? 'ընկերությանը'}»-ին Desavii-ում`,
      body: `Ձեզ հրավիրել են միանալու «${partnerName ?? 'ընկերությանը'}»-ին որպես ${roleName ?? 'թիմի անդամ'}: Ընդունեք հրավերը՝ ${inviteUrl ?? ''}`,
    }),
    ru: ({ partnerName, roleName, inviteUrl }) => ({
      subject: `Вас пригласили присоединиться к «${partnerName ?? 'компании'}» на Desavii`,
      body: `Вас пригласили присоединиться к «${partnerName ?? 'компании'}» в качестве ${roleName ?? 'участника команды'}. Примите приглашение: ${inviteUrl ?? ''}`,
    }),
  },
  // Sent via the normal event-driven pipeline once the invitation above
  // is actually accepted (a real `recipientUserId` exists by then).
  'partner.staff_added': {
    en: ({ partnerName, roleName }) => ({
      subject: 'Welcome to the team',
      body: `You are now a ${roleName ?? 'team member'} at "${partnerName ?? 'your new team'}".`,
    }),
    hy: ({ partnerName, roleName }) => ({
      subject: 'Բարի գալուստ թիմ',
      body: `Այժմ դուք «${partnerName ?? 'ձեր նոր թիմի'}» ${roleName ?? 'թիմի անդամն'} եք:`,
    }),
    ru: ({ partnerName, roleName }) => ({
      subject: 'Добро пожаловать в команду',
      body: `Теперь вы ${roleName ?? 'участник команды'} в «${partnerName ?? 'вашей новой команде'}».`,
    }),
  },
  // P1.5 (Master Roadmap) — the review author, notified only when a
  // moderator hides an already-live review (see eventTypes.js's own
  // comment on why there is no APPROVED/FLAGGED equivalent).
  'review.rejected': {
    en: ({ notes }) => ({
      subject: 'Your review was removed',
      body: `A moderator removed your review because it didn't meet our guidelines.${notes ? ` Note: ${notes}` : ''}`,
    }),
    hy: ({ notes }) => ({
      subject: 'Ձեր կարծիքը հեռացվել է',
      body: `Մոդերատորը հեռացրել է ձեր կարծիքը, քանի որ այն չի համապատասխանում մեր կանոններին։${notes ? ` Նշում. ${notes}` : ''}`,
    }),
    ru: ({ notes }) => ({
      subject: 'Ваш отзыв был удалён',
      body: `Модератор удалил ваш отзыв, так как он не соответствует нашим правилам.${notes ? ` Примечание: ${notes}` : ''}`,
    }),
  },
  // Sent to moderators/admins, not the review's author.
  'review.reported': {
    en: ({ reasonName }) => ({
      subject: 'A review was reported',
      body: `A customer reported a review (reason: ${reasonName ?? 'unspecified'}). Please review it in the moderation queue.`,
    }),
    hy: ({ reasonName }) => ({
      subject: 'Կարծիք է հայտնվել',
      body: `Հաճախորդը հայտնվել է կարծիքի մասին (պատճառ՝ ${reasonName ?? 'չնշված'})։ Խնդրում ենք ստուգել այն մոդերացիայի հերթում։`,
    }),
    ru: ({ reasonName }) => ({
      subject: 'На отзыв поступила жалоба',
      body: `Клиент пожаловался на отзыв (причина: ${reasonName ?? 'не указана'}). Пожалуйста, проверьте его в очереди модерации.`,
    }),
  },
  'admin.announcement': {
    en: ({ title, body }) => ({
      subject: title ?? 'Announcement',
      body: body ?? '',
    }),
    hy: ({ title, body }) => ({
      subject: title ?? 'Announcement',
      body: body ?? '',
    }),
    ru: ({ title, body }) => ({
      subject: title ?? 'Announcement',
      body: body ?? '',
    }),
  },
};

/**
 * Falls back to a generic (English, technical) rendering for any event
 * type without a specific template — this is a developer-facing safety
 * net, not a customer-facing message, so it's intentionally never
 * localized.
 */
export function renderEmail(eventType, payload = {}, locale = DEFAULT_LOCALE) {
  const perLocale = TEMPLATES[eventType];
  if (perLocale) {
    const render = perLocale[locale] ?? perLocale[DEFAULT_LOCALE];
    return render(payload);
  }
  return {
    subject: 'Notification',
    body: `Event: ${eventType}\n${JSON.stringify(payload)}`,
  };
}

export default renderEmail;
