// CloudFront Function (runtime: cloudfront-js-2.0), viewer request, default behaviour only.
//
// The React app uses client-side routing: /invoices/42 isn't a file in S3.
// Anything without a file extension is served index.html, and React Router
// takes it from there. Real files (/assets/app-1a2b.js, /favicon.svg) pass through.
//
// This is used instead of CloudFront "custom error responses", which apply to the
// whole distribution and would turn the API's JSON 404s into index.html.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split('/').pop();

  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }

  return request;
}
