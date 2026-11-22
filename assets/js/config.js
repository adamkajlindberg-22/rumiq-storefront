/* RumIQ site settings. Fill these in before launch; nothing else in the code needs to change.

   AUTH
   provider: "demo"     = accounts live only in this browser (preview).
             "supabase" = real accounts with Supabase Auth. Needs url + anonKey below, and each
                          social provider switched on in the Supabase dashboard
                          (Authentication > Providers) with its own client id and secret:
                          Google (Google Cloud console), Apple (Apple Developer account),
                          Microsoft (Azure "azure"), Facebook (Meta for Developers).
                          If the auth server cannot be reached (for example in the claude.ai preview,
                          which blocks other sites), the site falls back to demo mode by itself.
   social: which buttons to show, in this order. On the live site a button only shows once that
           provider is switched on in Supabase.
   redirect: where the provider sends people back after signing in (your live address).

   DELIVERY (Leveranskoll on every product)
   fromCountry: the country orders ship from, e.g. "Sverige". minDays/maxDays: delivery time in days.
   returnText: one sentence on how returns work. Empty = the page says "Bekräftas innan vi öppnar".
   A product can override these later with its own "ship" field.

   OFFERS
   lookDiscount: share off when every product in a ready-made look is in the cart (0.10 = 10 %). 0 = off.
                 The same discount must exist in Shopify (automatic discount) before launch.
   freeShippingFrom: order value in kr from which shipping is free, shown as a meter in the cart.
                     null = no meter (do not promise free shipping before it is decided).

   payments: the payment methods switched on in Shopify, shown as a row on product pages and in the
             checkout. Empty = no row (do not show methods that are not live).

   FORMS
   formEndpoint: Formspree (or similar) URL for the waiting list, newsletter and contact form.
                 Empty = preview mode, nothing is sent and the page says so. */
window.RQ_CONFIG = {
  auth: {
    provider: "supabase",
    supabaseUrl: "https://viiqzkuwmhnnhtlcwlpi.supabase.co",
    supabaseAnonKey: "sb_publishable_Wq2AVOAvXSXt9-U90ytpMA_n9Tri6Td", // public key, safe in the browser

    social: ["google", "apple", "azure"],
    redirect: "",
  },
  formEndpoint: "",
  delivery: { fromCountry: "", minDays: null, maxDays: null, returnText: "" },
  lookDiscount: 0.1,
  freeShippingFrom: null,
  payments: [], // e.g. ["Kort", "Klarna", "Swish", "Apple Pay", "Google Pay"] once they are switched on in Shopify
};
