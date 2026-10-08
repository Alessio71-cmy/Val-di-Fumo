import { describe, expect, it } from 'vitest';
import { detectPlatform, isIosSafari } from '../../src/offline/install';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('rilevamento della piattaforma per le istruzioni di installazione', () => {
  it('iPhone Safari: iOS, può installare', () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe('ios');
    expect(isIosSafari(UA.iphoneSafari)).toBe(true);
  });
  it('browser alternativi su iPhone: l’installazione dipende dalla versione di iOS e l’interfaccia consiglia Safari', () => {
    for (const ua of [UA.iphoneChrome, UA.iphoneFirefox]) {
      expect(detectPlatform(ua)).toBe('ios');
      expect(isIosSafari(ua)).toBe(false);
    }
  });
  it('iPad in modalità "sito desktop" si presenta come Mac ma ha il touch', () => {
    expect(detectPlatform(UA.ipadDesktopMode, 5)).toBe('ios');
    expect(detectPlatform(UA.ipadDesktopMode, 0)).toBe('desktop');
  });
  it('Android e desktop', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('android');
    expect(detectPlatform(UA.windowsChrome)).toBe('desktop');
    expect(detectPlatform('qualcosa di sconosciuto')).toBe('other');
  });
});
