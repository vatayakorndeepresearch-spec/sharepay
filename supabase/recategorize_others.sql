-- ============================================================
-- STEP 1: ดูก่อนว่ามี "other" ที่ยังไม่ถูก categorize กี่รายการ
-- ============================================================
SELECT id, description, notes, category, amount, paid_at
FROM public.expenses
WHERE
    category IS NULL OR
    category = '' OR
    category ILIKE 'other' OR
    category ILIKE 'others' OR
    category ILIKE 'misc' OR
    category ILIKE 'ไม่ระบุ%' OR
    category ILIKE 'อื่น%'
ORDER BY paid_at DESC;

-- ============================================================
-- STEP 2: รัน UPDATE (ใช้ทั้ง description + notes)
-- ============================================================
UPDATE public.expenses
SET category = CASE

    -- ค่าน้ำมัน
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%น้ำมัน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ptt%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%bangchak%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%บางจาก%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%shell%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%esso%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%caltex%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%fuel%'
        THEN 'ค่าน้ำมัน'

    -- ค่าชาร์จรถ
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ชาร์จรถ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ev charge%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%charging%'
        THEN 'ค่าชาร์จรถ'

    -- เดินทาง
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%grab%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%bolt%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%taxi%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%แท็กซี่%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%mrt%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%bts%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ทางด่วน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่ารถ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าเดินทาง%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%รถไฟ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%parking%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%uber%'
        THEN 'เดินทาง'

    -- ค่าอินเตอร์เน็ต
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%internet%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%wifi%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%fiber%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%เน็ตบ้าน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%broadband%'
        THEN 'ค่าอินเตอร์เน็ต'

    -- ค่าโทรศัพท์
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ais%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%dtac%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%truemove%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%true move%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%โทรศัพท์%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%มือถือ%'
        THEN 'ค่าโทรศัพท์'

    -- ค่าไฟ
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าไฟ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ไฟฟ้า%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%electric%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '% mea%'
        THEN 'ค่าไฟ'

    -- ค่าน้ำ
    WHEN description = 'ค่าน้ำ'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%น้ำประปา%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%water bill%'
        THEN 'ค่าน้ำ'

    -- ค่าเช่าบ้าน
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าเช่า%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าห้อง%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าบ้าน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%rent%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%condo%'
        THEN 'ค่าเช่าบ้าน'

    -- ที่พัก
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%โรงแรม%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%hotel%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%resort%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ที่พัก%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%agoda%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%booking%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%airbnb%'
        THEN 'ที่พัก'

    -- ค่าสมาชิก/Sub
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%netflix%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%spotify%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%youtube premium%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%subscription%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%membership%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ค่าสมาชิก%'
        THEN 'ค่าสมาชิก/Sub'

    -- สุขภาพ
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ยา%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%หมอ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%clinic%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%hospital%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%โรงพยาบาล%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%คลินิก%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%pharmacy%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%dental%'
        THEN 'สุขภาพ'

    -- การศึกษา
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%เรียน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%course%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%tuition%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%workshop%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%หนังสือเรียน%'
        THEN 'การศึกษา'

    -- สัตว์เลี้ยง
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%แมว%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%หมา%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%สัตว์เลี้ยง%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%pet%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%vet%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%อาหารสัตว์%'
        THEN 'สัตว์เลี้ยง'

    -- ประกัน
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%ประกัน%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%insurance%'
        THEN 'ประกัน'

    -- บันเทิง
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%หนัง%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%movie%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%concert%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%เกม%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%game%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%karaoke%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%คาราโอเกะ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%สวนสนุก%'
        THEN 'บันเทิง'

    -- ช้อปปิ้ง
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%shopee%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%lazada%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%เสื้อ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%รองเท้า%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%กางเกง%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%กระเป๋า%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%cosmetic%'
        THEN 'ช้อปปิ้ง'

    -- ของใช้
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%7-11%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%เซเว่น%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%big c%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%lotus%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%supermarket%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ของใช้%'
        THEN 'ของใช้'

    -- อาหาร (ไว้ท้าย เพราะ keyword กว้าง)
    WHEN (description || ' ' || COALESCE(notes, '')) ILIKE '%อาหาร%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ข้าว%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%กาแฟ%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%coffee%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%cafe%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%restaurant%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%grabfood%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%lineman%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ชานม%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%สุกี้%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%ชาบู%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%shabu%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%kfc%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%mcdonald%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%pizza%'
      OR (description || ' ' || COALESCE(notes, '')) ILIKE '%starbucks%'
        THEN 'อาหาร'

    -- ถ้า match ไม่ได้เลย คงไว้เป็น 'other' ไปก่อน
    ELSE category

END
WHERE
    category IS NULL OR
    category = '' OR
    category ILIKE 'other' OR
    category ILIKE 'others' OR
    category ILIKE 'misc' OR
    category ILIKE 'ไม่ระบุ%' OR
    category ILIKE 'อื่น%';

-- ============================================================
-- STEP 3: ดูว่ายังเหลือ "other" ที่ match ไม่ได้อีกไหม
-- (พวกนี้ต้องแก้มือจาก app)
-- ============================================================
SELECT id, description, notes, category, amount, paid_at
FROM public.expenses
WHERE
    category IS NULL OR
    category = '' OR
    category ILIKE 'other' OR
    category ILIKE 'others' OR
    category ILIKE 'misc' OR
    category ILIKE 'ไม่ระบุ%' OR
    category ILIKE 'อื่น%'
ORDER BY paid_at DESC;
