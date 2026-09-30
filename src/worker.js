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

  const tokenJson = JSON.stringify({ token: access_token, provider: "github" });

  const html = `<!doctype html><html><body style="font:14px system-ui;padding:20px">
<p id="status">正在完成登录…</p>
<script>
(function () {
  var status = document.getElementById("status");
  var tokenJson = ${JSON.stringify(tokenJson)};

  if (!window.opener) {
    status.textContent = "错误：未找到登录窗口（window.opener 为空），请返回后台重新登录。";
    return;
  }

  var done = false;
  function receiveMessage(e) {
    if (done) return;
    done = true;
    window.opener.postMessage("authorization:github:success:" + tokenJson, e.origin);
    status.textContent = "登录成功，正在返回后台…";
    setTimeout(function () { window.close(); }, 400);
  }

  window.addEventListener("message", receiveMessage, false);
  status.textContent = "正在与后台握手…";
  window.opener.postMessage("authorizing:github", "*");

  setTimeout(function () {
    if (done) return;
    done = true;
    status.textContent = "握手超时，已直接回传登录信息。";
    window.opener.postMessage("authorization:github:success:" + tokenJson, "*");
    setTimeout(function () { window.close(); }, 400);
  }, 2500);
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}