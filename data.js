/*
 * GAME_DATA — content layer for "kobi life" / החיים של קובי.
 * Separate from the engine so content can grow (and, later, so the same
 * engine can drive other careers: medicine, architecture, ...).
 * Loaded as a plain global before the game script (browser <script src>,
 * and run into the VM context first by the test loaders).
 */
(function (root) {
  "use strict";

  root.GAME_DATA = {
    version: 1,
    meta: {
      id: "kobi",
      title: { he: "החיים של קובי", en: "kobi life" }
    },

    /*
     * dailyEvents — the "morning brief" that opens each day.
     * Schema:
     *   id      unique string
     *   weight  relative pick weight (default 1)
     *   minDay  earliest day it may appear (default 1)
     *   maxDay  latest day it may appear (optional)
     *   tone    "good" | "bad" | "neutral"  (drives the dialog styling)
     *   headline {he,en}  short title
     *   body     {he,en}  one-line briefing — should hint at a decision/place
     * (Slice 1 is information-only; mechanical effects are added later.)
     */
    dailyEvents: [
      {
        id: "welcome",
        weight: 0, minDay: 1, maxDay: 1, tone: "neutral",
        headline: { he: "בוקר ראשון בתעשייה", en: "First morning in the business" },
        body: {
          he: "ספה של חבר, 300 ש\"ח וחלום. קודם עבודה ומלתחה, אחר כך מצלמה — ורק אז סרט.",
          en: "A borrowed couch, 300 and a dream. Job and wardrobe first, a camera next — a film only after that."
        }
      },
      {
        id: "masterclass",
        weight: 3, tone: "good",
        headline: { he: "סדנת אורח בבית הספר לקולנוע", en: "Guest masterclass at the film school" },
        body: {
          he: "במאי אורח מעביר היום סדנה. יום מצוין לקפוץ לבית הספר לקולנוע וללמוד.",
          en: "A visiting director is teaching today. A great day to drop by the film school and study."
        }
      },
      {
        id: "festival_ny",
        weight: 2, minDay: 18, tone: "good",
        headline: { he: "נפתח פסטיבל בניו יורק", en: "A festival opens in New York" },
        body: {
          he: "האולמות מתמלאים בניו יורק. אם יש לך סרט מוכן — שווה לשקול טיסה דרך שדה התעופה.",
          en: "Theaters are filling up in New York. With a film ready, a flight via the airport is worth considering."
        }
      },
      {
        id: "arkady_up",
        weight: 2, tone: "good",
        headline: { he: "המניה של ארקדי עלתה", en: "Arkady's stock climbed" },
        body: {
          he: "ארקדי במצב רוח נדיב. יום טוב לפגוש את הקרן ולדבר על מימון פיתוח.",
          en: "Arkady is in a generous mood. A good day to visit the fund and talk development money."
        }
      },
      {
        id: "arkady_down",
        weight: 2, tone: "bad",
        headline: { he: "ארקדי הפסיד בבורסה", en: "Arkady took a market hit" },
        body: {
          he: "הקרן רגישה היום. אם החזקת בה כסף — אל תופתע מתנודות, ואל תילחץ למשוך.",
          en: "The fund is jumpy today. If you parked cash there, expect swings — don't panic-pull."
        }
      },
      {
        id: "gear_sale",
        weight: 3, tone: "good",
        headline: { he: "ירידת מחירים בחנות הציוד", en: "Prices drop at the gear shop" },
        body: {
          he: "המוכרים במצב חיסול מלאי. אם חסרה לך מצלמה או ציוד — אולי היום היום לקנות.",
          en: "Sellers are clearing stock. If you still need a camera or gear, today might be the day to buy."
        }
      },
      {
        id: "gear_up",
        weight: 1, tone: "neutral",
        headline: { he: "ביקוש גבוה לציוד צילום", en: "Camera gear is in demand" },
        body: {
          he: "כולם מצלמים החודש והמחירים נדבקו למעלה. אולי כדאי לחכות לעסקה טובה יותר.",
          en: "Everyone is shooting this month and prices crept up. Might be worth waiting for a better deal."
        }
      },
      {
        id: "casting_scout",
        weight: 2, tone: "neutral",
        headline: { he: "מנהל ליהוק סורק את העיר", en: "A casting director is scouting" },
        body: {
          he: "פרצופים חדשים מבוקשים. אם אתה בונה הפקה — שווה לעבור על שוק הליהוק.",
          en: "Fresh faces are wanted. If you're building a production, the casting market is worth a look."
        }
      },
      {
        id: "critics_generous",
        weight: 2, tone: "good",
        headline: { he: "המבקרים במצב רוח טוב", en: "Critics are in a kind mood" },
        body: {
          he: "השבוע הביקורות נוטות לחיוב. שחרור בתזמון טוב יכול לתפוס גל אוהד.",
          en: "Reviews lean positive this week. A well-timed release can ride a friendly wave."
        }
      },
      {
        id: "crew_murmurs",
        weight: 1, minDay: 35, tone: "bad",
        headline: { he: "מלמולים באיגוד הצוות", en: "Murmurs in the crew union" },
        body: {
          he: "הצוותים מדברים על תעריפים. אם אתה מתכנן לשכור צוות — אל תתמהמה יותר מדי.",
          en: "Crews are talking rates. If you plan to hire crew, don't drag your feet too long."
        }
      },
      {
        id: "premiere_season",
        weight: 2, minDay: 55, tone: "good",
        headline: { he: "עונת הבכורות נפתחה", en: "Premiere season is open" },
        body: {
          he: "הקהל יוצא לקולנוע. סרט שמגיע עכשיו לאולמות נשמע רחוק יותר.",
          en: "Audiences are heading to cinemas. A film that reaches theaters now lands louder."
        }
      },
      {
        id: "rent_talk",
        weight: 1, tone: "neutral",
        headline: { he: "בעלי הדירות מדברים על העלאות", en: "Landlords are talking raises" },
        body: {
          he: "שכר הדירה לוחץ. אם ייצבת הכנסה — אולי הזמן לשדרג מגורים, או להדק את ההוצאות.",
          en: "Rent is squeezing. If your income is steady, maybe upgrade housing — or tighten spending."
        }
      },
      {
        id: "bank_rates",
        weight: 1, tone: "neutral",
        headline: { he: "הבנק עדכן ריביות", en: "The bank moved its rates" },
        body: {
          he: "תנאי ההלוואות השתנו. אם החוב מטריד — שווה לבדוק את הבנק לפני שהוא תופח.",
          en: "Loan terms shifted. If debt worries you, check the bank before it balloons."
        }
      },
      {
        id: "gossip_column",
        weight: 2, tone: "good",
        headline: { he: "השם שלך צץ בטור רכילות", en: "Your name popped up in a gossip column" },
        body: {
          he: "מישהו שם לב אליך. תשומת לב קטנה היום יכולה להפוך לקשרים מחר.",
          en: "Someone noticed you. A little attention today can become connections tomorrow."
        }
      },
      {
        id: "coffee_ideas",
        weight: 2, tone: "neutral",
        headline: { he: "סצנת הקפה רותחת ברעיונות", en: "The café scene is buzzing with ideas" },
        body: {
          he: "כולם מדברים על הסרט הבא. בוקר טוב לשבת, לחשוב על תסריט ולטעון יצירתיות.",
          en: "Everyone's pitching the next film. A good morning to sit, think script, and refill creativity."
        }
      }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
