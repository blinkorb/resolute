import { RequestHandler } from '@blinkorb/resolute';

import { AboutData as AboutData, getAboutData } from './about.api.js';

export interface Event {
  slug: string;
  title: string;
  date: string;
}

export interface AboutAndRecentEventsData {
  about: AboutData;
  events: {
    results: readonly Event[];
    count: number;
    offset: number;
    limit: number;
  };
}

export const get: RequestHandler<AboutAndRecentEventsData> = async () => {
  const about = await getAboutData();

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve({
        about,
        events: {
          results: [
            {
              slug: 'event-1',
              title: 'Our First Event',
              date: '2000-01-01',
            },
            {
              slug: 'another-event',
              title: 'The Second Event',
              date: '2001-01-01',
            },
            {
              slug: 'the-middlemost-event',
              title: 'Event #3',
              date: '2002-01-01',
            },
          ],
          count: 5,
          offset: 0,
          limit: 1,
        },
      });
    }, 1000);
  });
};
