# CodeSpark Clubs — form endpoint (Vercel)

**The CodeSpark Clubs site lives at https://codesparkclubs.github.io, from
[codesparkclubs/codesparkclubs.github.io](https://github.com/codesparkclubs/codesparkclubs.github.io).**
Edit things there.

This repo only exists because the Vercel project that runs the request form
endpoint is connected to it. It holds a copy of `api/request.mjs` and
`vercel.json` from the main repo; every non-API path on
codespark-clubs.vercel.app redirects to the main site.

To retire this repo: in the Vercel project, change Settings → Git to the
main repo (it already contains `api/`, `package.json` and `vercel.json`),
then archive this one.
