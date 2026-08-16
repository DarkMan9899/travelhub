/**
 * Seeds Stage 11.6's CMS pages (migration 0018) — one row per the six
 * static public pages `apps/web/src/modules/cms/` already ships
 * (about/contact/faq/help/become-a-partner/blog), each with real
 * en/hy/ru title+content so the new Admin CMS editor has something
 * genuine to list/edit from the start, not empty rows. The public pages
 * themselves stay static this stage (per the Phase 11 plan's own scope
 * decision) — this content is not yet fetched by them.
 */

const PAGES = [
  {
    slug: 'about',
    isPublished: true,
    translations: {
      en: {
        title: 'About desavii',
        content:
          'desavii connects travelers with verified local hosts, tour operators, and experience providers across Armenia — hotels, apartments, villas, guest houses, restaurants, tours, car rentals, and attractions, all in one marketplace.',
      },
      hy: {
        title: 'desavii-ի մասին',
        content:
          'desavii-ն ճանապարհորդներին կապում է Հայաստանի ստուգված տեղական հյուրընկալողների, տուր-օպերատորների և փորձառության մատակարարների հետ՝ հյուրանոցներ, բնակարաններ, վիլլաներ, հյուրատներ, ռեստորաններ, տուրեր, ավտովարձույթ և տեսարժան վայրեր, ամեն ինչ մեկ շուկայում։',
      },
      ru: {
        title: 'О desavii',
        content:
          'desavii соединяет путешественников с проверенными местными хозяевами, туроператорами и поставщиками впечатлений по всей Армении — отели, апартаменты, виллы, гостевые дома, рестораны, туры, аренда автомобилей и достопримечательности, всё на одной площадке.',
      },
    },
  },
  {
    slug: 'contact',
    isPublished: true,
    translations: {
      en: {
        title: 'Contact Us',
        content:
          'Have a question about a booking or a partner account? Reach our support team at support@desavii.com, available Monday to Friday, 9:00–18:00 (Yerevan time).',
      },
      hy: {
        title: 'Կապ մեզ հետ',
        content:
          'Հարց ունե՞ք ամրագրման կամ գործընկերոջ հաշվի վերաբերյալ։ Կապվեք մեր աջակցության թիմի հետ՝ support@desavii.com, երկուշաբթիից ուրբաթ, 9:00–18:00 (Երևանի ժամանակով)։',
      },
      ru: {
        title: 'Связаться с нами',
        content:
          'Есть вопрос о бронировании или партнёрском аккаунте? Свяжитесь с нашей службой поддержки: support@desavii.com, с понедельника по пятницу, 9:00–18:00 (по времени Еревана).',
      },
    },
  },
  {
    slug: 'faq',
    isPublished: true,
    translations: {
      en: {
        title: 'Frequently Asked Questions',
        content:
          'Find answers to common questions about booking, cancellations, payments, and becoming a desavii partner.',
      },
      hy: {
        title: 'Հաճախ տրվող հարցեր',
        content:
          'Գտեք պատասխաններ ամրագրման, չեղարկման, վճարումների և desavii-ի գործընկեր դառնալու վերաբերյալ հաճախ տրվող հարցերին։',
      },
      ru: {
        title: 'Часто задаваемые вопросы',
        content:
          'Найдите ответы на распространённые вопросы о бронировании, отмене, оплате и о том, как стать партнёром desavii.',
      },
    },
  },
  {
    slug: 'help',
    isPublished: true,
    translations: {
      en: {
        title: 'Help Center',
        content:
          'Browse guides for managing your bookings, updating your profile, and getting the most out of desavii.',
      },
      hy: {
        title: 'Օգնության կենտրոն',
        content:
          'Ուսումնասիրեք ուղեցույցներ ձեր ամրագրումները կառավարելու, պրոֆիլը թարմացնելու և desavii-ից առավելագույնս օգտվելու համար։',
      },
      ru: {
        title: 'Центр помощи',
        content:
          'Изучите руководства по управлению бронированиями, обновлению профиля и максимально эффективному использованию desavii.',
      },
    },
  },
  {
    slug: 'become-a-partner',
    isPublished: true,
    translations: {
      en: {
        title: 'Become a Partner',
        content:
          'List your hotel, apartment, tour, or experience on desavii and reach travelers across the country. Create an account to get started.',
      },
      hy: {
        title: 'Դարձեք գործընկեր',
        content:
          'Տեղադրեք ձեր հյուրանոցը, բնակարանը, տուրը կամ փորձառությունը desavii-ում և հասեք ողջ երկրի ճանապարհորդներին։ Սկսելու համար ստեղծեք հաշիվ։',
      },
      ru: {
        title: 'Станьте партнёром',
        content:
          'Разместите свой отель, апартаменты, тур или впечатление на desavii и охватите путешественников по всей стране. Создайте аккаунт, чтобы начать.',
      },
    },
  },
  {
    slug: 'blog',
    isPublished: false,
    translations: {
      en: {
        title: 'Blog',
        content:
          'Our blog is coming soon — check back later for travel stories and tips from across Armenia.',
      },
      hy: {
        title: 'Բլոգ',
        content:
          'Մեր բլոգը շուտով կհասանելի լինի․ ավելի ուշ վերադարձեք՝ Հայաստանի ճանապարհորդական պատմություններ և խորհուրդներ կարդալու համար։',
      },
      ru: {
        title: 'Блог',
        content:
          'Наш блог скоро появится — загляните позже, чтобы прочитать истории и советы о путешествиях по Армении.',
      },
    },
  },
];

async function upsertPage(connection, { slug, isPublished }) {
  await connection.query(
    `INSERT INTO cms_pages (slug, is_published) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE is_published = VALUES(is_published)`,
    [slug, isPublished ? 1 : 0],
  );
  const [[row]] = await connection.query(
    'SELECT id FROM cms_pages WHERE slug = ?',
    [slug],
  );
  return row.id;
}

async function upsertTranslation(
  connection,
  pageId,
  languageId,
  { title, content },
) {
  await connection.query(
    `INSERT INTO cms_page_translations (cms_page_id, language_id, title, content)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
    [pageId, languageId, title, content],
  );
}

export default async function seedCmsPages(connection) {
  const [languageRows] = await connection.query(
    'SELECT id, code FROM languages',
  );
  const languageIdByCode = new Map(
    languageRows.map((row) => [row.code, row.id]),
  );

  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const page of PAGES) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const pageId = await upsertPage(connection, page);
    // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
    for (const [code, translation] of Object.entries(page.translations)) {
      const languageId = languageIdByCode.get(code);
      if (languageId) {
        // eslint-disable-next-line no-await-in-loop -- sequential by design
        await upsertTranslation(connection, pageId, languageId, translation);
      }
    }
  }
}
