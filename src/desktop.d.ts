export {};

declare global {
  interface Window {
    desktopApp?: {
      isDesktop: boolean;
      platform?: string;
    };
  }
}
