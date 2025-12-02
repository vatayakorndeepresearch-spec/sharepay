-- Auto-categorize expenses based on description keywords

UPDATE public.expenses
SET category = CASE
    -- หมวดอาหาร
    WHEN description ILIKE '%ข้าว%' OR description ILIKE '%อาหาร%' OR description ILIKE '%กิน%' 
      OR description ILIKE '%mk%' OR description ILIKE '%kfc%' OR description ILIKE '%pizza%' 
      OR description ILIKE '%buffet%' OR description ILIKE '%shabu%' OR description ILIKE '%coffee%'
      OR description ILIKE '%cafe%' OR description ILIKE '%starbucks%' OR description ILIKE '%amazon%'
      THEN 'อาหาร'

    -- หมวดเดินทาง / น้ำมัน / ชาร์จรถ
    WHEN description ILIKE '%น้ำมัน%' OR description ILIKE '%pt%' OR description ILIKE '%shell%' OR description ILIKE '%esso%'
      THEN 'ค่าน้ำมัน'
    WHEN description ILIKE '%ชาร์จ%' OR description ILIKE '%ev%' OR description ILIKE '%pea%'
      THEN 'ค่าชาร์รถ'
    WHEN description ILIKE '%bts%' OR description ILIKE '%mrt%' OR description ILIKE '%grab%' 
      OR description ILIKE '%taxi%' OR description ILIKE '%ทางด่วน%' OR description ILIKE '%ค่ารถ%'
      THEN 'เดินทาง'

    -- หมวดของใช้
    WHEN description ILIKE '%7-11%' OR description ILIKE '%seven%' OR description ILIKE '%big c%' 
      OR description ILIKE '%lotus%' OR description ILIKE '%top%' OR description ILIKE '%market%' 
      OR description ILIKE '%ของใช้%' OR description ILIKE '%ทิชชู่%' OR description ILIKE '%น้ำยา%'
      THEN 'ของใช้'

    -- หมวดสุขภาพ
    WHEN description ILIKE '%ยา%' OR description ILIKE '%หมอ%' OR description ILIKE '%พยาบาล%' 
      OR description ILIKE '%โรงพยาบาล%' OR description ILIKE '%dental%' OR description ILIKE '%clinic%'
      THEN 'สุขภาพ'

    -- หมวดบันเทิง
    WHEN description ILIKE '%หนัง%' OR description ILIKE '%movie%' OR description ILIKE '%game%' 
      OR description ILIKE '%netflix%' OR description ILIKE '%spotify%' OR description ILIKE '%youtube%'
      THEN 'บันเทิง'

    -- หมวดช้อปปิ้ง
    WHEN description ILIKE '%shopee%' OR description ILIKE '%lazada%' OR description ILIKE '%เสื้อ%' 
      OR description ILIKE '%กางเกง%' OR description ILIKE '%รองเท้า%' OR description ILIKE '%กระเป๋า%'
      THEN 'ช้อปปิ้ง'

    -- หมวดค่าอินเตอร์เน็ต
    WHEN description ILIKE '%เน็ต%' OR description ILIKE '%internet%' OR description ILIKE '%wifi%' 
      OR description ILIKE '%ais%' OR description ILIKE '%true%' OR description ILIKE '%dtac%'
      THEN 'ค่าอินเตอร์เน็ต'

    -- หมวดค่าเช่าบ้าน / ที่พัก
    WHEN description ILIKE '%ค่าเช่า%' OR description ILIKE '%ค่าห้อง%' OR description ILIKE '%ค่าไฟ%' OR description ILIKE '%ค่าน้ำ%'
      THEN 'ค่าเช่าบ้าน'
    WHEN description ILIKE '%โรงแรม%' OR description ILIKE '%hotel%' OR description ILIKE '%resort%' OR description ILIKE '%agoda%'
      THEN 'ที่พัก'

    -- Default: Keep existing or set to Others if null
    ELSE COALESCE(category, 'Others')
END
WHERE category IS NULL OR category = 'Others' OR category = '';
