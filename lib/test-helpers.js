import dotenv from "dotenv";
import { vi } from "vitest";
import fetch from "isomorphic-fetch";
import pluginObject from "./plugin";

dotenv.config();

// --------------------------------------------------------------------------------------
export const mockPlugin = () => {
  const plugin = pluginObject;
  global.fetch = fetch; // So tests can run "fetch" without importing this module & later fouling up esbuild

  // Whatever entry point/actions you will implement should be included in this array
  ["insertText", "noteOption", "replaceText"].forEach((entryPointKey) => {
    if (plugin[entryPointKey]) {
      Object.entries(plugin[entryPointKey]).forEach(([functionName, checkAndRunOrFunction]) => {
        if (checkAndRunOrFunction.check || checkAndRunOrFunction.run) {
          if (checkAndRunOrFunction.check) {
            plugin[entryPointKey][functionName].check =
              plugin[entryPointKey][functionName].check.bind(plugin);
          }
          if (checkAndRunOrFunction.run) {
            plugin[entryPointKey][functionName].run =
              plugin[entryPointKey][functionName].run.bind(plugin);
          }
        } else {
          plugin[entryPointKey][functionName] = plugin[entryPointKey][functionName].bind(plugin); // .insertText
        }
      });
    }
  });

  return plugin;
};

// --------------------------------------------------------------------------------------
export const mockAppWithContent = (noteContent, name = "Main Note", uuid = "uuid-1", tags = []) => {
  const note = mockNote(noteContent, name, uuid, tags);
  const app = mockApp(note);
  return { app, note };
};

// --------------------------------------------------------------------------------------
export const mockApp = (seedNote) => {
  const _storedNotes = [seedNote];
  const app = {};
  // Not part of Plugin API, but useful for tests
  app._storedNotes = () => {
    return _storedNotes;
  };
  app.alert = vi.fn().mockImplementation(async (text, options = {}) => {
    console.debug("Alert was called", text);
  });
  app.context = {};
  app.context.noteUUID = seedNote.uuid;
  app.context.replaceSelection = vi.fn();
  app.context.replaceSelection.mockImplementation(async (newContent, sectionObject = null) => {
    return await seedNote.replaceContent(newContent, sectionObject);
  });
  app.createNote = vi.fn();
  app.saveFile = vi.fn();
  app.getNoteContent = vi.fn().mockImplementation(async (noteHandle) => {
    const note = app.notes.find(noteHandle);
    if (note) {
      return note.body;
    } else {
      return null;
    }
  });
  app.insertNoteContent = vi
    .fn()
    .mockImplementation(async (noteHandle, content, { atEnd = false } = {}) => {
      if (atEnd) {
        seedNote.body += content;
      } else {
        seedNote.body = `${content}${seedNote.body}`;
      }
    });
  app.prompt = vi.fn().mockImplementation(async (text, options = {}) => {
    console.error("Prompting user", text, "You probably wanted to mock this so it would respond?");
  });
  app.navigate = vi.fn();
  app.notes = {};
  // Mock implementation of the `find` method
  app.notes.find = vi.fn().mockImplementation(async (query) => {
    if (typeof query === "string") {
      // If the query is a string, assume it's a UUID and search accordingly
      return _storedNotes.find((note) => note.uuid === query) || null;
    } else if (typeof query === "object" && query !== null) {
      // If the query is an object, iterate through its key-value pairs
      return (
        _storedNotes.find((note) => {
          // Use Object.entries to get [key, value] pairs from the query
          return Object.entries(query).every(([key, value]) => {
            if (Array.isArray(value)) {
              // If the query value is an array, ensure the note's property is also an array
              // and that it includes all elements from the query array
              return Array.isArray(note[key]) && value.every((v) => note[key].includes(v));
            } else {
              // For primitive values, perform a direct comparison
              return note[key] === value;
            }
          });
        }) || null
      );
    }

    // If the query is neither a string nor a valid object, return null
    return null;
  });
  app.notes.filter = app.filterNotes = vi.fn().mockResolvedValue(null);
  app.notes.create = vi.fn().mockImplementation(async (name = "", tags = []) => {
    const newNote = mockNote("", name, "uuid-" + (_storedNotes.length + 1), tags);
    _storedNotes.push(newNote);
    return newNote;
  });
  app.notes.delete = app.deleteNote = vi.fn().mockImplementation(async (noteHandle) => {
    _storedNotes = _storedNotes.filter((note) => (note.uuid = noteHandle.uuid));
  });
  app.replaceNoteContent = vi
    .fn()
    .mockImplementation(async (noteHandle, content, { section = null } = {}) => {
      if (section) {
        console.error("Todo: Implement section replacement in mockApp.replaceNoteContent");
      }
      seedNote.body = content;
    });
  app.settings = {};

  if (seedNote) {
    const noteFunction = vi.fn();
    // Mock implementation of noteFunction
    noteFunction.mockImplementation((noteHandle) => {
      // **1. Type Checking:** Ensure noteHandle is a non-null object or a string
      if (typeof noteHandle === "object" && noteHandle !== null) {
        // **2. Object Matching:** Find a storedNote that matches all key/value pairs using isDeepMatch
        return _storedNotes.find((note) => isDeepMatch(note, noteHandle));
      }
      // **3. String Matching:** If noteHandle is a string, check against seedNote.uuid and storedNotes
      else if (typeof noteHandle === "string") {
        if (noteHandle === seedNote.uuid) {
          return seedNote;
        }
        return _storedNotes.find((note) => note.uuid === noteHandle);
      }
      // **4. Fallback Handling:** If noteHandle is neither object nor string, return undefined
      else {
        return undefined;
      }
    });
    // const getContent = vi.fn();
    // getContent.mockImplementation((noteHandle) => {
    //   if (noteHandle.uuid === seedNote.uuid) {
    //     return seedNote.content();
    //   }
    //   return null;
    // });

    app.findNote = noteFunction;
    app.notes.find = noteFunction;
    // app.getNoteContent = getContent;
  }

  return app;
};

// --------------------------------------------------------------------------------------
// Call this in order to accept the default option in an alert that would be shown to user
export function mockAlertAccept(app) {
  app.alert = vi.fn();
  app.alert.mockImplementation(async (text, options) => {
    if (!options) return null;
    return -1;
  });
}

// --------------------------------------------------------------------------------------
export const mockNote = (content, name, uuid, tags = []) => {
  const note = {};
  note.body = content;
  note.name = name;
  note.uuid = uuid;
  note.tags = tags;
  note.url = async () => {
    return `https://www.amplenote.com/notes/${uuid}`;
  };
  note.content = () => note.body;

  // --------------------------------------------------------------------------------------
  note.insertContent = async (newContent, options = {}) => {
    if (options.atEnd) {
      note.body += newContent;
    } else {
      note.body = `${note.body}\n${newContent}`;
    }
  };

  // --------------------------------------------------------------------------------------
  note.replaceContent = async (newContent, sectionObject = null) => {
    if (sectionObject) {
      const sectionHeadingText = sectionObject.section.heading.text;
      let throughLevel = sectionObject.section.heading?.level;
      if (!throughLevel) throughLevel = sectionHeadingText.match(/^#*/)[0].length;
      if (!throughLevel) throughLevel = 1;

      const indexes = Array.from(note.body.matchAll(/^#+\s*([^#\n\r]+)/gm));
      const sectionMatch = indexes.find((m) => m[1].trim() === sectionHeadingText.trim());
      let startIndex, endIndex;
      if (!sectionMatch) {
        throw new Error(
          `Could not find section ${sectionHeadingText} that was looked up. This might be expected`
        );
      } else {
        const level = sectionMatch[0].match(/^#+/)[0].length;
        const nextMatch = indexes.find(
          (m) => m.index > sectionMatch.index && m[0].match(/^#+/)[0].length <= level
        );
        endIndex = nextMatch ? nextMatch.index : note.body.length;
        startIndex = sectionMatch.index + sectionMatch[0].length + 1;
      }

      if (Number.isInteger(startIndex)) {
        const revisedContent = `${note.body.slice(
          0,
          startIndex
        )}${newContent.trim()}\n${note.body.slice(endIndex)}`;
        note.body = revisedContent;
      } else {
        throw new Error(
          `Could not find section ${sectionObject.section.heading.text} in note ${note.name}`
        );
      }
    } else {
      note.body = newContent;
      return true;
    }
  };

  // --------------------------------------------------------------------------------------
  note.sections = async () => {
    const headingMatches = note.body.matchAll(/^#+\s*([^\n]+)/gm);
    return Array.from(headingMatches).map((match) => ({
      anchor: match[1].replace(/\s/g, "_"),
      level: /^#+/.exec(match[0]).length,
      text: match[1],
    }));
  };
  return note;
};

/**
 * Recursively checks if all properties in source are present and equal in target.
 *
 * @param {any} target - The object to be checked against.
 * @param {any} source - The object containing the properties to match.
 * @returns {boolean} - True if target matches all properties in source, else false.
 */
function isDeepMatch(target, source) {
  // If source is null or undefined, perform strict equality
  if (source === null || source === undefined) {
    return target === source;
  }

  // If source is an array, target must also be an array with the same length and elements
  if (Array.isArray(source)) {
    if (!Array.isArray(target) || target.length !== source.length) {
      return false;
    }
    return source.every((item, index) => isDeepMatch(target[index], item));
  }

  // If source is an object, target must also be an object
  if (typeof source === "object") {
    if (typeof target !== "object" || target === null) {
      return false;
    }

    // Iterate through each key in source
    return Object.keys(source).every((key) => {
      // Ensure the key exists in target
      if (!target.hasOwnProperty(key)) {
        return false;
      }

      // Recursively check for deep match
      return isDeepMatch(target[key], source[key]);
    });
  }

  // For all other types (string, number, boolean, etc.), perform strict equality
  return target === source;
}
