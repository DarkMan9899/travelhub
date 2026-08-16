/**
 * Phase 18 (Premium Listing Detail Experience) rich demo content for the
 * 6 flagship listings `seedDemoInventoryScenarios.js` already creates —
 * one per category (Hotel, Apartment, Tour, Activity, Guide, Car Rental).
 * Those listings were built for Phase 17's inventory-engine demo and are
 * deliberately thin (1-2 images, no attributes/amenities/policies, no
 * highlights/itinerary/included-items/FAQs) — this module layers real,
 * hand-written, per-category content onto them so the redesigned Listing
 * Detail page has something genuinely rich to render for every category,
 * instead of the near-empty state Phase 17 left behind.
 *
 * Runs immediately after `seedDemoInventoryScenarios` in the same
 * transaction (see `cli/seedDemo.js`/`cli/seedDemoDev.js`), taking the
 * listing ids it returns directly rather than re-resolving by slug.
 * Every one of these 6 listings is freshly INSERTed by that prior step on
 * every run, so — matching this `demo/` family's own established
 * convention (see `seedDemoMarketplace.js`'s header) — every write here
 * is a plain INSERT, not an idempotent upsert, except the `en`
 * translation row, which already exists and must be updated in place
 * rather than duplicated (`listing_translations` is unique per
 * `(listing_id, language_id)`).
 *
 * `listing_highlights`/`listing_itinerary_steps`/`listing_included_items`/
 * `listing_faqs` (migration 0026) have no `language_id` column — they are
 * genuinely English-only today, a real, documented limitation of that
 * schema (see the Phase 18 final report), not an oversight here.
 */

import { getIdByCode } from '../helpers.js';

const ATTRIBUTE_VALUE_TABLES = {
  INTEGER: 'listing_attribute_values_integer',
  DECIMAL: 'listing_attribute_values_decimal',
  BOOLEAN: 'listing_attribute_values_boolean',
  STRING: 'listing_attribute_values_string',
  DATE: 'listing_attribute_values_date',
};

async function upsertTranslation(connection, listingId, languageId, t) {
  await connection.query(
    `INSERT INTO listing_translations (listing_id, language_id, title, summary, description)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), description = VALUES(description)`,
    [listingId, languageId, t.title, t.summary, t.description],
  );
}

async function insertAttributeValue(connection, listingId, entry) {
  const [[definition]] = await connection.query(
    `SELECT ad.id, adt.code AS data_type_code
     FROM attribute_definitions ad
     JOIN attribute_data_types adt ON adt.id = ad.data_type_id
     WHERE ad.code = ?`,
    [entry.code],
  );
  if (!definition) {
    throw new Error(
      `seedDemoListingRichContent: unknown attribute code "${entry.code}"`,
    );
  }
  if (entry.optionCodes) {
    // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
    for (const optionCode of entry.optionCodes) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      const [[option]] = await connection.query(
        'SELECT id FROM attribute_options WHERE attribute_definition_id = ? AND code = ?',
        [definition.id, optionCode],
      );
      if (!option) {
        throw new Error(
          `seedDemoListingRichContent: unknown option "${optionCode}" for attribute "${entry.code}"`,
        );
      }
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_attribute_option (listing_id, attribute_option_id) VALUES (?, ?)',
        [listingId, option.id],
      );
    }
    return;
  }
  const table = ATTRIBUTE_VALUE_TABLES[definition.data_type_code];
  await connection.query(
    `INSERT INTO ${table} (listing_id, attribute_definition_id, value) VALUES (?, ?, ?)`,
    [listingId, definition.id, entry.value],
  );
}

async function insertPolicyValue(connection, listingId, entry) {
  const policyDefinitionId = await getIdByCode(
    connection,
    'policy_definitions',
    entry.code,
  );
  await connection.query(
    'INSERT INTO listing_policy_values (listing_id, policy_definition_id, value) VALUES (?, ?, ?)',
    [listingId, policyDefinitionId, entry.value],
  );
}

async function insertMedia(
  connection,
  listingId,
  imageTypeId,
  completedUploadStatusId,
  approvedStatusId,
  ownerUserId,
  startPosition,
  category,
  files,
) {
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const [index, file] of files.entries()) {
    const url = `/assets/images/demo/${category}/${file}`;
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await connection.query(
      `INSERT INTO media
        (mediable_type, mediable_id, media_type_id, url, thumbnail_url, position, is_cover,
         upload_status_id, moderation_status_id, owner_user_id)
       VALUES ('listing', ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        listingId,
        imageTypeId,
        url,
        url,
        startPosition + index,
        completedUploadStatusId,
        approvedStatusId,
        ownerUserId,
      ],
    );
  }
}

const LANG_CODES = { en: 'en', hy: 'hy', ru: 'ru' };

// eslint-disable-next-line max-lines-per-function -- one flat, readable content table per flagship listing; splitting it up would only add indirection
export default async function seedDemoListingRichContent(
  connection,
  listingIds,
) {
  const [imageTypeId, completedUploadStatusId, approvedStatusId, languageIds] =
    await Promise.all([
      getIdByCode(connection, 'media_types', 'IMAGE'),
      getIdByCode(connection, 'media_upload_statuses', 'COMPLETED'),
      getIdByCode(connection, 'moderation_statuses', 'APPROVED'),
      (async () => {
        const [rows] = await connection.query(
          'SELECT id, code FROM languages WHERE code IN (?, ?, ?)',
          [LANG_CODES.en, LANG_CODES.hy, LANG_CODES.ru],
        );
        return new Map(rows.map((row) => [row.code, row.id]));
      })(),
    ]);

  const FLAGSHIPS = [
    {
      listingId: listingIds.hotelListingId,
      category: 'hotels',
      images: ['hotels-3.svg', 'hotels-4.svg', 'hotels-5.svg', 'hotels-6.svg'],
      translations: {
        en: {
          title: 'Boutique Yerevan Hotel',
          summary:
            'A design-forward boutique hotel moments from Republic Square, with Standard Rooms and Deluxe Suites.',
          description:
            'Boutique Yerevan Hotel sits on a quiet side street just minutes from Republic Square, blending mid-century Armenian architecture with warm, contemporary interiors. Choose a Standard Room for a comfortable solo or business stay, or step up to a Deluxe Suite with extra space for couples. Every morning starts with a full breakfast spread in the ground-floor café, and the small on-site gym and lounge make it easy to unwind after a day exploring the city. The front desk is staffed around the clock, so late check-ins and early departures are never a problem.',
        },
        hy: {
          title: 'Բուտիկ Հյուրանոց Երևանում',
          summary:
            'Ժամանակակից բուտիկ հյուրանոց Հանրապետության հրապարակի մոտակայքում՝ Ստանդարտ սենյակներով և Դելյուքս ապարտամենտներով։',
          description:
            'Բուտիկ Հյուրանոց Երևանում գտնվում է հանգիստ փողոցում՝ Հանրապետության հրապարակից ընդամենը մի քանի րոպե հեռավորության վրա։ Ընտրեք Ստանդարտ սենյակ հարմարավետ գործուղման կամ մեկանգամյա հանգստի համար, կամ Դելյուքս ապարտամենտ՝ զույգերի համար ընդարձակ տարածքով։ Յուրաքանչյուր առավոտ սկսվում է հարուստ նախաճաշով սրճարանում, իսկ փոքր մարզասրահն ու հանգստի գոտին թույլ են տալիս հանգստանալ քաղաքով զբոսնելուց հետո։ Ընդունարանն աշխատում է շուրջօրյա, ուստի ուշ ժամանումն ու վաղ մեկնումը երբեք խնդիր չեն դառնում։',
        },
        ru: {
          title: 'Бутик-отель в Ереване',
          summary:
            'Современный бутик-отель в нескольких минутах от площади Республики, со стандартными номерами и делюкс-люксами.',
          description:
            'Бутик-отель в Ереване расположен на тихой улице всего в нескольких минутах от площади Республики, сочетая армянскую архитектуру середины века с тёплым современным интерьером. Выберите стандартный номер для комфортной деловой поездки или люкс делюкс с дополнительным пространством для пар. Каждое утро начинается с обильного завтрака в кафе на первом этаже, а небольшой тренажёрный зал и гостиная зона помогают расслабиться после дня прогулок по городу. Стойка регистрации работает круглосуточно, поэтому поздний заезд и ранний выезд никогда не станут проблемой.',
        },
      },
      attributeValues: [{ code: 'star_rating', optionCodes: ['4'] }],
      amenityIds: [1, 4, 5, 2, 19, 11],
      policyValues: [
        { code: 'pets_allowed', value: 'false' },
        { code: 'smoking_allowed', value: 'false' },
        { code: 'children_allowed', value: 'true' },
        { code: 'cancellation_policy', value: 'MODERATE' },
        { code: 'check_in_time', value: '14:00' },
        { code: 'check_out_time', value: '12:00' },
      ],
      highlights: [
        { iconCode: 'location', text: "2 minutes' walk from Republic Square" },
        {
          iconCode: 'breakfast',
          text: 'Full breakfast included every morning',
        },
        { iconCode: 'wifi', text: 'Free high-speed WiFi throughout' },
        { iconCode: 'clock', text: '24-hour front desk' },
        { iconCode: 'award', text: '4-star boutique design' },
      ],
      included: [
        { itemText: 'Daily breakfast', isIncluded: true },
        { itemText: 'Free WiFi', isIncluded: true },
        { itemText: '24-hour front desk', isIncluded: true },
        { itemText: 'Airport transfer', isIncluded: false },
        { itemText: 'Minibar items', isIncluded: false },
        { itemText: 'Spa treatments', isIncluded: false },
      ],
      faqs: [
        {
          question: 'What time is check-in and check-out?',
          answer:
            'Check-in is from 14:00 and check-out is by 12:00. Early check-in or late check-out can sometimes be arranged with advance notice — just ask the front desk.',
        },
        {
          question: 'Is breakfast included in the room rate?',
          answer:
            'Yes, a full breakfast is included for every stay and served each morning in the ground-floor café.',
        },
        {
          question: 'Do you allow pets?',
          answer: "We're not able to accommodate pets at this property.",
        },
        {
          question: 'Is parking available on-site?',
          answer:
            'Yes, on-site parking is available for guests free of charge, subject to availability.',
        },
        {
          question: 'What is the cancellation policy?',
          answer:
            'This rate follows our moderate cancellation policy — free cancellation up to a set number of days before arrival, details are confirmed at booking.',
        },
      ],
    },
    {
      listingId: listingIds.apartmentListingId,
      category: 'apartments',
      images: [
        'apartments-2.svg',
        'apartments-3.svg',
        'apartments-4.svg',
        'apartments-5.svg',
      ],
      translations: {
        en: {
          title: 'Yerevan City Loft',
          summary:
            'A bright self-check-in loft near the Cascade, perfect for couples or solo travelers who want a home base in the city center.',
          description:
            "This self-contained loft sits on a quiet residential street just a short walk from the Cascade and Yerevan's gallery district. The open-plan living area has a fully equipped kitchen, a comfortable queen bed, and large windows that fill the space with natural light. Self-check-in means you can arrive whenever your flight lands, and the building's washing machine makes it easy to settle in for a longer stay. It's a five-minute walk to cafés, bakeries, and the nearest metro stop, with Republic Square about fifteen minutes on foot.",
        },
        hy: {
          title: 'Երևան Սիթի Լոֆթ',
          summary:
            'Լուսավոր, ինքնուրույն մուտքով լոֆթ Կասկադի մոտակայքում՝ գերազանց տարբերակ զույգերի և միայնակ ճանապարհորդների համար։',
          description:
            'Այս ինքնուրույն լոֆթը գտնվում է հանգիստ բնակելի փողոցում՝ Կասկադից և Երևանի գալերեաների թաղամասից ընդամենը մի քանի րոպե հեռավորության վրա։ Բաց հատակագծով հյուրասենյակն ունի լիարժեք սարքավորված խոհանոց, հարմարավետ մահճակալ և մեծ պատուհաններ, որոնք լցնում են տարածքը բնական լույսով։ Ինքնուրույն մուտքի շնորհիվ կարող եք ժամանել ցանկացած ժամի, իսկ շենքի լվացքի մեքենան հեշտացնում է ավելի երկար կեցությունը։ Հինգ րոպե է քայլելով սրճարաններից, հացաբուլկեղենի խանութներից և մոտակա մետրոյի կայարանից, իսկ Հանրապետության հրապարակը՝ մոտավորապես տասնհինգ րոպե։',
        },
        ru: {
          title: 'Ереван Сити Лофт',
          summary:
            'Светлый лофт с самостоятельным заездом рядом с Каскадом — отличный вариант для пар и путешественников в одиночку.',
          description:
            'Этот отдельный лофт расположен на тихой жилой улице всего в нескольких минутах ходьбы от Каскада и галерейного квартала Еревана. В гостиной открытой планировки есть полностью оборудованная кухня, удобная кровать и большие окна, наполняющие пространство естественным светом. Самостоятельный заезд позволяет приехать в любое удобное время, а стиральная машина в здании облегчает более длительное проживание. Пять минут пешком до кафе, пекарен и ближайшей станции метро, а до площади Республики — около пятнадцати минут пешком.',
        },
      },
      attributeValues: [
        { code: 'bedrooms', value: 1 },
        { code: 'bathrooms', value: 1 },
        { code: 'beds', value: 1 },
        { code: 'max_guests', value: 2 },
      ],
      amenityIds: [1, 4, 17, 18, 23],
      policyValues: [
        { code: 'pets_allowed', value: 'false' },
        { code: 'smoking_allowed', value: 'false' },
        { code: 'children_allowed', value: 'true' },
        { code: 'cancellation_policy', value: 'MODERATE' },
        { code: 'check_in_time', value: 'Flexible (self check-in)' },
        { code: 'check_out_time', value: '11:00' },
      ],
      highlights: [
        { iconCode: 'location', text: '5-minute walk to the Cascade' },
        { iconCode: 'wifi', text: 'Free WiFi and a dedicated workspace' },
        { iconCode: 'food', text: 'Fully equipped kitchen' },
        { iconCode: 'clock', text: 'Flexible self check-in, any time of day' },
        { iconCode: 'heart', text: 'Quiet residential street' },
      ],
      included: [
        { itemText: 'Fully equipped kitchen', isIncluded: true },
        { itemText: 'Free WiFi', isIncluded: true },
        { itemText: 'Washing machine access', isIncluded: true },
        { itemText: 'Daily housekeeping', isIncluded: false },
        { itemText: 'Airport transfer', isIncluded: false },
      ],
      faqs: [
        {
          question: 'How does check-in work?',
          answer:
            'This apartment uses self check-in, so you can arrive at any time — full instructions are sent before your stay.',
        },
        {
          question: 'Is there a kitchen?',
          answer:
            'Yes, the loft has a fully equipped kitchen including a stove, fridge, and basic cookware.',
        },
        {
          question: 'Is it suitable for families with children?',
          answer:
            'Yes, children are welcome. The loft has one bedroom, so it works best for a small family or a couple.',
        },
        {
          question: 'Is there laundry access?',
          answer:
            'Yes, a washing machine is available in the building for guest use.',
        },
        {
          question: 'How far is it from the city center?',
          answer:
            'Republic Square is about a 15-minute walk, and the Cascade is just 5 minutes away on foot.',
        },
      ],
    },
    {
      listingId: listingIds.tourListingId,
      category: 'tours',
      images: ['tours-2.svg', 'tours-3.svg', 'tours-4.svg', 'tours-5.svg'],
      translations: {
        en: {
          title: 'Dilijan Trail Tour',
          summary:
            "A guided day hike through Dilijan's forest trails, with morning and afternoon departures to fit your schedule.",
          description:
            "Explore the dense forests and mountain viewpoints around Dilijan on this guided day hike, led by a local trail guide who knows the region's best routes. The trail winds through beech and oak woodland, past a quiet monastery, and up to a ridge with sweeping views over the Dilijan valley. Choose the morning departure for cooler temperatures and better light, or the afternoon group if you'd rather start the day slowly. Suitable for moderately fit walkers — comfortable shoes and a bottle of water are all you need to bring.",
        },
        hy: {
          title: 'Դիլիջանի Արահետների Շրջայց',
          summary:
            'Ուղեկցվող միօրյա արշավ Դիլիջանի անտառային արահետներով՝ առավոտյան և կեսօրից հետո մեկնումներով։',
          description:
            'Բացահայտեք Դիլիջանի շուրջ ընկած խիտ անտառներն ու լեռնային տեսարանները այս ուղեկցվող միօրյա արշավի ընթացքում՝ տեղացի արահետային ուղեկցորդի հետ, ով լավ գիտի տարածաշրջանի լավագույն երթուղիները։ Արահետը գնում է հաճարենու և կաղնու անտառներով, հանգիստ վանքի կողքով և բարձրանում է լեռնաշղթա՝ Դիլիջանի հովտի հիասքանչ տեսարաններով։ Ընտրեք առավոտյան մեկնումը ավելի զով ջերմաստիճանի և լավ լուսավորության համար, կամ կեսօրից հետո խումբը, եթե նախընտրում եք օրը սկսել դանդաղ։',
        },
        ru: {
          title: 'Тур по тропам Дилижана',
          summary:
            'Пеший поход с гидом по лесным тропам Дилижана — утренние и дневные отправления на выбор.',
          description:
            'Исследуйте густые леса и горные смотровые площадки вокруг Дилижана в этом однодневном походе с местным гидом, который знает лучшие маршруты региона. Тропа проходит через буковый и дубовый лес, мимо тихого монастыря и поднимается на хребет с широкими видами на долину Дилижана. Выберите утреннее отправление для более прохладной погоды и хорошего освещения или дневную группу, если предпочитаете начать день неспешно.',
        },
      },
      attributeValues: [
        { code: 'duration_minutes', value: 240 },
        { code: 'difficulty', optionCodes: ['MODERATE'] },
        { code: 'max_group_size', value: 12 },
      ],
      amenityIds: [23],
      policyValues: [
        { code: 'cancellation_policy', value: 'FLEXIBLE' },
        { code: 'children_allowed', value: 'true' },
      ],
      highlights: [
        {
          iconCode: 'mountain',
          text: "Guided hike through Dilijan's forest trails",
        },
        {
          iconCode: 'clock',
          text: '2 daily departures — morning and afternoon',
        },
        { iconCode: 'group', text: 'Small groups, up to 12 hikers' },
        { iconCode: 'view', text: 'Ridge viewpoint over the Dilijan valley' },
      ],
      itinerary: [
        {
          title: 'Meet at the trailhead',
          description:
            'Meet your guide at the Dilijan trailhead car park for a short safety briefing and gear check.',
          durationMinutes: 15,
        },
        {
          title: 'Forest ascent',
          description:
            'Begin the climb through beech and oak woodland, with regular stops to point out local flora and wildlife.',
          durationMinutes: 90,
        },
        {
          title: 'Monastery stop',
          description:
            'Pass a quiet hillside monastery and take a short break to rest and rehydrate.',
          durationMinutes: 20,
        },
        {
          title: 'Ridge viewpoint',
          description:
            'Reach the ridge for panoramic views over the Dilijan valley — the best photo stop of the hike.',
          durationMinutes: 30,
        },
        {
          title: 'Descent and return',
          description:
            'Follow a gentler path back down to the trailhead, arriving in time for lunch in town.',
          durationMinutes: 85,
        },
      ],
      included: [
        { itemText: 'Local guide', isIncluded: true },
        { itemText: 'Safety briefing', isIncluded: true },
        { itemText: 'Bottled water', isIncluded: true },
        { itemText: 'Transportation to the trailhead', isIncluded: false },
        { itemText: 'Lunch', isIncluded: false },
        { itemText: 'Gratuities', isIncluded: false },
      ],
      faqs: [
        {
          question: 'How difficult is the hike?',
          answer:
            'This is a moderate-difficulty trail — around 4 hours with some uphill sections. Basic fitness is enough; no technical climbing is involved.',
        },
        {
          question: 'What should I bring?',
          answer:
            'Comfortable walking shoes, a bottle of water, and weather-appropriate clothing. Snacks are recommended for the ridge stop.',
        },
        {
          question: 'Is transportation to the trailhead included?',
          answer:
            'No, the tour starts at the trailhead car park. Your guide can suggest local taxi options.',
        },
        {
          question: 'Can children join?',
          answer:
            'Yes, children are welcome — the trail is unpaved with some elevation gain, so it suits kids comfortable walking for a few hours.',
        },
        {
          question: 'What happens if it rains?',
          answer:
            "The hike runs in light rain. In case of severe weather, we'll contact you to reschedule or offer a full refund.",
        },
      ],
    },
    {
      listingId: listingIds.activityListingId,
      category: 'attractions',
      images: ['attractions-2.svg', 'attractions-3.svg', 'attractions-4.svg'],
      translations: {
        en: {
          title: 'Yerevan Cooking Workshop',
          summary:
            'A hands-on Armenian cooking class in a small group, with morning and evening sessions to choose from.',
          description:
            "Learn to make traditional Armenian dishes from scratch in this hands-on cooking workshop, led by a local home cook in a warm, welcoming kitchen. You'll prepare a full menu together — usually including dolma, lavash, and a seasonal dessert — before sitting down to enjoy what you've made. The class is kept small so everyone gets real hands-on time at the counter, and both the morning and evening sessions cover the same menu, so pick whichever fits your day better.",
        },
        hy: {
          title: 'Երևանյան Խոհարարական Վարպետության Դաս',
          summary:
            'Գործնական հայկական խոհարարության դասընթաց փոքր խմբում՝ առավոտյան և երեկոյան նստաշրջաններով։',
          description:
            'Սովորեք պատրաստել ավանդական հայկական ուտեստներ զրոյից այս գործնական խոհարարական վարպետության դասին՝ տեղացի տնային խոհարարի ղեկավարությամբ, տաք և հյուրընկալ խոհանոցում։ Դուք միասին կպատրաստեք ամբողջական մենյու, որը սովորաբար ներառում է տոլմա, լավաշ և սեզոնային աղանդեր, այնուհետև կնստեք վայելելու ձեր պատրաստածը։ Դասընթացը մնում է փոքր, որպեսզի բոլորը ստանան իրական գործնական փորձ։',
        },
        ru: {
          title: 'Кулинарный мастер-класс в Ереване',
          summary:
            'Практический мастер-класс по армянской кухне в маленькой группе — утренние и вечерние сеансы на выбор.',
          description:
            'Научитесь готовить традиционные армянские блюда с нуля на этом практическом кулинарном мастер-классе под руководством местного домашнего повара в тёплой, гостеприимной кухне. Вместе вы приготовите полное меню — обычно включающее долму, лаваш и сезонный десерт — а затем сядете насладиться тем, что приготовили. Группа остаётся небольшой, чтобы у каждого было реальное практическое время у стола.',
        },
      },
      attributeValues: [
        { code: 'duration_minutes', value: 180 },
        { code: 'languages_offered', optionCodes: ['EN', 'HY', 'RU'] },
        { code: 'max_group_size', value: 8 },
      ],
      amenityIds: [23],
      policyValues: [{ code: 'children_allowed', value: 'true' }],
      highlights: [
        { iconCode: 'food', text: 'Hands-on, small-group cooking class' },
        { iconCode: 'clock', text: 'Morning and evening sessions available' },
        { iconCode: 'heart', text: 'Traditional Armenian recipes' },
        { iconCode: 'group', text: 'Shared meal at the end of class' },
      ],
      included: [
        { itemText: 'All ingredients', isIncluded: true },
        { itemText: 'Apron and recipe cards', isIncluded: true },
        { itemText: 'Meal at the end of class', isIncluded: true },
        { itemText: 'Alcoholic drinks', isIncluded: false },
        { itemText: 'Gratuities', isIncluded: false },
      ],
      faqs: [
        {
          question: 'Do I need any cooking experience?',
          answer:
            'No prior experience is needed — the class is designed for complete beginners as well as confident home cooks.',
        },
        {
          question: 'What dishes will we make?',
          answer:
            'The menu usually includes dolma, fresh lavash, and a seasonal dessert, though ingredients may vary slightly by season.',
        },
        {
          question: 'Is the class suitable for vegetarians?',
          answer:
            "Please let us know about dietary restrictions in advance and we'll do our best to adapt the menu.",
        },
        {
          question: 'How long does the class last?',
          answer:
            'The workshop runs for approximately 3 hours, including the shared meal at the end.',
        },
      ],
    },
    {
      listingId: listingIds.guideListingId,
      category: 'attractions',
      images: ['attractions-5.svg', 'attractions-6.svg', 'attractions-7.svg'],
      translations: {
        en: {
          title: 'Certified Yerevan City Guide',
          summary:
            'A licensed, multilingual private guide for a full day exploring Yerevan and nearby historic sites.',
          description:
            "Spend a full day with a licensed city guide who speaks English, Russian, and Armenian, and knows Yerevan's history inside out. A typical day covers the city's main landmarks — Republic Square, the Cascade, the Vernissage market, and Matenadaran — with the itinerary shaped around your interests, whether that's architecture, history, food, or a mix of everything. The guide is booked for the whole day rather than by the hour, so there's no need to rush between stops.",
        },
        hy: {
          title: 'Հավաստագրված Երևանյան Ուղեկցորդ',
          summary:
            'Հավաստագրված, բազմալեզու անհատական ուղեկցորդ ամբողջ օրվա ընթացքում Երևանում և մոտակա պատմական վայրերում։',
          description:
            'Անցկացրեք ամբողջ օրը հավաստագրված քաղաքային ուղեկցորդի հետ, ով խոսում է անգլերեն, ռուսերեն և հայերեն և գերազանց գիտի Երևանի պատմությունը։ Բնորոշ օրը ներառում է քաղաքի հիմնական տեսարժան վայրերը՝ Հանրապետության հրապարակը, Կասկադը, Վերնիսաժը և Մատենադարանը, իսկ երթուղին ձևավորվում է ըստ ձեր հետաքրքրությունների։',
        },
        ru: {
          title: 'Сертифицированный гид по Еревану',
          summary:
            'Сертифицированный многоязычный частный гид на целый день по Еревану и близлежащим историческим местам.',
          description:
            'Проведите целый день с сертифицированным городским гидом, который говорит на английском, русском и армянском языках и прекрасно знает историю Еревана. Типичный день охватывает главные достопримечательности города — площадь Республики, Каскад, рынок Вернисаж и Матенадаран, а маршрут выстраивается с учётом ваших интересов.',
        },
      },
      attributeValues: [
        { code: 'duration_minutes', value: 480 },
        { code: 'languages_offered', optionCodes: ['EN', 'HY', 'RU'] },
        { code: 'max_group_size', value: 6 },
      ],
      amenityIds: [2, 21],
      policyValues: [{ code: 'children_allowed', value: 'true' }],
      highlights: [
        {
          iconCode: 'verified',
          text: 'Licensed, English/Russian/Armenian-speaking guide',
        },
        {
          iconCode: 'clock',
          text: 'Full-day availability, not billed by the hour',
        },
        {
          iconCode: 'location',
          text: 'Covers Republic Square, the Cascade, Vernissage & more',
        },
        { iconCode: 'users', text: 'Tailored to your interests' },
      ],
      itinerary: [
        {
          title: 'Morning pickup and Republic Square',
          description:
            'Meet your guide and begin with the architecture and history of Republic Square.',
          durationMinutes: 60,
        },
        {
          title: 'The Cascade and modern art',
          description:
            'Walk up the Cascade complex, taking in views over the city and its outdoor sculpture garden.',
          durationMinutes: 90,
        },
        {
          title: 'Vernissage market',
          description:
            "Browse handmade crafts, carpets, and antiques at Yerevan's open-air market.",
          durationMinutes: 60,
        },
        {
          title: 'Lunch break',
          description:
            'A break to enjoy Armenian cuisine at a guide-recommended local restaurant (meal not included).',
          durationMinutes: 60,
        },
        {
          title: 'Matenadaran and old manuscripts',
          description:
            "Visit the Matenadaran to see one of the world's richest collections of ancient manuscripts.",
          durationMinutes: 75,
        },
        {
          title: 'Free time and drop-off',
          description:
            'Wrap up with time for any last requests before being dropped off at your accommodation.',
          durationMinutes: 45,
        },
      ],
      included: [
        { itemText: 'Licensed guide for the full day', isIncluded: true },
        { itemText: 'Entry planning for key sites', isIncluded: true },
        { itemText: 'Local recommendations', isIncluded: true },
        { itemText: 'Site entry tickets', isIncluded: false },
        { itemText: 'Lunch', isIncluded: false },
        { itemText: 'Transportation between sites', isIncluded: false },
      ],
      faqs: [
        {
          question: 'What languages does the guide speak?',
          answer: 'English, Russian, and Armenian.',
        },
        {
          question: 'Can the itinerary be customized?',
          answer:
            "Yes — the day is shaped around your interests, whether that's architecture, history, food, or a general overview of the city.",
        },
        {
          question: 'Are entry tickets to sites included?',
          answer:
            'No, entry tickets to museums and attractions are not included and are paid separately.',
        },
        {
          question: 'Is this a group tour?',
          answer:
            'No, this is a private, one-on-one guide booking for your party only.',
        },
      ],
    },
    {
      listingId: listingIds.carRentalListingId,
      category: 'car-rentals',
      images: [
        'car-rentals-2.svg',
        'car-rentals-3.svg',
        'car-rentals-4.svg',
        'car-rentals-5.svg',
      ],
      translations: {
        en: {
          title: 'Ararat Valley Fleet',
          summary:
            "A small, well-maintained SUV rental fleet for self-drive trips across Armenia's highways and mountain roads.",
          description:
            "Ararat Valley Fleet offers a small selection of well-maintained SUVs, each suited to Armenia's mix of highways and unpaved mountain roads. Every vehicle comes with a full tank, comprehensive insurance, and a spare tire, so you can head out to Dilijan, Lake Sevan, or further afield with confidence. Pick-up and drop-off are arranged directly with the fleet manager, and each vehicle is tracked individually, so availability reflects exactly which cars are free on your travel dates.",
        },
        hy: {
          title: 'Արարատյան Հովտի Ավտոպարկ',
          summary:
            'Փոքր, լավ պահպանված ամենագնացների վարձակալման պարկ Հայաստանի մայրուղիներով և լեռնային ճանապարհներով ինքնուրույն ճամփորդությունների համար։',
          description:
            'Արարատյան Հովտի Ավտոպարկը առաջարկում է լավ պահպանված ամենագնացների փոքր ընտրություն, որոնցից յուրաքանչյուրը հարմարեցված է Հայաստանի մայրուղիների և չասֆալտապատված լեռնային ճանապարհների համադրությանը։ Յուրաքանչյուր մեքենա գալիս է լիքը բաքով, համապարփակ ապահովագրությամբ և պահեստային անվադողով, որպեսզի կարողանաք վստահորեն մեկնել Դիլիջան, Սևանա լիճ կամ ավելի հեռու։',
        },
        ru: {
          title: 'Автопарк Араратской долины',
          summary:
            'Небольшой парк ухоженных внедорожников для самостоятельных поездок по шоссе и горным дорогам Армении.',
          description:
            'Автопарк Араратской долины предлагает небольшой выбор ухоженных внедорожников, каждый из которых подходит для сочетания шоссе и грунтовых горных дорог Армении. Каждый автомобиль поставляется с полным баком, полной страховкой и запасным колесом, чтобы вы могли уверенно отправиться в Дилижан, на озеро Севан или ещё дальше.',
        },
      },
      attributeValues: [
        { code: 'transmission', optionCodes: ['AUTOMATIC'] },
        { code: 'seats', value: 5 },
      ],
      amenityIds: [4],
      policyValues: [
        { code: 'smoking_allowed', value: 'false' },
        { code: 'cancellation_policy', value: 'FLEXIBLE' },
      ],
      highlights: [
        {
          iconCode: 'car',
          text: 'Well-maintained SUVs for highway and mountain roads',
        },
        { iconCode: 'shield', text: 'Comprehensive insurance included' },
        { iconCode: 'fast', text: 'Full tank at pick-up' },
        {
          iconCode: 'location',
          text: 'Flexible pick-up and drop-off in Yerevan',
        },
      ],
      included: [
        { itemText: 'Comprehensive insurance', isIncluded: true },
        { itemText: 'Full tank at pick-up', isIncluded: true },
        { itemText: 'Spare tire and roadside kit', isIncluded: true },
        { itemText: 'Fuel refill on return', isIncluded: false },
        { itemText: 'Additional driver fee', isIncluded: false },
        { itemText: 'Child car seat', isIncluded: false },
      ],
      faqs: [
        {
          question: 'What is included with the rental?',
          answer:
            'Every rental includes comprehensive insurance, a full tank of fuel, and a spare tire.',
        },
        {
          question: 'Do I need an international driving permit?',
          answer:
            'Most foreign licenses are accepted, but we recommend bringing an International Driving Permit alongside your national license.',
        },
        {
          question: 'Can I drive outside Yerevan?',
          answer:
            'Yes, these SUVs are well suited to travel across Armenia, including unpaved mountain roads to places like Dilijan and Lake Sevan.',
        },
        {
          question: 'What is the cancellation policy?',
          answer:
            'This fleet follows a flexible cancellation policy — free cancellation up to a set number of hours before pick-up.',
        },
      ],
    },
  ];

  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const flagship of FLAGSHIPS) {
    const { listingId } = flagship;
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const [[owner]] = await connection.query(
      'SELECT created_by AS ownerUserId FROM listings WHERE id = ?',
      [listingId],
    );

    // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
    for (const [code, t] of Object.entries(flagship.translations)) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await upsertTranslation(connection, listingId, languageIds.get(code), t);
    }

    // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
    for (const entry of flagship.attributeValues) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await insertAttributeValue(connection, listingId, entry);
    }

    if (flagship.amenityIds.length > 0) {
      const values = flagship.amenityIds.map((amenityId) => [
        listingId,
        amenityId,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_amenity_listing (listing_id, amenity_id) VALUES ?',
        [values],
      );
    }

    // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
    for (const entry of flagship.policyValues) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await insertPolicyValue(connection, listingId, entry);
    }

    if (flagship.highlights.length > 0) {
      const values = flagship.highlights.map((h, index) => [
        listingId,
        h.iconCode,
        h.text,
        index,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_highlights (listing_id, icon_code, text, sort_order) VALUES ?',
        [values],
      );
    }

    if (flagship.itinerary?.length > 0) {
      const values = flagship.itinerary.map((step, index) => [
        listingId,
        index,
        step.title,
        step.description ?? null,
        step.durationMinutes ?? null,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_itinerary_steps (listing_id, sort_order, title, description, duration_minutes) VALUES ?',
        [values],
      );
    }

    if (flagship.included.length > 0) {
      const values = flagship.included.map((item, index) => [
        listingId,
        item.itemText,
        item.isIncluded ? 1 : 0,
        index,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_included_items (listing_id, item_text, is_included, sort_order) VALUES ?',
        [values],
      );
    }

    if (flagship.faqs.length > 0) {
      const values = flagship.faqs.map((faq, index) => [
        listingId,
        faq.question,
        faq.answer,
        index,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT INTO listing_faqs (listing_id, question, answer, sort_order) VALUES ?',
        [values],
      );
    }

    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await insertMedia(
      connection,
      listingId,
      imageTypeId,
      completedUploadStatusId,
      approvedStatusId,
      owner.ownerUserId,
      2,
      flagship.category,
      flagship.images,
    );
  }

  return { enrichedListingIds: FLAGSHIPS.map((f) => f.listingId) };
}
