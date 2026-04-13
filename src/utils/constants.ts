export const LOCALE_HEBREW = 'he-IL';
export const TTS_RATE = 0.9;
export const TTS_PITCH = 1.0;
export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const MAX_NOTIFICATIONS_BUFFER = 50;
export const MAX_CONVERSATION_LOG = 100;

export const INTENT_PARSER_PROMPT = `אתה מנתח פקודות קוליות בעברית. תפקידך לפרש פקודות בעברית ולהחזיר JSON בלבד, ללא הסבר.

החזר אובייקט JSON עם המבנה הבא:
{
  "intent": "<סוג_הפעולה>",
  "contact": "<שם_איש_הקשר או null>",
  "message": "<תוכן_ההודעה או null>",
  "appName": "<שם_האפליקציה או null>",
  "reminderText": "<תוכן_התזכורת או null>",
  "reminderTime": "<זמן_התזכורת או null>",
  "count": <מספר_ההודעות_לקריאה_או_null — 1 אם ביקשו הודעה אחת/אחרונה, 5 אם ביקשו הודעות ברבים, null אחרת>
}

סוגי פעולות אפשריים: SEND_SMS, READ_SMS, MAKE_CALL, SEND_WHATSAPP, READ_WHATSAPP, READ_NOTIFICATIONS, SET_REMINDER, OPEN_APP, UNKNOWN

חשוב לגבי SEND_WHATSAPP: הוצא מה-message רק את תוכן ההודעה עצמה. הסר פעלי פקודה (תשלח, תרשום, תכתוב, תגיד), מילות קישור (ש-, שאני, שהוא), ושמות פונים (שלום X). השאר אך ורק את מה שצריך להישלח.

חשוב לגבי SET_REMINDER: הפרד בין תוכן התזכורת (reminderText) לבין ביטוי הזמן (reminderTime).
- reminderText הוא מה שצריך לזכור (הפעולה/האירוע).
- reminderTime הוא מתי להזכיר (ביטוי הזמן בעברית, כולל "בעוד X דקות", "מחר בשעה Y", "ביום Z", "בערב" וכו').
- אם לא צוין זמן מפורש, reminderTime צריך להיות null.
- כשהמשתמש שואל לראות/להציג/לבדוק תזכורות (ולא ליצור חדשה), החזר SET_REMINDER עם reminderText: null ו-reminderTime: null.

דוגמאות:
1. "שלח הודעה לאמא שאני בדרך" -> {"intent":"SEND_SMS","contact":"אמא","message":"אני בדרך","appName":null,"reminderText":null,"reminderTime":null,"count":null}
2. "תתקשר לדוד יוסי" -> {"intent":"MAKE_CALL","contact":"דוד יוסי","message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":null}
3. "תקרא לי את ההודעות" -> {"intent":"READ_SMS","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":5}
4. "תקרא את ההודעה האחרונה שלי" -> {"intent":"READ_SMS","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":1}
5. "שלח וואטסאפ לאבא שאני מאחר" -> {"intent":"SEND_WHATSAPP","contact":"אבא","message":"אני מאחר","appName":null,"reminderText":null,"reminderTime":null,"count":null}
6. "תשלחי הודעה לאמא שאני בדרך" -> {"intent":"SEND_WHATSAPP","contact":"אמא","message":"אני בדרך","appName":null,"reminderText":null,"reminderTime":null,"count":null}
7. "תרשום לבנימין מה קורה" -> {"intent":"SEND_WHATSAPP","contact":"בנימין","message":"מה קורה","appName":null,"reminderText":null,"reminderTime":null,"count":null}
8. "אפשר לשלוח בוואטסאפ למיכל שאני מאחרת?" -> {"intent":"SEND_WHATSAPP","contact":"מיכל","message":"אני מאחרת","appName":null,"reminderText":null,"reminderTime":null,"count":null}
9. "תגיד לאבא שאני בדרך הביתה" -> {"intent":"SEND_WHATSAPP","contact":"אבא","message":"אני בדרך הביתה","appName":null,"reminderText":null,"reminderTime":null,"count":null}
10. "שלום בנימין מה המצב אני באמצע נהיגה אני לא יכול לדבר תרשום לי אני קורא" -> {"intent":"SEND_WHATSAPP","contact":"בנימין","message":"מה המצב אני באמצע נהיגה אני לא יכול לדבר אני קורא","appName":null,"reminderText":null,"reminderTime":null,"count":null}
11. "מה ההתראות שלי" -> {"intent":"READ_NOTIFICATIONS","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":null}
12. "תפתח וויז" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"וויז","reminderText":null,"reminderTime":null,"count":null}
12a. "תפתחי את הוואטסאפ" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"וואטסאפ","reminderText":null,"reminderTime":null,"count":null}
12b. "הפעל לי מצלמה" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"מצלמה","reminderText":null,"reminderTime":null,"count":null}
12c. "בבקשה תיכנס לביט" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"ביט","reminderText":null,"reminderTime":null,"count":null}
12d. "אפשר לפתוח את הנטפליקס" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"נטפליקס","reminderText":null,"reminderTime":null,"count":null}
12e. "תעביר אותי לגוגל מפות" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"גוגל מפות","reminderText":null,"reminderTime":null,"count":null}
12f. "תדליקי את הפנס" -> {"intent":"OPEN_APP","contact":null,"message":null,"appName":"פנס","reminderText":null,"reminderTime":null,"count":null}
13. "תזכיר לי בעוד שעה לקנות חלב" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לקנות חלב","reminderTime":"בעוד שעה","count":null}
14. "שים לי תזכורת בעוד עשרים דקות לצאת מהבית" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לצאת מהבית","reminderTime":"בעוד עשרים דקות","count":null}
15. "אל תתן לי לשכוח לקנות חלב בערב" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לקנות חלב","reminderTime":"בערב","count":null}
16. "תזכירי לי מחר בשעה שמונה בבוקר להתקשר לרופא" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"להתקשר לרופא","reminderTime":"מחר בשעה שמונה בבוקר","count":null}
17. "בבקשה תקבעי לי תזכורת ביום ראשון לשלם חשבון חשמל" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לשלם חשבון חשמל","reminderTime":"ביום ראשון","count":null}
18. "רשום לי תזכורת לקנות מתנה ליום הולדת של אמא" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לקנות מתנה ליום הולדת של אמא","reminderTime":null,"count":null}
19. "תזכיר לי בעוד חצי שעה שצריך להוציא את הכביסה" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"צריך להוציא את הכביסה","reminderTime":"בעוד חצי שעה","count":null}
20. "אל תשכחי להזכיר לי מחרתיים על הפגישה עם הרופא" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"הפגישה עם הרופא","reminderTime":"מחרתיים","count":null}
21. "תתריע לי בשעה 8 בערב שיש משחק כדורגל" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"יש משחק כדורגל","reminderTime":"בשעה 8 בערב","count":null}
22. "אפשר להזכיר לי בעוד שעתיים לקחת תרופה" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לקחת תרופה","reminderTime":"בעוד שעתיים","count":null}
23. "תעשה לי תזכורת ב-15:30 לאסוף את הילדים" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לאסוף את הילדים","reminderTime":"ב-15:30","count":null}
24. "איזה תזכורות יש לי" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":null}
25. "תראה לי את התזכורות שלי" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":null}
26. "יש לי תזכורות?" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":null,"reminderTime":null,"count":null}

החזר ONLY JSON בלי שום טקסט נוסף.

הפקודה לניתוח:
`;
