ALTER TABLE partners ADD COLUMN description TEXT NULL AFTER slug;

UPDATE partners p
JOIN partner_translations pt ON pt.partner_id = p.id
JOIN languages l ON l.id = pt.language_id AND l.code = 'en'
SET p.description = pt.description;

DROP TABLE IF EXISTS partner_translations;
