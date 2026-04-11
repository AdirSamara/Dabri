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
13. "תזכיר לי בעוד שעה לקנות חלב" -> {"intent":"SET_REMINDER","contact":null,"message":null,"appName":null,"reminderText":"לקנות חלב","reminderTime":"בעוד שעה","count":null}

החזר ONLY JSON בלי שום טקסט נוסף.

הפקודה לניתוח:
`;
