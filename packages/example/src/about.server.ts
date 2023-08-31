import { RequestHandler } from '@blinkorb/resolute';

export interface AboutData {
  content: string;
}

export const getAboutData: RequestHandler<AboutData> = () => {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve({
        content: "Here's a little info about us",
      });
    }, 1000);
  });
};
