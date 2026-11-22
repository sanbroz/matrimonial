-- Preference lists used to be split at "/", turning "Bania / Aggarwal" into "Bania" + "Aggarwal".
-- Put the two default options with a slash back together.
UPDATE "PartnerPreference" SET castes = array_append(array_remove(array_remove(castes, 'Bania'), 'Aggarwal'), 'Bania / Aggarwal') WHERE castes @> ARRAY['Bania', 'Aggarwal'];
UPDATE "PartnerPreference" SET "excludeCastes" = array_append(array_remove(array_remove("excludeCastes", 'Bania'), 'Aggarwal'), 'Bania / Aggarwal') WHERE "excludeCastes" @> ARRAY['Bania', 'Aggarwal'];
UPDATE "PartnerPreference" SET castes = array_append(array_remove(array_remove(castes, 'Kumhar'), 'Prajapati'), 'Kumhar / Prajapati') WHERE castes @> ARRAY['Kumhar', 'Prajapati'];
UPDATE "PartnerPreference" SET "excludeCastes" = array_append(array_remove(array_remove("excludeCastes", 'Kumhar'), 'Prajapati'), 'Kumhar / Prajapati') WHERE "excludeCastes" @> ARRAY['Kumhar', 'Prajapati'];
