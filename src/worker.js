export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const url = new URL(request.url);

    if (url.pathname.includes(".")) {
      return response;
    }

    const indexUrl = new URL(url);
    indexUrl.pathname = `${url.pathname.replace(/\/$/, "")}/index.html`;

    const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));

    if (indexResponse.status !== 404) {
      return indexResponse;
    }

    return response;
  },
};
