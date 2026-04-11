
declare module 'react-native-sms' {
  interface SmsOptions {
    body: string;
    recipients: string[];
  }
  type SmsCompletedCallback = (completed: boolean, cancelled: boolean, error: string) => void;
  const SendSMS: {
    send(options: SmsOptions, completed: SmsCompletedCallback): void;
  };
  export default SendSMS;
}
