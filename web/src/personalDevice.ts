import { Capacitor, registerPlugin } from "@capacitor/core";
export const personalNative = Capacitor.isNativePlatform();
export const PersonalDevice = registerPlugin<{
  requestNotifications(): Promise<{granted:boolean}>;
  status(options: {
    userId: string;
  }): Promise<{ available: boolean; enabled: boolean }>;
  authenticate(): Promise<void>;
  setLock(options: { userId: string; enabled: boolean }): Promise<void>;
  dictate(): Promise<{ text: string }>;
  saveBackup(options: { content: string; filename: string }): Promise<void>;
  reminders(options: { userId: string; items: any[] }): Promise<void>;
}>("PersonalDevice");
export async function dictate(): Promise<string> {
  if (personalNative) return (await PersonalDevice.dictate()).text;
  const Speech =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Speech)
    throw new Error(
      "Input suara belum didukung browser ini. Gunakan keyboard atau APK terbaru.",
    );
  return new Promise((resolve, reject) => {
    const recognition = new Speech();
    let finished = false;
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      finished = true;
      resolve(event.results[0][0].transcript);
    };
    recognition.onerror = () => {
      finished = true;
      reject(
        new Error(
          "Suara belum terbaca. Periksa izin mikrofon atau coba ketik.",
        ),
      );
    };
    recognition.onend = () => {
      if (!finished) reject(new Error("Tidak ada suara yang terbaca."));
    };
    recognition.start();
  });
}
