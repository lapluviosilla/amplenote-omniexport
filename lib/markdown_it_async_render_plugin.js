/**
 * This plugin allows you to do some asynchronous processing between the parse and render steps of markdown-it
 * Current limitations of markdown-it only allow you to do synchronous processing within the parse and render rules.
 * This is the only way to do some processing pre-render asynchronously.
 */
export function asyncRenderPlugin(md) {
  /**
   * md.renderAsync(src, env, asyncCallback) -> Promise<String>
   * - src (String): source string
   * - env (Object): environment sandbox
   * - asyncCallback (Function): async function(tokens, env)
   *
   * Parses the markdown source, calls the asyncCallback with tokens and env,
   * waits for the promise to resolve, then renders the tokens.
   **/
  md.renderAsync = async function (src, env = {}, asyncCallback) {
    const tokens = md.parse(src, env);

    // Call the async callback with the tokens and env
    if (typeof asyncCallback === "function") {
      await asyncCallback(tokens, env);
    }

    return md.renderer.render(tokens, md.options, env);
  };
}
