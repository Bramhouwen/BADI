-- World of Badi: things for the extra spaces (bathroom, garden, attic, own gym)
-- in the shop. Keep the prices equal to ITEMS in src/lib/world/items.ts.
insert into public.world_shop_items (id, price) values
  ('bad', 90), ('douche', 80), ('wastafel', 50), ('wasmand', 20), ('handdoekenrek', 25), ('badmat', 15),
  ('loungebank', 90), ('tuinset', 70), ('barbecue', 60), ('parasol', 40), ('bloembak', 25), ('tuinlantaarn', 20),
  ('arcadekast', 110), ('platenspeler', 45), ('kist', 30), ('zitkussens', 25), ('boekenladder', 35), ('lichtslinger', 30),
  ('loopband', 130), ('squatrack', 120), ('bokszak', 60), ('sportbank', 50), ('kettlebells', 30), ('springtouw', 20)
on conflict (id) do update set price = excluded.price, active = true;
