-- Update categories based on specific user feedback

UPDATE public.expenses
SET category = CASE
    -- หมวดค่าอินเตอร์เน็ต (รวม VPS, Trading Tools)
    WHEN description ILIKE '%vps%' THEN 'ค่าอินเตอร์เน็ต'
    WHEN description ILIKE '%TradingView%' THEN 'ค่าอินเตอร์เน็ต'
    WHEN description ILIKE '%อินเคเตอร์%' THEN 'ค่าอินเตอร์เน็ต' -- Indicator
    WHEN description ILIKE '%เครื่องมือ%' THEN 'ค่าอินเตอร์เน็ต' -- Tools

    -- หมวดเดินทาง
    WHEN description ILIKE '%bts%' THEN 'เดินทาง'
    WHEN description ILIKE '%ค่ารถ%' THEN 'เดินทาง' -- ครอบคลุม ค่ารถ..., ค่ารถเดินทาง...
    WHEN description ILIKE '%ค่าเดินทาง%' THEN 'เดินทาง'
    WHEN description ILIKE '%แท็กซี่%' THEN 'เดินทาง'
    WHEN description ILIKE '%Bolt%' THEN 'เดินทาง'

    -- หมวดค่าเช่าบ้าน (รวม ค่าน้ำ, ค่าไฟ)
    WHEN description = 'ค่าน้ำ' THEN 'ค่าเช่าบ้าน' -- ระวังชนกับ ค่าน้ำมัน
    WHEN description ILIKE '%ค่าไฟ%' THEN 'ค่าเช่าบ้าน'
    WHEN description ILIKE '%ค่าบ้านเช่า%' THEN 'ค่าเช่าบ้าน'

    -- หมวดอาหาร
    WHEN description ILIKE '%ค่ากาแฟ%' THEN 'อาหาร'
    WHEN description ILIKE '%ค่าอาหาร%' THEN 'อาหาร'

    -- หมวดของใช้
    WHEN description ILIKE '%หลอดไฟ%' THEN 'ของใช้'

    -- หมวดอื่นๆ (LandmarkForum -> บันเทิง/การเรียนรู้ -> ใส่ Others หรือ บันเทิง ไปก่อน)
    -- WHEN description ILIKE '%LandmarkForum%' THEN 'บันเทิง' 

    ELSE category
END
WHERE 
    description ILIKE '%vps%' OR
    description ILIKE '%TradingView%' OR
    description ILIKE '%อินเคเตอร์%' OR
    description ILIKE '%เครื่องมือ%' OR
    description ILIKE '%bts%' OR
    description ILIKE '%ค่ารถ%' OR
    description ILIKE '%ค่าเดินทาง%' OR
    description ILIKE '%แท็กซี่%' OR
    description ILIKE '%Bolt%' OR
    description = 'ค่าน้ำ' OR
    description ILIKE '%ค่าไฟ%' OR
    description ILIKE '%ค่าบ้านเช่า%' OR
    description ILIKE '%ค่ากาแฟ%' OR
    description ILIKE '%ค่าอาหาร%' OR
    description ILIKE '%หลอดไฟ%';
