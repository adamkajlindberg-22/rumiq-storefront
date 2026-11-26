# Prompt template proven in the Higgsfield test (nano_banana_2_1 = Google "Nano Banana" family, 2k, thinking high, 2 credits/image)
Inputs: image 1 = the room photo; images 2..n = product cut-outs (transparent/white bg). Output keeps the photo's aspect ratio.

Edit the FIRST image (a photo of a <room type>). Keep the room exactly as it is: same camera angle, framing, walls,
window, floor, furniture, decor and the same light. Only add/replace these products, copied faithfully from the
reference images (same shape, colour, material, texture and proportions), each placed where the customer pointed and
at its true real-world size:
<for each pin i>: <i>) Image <i+1>, <product name in plain English>, <W x H (x D) cm>: <surface verb + place>,
   e.g. "standing on the oak side table to the left of the white mug" / "lying flat on the floor in front of the sofa,
   long side parallel to the sofa" / "hanging on the wall at about 150 cm height" / "draped over the left arm of the sofa".
   The place text is built from the pin: surface + nearest named object in the room map + side, or for an own photo
   from the pin's x/y described as "about 30 % from the left, at floor level near the bottom of the picture".
Scale everything correctly relative to <known reference sizes: sofa ~200 cm wide, side table ~55 cm high, bed 160 cm;
or the customer's known length>. Realistic contact shadows and light that matches the room. Photorealistic interior
photograph, no text, no labels, no people, nothing else changed.

Results (26 nov): living room (rug 160x230, globe lamp on side table, 50x70 poster, throw on sofa) – excellent, true
scale, room unchanged. Bedroom (duvet set, ceramic lamp replacing the old lamp, linen curtains) – excellent placement
and scale; the duvet came out more yellow/saturated than the product's sand tone → the quality check must compare
each product's colour in the result with the reference (mean Lab in the product area, ΔE threshold) and retry once
with "keep the exact colour of image N (sand beige, not yellow)".
