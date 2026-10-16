import { defineContentScript } from 'wxt/utils/define-content-script';
/** Observe only the submission endpoint. Never intercept credentials, GraphQL traffic, or other browsing. */
export default defineContentScript({
  matches: ['https://leetcode.com/problems/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const channel = 'dsacommit:submission:v2';
    const emit = (payload: Record<string, unknown>) =>
      window.postMessage({ channel, ...payload }, location.origin);
    function submission(url: string, method: string, body: unknown) {
      try {
        const u = new URL(url, location.href);
        const match = u.pathname.match(/^\/problems\/([a-z0-9-]+)\/submit\/$/);
        if (
          u.origin !== location.origin ||
          method.toUpperCase() !== 'POST' ||
          !match ||
          typeof body !== 'string'
        )
          return null;
        const b = JSON.parse(body);
        if (
          typeof b.typed_code !== 'string' ||
          b.typed_code.length > 200_000 ||
          typeof b.lang !== 'string'
        )
          return null;
        const requestId = crypto.randomUUID();
        emit({
          kind: 'start',
          requestId,
          slug: match[1],
          code: b.typed_code,
          language: b.lang,
          submittedAt: new Date().toISOString(),
        });
        return requestId;
      } catch {
        return null;
      }
    }
    function received(requestId: string, raw: unknown) {
      const r = raw as { submission_id?: unknown };
      if (r && /^\d{1,20}$/.test(String(r.submission_id)))
        emit({ kind: 'identified', requestId, submissionId: String(r.submission_id) });
    }
    const original = window.fetch;
    window.fetch = async function (input, init) {
      let id: string | null = null;
      try {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        const u = new URL(url, location.href);
        if (
          u.origin !== location.origin ||
          method.toUpperCase() !== 'POST' ||
          !/^\/problems\/[a-z0-9-]+\/submit\/$/.test(u.pathname)
        )
          return original.call(this, input, init);
        const body =
          init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
        id = submission(url, method, body);
      } catch {
        /* Page request must still run unchanged. */
      }
      const response = await original.call(this, input, init);
      if (id)
        void response
          .clone()
          .json()
          .then((data) => received(id!, data))
          .catch(() => {});
      return response;
    };
    const open = XMLHttpRequest.prototype.open,
      send = XMLHttpRequest.prototype.send;
    const requests = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      requests.set(this, { method, url: String(url) });
      return (open as Function).apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (body) {
      const request = requests.get(this);
      const id = request ? submission(request.url, request.method, body) : null;
      if (id)
        this.addEventListener(
          'load',
          () => {
            try {
              received(
                id,
                this.responseType === 'json' ? this.response : JSON.parse(this.responseText),
              );
            } catch {}
          },
          { once: true },
        );
      return send.call(this, body);
    };
  },
});
