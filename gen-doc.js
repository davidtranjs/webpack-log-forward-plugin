const fs = require('node:fs');
const { marked } = require('marked');

const md = fs.readFileSync('README.md', 'utf8');
const htmlContent = marked(md);

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Webpack Log Forward Plugin - Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Documentation for Webpack Log Forward Plugin @davidtranjs/webpack-log-forward-plugin">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css" integrity="sha512-BrOPA520KmDMqieeM7XFe6a3u3Sb3F1JBaQnrIAmWg3EYrciJ+Qqe6ZcKCdfPv26rGcgTrJnZ/IdQEct8h3Zhw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>
    body {
      box-sizing: border-box;
      padding: 40px;
    }
    .markdown-body {
      max-width: 800px;
      margin: auto;
    }
  </style>
</head>
<body>
  <article class="markdown-body">
    ${htmlContent}
  </article>
</body>
</html>
`;

fs.writeFileSync('index.html', html);
