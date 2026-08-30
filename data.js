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
     *   weight  relative pick weight (default 1; 0 = never drawn randomly —
     *           use this for events reached ONLY via followUpEventId)
     *   minDay  earliest day it may appear (default 1)
     *   maxDay  latest day it may appear (optional)
     *   cooldownDays (optional) — once this event fires, it can't fire again
     *           until gameState.day passes day-it-fired + cooldownDays.
     *   tone    "good" | "bad" | "neutral"  (drives the dialog styling)
     *   source  (optional) {he,en} — short attribution shown on the brief
     *           card ("why did this show up"). Falls back to a computed
     *           default ("<city> today" / "Result of an earlier choice").
     *   headline {he,en}  short title
     *   body     {he,en}  one-line briefing — should hint at a decision/place
     *   requires(state) (optional) — gates the event to game-state conditions
     *   choices (optional) — 2-3 real decisions, each:
     *     { id, label:{he,en}, cost?:{cash,hours}, effects?:{...}, result?:{he,en},
     *       followUpEventId?, followUpInDays? }
     *     effects keys: cash, debt (negative=reduce), experience, wardrobeTier,
     *     equipment ("camera"|"studio"|"insurance" -> unlocks it), and the
     *     bounded stats reputation/education/soul/creativity/love (deltas).
     *     If an event has no `choices`, it auto-resolves with a single
     *     acknowledge button (backward-compatible with older info-only events).
     *   modifier (optional) — temporary effect activated when this briefing fires.
     *     { category, value, days }
     *       category: "gear" | "course" | "courseCredits"
     *       value:    multiplier (e.g., 0.75 = 25% off, 1.25 = 25% premium)
     *       days:     how many days the effect stays active (decremented at endDay)
     *     Modifier scope is deliberately narrow: it only touches buyEquip price
     *     and attendClass cost/credits. The calibrated film economy (script →
     *     shoot → post → release) is NOT affected.
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
      },
      {
        id: "henry_friendly_invite",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.henry_festival && s.npcs.henry_festival.relationship >= 5; },
        headline: { he: "הנרי דוחף אותך לתחרות הראשית", en: "Henry is pushing you into the main competition" },
        body: {
          he: "לונדון. הלובי, ארבע אחר הצהריים. אל תאחר.",
          en: "London. The lobby, 4pm. Don't be late."
        }
      },
      {
        id: "henry_hostile_blacklist",
        weight: 3, tone: "bad",
        requires: function (s) { return s.npcs && s.npcs.henry_festival && s.npcs.henry_festival.relationship <= -5; },
        headline: { he: "השם שלך הוצא משתי רשימות פסטיבל", en: "Your name was pulled from two festival lists" },
        body: {
          he: "הנרי מצא דרך מנומסת לעשות את זה. השבוע. אל תגיש.",
          en: "Henry found a polite way to do it. This week. Don't submit."
        }
      },
      {
        id: "rose_friendly_column",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.rose_legend && s.npcs.rose_legend.relationship >= 5; },
        headline: { he: "דיים רוז הזכירה אותך במאמר", en: "Dame Rose mentioned you in her column" },
        body: {
          he: "שורה אחת בעדינות. אבל בריטים יודעים לקרוא.",
          en: "One subtle line. But the British know how to read."
        }
      },
      {
        id: "whitwell_friendly_offer",
        weight: 3, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.whitwell_banker && s.npcs.whitwell_banker.relationship >= 5; },
        headline: { he: "מר ויטוול שולח הצעת אשראי אישית", en: "Mr. Whitwell sent a personal credit offer" },
        body: {
          he: "אם אתה בלונדון — היום הבנק, בלי תור. הוא יחכה.",
          en: "If you're in London — the bank today, no queue. He'll wait."
        }
      },
      {
        id: "emilie_friendly_event",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.emilie_wardrobe && s.npcs.emilie_wardrobe.relationship >= 5; },
        headline: { he: "אמילי הזמינה אותך לאירוע אופנה", en: "Émilie invited you to a fashion event" },
        body: {
          he: "פריז, הערב. הקאסט שלה שם. תיכרו פנים שלא מצולמות.",
          en: "Paris, tonight. Her cast is there. Meet faces that aren't on camera yet."
        }
      },
      {
        id: "lea_friendly_grant",
        weight: 4, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.lea_lector && s.npcs.lea_lector.relationship >= 5; },
        headline: { he: "ליאה דחפה את התיק שלך", en: "Léa pushed your file forward" },
        body: {
          he: "הוועדה תקרא השבוע. אם אתה בפריז — קפה איתה בבוקר.",
          en: "The committee reads this week. If you're in Paris — coffee with her in the morning."
        }
      },
      {
        id: "marc_friendly_crew",
        weight: 3, tone: "good",
        requires: function (s) { return s.npcs && s.npcs.marc_crew && s.npcs.marc_crew.relationship >= 5; },
        headline: { he: "מארק שלח לך צוות במחיר עלות", en: "Marc lined up a crew at cost" },
        body: {
          he: "פריז, היום. אם תבוא לאיגוד, הוא יחתום על המסמכים.",
          en: "Paris, today. Show up at the union and he'll sign the paperwork."
        }
      },

      /* === Choice-driven briefs (day 1-30 focus) ===
       * Each poses one real tension and always leaves a free/safe option —
       * no event should be able to end in a dead end. Several chain into a
       * followUpEventId so a decision echoes a few days later. */
      {
        id: "boss_pleased_shift",
        weight: 3, minDay: 3, cooldownDays: 18, tone: "good",
        requires: function (s) { return !!s.jobId; },
        headline: { he: "הבוס מרוצה מהמשמרת האחרונה", en: "The boss liked your last shift" },
        body: {
          he: "עמדת/עמדת בזמנים, אף אחד לא התלונן. זה כבר הישג בתעשייה הזאת.",
          en: "You were on time, nobody complained. That's already an achievement in this industry."
        },
        choices: [
          {
            id: "ask_more_hours",
            label: { he: "תבקש/י תוספת שעות · 0 ₪ · 0ש", en: "Ask for more hours · $0 · 0h" },
            effects: { reputation: 8 },
            result: { he: "הבוס הבטיח לחשוב על זה.", en: "The boss promised to think about it." },
            followUpEventId: "extra_hours_offer", followUpInDays: 3
          },
          {
            id: "say_thanks",
            label: { he: "תגיד/י תודה ותמשיך/י הלאה · 0 ₪ · 0ש", en: "Say thanks and move on · $0 · 0h" },
            effects: { reputation: 2 },
            result: { he: "לא ביקשת כלום. גם זה בחירה.", en: "You asked for nothing. That's a choice too." }
          }
        ]
      },
      {
        id: "extra_hours_offer",
        weight: 0, tone: "good",
        headline: { he: "הבוס חוזר עם תשובה", en: "The boss comes back with an answer" },
        body: {
          he: "יש עוד משמרת פנויה השבוע, אם תרצה/י אותה.",
          en: "There's an open shift this week, if you want it."
        },
        choices: [
          {
            id: "take_it",
            label: { he: "קח/י את המשמרת · 0 ₪ · 0ש", en: "Take the shift · $0 · 0h" },
            effects: { cash: 90, experience: 3 },
            result: { he: "עוד קצת כסף וניסיון בכיס.", en: "A bit more cash and experience in your pocket." }
          },
          {
            id: "skip_it",
            label: { he: "תוותר/י הפעם · 0 ₪ · 0ש", en: "Skip it this time · $0 · 0h" },
            result: { he: "אתה בוחר את הזמן שלך.", en: "You choose your own time." }
          }
        ]
      },
      {
        id: "boss_disappointed_shift",
        weight: 3, minDay: 3, cooldownDays: 18, tone: "bad",
        requires: function (s) { return !!s.jobId; },
        headline: { he: "הבוס מאוכזב מהמשמרת האחרונה", en: "The boss was unhappy with your last shift" },
        body: {
          he: "משהו לא עבד אתמול. הוא לא צעק, אבל הוא זכר.",
          en: "Something didn't work yesterday. He didn't yell, but he remembered."
        },
        choices: [
          {
            id: "apologize_double",
            label: { he: "תתנצל/י ותציע/י משמרת כפולה · 0 ₪ · 4ש", en: "Apologize, offer a double shift · $0 · 4h" },
            cost: { hours: 4 },
            effects: { reputation: 5, soul: -3 },
            result: { he: "עייף/ה, אבל חזרת למסלול.", en: "Tired, but back on track." }
          },
          {
            id: "shrug_it_off",
            label: { he: "תתעלם/י, זו רק עבודה · 0 ₪ · 0ש", en: "Shrug it off, it's just a job · $0 · 0h" },
            effects: { reputation: -4 },
            result: { he: "אתה שומר על השקט הנפשי. הוא שומר טינה קטנה.", en: "You keep your peace. He keeps a small grudge." }
          }
        ]
      },
      {
        id: "couch_friend_request",
        weight: 2, minDay: 4, cooldownDays: 25, tone: "neutral",
        headline: { he: "חבר מבקש להישאר על הספה", en: "A friend asks to crash on the couch" },
        body: {
          he: "גם אם הספה הזאת עצמה שאולה — הוא לא יודע את זה, ולא אכפת לו.",
          en: "Even if that couch is itself borrowed — he doesn't know that, and doesn't care."
        },
        choices: [
          {
            id: "let_him_stay",
            label: { he: "תגיד/י כן · 0 ₪ · 0ש", en: "Say yes · $0 · 0h" },
            effects: { love: 6, soul: -4 },
            result: { he: "צפוף, אבל לא לבד.", en: "Crowded, but not alone." },
            followUpEventId: "friend_owes_you", followUpInDays: 5
          },
          {
            id: "no_room",
            label: { he: "תגיד/י שאין מקום · 0 ₪ · 0ש", en: "Say there's no room · $0 · 0h" },
            effects: { love: -5 },
            result: { he: "הוא מבין. לא באמת.", en: "He understands. Not really." }
          }
        ]
      },
      {
        id: "friend_owes_you",
        weight: 0, tone: "good",
        headline: { he: "החבר מהספה חוזר עם טובה", en: "The couch friend returns a favor" },
        body: {
          he: "הוא מכיר מישהו שמחפש בדיוק אותך.",
          en: "He knows someone who's looking for exactly you."
        },
        choices: [
          {
            id: "cash_in",
            label: { he: "תקבל/י את ההיכרות · 0 ₪ · 0ש", en: "Take the introduction · $0 · 0h" },
            effects: { reputation: 4 },
            result: { he: "לפעמים ספה שווה יותר משכר דירה.", en: "Sometimes a couch is worth more than rent." }
          }
        ]
      },
      {
        id: "rent_landlord_pressure",
        weight: 2, minDay: 6, cooldownDays: 20, tone: "bad",
        requires: function (s) { return s.housing !== "couch"; },
        headline: { he: "בעל הבית מרמז על איחור", en: "The landlord hints about being late" },
        body: {
          he: "שום דבר רשמי עדיין. רק רמז, בחיוך שלא מגיע לעיניים.",
          en: "Nothing official yet. Just a hint, with a smile that doesn't reach the eyes."
        },
        choices: [
          {
            id: "pay_goodwill",
            label: { he: "שלם/י מקדמה כמחווה · 200 ₪ · 0ש", en: "Pay an advance as a gesture · $200 · 0h" },
            cost: { cash: 200 },
            result: { he: "החיוך הזה הגיע קצת יותר קרוב לעיניים.", en: "That smile got a little closer to the eyes." },
            followUpEventId: "landlord_goodwill", followUpInDays: 6
          },
          {
            id: "promise_later",
            label: { he: "תבטיח/י ותמשיך/י הלאה · 0 ₪ · 0ש", en: "Promise and move on · $0 · 0h" },
            result: { he: "אתה קונה זמן. לא הרבה, אבל זמן.", en: "You buy time. Not much, but time." }
          }
        ]
      },
      {
        id: "landlord_goodwill",
        weight: 0, tone: "good",
        headline: { he: "בעל הבית זוכר את המחווה", en: "The landlord remembers the gesture" },
        body: {
          he: "הוא לא מזכיר את זה, אבל הוא מקל קצת.",
          en: "He doesn't mention it, but he eases up a little."
        },
        choices: [
          { id: "ack", label: { he: "בסדר גמור", en: "Good to know" }, effects: { soul: 3 } }
        ]
      },
      {
        id: "fund_open_call",
        weight: 2, minDay: 10, cooldownDays: 30, tone: "good",
        requires: function (s) { return !!s.jobId; },
        headline: { he: "קרן קולנוע פרסמה קול קורא", en: "A film fund published an open call" },
        body: {
          he: "דדליין בעוד כמה ימים. לא הרבה, אבל דלת.",
          en: "A deadline in a few days. Not much, but a door."
        },
        choices: [
          {
            id: "submit_pitch",
            label: { he: "תגיש/י בקשה עכשיו · 0 ₪ · 2ש", en: "Submit a pitch now · $0 · 2h" },
            cost: { hours: 2 },
            effects: { experience: 3 },
            result: { he: "הבקשה בדרך. עכשיו מחכים.", en: "The application is in. Now you wait." },
            followUpEventId: "fund_call_result", followUpInDays: 5
          },
          {
            id: "skip_call",
            label: { he: "תדלג/י, אין זמן · 0 ₪ · 0ש", en: "Skip it, no time · $0 · 0h" },
            result: { he: "יהיה קול קורא אחר.", en: "There will be another call." }
          }
        ]
      },
      {
        id: "fund_call_result",
        weight: 0, tone: "good",
        headline: { he: "תשובה מהקרן", en: "An answer from the fund" },
        body: {
          he: "לא זכית בכל הסכום, אבל שמו לב אליך.",
          en: "You didn't win the full amount, but they noticed you."
        },
        choices: [
          { id: "ack", label: { he: "לוקחים את זה", en: "Take the win" }, effects: { cash: 250, reputation: 3 } }
        ]
      },
      {
        id: "cinema_premiere_invite",
        weight: 2, minDay: 12, cooldownDays: 25, tone: "good",
        headline: { he: "הזמנה לבכורה בקולנוע", en: "An invitation to a cinema premiere" },
        body: {
          he: "כל התעשייה שם. גם האנשים שמעולם לא ענו לך להודעה.",
          en: "The whole industry is there. Even the people who never answered your message."
        },
        choices: [
          {
            id: "attend_premiere",
            label: { he: "לך/י לבכורה · 60 ₪ · 3ש", en: "Go to the premiere · $60 · 3h" },
            cost: { cash: 60, hours: 3 },
            effects: { soul: 5, reputation: 4 },
            result: { he: "פנים חדשות, שם אחד שכדאי לזכור.", en: "New faces, one name worth remembering." },
            followUpEventId: "premiere_afterparty_contact", followUpInDays: 2
          },
          {
            id: "stay_home_write",
            label: { he: "תישאר/י בבית לעבוד על התסריט · 0 ₪ · 0ש", en: "Stay home and work the script · $0 · 0h" },
            effects: { experience: 3 },
            result: { he: "אף אחד לא ראה אותך שם. גם אתה לא היית שם.", en: "No one saw you there. You weren't there either." }
          }
        ]
      },
      {
        id: "premiere_afterparty_contact",
        weight: 0, tone: "good",
        headline: { he: "האיש מהמסיבה מחזיר קשר", en: "The guy from the after-party follows up" },
        body: {
          he: "'היה כיף לדבר אתמול. יש לי מישהו שכדאי שתכיר.'",
          en: "'Good talking last night. I know someone you should meet.'"
        },
        choices: [
          { id: "ack", label: { he: "תשמח/י לקשר", en: "Glad for the connection" }, effects: { reputation: 4 } }
        ]
      },
      {
        id: "secondhand_camera_deal",
        weight: 2, minDay: 6, maxDay: 40, cooldownDays: 40, tone: "good",
        requires: function (s) { return s.equipment && !s.equipment.camera; },
        headline: { he: "מצלמה יד שנייה במחיר חד-פעמי", en: "A secondhand camera, one-time price" },
        body: {
          he: "שריטה על הגוף, אבל העדשה נקייה. המוכר ממהר להיפטר ממנה.",
          en: "A scratch on the body, but the lens is clean. The seller wants it gone fast."
        },
        choices: [
          {
            id: "buy_camera",
            label: { he: "תקנה/י אותה עכשיו · 900 ₪ · 1ש", en: "Buy it now · $900 · 1h" },
            cost: { cash: 900, hours: 1 },
            effects: { equipment: "camera", creativity: 4 },
            result: { he: "היא לא יפה, אבל היא שלך.", en: "It's not pretty, but it's yours." }
          },
          {
            id: "pass_camera",
            label: { he: "תוותר/י, המחיר עדיין גבוה · 0 ₪ · 0ש", en: "Pass, still too pricey · $0 · 0h" },
            result: { he: "תמיד יש מצלמה הבאה.", en: "There's always a next camera." }
          }
        ]
      },
      {
        id: "runner_gig_today",
        weight: 3, minDay: 5, cooldownDays: 14, tone: "neutral",
        headline: { he: "במאי מחפש ראנר/ית היום בלבד", en: "A director needs a runner today only" },
        body: {
          he: "משמרת חד-פעמית, בלי משא ומתן, בלי מחר.",
          en: "A one-off shift, no negotiation, no tomorrow."
        },
        choices: [
          {
            id: "take_runner_gig",
            label: { he: "תיקח/י את המשמרת · 0 ₪ · 6ש", en: "Take the shift · $0 · 6h" },
            cost: { hours: 6 },
            effects: { cash: 140, experience: 6, soul: -3 },
            result: { he: "רגליים כואבות, כיס קצת יותר מלא.", en: "Sore feet, a slightly fuller pocket." }
          },
          {
            id: "skip_runner_gig",
            label: { he: "תוותר/י, זה מתנגש עם התוכניות · 0 ₪ · 0ש", en: "Pass, it clashes with your plans · $0 · 0h" },
            result: { he: "מישהו אחר ירוץ היום.", en: "Someone else runs today." }
          }
        ]
      },
      {
        id: "reputation_article",
        weight: 2, minDay: 8, cooldownDays: 25, tone: "neutral",
        headline: { he: "כתבה עליך יוצאת מחר", en: "An article about you runs tomorrow" },
        body: {
          he: "עיתונאית מבקשת עוד כמה משפטים, 'רק כדי לחדד את הזווית'.",
          en: "A journalist wants a few more lines, 'just to sharpen the angle'."
        },
        choices: [
          {
            id: "extra_interview",
            label: { he: "תסכים/י לראיון נוסף · 0 ₪ · 2ש", en: "Agree to another interview · $0 · 2h" },
            cost: { hours: 2 },
            effects: { reputation: 8, love: -3 },
            result: { he: "הכתבה תהיה גדולה יותר. גם החשיפה.", en: "The piece gets bigger. So does the exposure." }
          },
          {
            id: "decline_more",
            label: { he: "תסרב/י לפרסום נוסף · 0 ₪ · 0ש", en: "Decline further coverage · $0 · 0h" },
            effects: { reputation: 2 },
            result: { he: "מסתורין זה גם מותג.", en: "Mystery is also a brand." }
          }
        ]
      },
      {
        id: "rain_cancels_shoot",
        weight: 2, minDay: 20, cooldownDays: 25, tone: "bad",
        requires: function (s) { return !!s.filmUnlocked; },
        headline: { he: "גשם מבטל צילומי חוץ", en: "Rain cancels the exterior shoot" },
        body: {
          he: "השמיים לא קראו את לוח הזמנים שלך.",
          en: "The sky didn't read your schedule."
        },
        choices: [
          {
            id: "move_indoors",
            label: { he: "תזיז/י לצילומי פנים · 250 ₪ · 0ש", en: "Move to an indoor location · $250 · 0h" },
            cost: { cash: 250 },
            result: { he: "עולה כסף, אבל הלו\"ז שרד.", en: "Costs money, but the schedule survives." }
          },
          {
            id: "postpone_shoot",
            label: { he: "תדחה/י ליום אחר · 0 ₪ · 0ש", en: "Postpone to another day · $0 · 0h" },
            effects: { reputation: -4 },
            result: { he: "הצוות מבין. לא כולם שמחים.", en: "The crew understands. Not everyone's happy." }
          }
        ]
      },
      {
        id: "investor_meeting_request",
        weight: 2, minDay: 20, cooldownDays: 30, tone: "neutral",
        requires: function (s) { return !!s.jobId; },
        headline: { he: "משקיע מבקש פגישה קצרה", en: "An investor requests a short meeting" },
        body: {
          he: "'עשר דקות, לא יותר.' תמיד יש יותר.",
          en: "'Ten minutes, no more.' There's always more."
        },
        choices: [
          {
            id: "take_meeting",
            label: { he: "תיפגש/י איתו · 0 ₪ · 2ש", en: "Take the meeting · $0 · 2h" },
            cost: { hours: 2 },
            result: { he: "הוא מקשיב יותר משהוא מדבר. חשוד.", en: "He listens more than he talks. Suspicious." },
            followUpEventId: "investor_followup_offer", followUpInDays: 4
          },
          {
            id: "decline_meeting",
            label: { he: "תדחה/י בנימוס · 0 ₪ · 0ש", en: "Decline politely · $0 · 0h" },
            result: { he: "הזמן שלך נשאר שלך.", en: "Your time stays yours." }
          }
        ]
      },
      {
        id: "investor_followup_offer",
        weight: 0, tone: "good",
        headline: { he: "המשקיע חוזר עם הצעה", en: "The investor comes back with an offer" },
        body: {
          he: "לא ענק, אבל אמיתי.",
          en: "Not huge, but real."
        },
        choices: [
          { id: "ack", label: { he: "לוקחים את הכסף", en: "Take the money" }, effects: { cash: 300 } }
        ]
      },
      {
        id: "arkady_debt_call",
        weight: 2, minDay: 10, cooldownDays: 15, tone: "bad",
        requires: function (s) { return s.debt > 0; },
        headline: { he: "ארקדי מזכיר את החוב", en: "Arkady brings up the debt" },
        body: {
          he: "לא איום. עוד לא. רק תזכורת, בטלפון, בשעה מוזרה.",
          en: "Not a threat. Not yet. Just a reminder, by phone, at an odd hour."
        },
        choices: [
          {
            id: "pay_partial",
            label: { he: "שלם/י חלק עכשיו · 500 ₪ · 0ש", en: "Pay part now · $500 · 0h" },
            cost: { cash: 500 },
            effects: { debt: -500 },
            result: { he: "החוב קצת יותר קל הלילה.", en: "The debt is a little lighter tonight." }
          },
          {
            id: "ask_installments",
            label: { he: "תבקש/י הסדר תשלומים · 0 ₪ · 0ש", en: "Ask for a payment plan · $0 · 0h" },
            effects: { debt: 200 },
            result: { he: "הוא מסכים. הריבית לא נעלמת.", en: "He agrees. The interest doesn't disappear." }
          }
        ]
      },
      {
        id: "party_vs_shift_conflict",
        weight: 2, minDay: 7, cooldownDays: 20, tone: "neutral",
        requires: function (s) { return !!s.jobId; },
        headline: { he: "מסיבה מול משמרת", en: "A party against a shift" },
        body: {
          he: "כולם יהיו שם הלילה. גם המחר עדיין קיים.",
          en: "Everyone will be there tonight. Tomorrow still exists too."
        },
        choices: [
          {
            id: "go_party",
            label: { he: "לך/י למסיבה · 0 ₪ · 4ש", en: "Go to the party · $0 · 4h" },
            cost: { hours: 4 },
            effects: { soul: 6, love: 5, reputation: -3 },
            result: { he: "בוקר טוב יותר, שם קצת פחות אמין.", en: "A better morning, a slightly less reliable name." }
          },
          {
            id: "prefer_shift",
            label: { he: "תעדיף/י את המשמרת · 0 ₪ · 0ש", en: "Prefer the shift · $0 · 0h" },
            effects: { experience: 3 },
            result: { he: "עוד לילה שקט, עוד קצת ניסיון.", en: "Another quiet night, a bit more experience." }
          }
        ]
      },
      {
        id: "course_enrollment_opens",
        weight: 2, minDay: 5, cooldownDays: 25, tone: "good",
        headline: { he: "קורס חדש נפתח להרשמה", en: "A new course opens for enrollment" },
        body: {
          he: "מקומות מוגבלים, כמו תמיד. גם התקציב שלך.",
          en: "Limited spots, as always. So is your budget."
        },
        choices: [
          {
            id: "enroll_now",
            label: { he: "תירשם/י עכשיו · 250 ₪ · 0ש", en: "Enroll now · $250 · 0h" },
            cost: { cash: 250 },
            effects: { education: 1 },
            result: { he: "מקום שמור. עכשיו רק להגיע.", en: "A seat is saved. Now just show up." }
          },
          {
            id: "wait_next_course",
            label: { he: "תחכה/י לפעם הבאה · 0 ₪ · 0ש", en: "Wait for next time · $0 · 0h" },
            result: { he: "יהיה מחזור נוסף.", en: "There will be another cohort." }
          }
        ]
      },
      {
        id: "cafe_connection",
        weight: 2, minDay: 3, cooldownDays: 20, tone: "good",
        headline: { he: "חבר מהקפה מציע חיבור מקצועי", en: "A cafe friend offers a professional connection" },
        body: {
          he: "'אני מכיר מישהי שמחפשת בדיוק את מה שאתה עושה.' אולי נכון, אולי נחמד.",
          en: "'I know someone looking for exactly what you do.' Maybe true, maybe just nice."
        },
        choices: [
          {
            id: "ask_intro",
            label: { he: "תבקש/י הכרות · 0 ₪ · 1ש", en: "Ask for the introduction · $0 · 1h" },
            cost: { hours: 1 },
            effects: { reputation: 4 },
            result: { he: "מייל יוצא. עכשיו מחכים.", en: "An email goes out. Now you wait." },
            followUpEventId: "cafe_connection_payoff", followUpInDays: 4
          },
          {
            id: "decline_intro",
            label: { he: "תודה, לא הפעם · 0 ₪ · 0ש", en: "Thanks, not this time · $0 · 0h" },
            result: { he: "הקפה נשאר סתם קפה.", en: "The coffee stays just coffee." }
          }
        ]
      },
      {
        id: "cafe_connection_payoff",
        weight: 0, tone: "good",
        headline: { he: "ההיכרות מהקפה נושאת פרי", en: "The cafe introduction pays off" },
        body: {
          he: "היא ענתה. יש עבודה קטנה בשבילך.",
          en: "She answered. There's small work for you."
        },
        choices: [
          { id: "ack", label: { he: "לוקחים את זה", en: "Take it" }, effects: { cash: 180, experience: 2 } }
        ]
      },
      {
        id: "festival_flight_opportunity",
        weight: 2, minDay: 25, cooldownDays: 30, tone: "good",
        requires: function (s) { return !!s.filmUnlocked; },
        headline: { he: "הזדמנות טיסה לפסטיבל", en: "A festival flight opportunity" },
        body: {
          he: "מחיר טיסה טוב, לוח זמנים צפוף, אולי שווה.",
          en: "A good flight price, a tight schedule, maybe worth it."
        },
        choices: [
          {
            id: "book_flight",
            label: { he: "תזמין/י טיסה · 300 ₪ · 3ש", en: "Book the flight · $300 · 3h" },
            cost: { cash: 300, hours: 3 },
            effects: { reputation: 10, creativity: 5 },
            result: { he: "עוד שם שמכיר את הפנים שלך.", en: "One more name that knows your face." }
          },
          {
            id: "skip_flight",
            label: { he: "תוותר/י הפעם · 0 ₪ · 0ש", en: "Skip it this time · $0 · 0h" },
            result: { he: "יהיה פסטיבל אחר.", en: "There will be another festival." }
          }
        ]
      },
      {
        id: "urgent_equipment_repair",
        weight: 2, minDay: 15, cooldownDays: 25, tone: "bad",
        requires: function (s) { return s.equipment && s.equipment.camera; },
        headline: { he: "תיקון דחוף לציוד", en: "Urgent equipment repair" },
        body: {
          he: "רעש מוזר מהמצלמה. לא הזמן הכי טוב, אבל מתי כן.",
          en: "A strange noise from the camera. Not the best time, but when is."
        },
        choices: [
          {
            id: "professional_repair",
            label: { he: "תתקן/י מיד במקצועי · 200 ₪ · 0ש", en: "Fix it professionally now · $200 · 0h" },
            cost: { cash: 200 },
            result: { he: "יקר, אבל שקט נפשי.", en: "Pricey, but peace of mind." }
          },
          {
            id: "diy_repair",
            label: { he: "תנסה/י לתקן לבד · 0 ₪ · 3ש", en: "Try fixing it yourself · $0 · 3h" },
            cost: { hours: 3 },
            effects: { creativity: 2 },
            result: { he: "זה עובד. בינתיים.", en: "It works. For now." }
          }
        ]
      },
      {
        id: "review_swings",
        weight: 2, minDay: 30, cooldownDays: 30, tone: "neutral",
        requires: function (s) { return s.projects && s.projects.some(function (p) { return p.released; }); },
        headline: { he: "ביקורת יצאה על ההפקה שלך", en: "A review of your production is out" },
        body: {
          he: "מישהו ישב וכתב עליך משפט שלם. לא כולם יסכימו איתו.",
          en: "Someone sat down and wrote a whole sentence about you. Not everyone will agree."
        },
        choices: [
          {
            id: "share_proudly",
            label: { he: "תשתף/י את הביקורת בגאווה · 0 ₪ · 0ש", en: "Share the review proudly · $0 · 0h" },
            effects: { reputation: 4, soul: -2 },
            result: { he: "עוד עיניים עליך. לא כולן ידידותיות.", en: "More eyes on you. Not all of them friendly." }
          },
          {
            id: "let_it_go",
            label: { he: "תתעלם/י ותתקדם/י · 0 ₪ · 0ש", en: "Let it go and move on · $0 · 0h" },
            effects: { soul: 2 },
            result: { he: "הביקורת נשארת שם. אתה כבר לא.", en: "The review stays there. You've already moved on." }
          }
        ]
      },
      {
        id: "quiet_recovery_day",
        weight: 3, minDay: 1, cooldownDays: 10, tone: "neutral",
        headline: { he: "יום שקט בעיר", en: "A quiet day in the city" },
        body: {
          he: "שום דבר לא בוער. אפשר סוף סוף לנשום.",
          en: "Nothing is on fire. You can finally breathe."
        },
        choices: [
          {
            id: "rest_up",
            label: { he: "תנצל/י את השקט לנוח · 0 ₪ · 0ש", en: "Use the quiet to rest · $0 · 0h" },
            effects: { soul: 5, creativity: 2 },
            result: { he: "מחר יהיה שוב עמוס. היום לא.", en: "Tomorrow will be busy again. Today isn't." }
          }
        ]
      },
      /* === follow-ups scheduled by the "First Pitch" moment (see pitchMoment below) === */
      {
        id: "pitch_followup_human",
        weight: 0, tone: "good",
        teaser: { he: "איש הקשר מהפיץ' האחרון אמור לחזור עם תשובה.", en: "The contact from your last pitch is due to write back." },
        headline: { he: "השיחה מהפיץ' חוזרת", en: "The pitch conversation comes back" },
        body: {
          he: "'בוא/י נדבר שוב,' כתב/ה. 'יש מישהו שכדאי שתכיר/י.'",
          en: "'Let's talk again,' they wrote. 'There's someone you should meet.'"
        },
        choices: [
          {
            id: "take_intro",
            label: { he: "לקחת את ההיכרות · 0 ₪ · 1ש", en: "Take the introduction · $0 · 1h" },
            cost: { hours: 1 },
            effects: { relationshipReputation: 4, experience: 4 },
            result: { he: "עוד שם ברשימת אנשי הקשר. עוד דלת פתוחה.", en: "Another name in your contacts. Another open door." }
          },
          {
            id: "stay_focused",
            label: { he: "להישאר ממוקד/ת בעבודה · 0 ₪ · 0ש", en: "Stay focused on the work · $0 · 0h" },
            effects: { soul: 2 },
            result: { he: "לא כל דלת צריכה להיפתח מיד.", en: "Not every door needs opening right away." }
          }
        ]
      },
      {
        id: "pitch_followup_vision",
        weight: 0, tone: "good",
        teaser: { he: "מישהו מהפיץ' האחרון ביקש moodboard.", en: "Someone from your last pitch asked for a moodboard." },
        headline: { he: "הבקשה ל-moodboard מגיעה", en: "The moodboard request arrives" },
        body: {
          he: "מייל קצר: 'תשלח/י לי משהו ויזואלי לפני שאני מציג/ה את זה הלאה.'",
          en: "A short email: 'send me something visual before I take this further.'"
        },
        choices: [
          {
            id: "send_moodboard",
            label: { he: "להרכיב moodboard · 0 ₪ · 2ש", en: "Put together a moodboard · $0 · 2h" },
            cost: { hours: 2 },
            effects: { artisticReputation: 4, creativity: 3 },
            result: { he: "שלחת עשר תמונות ומשפט אחד טוב. זה עבר הלאה.", en: "You sent ten images and one good sentence. It moved forward." }
          },
          {
            id: "skip_moodboard",
            label: { he: "לענות שאין זמן כרגע · 0 ₪ · 0ש", en: "Reply there's no time right now · $0 · 0h" },
            effects: { artisticReputation: -1 },
            result: { he: "היא הבינה. זה לא נעלם, זה רק מחכה.", en: "They understood. It didn't vanish, just waits." }
          }
        ]
      },
      {
        id: "pitch_followup_audience",
        weight: 0, tone: "good",
        teaser: { he: "מישהו מהפיץ' האחרון בודק תקציב עבורך.", en: "Someone from your last pitch is checking a budget for you." },
        headline: { he: "שיחת תקציב קצרה", en: "A short budget call" },
        body: {
          he: "'רק מספרים,' כתב/ה. 'בלי רגש. תתקשר/י כשנוח.'",
          en: "'Just numbers,' they wrote. 'No feelings. Call when it suits you.'"
        },
        choices: [
          {
            id: "take_call",
            label: { he: "לקיים את השיחה · 0 ₪ · 1ש", en: "Take the call · $0 · 1h" },
            cost: { hours: 1 },
            effects: { commercialReputation: 4, cash: 120 },
            result: { he: "יצאת עם מספר ראשוני וכיוון קר אבל אמיתי.", en: "You left with a first number and a cold but real direction." }
          },
          {
            id: "decline_call",
            label: { he: "לדחות לשבוע הבא · 0 ₪ · 0ש", en: "Push it to next week · $0 · 0h" },
            result: { he: "המספרים לא בורחים. הם רק מחכים בסבלנות.", en: "The numbers don't run away. They just wait." }
          }
        ]
      }
    ],

    /*
     * pitchMoment — the one-time "First Pitch" career milestone. Not part of
     * the daily-briefing pool: triggered explicitly by maybeTriggerPitch()
     * once the player has an active idea (filmTasks.have_idea), has met at
     * least one industry contact, and minDaysAfterIdea has passed. Rendered
     * by its own dedicated renderPitchWindow() screen, not the brief popup.
     * Each style's effects/result/followUpEventId follow the exact same
     * shape as a dailyEvents choice, so resolvePitchChoice() can reuse
     * applyBriefEffects()/pendingFollowUps unchanged.
     */
    pitchMoment: {
      id: "first_pitch",
      cost: { hours: 2 },
      requiredFilmTaskId: "have_idea",
      minDaysAfterIdea: 2,
      unlocksFilmTaskId: "treatment",
      title: { he: "פיץ' ראשון", en: "First Pitch" },
      contextTemplate: {
        he: "{npcName} הסכים/ה לשמוע. עשר דקות, לא יותר. הזדמנות חד־פעמית — היא לא תיפתח שוב.",
        en: "{npcName} agreed to listen. Ten minutes, no more. A one-time opportunity — it won't reopen."
      },
      styles: [
        {
          id: "human",
          label: { he: "הסיפור האנושי", en: "The Human Story" },
          tag: { he: "קשרים ורגש", en: "Connection & feeling" },
          preview: {
            he: "תספר/י למה זה חשוב לך באמת. עשוי להיקרא פחות מקצועי.",
            en: "Tell them why it actually matters to you. May read as less professional."
          },
          effects: { relationshipReputation: 6, reputation: 1, love: 2 },
          npcRelationshipDelta: 3,
          result: {
            he: "{npcName} הנמיך/ה את הטלפון. זה כבר משהו.",
            en: "{npcName} put the phone down. That's already something."
          },
          followUpEventId: "pitch_followup_human", followUpInDays: 2
        },
        {
          id: "vision",
          label: { he: "החזון הקולנועי", en: "The Cinematic Vision" },
          tag: { he: "כיוון אמנותי", en: "Artistic direction" },
          preview: {
            he: "תדבר/י על התמונה, לא על התקציב. עשוי להיקרא פחות מציאותי.",
            en: "Talk about the image, not the budget. May read as less grounded."
          },
          effects: { artisticReputation: 6, reputation: 1, creativity: 2 },
          npcRelationshipDelta: 1,
          result: {
            he: "{npcName} ביקש/ה moodboard. זה אומר שהיא זוכרת.",
            en: "{npcName} asked for a moodboard. That means they remember."
          },
          followUpEventId: "pitch_followup_vision", followUpInDays: 2
        },
        {
          id: "audience",
          label: { he: "הקהל והפוטנציאל", en: "The Audience & Potential" },
          tag: { he: "מסחור והפקה", en: "Commerce & production" },
          preview: {
            he: "תדבר/י מספרים ופלטפורמות. עשוי להיקרא פחות אישי.",
            en: "Talk numbers and platforms. May read as less personal."
          },
          effects: { commercialReputation: 6, reputation: 1 },
          npcRelationshipDelta: 1,
          result: {
            he: "{npcName} כתב/ה מספר על הנייר. תמיד סימן טוב.",
            en: "{npcName} wrote a number on the paper. Always a good sign."
          },
          followUpEventId: "pitch_followup_audience", followUpInDays: 3
        }
      ],
      skipResult: {
        he: "לא היום. ההזדמנות הזאת נסגרה — הבאה תגיע כשתגיע.",
        en: "Not today. This opportunity is closed — the next one arrives when it arrives."
      }
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
