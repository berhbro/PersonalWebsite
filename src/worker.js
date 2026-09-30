export default {
  async fetch(request, env) {
    if (request.method === "GET" || request.method === "HEAD") {
      const url = new URL(request.url);

      if (url.pathname === "/api/auth") {
        return startOAuth(env);
      }
      if (url.pathname === "/api/auth/callback") {
        return handleOAuthCallback(request, env);
      }
    }

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

function startOAuth(env) {
  const state = crypto.randomUUID();
  const url = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user&state=${state}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("Cookie") || "";
  const storedState = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];

  if (!state || !storedState || state !== storedState) {
    return new Response("Invalid state parameter", { status: 403 });
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await res.json();
  const { access_token } = data;

  if (!access_token) {
    const debug = new Response(
      `<h3>OAuth callback</h3><p>GitHub returned an error instead of an access token:</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
    return debug;
  }

  const html = `<script>
  if (window.opener) {
    window.opener.postMessage('authorization:github:success:${JSON.stringify({
      token: access_token,
      provider: "github",
    })}', window.location.origin);
  }
  setTimeout(() => window.close(), 500);
</script>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}