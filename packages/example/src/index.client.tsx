import { createAPI, GetPropsResult } from '@blinkorb/resolute';
import React from 'react';

const fetch =
  createAPI<typeof import('./index.server.js')>('./index.server.js');

export const getProps = () => fetch('get');

export const title = 'Home';

const Home = ({ about, events }: GetPropsResult<typeof getProps>) => {
  return (
    <>
      <h1>About</h1>
      <p>{about.content}</p>
      <ol>
        {events.results.map((event) => (
          <li key={event.slug}>
            <h2>
              <a href={`/events/${event.slug}`}>{event.title}</a>
            </h2>
            <p>{event.date}</p>
          </li>
        ))}
      </ol>
      {events.count > events.results.length && (
        <p>
          <a href="/events">View all events</a>
        </p>
      )}
    </>
  );
};

export default Home;
