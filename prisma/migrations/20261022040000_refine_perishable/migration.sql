-- The first pass marked juices, jams and packaged goods. Perecederos are produce and meat.
UPDATE "Ingredient"
SET "perishable" = false;

UPDATE "Ingredient"
SET "perishable" = true
WHERE kind IN ('RAW', 'FROZEN')
AND NOT (
  translate(lower(name || ' ' || coalesce(category, '')), 'áéíóúüñ', 'aeiouun')
  ~ '(jugo|boing|jumex|mermelada|sobre|refresco|joya|aceite|catsup|ketchup|mayonesa|aderezo|lechera|condensad|crema de coco|enlat|almibar|sierra|coca|pepsi|agua )'
)
AND (
  translate(lower(name || ' ' || coalesce(category, '')), 'áéíóúüñ', 'aeiouun')
  ~ '(verdura|lechuga|jitomate|tomate|cebolla|cilantro|chile|pimiento|zanahoria|pepino|aguacate|apio|espinaca|brocoli|elote|ajo|limon|naranja|fruta|manzana|pina|fresa|platano|mango|melon|sandia|carne|pollo|puerco|cerdo|pescado|camaron|marisco|jamon|tocino|chorizo|arrachera|pechuga|milanesa|atun|salmon|huevo|lomo|bistec|costilla|queso)'
);
