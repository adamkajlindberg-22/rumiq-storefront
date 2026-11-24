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
   fromCountry: where orders ship from, e.g. "Lager i EU". minDays/maxDays: delivery time in business days
   (weekends skipped; orders after cutoffHour count from the next weekday). openPurchaseDays: days of open
   purchase shown instead of the legal 14-day withdrawal line. withdrawalDays: the right of withdrawal the law gives
   (14). Pages read both numbers from here (RQ.shop.returnsLine()), nobody types them by hand. The values below are RumIQ's TARGET from the
   business plan; confirm them with the chosen supplier before launch.
   returnText: one sentence on how returns work. Empty = the page says "Bekräftas innan vi öppnar".
   returnVia: where a return can be handed in, shown on the returns page (target: pickup point and parcel locker;
              confirm with the carrier). Empty = not shown.
   A product can override these later with its own "ship" field.

   OFFERS
   lookDiscount: share off when every product in a ready-made look is in the cart (0.10 = 10 %). 0 = off.
                 The same discount must exist in Shopify (automatic discount) before launch.
   freeShippingFrom: order value in kr from which shipping is free, shown as a meter in the cart.
                     null = no meter (do not promise free shipping before it is decided).

   COMPANY: shown in the footer. Empty fields = the footer says the details are published before launch.

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
  delivery: { fromCountry: "Lager i EU", minDays: 2, maxDays: 5, cutoffHour: 14, openPurchaseDays: 30, withdrawalDays: 14, returnText: "Returen skickas till en adress i Sverige.", returnVia: ["hos ett ombud", "i ett paketskåp"] },
  company: { name: "", orgnr: "", address: "", phone: "", email: "support@rumiq.se" },
  waitlist: { table: "waitlist", offer: "10 % på första köpet när vi öppnar" },
  showNews: false, // true once there are real new arrivals; until then Nyheter is hidden from the menus
  lookDiscount: 0.1,
  freeShippingFrom: 799,
  shipping: { pickup: 49, home: 89 }, // kr to pickup point/parcel locker and to the door (examples until the carrier is chosen)
  payments: [], // e.g. ["Kort", "Klarna", "Swish", "Apple Pay", "Google Pay"] once they are switched on in Shopify
};
