import { createAPI, GetPropsResult, Link } from '@blinkorb/resolute';
import React from 'react';

const fetch = createAPI<typeof import('./index.api.js')>('/');

export const getProps = () => fetch('get');

export const title = 'Home';

const Home = ({ about, events }: GetPropsResult<typeof getProps>) => {
  return (
    <>
      <h1>Home</h1>
      <p>{about.content}</p>
      <ol>
        {events.results.map((event) => (
          <li key={event.slug}>
            <h2>
              <Link href={`/events/${event.slug}`}>{event.title}</Link>
            </h2>
            <p>{event.date}</p>
          </li>
        ))}
      </ol>
      {events.count > events.results.length && (
        <p>
          <Link href="/events">View all events</Link>
        </p>
      )}
    </>
  );
};

export default Home;
