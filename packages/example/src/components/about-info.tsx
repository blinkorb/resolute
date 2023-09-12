import React from 'react';

const AboutInfo = ({ title, content }: { title: string; content: string }) => {
  return (
    <>
      <h1>{title}</h1>
      <p>{content}</p>
    </>
  );
};

export default AboutInfo;
