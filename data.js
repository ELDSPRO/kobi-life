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
     *   modifier (optional) — temporary effect activated when this briefing fires.
     *     { category, value, days }
     *       category: "gear" | "course" | "courseCredits"
     *       value:    multiplier (e.g., 0.75 = 25% off, 1.25 = 25% premium)
     *       days:     how many days the effect stays active (decremented at endDay)
     *     Modifier scope is deliberately narrow: it only touches buyEquip price
     *     and attendClass cost/credits. The calibrated film economy (script →
     *     shoot → post → release) is NOT affected — that comes in a later slice
     *     after broader test coverage.
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
          he: "במאי אורח מעביר היום סדנה. כל קורס שתעבור בשני הימים הקרובים מקנה 50% יותר קרדיטים.",
          en: "A visiting director is teaching today. Any course in the next two days grants 50% more credits."
        },
        modifier: { category: "courseCredits", value: 1.5, days: 2 }
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
          he: "המוכרים במצב חיסול מלאי — ציוד ב-25% הנחה לשלושה ימים. אם חסרה לך מצלמה, זה החלון.",
          en: "Sellers are clearing stock — 25% off all gear for three days. If you need a camera, this is the window."
        },
        modifier: { category: "gear", value: 0.75, days: 3 }
      },
      {
        id: "gear_up",
        weight: 1, tone: "bad",
        headline: { he: "ביקוש גבוה לציוד צילום", en: "Camera gear is in demand" },
        body: {
          he: "כולם מצלמים החודש. המחירים בחנות עלו ב-25% לשלושה ימים — אולי שווה לחכות.",
          en: "Everyone is shooting this month. Prices jumped 25% for three days — waiting might pay off."
        },
        modifier: { category: "gear", value: 1.25, days: 3 }
      },
      {
        id: "tuition_grant",
        weight: 2, tone: "good",
        headline: { he: "בית הספר קיבל מענק", en: "The school landed a grant" },
        body: {
          he: "שכר הלימוד מסובסד ב-30% לארבעה ימים. אם חיכית להירשם — זה הזמן ללמוד זול.",
          en: "Tuition is subsidized 30% for four days. If you've been waiting to enroll, this is the cheap window."
        },
        modifier: { category: "course", value: 0.7, days: 4 }
      },
      {
        id: "tuition_spike",
        weight: 1, minDay: 30, tone: "bad",
        headline: { he: "המחזור הקודם הצליח — והעלו מחיר", en: "Last cohort blew up — tuition followed" },
        body: {
          he: "אחרי שתי בוגרות שעלו לפסטיבל, בית הספר העלה שכר לימוד ב-25% לשלושה ימים.",
          en: "After two alumni hit a festival, the school bumped tuition 25% for three days."
        },
        modifier: { category: "course", value: 1.25, days: 3 }
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
      },
      /* === Money incidents === */
      {
        id: "shark_loan_calls",
        weight: 1, minDay: 12, tone: "bad",
        headline: { he: "הכריש התקשר פעמיים", en: "The loan shark called twice" },
        body: {
          he: "אם יש לך חוב פתוח — היום הוא יום שווה לסגור משהו. אחרת זה ימצא אותך בלילה.",
          en: "If you carry open debt, today is a good day to chip away. Otherwise it finds you at night."
        }
      },
      {
        id: "lottery_dust",
        weight: 1, tone: "good",
        headline: { he: "מטבע שנפל מהכיס בכביסה", en: "A coin you forgot in the laundry" },
        body: {
          he: "מצאת 80 ש\"ח בכיס של מעיל ישן. לא יציל את הסרט, אבל יציל את הקפה.",
          en: "Eighty bucks turned up in an old coat. Won't save the film — will save the coffee."
        }
      },
      /* === Creative incidents === */
      {
        id: "writers_block",
        weight: 2, minDay: 8, tone: "bad",
        headline: { he: "התסריט נתקע", en: "The script is stuck" },
        body: {
          he: "שלוש שעות מול הדף, אפס מילים. אולי סינמטק היום במקום מחשב.",
          en: "Three hours, blank page. Maybe cinematheque today instead of the keyboard."
        }
      },
      {
        id: "muse_visit",
        weight: 2, tone: "good",
        headline: { he: "רעיון חטף אותך בדרך הביתה", en: "An idea ambushed you on the walk home" },
        body: {
          he: "סצנה שלמה התרוצצה לך בראש. רוץ הביתה ותכתוב לפני שזה נעלם.",
          en: "A whole scene just landed in your head. Run home and write before it dissolves."
        }
      },
      /* === Ego incidents === */
      {
        id: "rival_in_paper",
        weight: 2, minDay: 14, tone: "bad",
        headline: { he: "חבר ללימודים בכותרת", en: "A film-school friend made the front page" },
        body: {
          he: "מישהו שהיה איתך בכיתה חתם עם סטודיו. תקנא ביעילות — או תעבוד.",
          en: "Someone from your class signed with a studio. Envy efficiently — or work."
        }
      },
      {
        id: "paparazzi_glance",
        weight: 1, minDay: 20, tone: "good",
        headline: { he: "צלם רחוב לחץ פעמיים בכיוונך", en: "A street photographer clicked twice your way" },
        body: {
          he: "פתאום אתה במסגרת. עוד טיפה מוניטין, עוד טיפה לחץ.",
          en: "Suddenly you're in a frame. A drop more reputation, a drop more pressure."
        }
      },
      /* === NPC memory-callbacks ===
       * requires(state) gates these to relationship thresholds. The brief
       * picker filters them out otherwise. Tone matches the NPC's vibe.
       * Body hints at where to go today so the brief connects to gameplay. */
      {
        id: "lior_friendly_call",
        weight: 5, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.lior_agent && s.npcs.lior_agent.relationship >= 5; },
        headline: { he: "ליאור התקשר. השאיר הודעה.", en: "Lior called. Left a message." },
        body: {
          he: "אם תקפוץ לבר המלון אחה\"צ — אמר שיש משהו ששווה בקבוק כפול.",
          en: "If you swing by the hotel bar this afternoon — said there's something worth a double."
        }
      },
      {
        id: "lior_hostile_call",
        weight: 4, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.lior_agent && s.npcs.lior_agent.relationship <= -5; },
        headline: { he: "השם שלך עלה בשיחה אצל ליהוקים", en: "Your name came up in casting talk" },
        body: {
          he: "ליאור צוחק עם חברים. השבוע. תיזהר על מי אתה נשען.",
          en: "Lior is laughing with friends. This week. Watch who you lean on."
        }
      },
      {
        id: "maya_friendly_note",
        weight: 5, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.maya_barista && s.npcs.maya_barista.relationship >= 5; },
        headline: { he: "מאיה שלחה הודעה: 'אני מנסה לזכור שיר'", en: "Maya texted: 'trying to remember a poem'" },
        body: {
          he: "אם תיכנס לקפה היום, סביר שתצא עם שורה שלא חשבת עליה.",
          en: "Swing by the cafe today and you'll likely leave with a line you didn't expect."
        }
      },
      {
        id: "maya_hostile_whisper",
        weight: 3, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.maya_barista && s.npcs.maya_barista.relationship <= -5; },
        headline: { he: "מאיה אמרה לבריסטה השני: 'ההוא.'", en: "Maya said to the other barista: 'that guy.'" },
        body: {
          he: "תחשוב פעמיים לפני שתחזור לאותו קפה. אולי תחפש מקום אחר.",
          en: "Think twice before walking back into that cafe. Try a different spot."
        }
      },
      {
        id: "sofia_friendly_slot",
        weight: 5, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.sofia_editor && s.npcs.sofia_editor.relationship >= 5; },
        headline: { he: "סופיה השאירה לך חצי שעה אחה\"צ", en: "Sofia carved out half an hour for you" },
        body: {
          he: "אם אתה באתונה — חדר העריכה היום. היא לא חוזרת על עצמה.",
          en: "If you're in Athens — the post house today. She doesn't repeat herself."
        }
      },
      {
        id: "nikos_hostile_blacklist",
        weight: 4, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.nikos_lecturer && s.npcs.nikos_lecturer.relationship <= -5; },
        headline: { he: "ניקוס הכניס את שמך לרשימה", en: "Nikos added you to a list" },
        body: {
          he: "'לא נכנסים יותר לכיתות שלי.' עבר במסדרון, יודעים שזה אתה.",
          en: "'Not allowed in my classes anymore.' Word traveled the hallway. They know who."
        }
      },
      {
        id: "klaus_friendly_workshop",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.klaus_gear && s.npcs.klaus_gear.relationship >= 5; },
        headline: { he: "קלאוס: 'יש לי כיסא בסדנה בברלין'", en: "Klaus: 'I have a seat for you in a Berlin workshop'" },
        body: {
          he: "אם תקפוץ לחנות הציוד היום, הוא יסביר. ההזמנה לא תחזור.",
          en: "Stop by the gear shop today and he'll explain. The invite won't repeat."
        }
      },
      {
        id: "ulrich_friendly_dev",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.ulrich_investor && s.npcs.ulrich_investor.relationship >= 5; },
        headline: { he: "אולריך הזכיר תקציב פיתוח", en: "Ulrich mentioned a development budget" },
        body: {
          he: "אמר לעוזרת לרשום אותך. אם אתה בברלין — היום אחה\"צ במשרד.",
          en: "Told his assistant to put you on the list. If you're in Berlin — his office this afternoon."
        }
      },
      {
        id: "petra_friendly_slot",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.petra_programmer && s.npcs.petra_programmer.relationship >= 5; },
        headline: { he: "פטרה כתבה: 'יש משבצת. תרצה?'", en: "Petra wrote: 'there's a slot. Want it?'" },
        body: {
          he: "סינמטק ברלין, רטרוספקטיבה. אם תיכנס לדבר היום, היא תסגור.",
          en: "Berlin Cinematheque, retrospective track. If you swing by today, she'll lock it in."
        }
      },
      {
        id: "ulrich_hostile_block",
        weight: 3, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.ulrich_investor && s.npcs.ulrich_investor.relationship <= -5; },
        headline: { he: "אולריך מדבר עם הקרן השנייה", en: "Ulrich is speaking with the other fund" },
        body: {
          he: "השם שלך עולה בהקשר 'חסר רצינות'. השבוע. אל תגיש כלום.",
          en: "Your name comes up framed 'not serious.' This week. Don't submit anything."
        }
      },
      {
        id: "frank_friendly_lot",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.frank_set && s.npcs.frank_set.relationship >= 5; },
        headline: { he: "פרנק שלח SMS: 'הלוט שלי פנוי ביום ראשון'", en: "Frank texted: 'my lot's free Sunday'" },
        body: {
          he: "אם תצליח להגיע לניו יורק עד אז — אין לך תירוץ.",
          en: "Make it to NYC by then — you've run out of excuses."
        }
      },
      {
        id: "karen_friendly_meeting",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.karen_tv && s.npcs.karen_tv.relationship >= 5; },
        headline: { he: "קארן ביקשה את הטיוטה", en: "Karen wants the draft" },
        body: {
          he: "התחנה בניו יורק. אחר הצהריים. תיכנס אישית, לא מייל.",
          en: "Station in NYC. This afternoon. In person — not email."
        }
      },
      {
        id: "tony_friendly_tip",
        weight: 3, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.tony_loan && s.npcs.tony_loan.relationship >= 5; },
        headline: { he: "טוני העביר רמז דרך השוער", en: "Tony left a tip through the doorman" },
        body: {
          he: "'אם תקפוץ הלילה לבר — יש מישהו ששווה לדעת עליו.'",
          en: "'Stop by the bar tonight — there's someone you'll want to know about.'"
        }
      },
      {
        id: "tony_hostile_followers",
        weight: 3, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.tony_loan && s.npcs.tony_loan.relationship <= -5; },
        headline: { he: "שני בחורים עוקבים אחריך מהבר", en: "Two guys are tailing you from the bar" },
        body: {
          he: "לא נראה שזה אישי. נראה שזה כן. עדיף לא לחזור לאותו אזור.",
          en: "Doesn't look personal. It is. Better not to revisit that block."
        }
      }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
