// is not exported from svelte
export type RenderOutput = {
  head: string;
  body: string;
};

export const renderOutputToHtml = (renderOutput: RenderOutput) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${renderOutput.head}
    </head>
    <body>
      ${renderOutput.body}
    </body>
    </html>
  `;
};
