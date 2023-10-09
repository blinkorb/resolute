declare module 'markdown-yaml-metadata-parser' {
  function parse(markdown: string): {
    metadata: Record<string, unknown>;
    content: string;
  };

  export default parse;
}
