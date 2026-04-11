import { NativeModules } from 'react-native';

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
}

interface SmsModuleInterface {
  /** Read up to maxCount messages from the inbox, newest first. */
  readInbox(maxCount: number): Promise<SmsMessage[]>;
  /** Send an SMS. Resolves with true on success. */
  sendSms(phoneNumber: string, message: string): Promise<boolean>;
}

const SmsBridge: SmsModuleInterface | null = NativeModules.SmsModule ?? null;

export default SmsBridge;
