/** Keeps live workflow provisioning credentials out of the API's development env file. */
export function diditWorkflowApiKey(environment, env = process.env) {
  return (environment === "live" ? env.DIDIT_LIVE_API_KEY : env.DIDIT_SANDBOX_API_KEY)?.trim();
}

/** `node --env-file` loads a file into the environment, and a live key must never be in one. */
export function refuseEnvFileForLive(environment, execArgv = process.execArgv) {
  if (environment === "live" && execArgv.some((arg) => arg.startsWith("--env-file")))
    throw new Error("Live never reads an env file. Run it without --env-file and paste the key.");
}

/**
 * Asks for a value at the terminal without echoing it, so a pasted key shows
 * neither on screen nor in shell history. Enter finishes, Ctrl+C cancels.
 */
export function readHidden(prompt, input = process.stdin, output = process.stderr) {
  return new Promise((resolve, reject) => {
    if (!input.isTTY)
      return reject(new Error("No terminal to ask for the key in; run this in one."));
    let value = "";
    const finish = (error) => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const char of String(chunk)) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") return finish(new Error("Cancelled."));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    output.write(prompt);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.on("data", onData);
    input.resume();
  });
}
