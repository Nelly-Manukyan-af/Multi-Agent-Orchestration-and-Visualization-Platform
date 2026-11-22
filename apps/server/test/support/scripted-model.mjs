// Loaded only in test server processes. All model requests stay in this process.
let calls = 0;
const scenario = process.env.SCRIPTED_MODEL_SCENARIO;
const encoder = new TextEncoder();

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url !== "http://scripted-model.test/api/chat") {
    throw new Error("The scripted model blocks unexpected outbound requests");
  }
  options.signal?.throwIfAborted();
  calls++;
  console.log(`Scripted model request ${calls}`);
  if (scenario === "hung") return new Promise(() => {});
  if (scenario === "failure" || (scenario === "retry" && calls === 1)) {
    return new Response("Scripted temporary failure", { status: 503 });
  }

  const partial = scenario === "stream";
  const text = partial ? "Partial response" : scenario === "loop" ? "Repeated answer" : `Reply ${calls}`;
  return new Response(new ReadableStream({
    start(controller) {
      const send = (chunk) => controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      if (!(scenario === "empty" && calls === 1)) {
        for (const piece of [text.slice(0, 4), text.slice(4)]) {
          send({ message: { content: piece }, done: false });
        }
      }
      if (partial) {
        options.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      } else {
        send({ done: true, prompt_eval_count: 7, eval_count: 11, total_duration: 1000000 });
        controller.close();
      }
    },
  }));
};
