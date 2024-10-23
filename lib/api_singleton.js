// AppInterfaceSingleton.js

let appInterface = null;

/**
 * Sets the application interface into a singleton function
 * @param {Object} api - The app plugin API object.
 * @throws Will throw an error if the app interface is already set.
 */
export function setAppInterface(api) {
  if (typeof api !== "object" || api === null) {
    throw new TypeError("App interface must be a non-null object.");
  }
  appInterface = api;
}

/**
 * Retrieves the application interface from the singleton variable
 * @returns {Object} The app plugin API object.
 * @throws Will throw an error if the app interface has not been set.
 */
export function getAppInterface() {
  if (!appInterface) {
    throw new Error("App interface has not been set yet.");
  }
  return appInterface;
}
