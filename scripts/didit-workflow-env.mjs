/** Keeps live workflow provisioning credentials out of the API's development env file. */
export function diditWorkflowApiKey(environment, env = process.env) {
  return (environment === "live" ? env.DIDIT_LIVE_API_KEY : env.DIDIT_SANDBOX_API_KEY)?.trim();
}
